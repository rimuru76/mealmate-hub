import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LineChart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currency, timeAgo } from "@/lib/format";
import { performanceInsights, type InsightsResult } from "@/lib/insights.functions";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Performance insights — MealMate Partners" },
      {
        name: "description",
        content: "Personalised recommendations built from your own sales and order data.",
      },
      { property: "og:title", content: "Performance insights — MealMate Partners" },
      {
        property: "og:description",
        content: "Turn your sales and order history into practical next steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
});

const PERIODS = [7, 30, 90] as const;

function InsightsPage() {
  const { restaurant, isManager } = useWorkspace();
  const run = useServerFn(performanceInsights);
  const [days, setDays] = useState<number>(30);
  const [goal, setGoal] = useState("");
  const [challenges, setChallenges] = useState("");
  const [marketingSpend, setMarketingSpend] = useState("0");
  const [staffCount, setStaffCount] = useState("5");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InsightsResult | null>(null);

  if (!isManager) {
    return (
      <div className="pb-8">
        <PageHeader title="Performance insights" />
        <EmptyState
          icon={Lock}
          title="Restricted"
          description="Only owners and managers can view performance recommendations."
        />
      </div>
    );
  }

  async function generate() {
    if (!restaurant?.id) return;
    setBusy(true);
    try {
      const data = await run({
        data: {
          restaurantId: restaurant.id,
          days,
          goal,
          challenges,
          marketingSpend: Number(marketingSpend) || 0,
          staffCount: Number(staffCount) || 0,
          notes,
        },
      });
      setResult(data);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't generate recommendations. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Performance insights"
        subtitle="Built from your real orders plus the context you add"
      />

      <section className="surface-card mb-4 space-y-4 rounded-3xl p-4">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Period
          </Label>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDays(p)}
                className={`tap-target flex-1 rounded-xl border px-3 py-2 text-xs font-medium ${
                  days === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                Last {p} days
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly marketing spend (R)">
            <Input
              className="h-11 rounded-xl"
              inputMode="numeric"
              value={marketingSpend}
              onChange={(e) => setMarketingSpend(e.target.value)}
            />
          </Field>
          <Field label="Staff on shift">
            <Input
              className="h-11 rounded-xl"
              inputMode="numeric"
              value={staffCount}
              onChange={(e) => setStaffCount(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Your goal for the next month">
          <Textarea
            className="min-h-20 rounded-xl"
            placeholder="e.g. Grow delivery revenue by 20% without extra staff"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </Field>
        <Field label="Biggest challenges">
          <Textarea
            className="min-h-20 rounded-xl"
            placeholder="e.g. Slow weekday lunches, high cancellations after 9pm"
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
          />
        </Field>
        <Field label="Anything else we should know">
          <Textarea
            className="min-h-20 rounded-xl"
            placeholder="e.g. New branch opening, supplier price increase"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <Button className="tap-target h-12 w-full rounded-2xl" disabled={busy} onClick={generate}>
          <LineChart className="size-4" />
          {busy ? "Analysing your data…" : "Generate recommendations"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Recommendations are advice based on your own data — you decide what to act on.
        </p>
      </section>

      {result ? (
        <>
          <section className="surface-card mb-4 rounded-3xl p-4">
            <p className="font-display text-sm font-semibold">Your numbers</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Stat label="Orders" value={String(result.metrics.orders)} />
              <Stat label="Revenue" value={currency(result.metrics.revenue)} />
              <Stat label="Average order" value={currency(result.metrics.aov)} />
              <Stat label="Completion rate" value={`${result.metrics.completionRate}%`} />
              <Stat label="Cancelled" value={String(result.metrics.cancelled)} />
              <Stat
                label="Busiest hour"
                value={
                  result.metrics.busiestHour === null
                    ? "—"
                    : `${String(result.metrics.busiestHour).padStart(2, "0")}:00`
                }
              />
            </div>
            {result.metrics.topItems.length ? (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Top sellers
                </p>
                {result.metrics.topItems.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex justify-between gap-3 text-xs">
                    <span className="truncate">{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.quantity} · {currency(Math.round(item.revenue))}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="surface-card space-y-2 rounded-3xl p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-sm font-semibold">Recommendations</p>
              <p className="text-xs text-muted-foreground">{timeAgo(result.generatedAt)}</p>
            </div>
            <div className="space-y-1.5">
              {result.recommendations.split("\n").map((line, index) => {
                const text = line.trim();
                if (!text) return null;
                if (text.startsWith("##")) {
                  return (
                    <p key={index} className="pt-2 font-display text-sm font-semibold">
                      {text.replace(/^#+\s*/, "")}
                    </p>
                  );
                }
                return (
                  <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                    {text.replace(/\*\*/g, "")}
                  </p>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
