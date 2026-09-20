import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PricingInput = {
  basePrice: number;
  minimumPrice: number;
  maxDiscountPct: number;
  contractMonths: number;
  upfrontDiscountPct: number;
  branchCount: number;
  restaurantSize: string;
  orderVolume: number;
  attempts: number;
  currentOffer: number;
  discountReason: string;
};

/**
 * Advisory only. Returns a recommended negotiation range and explanation.
 * It never finalises a contract or a payment — a human must approve any final offer.
 */
export const recommendPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PricingInput) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_platform_admin", {
      _user_id: context.userId,
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Error("Forbidden");

    const floor = Math.max(
      data.minimumPrice,
      data.basePrice * (1 - Math.min(data.maxDiscountPct, 100) / 100),
    );
    const contractLever = Math.min(data.contractMonths / 12, 2) * 0.05;
    const upfrontLever = Math.min(data.upfrontDiscountPct, 20) / 100;
    const volumeLever = data.orderVolume > 2000 ? 0.05 : data.orderVolume > 500 ? 0.03 : 0;
    const branchLever = Math.min(data.branchCount, 10) * 0.005;
    const totalLever = Math.min(contractLever + upfrontLever + volumeLever + branchLever, 0.3);
    const suggested = Math.max(floor, Math.round(data.basePrice * (1 - totalLever)));

    let explanation =
      `Floor is R${floor.toFixed(0)} from the minimum price and maximum discount. ` +
      `Contract length, upfront payment, order volume and branch count justify about ` +
      `${Math.round(totalLever * 100)}% off list.`;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.8-flash",
            messages: [
              {
                role: "system",
                content:
                  "You advise a B2B SaaS sales team on restaurant subscription pricing in South African Rand. Be concise (max 90 words). Never promise or finalise a deal; recommendations are advisory and require human approval.",
              },
              {
                role: "user",
                content: JSON.stringify({ ...data, computedFloor: floor, computedSuggestion: suggested }),
              },
            ],
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const text = body.choices?.[0]?.message?.content;
          if (text) explanation = text.trim();
        }
      } catch {
        // Keep the deterministic explanation if the AI service is unavailable.
      }
    }

    return {
      floor: Math.round(floor),
      suggested,
      rangeLow: Math.round(floor),
      rangeHigh: Math.round(data.basePrice),
      counterOffer: Math.max(floor, Math.round((suggested + data.currentOffer) / 2)),
      explanation,
      humanApprovalRequired: true as const,
    };
  });
