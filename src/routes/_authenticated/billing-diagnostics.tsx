import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Webhook,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { currency, shortDate, timeAgo } from "@/lib/format";
import { billingDiagnostics } from "@/lib/revenuecat.functions";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/billing-diagnostics")({
  head: () => ({
    meta: [
      { title: "Billing diagnostics — MealMate Partners" },
      {
        name: "description",
        content: "Check RevenueCat products, entitlements, webhook health and subscription status.",
      },
      { property: "og:title", content: "Billing diagnostics — MealMate Partners" },
      {
        property: "og:description",
        content: "RevenueCat connection, entitlement and webhook health for your restaurant.",
      },
    ],
  }),
  component: BillingDiagnosticsPage,
});

function BillingDiagnosticsPage() {
  const { restaurant, isManager } = useWorkspace();
  const run = useServerFn(billingDiagnostics);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["billing-diagnostics", restaurant?.id],
    enabled: !!restaurant?.id && isManager,
    queryFn: () => run({ data: { restaurantId: restaurant!.id } }),
  });

  const webhookUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/api/public/revenuecat`;

  if (!isManager) {
    return (
      <div className="pb-8">
        <PageHeader title="Billing diagnostics" subtitle="Owners and managers only" />
        <EmptyState
          icon={Lock}
          title="Billing is restricted"
          description="Only the restaurant owner or a manager can view billing diagnostics."
        />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Billing diagnostics"
        subtitle="RevenueCat connection, catalogue and webhook health"
      />

      {query.isLoading ? <Spinner label="Running billing checks…" /> : null}

      {query.isError ? (
        <ErrorState
          message="Couldn't run the billing checks. Check your connection and try again."
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.data ? (
        <div className="space-y-4">
          <section className="surface-card rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold">Connection</h2>
              <Button
                variant="secondary"
                size="sm"
                className="tap-target rounded-xl"
                disabled={query.isFetching}
                onClick={() => query.refetch()}
              >
                <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} />
                Re-check
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Status
                ok={query.data.credentials.secretKey}
                label="Secret API key stored"
                detail={
                  query.data.credentials.secretKey
                    ? "Stored securely on the server"
                    : "Not set — subscription checks are off"
                }
                icon={KeyRound}
              />
              <Status
                ok={query.data.credentials.webhookSecret}
                label="Webhook authorisation set"
                detail={
                  query.data.credentials.webhookSecret
                    ? "Incoming events are verified"
                    : "Not set — events will be rejected"
                }
                icon={Webhook}
              />
              <Status
                ok={query.data.revenuecat.reachable}
                label="RevenueCat reachable"
                detail={query.data.revenuecat.message}
                icon={ShieldCheck}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Last checked {timeAgo(query.data.checkedAt)}. Key values are never sent to this
              device.
            </p>
          </section>

          <section className="surface-card rounded-3xl p-5">
            <h2 className="font-display text-base font-semibold">Webhook endpoint</h2>
            <p className="mt-2 break-all rounded-2xl bg-secondary px-3 py-2 font-mono text-xs">
              {webhookUrl}
            </p>
            <Button
              variant="secondary"
              className="tap-target mt-3 w-full rounded-2xl"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  toast.success("Webhook address copied");
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  toast.error("Couldn't copy. Select and copy the address manually.");
                }
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy address
            </Button>
            <div className="mt-4 space-y-2 text-sm">
              <Line
                label="Events received"
                value={query.data.events.length ? `${query.data.events.length} recent` : "None yet"}
              />
              <Line
                label="Last event"
                value={
                  query.data.events[0]
                    ? `${query.data.events[0].event_type} · ${timeAgo(query.data.events[0].created_at)}`
                    : "Waiting for the first event"
                }
              />
            </div>
            {query.data.events.length ? (
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
                {query.data.events.map((event, index) => (
                  <li
                    key={`${event.created_at}-${index}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <span className="font-medium">{event.event_type}</span>
                    <span className="text-muted-foreground">
                      {event.entitlement ?? "—"} · {timeAgo(event.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No billing events have arrived yet. Add this address in RevenueCat under
                Integrations → Webhooks with your authorisation value.
              </p>
            )}
          </section>

          <section className="surface-card rounded-3xl p-5">
            <h2 className="font-display text-base font-semibold">Products and entitlements</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Plans configured in your backend and the entitlement each one unlocks.
            </p>
            <ul className="mt-4 space-y-3">
              {query.data.plans.map((plan) => {
                const matched = query.data.revenuecat.entitlements.find(
                  (e) => e.id === plan.entitlement,
                );
                return (
                  <li key={plan.id} className="rounded-2xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-sm">{currency(Number(plan.price_zar))}/mo</span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <Line label="Entitlement" value={plan.entitlement ?? "—"} small />
                      <Line
                        label="Product"
                        value={matched?.productId ?? "Set in RevenueCat"}
                        small
                      />
                      <Line
                        label="On this account"
                        value={matched ? (matched.active ? "Active" : "Lapsed") : "Not purchased"}
                        small
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {query.data.revenuecat.products.length ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Purchases on this account
                </p>
                <ul className="mt-2 space-y-2 text-xs">
                  {query.data.revenuecat.products.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center justify-between rounded-2xl border border-border px-3 py-2"
                    >
                      <span className="font-medium">{product.id}</span>
                      <span className="text-muted-foreground">
                        {product.store ?? "—"} ·{" "}
                        {product.expires ? shortDate(product.expires) : "No expiry"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="surface-card rounded-3xl p-5">
            <h2 className="font-display text-base font-semibold">This restaurant's subscription</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Line label="Status" value={query.data.subscription?.status ?? "none"} />
              <Line label="Entitlement" value={query.data.subscription?.entitlement ?? "—"} />
              <Line label="Product" value={query.data.subscription?.product_id ?? "—"} />
              <Line
                label="Renews"
                value={
                  query.data.subscription?.expiration_date
                    ? shortDate(query.data.subscription.expiration_date)
                    : "—"
                }
              />
              <Line label="Trial" value={query.data.subscription?.is_trial ? "Yes" : "No"} />
              <Line
                label="RevenueCat customer"
                value={
                  query.data.subscription?.revenuecat_customer_id ??
                  query.data.revenuecat.customerId ??
                  "Not linked yet"
                }
              />
              <Line
                label="Last synced"
                value={
                  query.data.subscription?.last_synced_at
                    ? timeAgo(query.data.subscription.last_synced_at)
                    : "Never"
                }
              />
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Status({
  ok,
  label,
  detail,
  icon: Icon,
}: {
  ok: boolean;
  label: string;
  detail: string;
  icon: typeof KeyRound;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          ok ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {label}
          {ok ? <Check className="size-4 text-success" /> : <X className="size-4 text-warning" />}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function Line({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", small && "text-xs")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
