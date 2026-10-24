import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Input } from "@/components/ui/input";
import { firebaseClient } from "@/integrations/firebase/client";
import { currency, shortDate } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import type { Database } from "@/integrations/firebase/types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — MealMate Partners" },
      { name: "description", content: "See who orders from you, how often and what they spend." },
      { property: "og:title", content: "Customers — MealMate Partners" },
      { property: "og:description", content: "Customer insights for MealMate restaurants." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { restaurant, activeBranchId } = useWorkspace();
  const restaurantId = restaurant?.id ?? null;
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["customers", restaurantId, activeBranchId, search],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = firebaseClient
        .from("customers")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("total_spent", { ascending: false })
        .limit(100);
      if (activeBranchId) q = q.eq("branch_id", activeBranchId);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  return (
    <div className="pb-8">
      <PageHeader title="Customers" subtitle="Everyone who has ordered from you" />

      <Input
        placeholder="Search customers"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 h-12 rounded-2xl"
      />

      {query.isLoading ? <ListSkeleton /> : null}
      {query.isError ? (
        <ErrorState
          message="Couldn't load customers. Check your connection and try again."
          onRetry={() => query.refetch()}
        />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Customers will appear after your first completed order."
        />
      ) : null}

      <div className="space-y-3">
        {(query.data ?? []).map((c) => {
          const aov = c.total_orders > 0 ? Number(c.total_spent) / c.total_orders : 0;
          return (
            <article key={c.id} className="surface-card rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-sm font-semibold">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Customer since {shortDate(c.created_at)}
                  </p>
                </div>
                <p className="font-display text-sm font-semibold">
                  {currency(Number(c.total_spent))}
                </p>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="Orders" value={String(c.total_orders)} />
                <Stat label="Avg order" value={currency(aov)} />
                <Stat
                  label="Last order"
                  value={c.last_order_at ? shortDate(c.last_order_at) : "—"}
                />
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/50 px-2 py-3">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
