import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InsightsInput = {
  restaurantId: string;
  days: number;
  /** Manager-supplied context */
  goal: string;
  challenges: string;
  marketingSpend: number;
  staffCount: number;
  notes: string;
};

export type InsightsResult = {
  metrics: {
    orders: number;
    revenue: number;
    completed: number;
    cancelled: number;
    aov: number;
    completionRate: number;
    delivery: number;
    pickup: number;
    busiestHour: number | null;
    topItems: { name: string; quantity: number; revenue: number }[];
  };
  recommendations: string;
  generatedAt: string;
};

async function readResponsesStream(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed" && event.response?.output_text) {
          if (!text) text = event.response.output_text;
        }
      } catch {
        // ignore keep-alive / non-JSON frames
      }
    }
  }
  return text.trim();
}

/**
 * Builds real performance metrics from the restaurant's own orders, combines them with
 * the manager's own context, and asks the AI model for tailored recommendations.
 */
export const performanceInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InsightsInput) => {
    if (!input?.restaurantId) throw new Error("Missing restaurant");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: membership, error: memberError } = await context.supabase
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", data.restaurantId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membership || (membership.role !== "owner" && membership.role !== "manager")) {
      throw new Error("Forbidden");
    }

    const days = Math.min(Math.max(Math.round(data.days || 30), 1), 180);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error: ordersError } = await context.supabase
      .from("orders")
      .select("id,total,status,fulfillment,placed_at")
      .eq("restaurant_id", data.restaurantId)
      .gte("placed_at", since)
      .order("placed_at", { ascending: false })
      .limit(2000);
    if (ordersError) throw ordersError;

    const rows = orders ?? [];
    const completedRows = rows.filter((o) => o.status === "completed");
    const revenue = completedRows.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const cancelled = rows.filter((o) => o.status === "cancelled" || o.status === "rejected").length;
    const hourCounts = new Map<number, number>();
    for (const o of rows) {
      const hour = new Date(o.placed_at).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
    const busiestHour =
      [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const { data: items, error: itemsError } = await context.supabase
      .from("order_items")
      .select("name,quantity,total_price,order_id")
      .eq("restaurant_id", data.restaurantId)
      .in(
        "order_id",
        rows.slice(0, 500).map((o) => o.id),
      )
      .limit(3000);
    if (itemsError) throw itemsError;

    const itemTotals = new Map<string, { quantity: number; revenue: number }>();
    for (const item of items ?? []) {
      const entry = itemTotals.get(item.name) ?? { quantity: 0, revenue: 0 };
      entry.quantity += Number(item.quantity ?? 0);
      entry.revenue += Number(item.total_price ?? 0);
      itemTotals.set(item.name, entry);
    }
    const topItems = [...itemTotals.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const metrics: InsightsResult["metrics"] = {
      orders: rows.length,
      revenue: Math.round(revenue),
      completed: completedRows.length,
      cancelled,
      aov: completedRows.length ? Math.round(revenue / completedRows.length) : 0,
      completionRate: rows.length ? Math.round((completedRows.length / rows.length) * 100) : 0,
      delivery: rows.filter((o) => o.fulfillment === "delivery").length,
      pickup: rows.filter((o) => o.fulfillment === "pickup").length,
      busiestHour,
      topItems,
    };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "You advise independent restaurant managers in South Africa (currency: South African Rand, written as R1 234).",
                  "You receive real order metrics from the last period plus the manager's own context.",
                  "Reply in plain markdown with these sections: '## What stands out', '## Recommendations' (4-6 numbered, specific, each with the expected impact), '## Watch next week' (3 bullets).",
                  "Be concrete, reference the actual numbers, and keep it under 350 words. Never invent data that was not provided. Recommendations are advice, not guarantees.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  periodDays: days,
                  metrics,
                  managerContext: {
                    goal: data.goal,
                    challenges: data.challenges,
                    monthlyMarketingSpendRand: data.marketingSpend,
                    staffCount: data.staffCount,
                    notes: data.notes,
                  },
                }),
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("The AI service is busy. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are used up. Top up to keep using recommendations.");
      throw new Error("Couldn't generate recommendations right now. Please try again.");
    }

    const recommendations = await readResponsesStream(res);
    if (!recommendations) throw new Error("The model returned no recommendations. Please try again.");

    return {
      metrics,
      recommendations,
      generatedAt: new Date().toISOString(),
    } satisfies InsightsResult;
  });
