import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Receipt } from "lucide-react";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, Spinner } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";
import { currency, shortDate } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — MealMate Partners" },
      { name: "description", content: "Revenue, pending amounts, invoices and subscription charges." },
      { property: "og:title", content: "Payments — MealMate Partners" },
      { property: "og:description", content: "Financial overview for your restaurant." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { restaurant, isManager } = useWorkspace();
  const restaurantId = restaurant?.id ?? null;

  const query = useQuery({
    queryKey: ["payments", restaurantId],
    enabled: !!restaurantId && isManager,
    queryFn: async () => {
      const [orders, invoices] = await Promise.all([
        supabase
          .from("orders")
          .select("total, status, payment_status, placed_at")
          .eq("restaurant_id", restaurantId!)
          .limit(2000),
        supabase
          .from("invoices")
          .select("*")
          .eq("restaurant_id", restaurantId!)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (orders.error) throw orders.error;
      if (invoices.error) throw invoices.error;
      return { orders: orders.data ?? [], invoices: invoices.data ?? [] };
    },
  });

  if (!isManager) {
    return (
      <div className="pb-8">
        <PageHeader title="Payments" />
        <EmptyState
          icon={Lock}
          title="Payments are restricted"
          description="Only owners and managers can see financial information."
        />
      </div>
    );
  }

  if (query.isLoading) return <Spinner label="Loading your finances…" />;
  if (query.isError)
    return (
      <ErrorState
        message="Couldn't load payments. Check your connection and try again."
        onRetry={() => query.refetch()}
      />
    );

  const orders = query.data?.orders ?? [];
  const completed = orders.filter((o) => o.status === "completed");
  const revenue = completed.reduce((sum, o) => sum + Number(o.total), 0);
  const pending = orders
    .filter((o) => o.payment_status === "pending" && o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="pb-8">
      <PageHeader title="Payments" subtitle="From your real order and invoice records" />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Metric label="Lifetime revenue" value={currency(revenue)} />
        <Metric label="Completed orders" value={String(completed.length)} />
        <Metric label="Pending payments" value={currency(pending)} />
        <Metric label="Invoices" value={String(query.data?.invoices.length ?? 0)} />
      </div>

      <h2 className="mb-3 font-display text-sm font-semibold">Invoices & subscription charges</h2>
      {(query.data?.invoices ?? []).length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Subscription invoices appear here once your billing records sync."
        />
      ) : (
        <div className="space-y-2">
          {(query.data?.invoices ?? []).map((inv) => (
            <div key={inv.id} className="surface-card flex items-center justify-between rounded-2xl p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{inv.reference}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {inv.source} · {inv.status} · {shortDate(inv.created_at)}
                </p>
              </div>
              <p className="font-display text-sm font-semibold">{currency(Number(inv.amount))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card rounded-3xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
