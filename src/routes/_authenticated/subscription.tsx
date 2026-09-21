import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, RefreshCw, ShieldCheck, Stethoscope } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { ErrorState, Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { currency, shortDate } from "@/lib/format";
import { syncSubscription } from "@/lib/revenuecat.functions";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription — MealMate Partners" },
      { name: "description", content: "Your MealMate Partners plan, renewal date and entitlements." },
      { property: "og:title", content: "Subscription — MealMate Partners" },
      { property: "og:description", content: "Manage your MealMate Partners subscription." },
    ],
  }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { restaurant, subscription, plan, isOwner, isManager, refresh } = useWorkspace();
  const router = useRouter();
  const sync = useServerFn(syncSubscription);
  const [busy, setBusy] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["plans-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function runSync() {
    if (!restaurant) return;
    setBusy(true);
    try {
      const result = await sync({ data: { restaurantId: restaurant.id } });
      if (result.ok) {
        toast.success(
          result.entitlement ? "Subscription restored and up to date" : "No active purchase found",
        );
        refresh();
        router.invalidate();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Couldn't check your subscription. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (plansQuery.isLoading) return <Spinner label="Loading plans…" />;
  if (plansQuery.isError)
    return (
      <ErrorState
        message="Couldn't load plans. Check your connection and try again."
        onRetry={() => plansQuery.refetch()}
      />
    );

  const status = subscription?.status ?? "none";

  return (
    <div className="pb-8">
      <PageHeader title="Subscription" subtitle="Billed securely through RevenueCat" />

      <section className="surface-card mb-4 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="font-display text-xl font-semibold">{plan?.name ?? "No plan"}</p>
            {plan ? (
              <p className="text-sm text-muted-foreground">
                {currency(Number(plan.price_zar))} / month
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[11px] uppercase",
              status === "active" || status === "trialing"
                ? "bg-success/15 text-success"
                : "bg-warning/15 text-warning",
            )}
          >
            {status}
          </span>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Line
            label="Renews"
            value={subscription?.expiration_date ? shortDate(subscription.expiration_date) : "—"}
          />
          <Line label="Trial" value={subscription?.is_trial ? "Yes" : "No"} />
          <Line label="Entitlement" value={subscription?.entitlement ?? "—"} />
          <Line
            label="Last checked"
            value={subscription?.last_synced_at ? shortDate(subscription.last_synced_at) : "Never"}
          />
        </dl>
        <Button
          variant="secondary"
          className="tap-target mt-4 w-full rounded-2xl"
          disabled={busy || !isManager}
          onClick={runSync}
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          Restore purchases / refresh status
        </Button>
      </section>

      <div className="space-y-3">
        {(plansQuery.data ?? []).map((p) => {
          const current = plan?.id === p.id;
          const features = (p.features ?? {}) as Record<string, unknown>;
          return (
            <article
              key={p.id}
              className={cn("surface-card rounded-3xl p-5", current && "border-primary/60")}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                <p className="font-display text-lg font-semibold">
                  {currency(Number(p.price_zar))}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </p>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {Object.entries(features).map(([key, value]) => (
                  <li key={key} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {key.replaceAll("_", " ")}: {String(value)}
                  </li>
                ))}
              </ul>
              <Button
                className="tap-target mt-4 h-12 w-full rounded-2xl"
                variant={current ? "secondary" : "default"}
                disabled={current || !isOwner}
                onClick={() =>
                  toast.info(
                    "Purchases complete in the MealMate Partners mobile app through RevenueCat, then tap Restore purchases here.",
                  )
                }
              >
                {current ? "Current plan" : `Choose ${p.name}`}
              </Button>
            </article>
          );
        })}
      </div>

      {isManager ? (
        <Link
          to="/billing-diagnostics"
          className="tap-target mt-4 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Stethoscope className="size-4 text-muted-foreground" />
            Billing diagnostics
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}

      <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        RevenueCat is the only source of truth for billing. Entitlements are written server-side from
        RevenueCat's webhook, never from this device.
      </p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
