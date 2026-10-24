import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firebaseClient } from "@/integrations/firebase/client";
import { currency, shortDate } from "@/lib/format";
import { recommendPrice } from "@/lib/pricing.functions";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/ai-pricing")({
  head: () => ({
    meta: [
      { title: "AI pricing engine — MealMate Partners" },
      {
        name: "description",
        content: "Advisory pricing recommendations for Taz sales negotiations.",
      },
      { property: "og:title", content: "AI pricing engine — MealMate Partners" },
      { property: "og:description", content: "Advisory-only negotiation support." },
    ],
  }),
  component: PricingPage,
});

const FIELDS = [
  ["restaurantName", "Restaurant name"],
  ["basePrice", "Base price (R)"],
  ["minimumPrice", "Minimum price (R)"],
  ["maxDiscountPct", "Max discount (%)"],
  ["contractMonths", "Contract length (months)"],
  ["upfrontDiscountPct", "Upfront payment discount (%)"],
  ["branchCount", "Branch count"],
  ["restaurantSize", "Restaurant size"],
  ["orderVolume", "Monthly order volume"],
  ["attempts", "Negotiation attempts"],
  ["currentOffer", "Current offer (R)"],
  ["discountReason", "Discount reason"],
] as const;

type FormKey = (typeof FIELDS)[number][0];

const initial: Record<FormKey, string> = {
  restaurantName: "",
  basePrice: "3000",
  minimumPrice: "1800",
  maxDiscountPct: "25",
  contractMonths: "12",
  upfrontDiscountPct: "5",
  branchCount: "1",
  restaurantSize: "medium",
  orderVolume: "400",
  attempts: "1",
  currentOffer: "2400",
  discountReason: "",
};

function PricingPage() {
  const { isPlatformAdmin, userId } = useWorkspace();
  const queryClient = useQueryClient();
  const advise = useServerFn(recommendPrice);
  const [form, setForm] = useState({ ...initial });
  const [result, setResult] = useState<{
    floor: number;
    suggested: number;
    rangeLow: number;
    rangeHigh: number;
    counterOffer: number;
    explanation: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const history = useQuery({
    queryKey: ["ai-pricing"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("ai_pricing_negotiations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveRecord = useMutation({
    mutationFn: async (approved: boolean) => {
      if (!result) return;
      const { error } = await firebaseClient.from("ai_pricing_negotiations").insert({
        restaurant_name: form.restaurantName || null,
        base_price: Number(form.basePrice),
        minimum_price: Number(form.minimumPrice),
        max_discount_pct: Number(form.maxDiscountPct),
        contract_months: Number(form.contractMonths),
        upfront_discount_pct: Number(form.upfrontDiscountPct),
        branch_count: Number(form.branchCount),
        restaurant_size: form.restaurantSize,
        order_volume: Number(form.orderVolume),
        attempts: Number(form.attempts),
        current_offer: Number(form.currentOffer),
        discount_reason: form.discountReason || null,
        suggested_offer: result.suggested,
        recommendation: result.explanation,
        final_offer: approved ? result.counterOffer : null,
        human_approved: approved,
        approved_by: approved ? userId : null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-pricing"] });
      toast.success("Negotiation saved");
    },
    onError: () => toast.error("Couldn't save this negotiation."),
  });

  if (!isPlatformAdmin) {
    return (
      <div className="pb-8">
        <PageHeader title="AI pricing engine" />
        <EmptyState
          icon={ShieldAlert}
          title="Not available"
          description="This tool is for Taz Technologies staff only."
        />
      </div>
    );
  }

  async function run() {
    setBusy(true);
    try {
      const recommendation = await advise({
        data: {
          basePrice: Number(form.basePrice),
          minimumPrice: Number(form.minimumPrice),
          maxDiscountPct: Number(form.maxDiscountPct),
          contractMonths: Number(form.contractMonths),
          upfrontDiscountPct: Number(form.upfrontDiscountPct),
          branchCount: Number(form.branchCount),
          restaurantSize: form.restaurantSize,
          orderVolume: Number(form.orderVolume),
          attempts: Number(form.attempts),
          currentOffer: Number(form.currentOffer),
          discountReason: form.discountReason,
        },
      });
      setResult(recommendation);
    } catch {
      toast.error("Couldn't generate a recommendation. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="AI pricing engine"
        subtitle="Advisory only — a human approves every offer"
      />

      <section className="surface-card mb-4 grid grid-cols-2 gap-3 rounded-3xl p-4">
        {FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {label}
            </Label>
            <Input
              className="h-11 rounded-xl"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
        <Button className="tap-target col-span-2 h-12 rounded-2xl" disabled={busy} onClick={run}>
          <Sparkles className="size-4" /> {busy ? "Thinking…" : "Get recommendation"}
        </Button>
      </section>

      {result ? (
        <section className="surface-card mb-4 space-y-3 rounded-3xl p-4">
          <p className="font-display text-sm font-semibold">Recommendation</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info
              label="Negotiation range"
              value={`${currency(result.rangeLow)} – ${currency(result.rangeHigh)}`}
            />
            <Info label="Current offer" value={currency(Number(form.currentOffer))} />
            <Info label="Suggested" value={currency(result.suggested)} />
            <Info label="Counter-offer" value={currency(result.counterOffer)} />
          </div>
          <p className="text-xs text-muted-foreground">{result.explanation}</p>
          <p className="rounded-2xl bg-warning/10 px-3 py-2 text-xs text-warning">
            Advisory only. Nothing is contracted or charged until a human approves the final offer.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="tap-target flex-1 rounded-2xl"
              onClick={() => saveRecord.mutate(false)}
            >
              Save without approving
            </Button>
            <Button
              className="tap-target flex-1 rounded-2xl"
              onClick={() => {
                if (window.confirm("Approve this final offer?")) saveRecord.mutate(true);
              }}
            >
              Approve final offer
            </Button>
          </div>
        </section>
      ) : null}

      <h2 className="mb-3 font-display text-sm font-semibold">Recent negotiations</h2>
      <div className="space-y-2">
        {(history.data ?? []).map((n) => (
          <div key={n.id} className="surface-card rounded-2xl p-4">
            <div className="flex justify-between gap-3">
              <p className="truncate text-sm font-medium">{n.restaurant_name ?? "Unnamed"}</p>
              <p className="text-xs text-muted-foreground">{shortDate(n.created_at)}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Suggested {currency(Number(n.suggested_offer ?? 0))} ·{" "}
              {n.human_approved
                ? `approved at ${currency(Number(n.final_offer ?? 0))}`
                : "awaiting approval"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
