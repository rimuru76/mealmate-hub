import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, Spinner } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";
import { currency, shortDate } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
] as const;

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — MealMate Partners" },
      { name: "description", content: "Revenue, orders, customers and branch performance." },
      { property: "og:title", content: "Analytics — MealMate Partners" },
      { property: "og:description", content: "Real performance data for your restaurant." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { restaurant, role, features, activeBranchId } = useWorkspace();
  const restaurantId = restaurant?.id ?? null;
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("7");
  const days = RANGES.find((r) => r.key === range)!.days;

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d.toISOString();
  }, [days]);

  const query = useQuery({
    queryKey: ["analytics", restaurantId, days, activeBranchId],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, total, status, placed_at, customer_id, branch_id")
        .eq("restaurant_id", restaurantId!)
        .gte("placed_at", since)
        .limit(5000);
      if (activeBranchId) q = q.eq("branch_id", activeBranchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (role === "staff") {
    return (
      <div className="pb-8">
        <PageHeader title="Analytics" />
        <EmptyState
          icon={Lock}
          title="Analytics are restricted"
          description="Financial analytics are available to owners and managers only."
        />
      </div>
    );
  }

  const orders = query.data ?? [];
  const completed = orders.filter((o) => o.status === "completed");
  const cancelled = orders.filter((o) => o.status === "cancelled" || o.status === "rejected");
  const revenue = completed.reduce((sum, o) => sum + Number(o.total), 0);
  const aov = completed.length ? revenue / completed.length : 0;
  const customerIds = orders.map((o) => o.customer_id).filter(Boolean) as string[];
  const uniqueCustomers = new Set(customerIds);
  const repeatCustomers = [...uniqueCustomers].filter(
    (id) => customerIds.filter((c) => c === id).length > 1,
  ).length;
  const completionRate = orders.length ? Math.round((completed.length / orders.length) * 100) : 0;

  const series = useMemo(() => {
    const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: shortDate(d.toISOString()), revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      const key = o.placed_at.slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.orders += 1;
      if (o.status === "completed") bucket.revenue += Number(o.total);
    }
    return [...buckets.values()];
  }, [orders, days]);

  return (
    <div className="pb-8">
      <PageHeader title="Analytics" subtitle="Everything calculated from your live orders" />

      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "tap-target rounded-full border px-4 py-2 text-xs font-medium",
                range === r.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? <Spinner label="Crunching your numbers…" /> : null}
      {query.isError ? (
        <ErrorState
          message="Couldn't load analytics. Check your connection and try again."
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.data && orders.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing to analyse yet"
          description="Complete orders to start generating analytics."
        />
      ) : null}

      {orders.length > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Metric label="Revenue" value={currency(revenue)} />
            <Metric label="Orders" value={String(orders.length)} />
            <Metric label="Average order" value={currency(aov)} />
            <Metric label="Customers" value={String(uniqueCustomers.size)} />
            <Metric label="Repeat customers" value={String(repeatCustomers)} />
            <Metric label="Completion rate" value={`${completionRate}%`} />
            <Metric label="Cancelled" value={String(cancelled.length)} />
            <Metric label="Completed" value={String(completed.length)} />
          </div>

          <section className="surface-card mb-4 rounded-3xl p-4">
            <p className="mb-3 font-display text-sm font-semibold">Revenue trend</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="an-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" width={40} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    fill="url(#an-rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {features.advanced_analytics ? (
            <BranchPerformance restaurantId={restaurantId!} since={since} />
          ) : (
            <div className="surface-card rounded-3xl p-5 text-center">
              <Lock className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Advanced analytics are on the Pro plan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upgrade to unlock branch performance and promotion analytics.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function BranchPerformance({ restaurantId, since }: { restaurantId: string; since: string }) {
  const query = useQuery({
    queryKey: ["branch-performance", restaurantId, since],
    queryFn: async () => {
      const [branches, orders, promos] = await Promise.all([
        supabase.from("branches").select("id, name").eq("restaurant_id", restaurantId),
        supabase
          .from("orders")
          .select("branch_id, total, status")
          .eq("restaurant_id", restaurantId)
          .gte("placed_at", since)
          .limit(5000),
        supabase
          .from("promotions")
          .select("name, uses, views, revenue_generated")
          .eq("restaurant_id", restaurantId)
          .order("revenue_generated", { ascending: false })
          .limit(5),
      ]);
      if (branches.error) throw branches.error;
      if (orders.error) throw orders.error;
      if (promos.error) throw promos.error;
      const rows = (branches.data ?? []).map((b) => {
        const mine = (orders.data ?? []).filter(
          (o) => o.branch_id === b.id && o.status === "completed",
        );
        return {
          id: b.id,
          name: b.name,
          orders: mine.length,
          revenue: mine.reduce((sum, o) => sum + Number(o.total), 0),
        };
      });
      return { rows, promos: promos.data ?? [] };
    },
  });

  if (!query.data) return null;

  return (
    <>
      <section className="surface-card mb-4 rounded-3xl p-4">
        <p className="mb-3 font-display text-sm font-semibold">Branch performance</p>
        {query.data.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No branches yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {query.data.rows.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span className="truncate">{b.name}</span>
                <span className="text-muted-foreground">
                  {b.orders} · {currency(b.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card rounded-3xl p-4">
        <p className="mb-3 font-display text-sm font-semibold">Promotion performance</p>
        {query.data.promos.length === 0 ? (
          <p className="text-xs text-muted-foreground">No promotions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {query.data.promos.map((p) => (
              <li key={p.name} className="flex justify-between">
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground">
                  {p.uses}/{p.views} · {currency(Number(p.revenue_generated))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
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
