import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { currency, shortDate } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Taz admin — MealMate Partners" },
      { name: "description", content: "Internal platform console for Taz Technologies." },
      { property: "og:title", content: "Taz admin — MealMate Partners" },
      { property: "og:description", content: "Internal platform console." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isPlatformAdmin } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-overview"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const [restaurants, subs, orders, tickets] = await Promise.all([
        supabase.from("restaurants").select("id, name, city, is_suspended, created_at").limit(500),
        supabase.from("subscriptions").select("restaurant_id, status, plan_id").limit(500),
        supabase.from("orders").select("total, status").limit(5000),
        supabase
          .from("support_tickets")
          .select("id, subject, status, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (restaurants.error) throw restaurants.error;
      if (subs.error) throw subs.error;
      if (orders.error) throw orders.error;
      if (tickets.error) throw tickets.error;
      return {
        restaurants: restaurants.data ?? [],
        subs: subs.data ?? [],
        orders: orders.data ?? [],
        tickets: tickets.data ?? [],
      };
    },
  });

  const suspend = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("restaurants").update({ is_suspended: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Restaurant updated");
    },
    onError: () => toast.error("Couldn't update that restaurant."),
  });

  if (!isPlatformAdmin) {
    return (
      <div className="pb-8">
        <PageHeader title="Admin" />
        <EmptyState
          icon={ShieldAlert}
          title="Not available"
          description="This console is for Taz Technologies staff only."
        />
      </div>
    );
  }

  if (query.isLoading) return <Spinner label="Loading platform data…" />;
  if (query.isError)
    return (
      <ErrorState
        message="Couldn't load platform data. Check your connection and try again."
        onRetry={() => query.refetch()}
      />
    );

  const data = query.data!;
  const active = data.subs.filter((s) => s.status === "active" || s.status === "trialing").length;
  const churned = data.subs.filter((s) => s.status === "expired" || s.status === "cancelled").length;
  const gmv = data.orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="pb-8">
      <PageHeader
        title="Taz admin"
        subtitle="Platform-wide view"
        action={
          <Button
            className="tap-target shrink-0 rounded-2xl px-3 text-xs font-semibold shadow-glow"
            onClick={() => navigate({ to: "/onboarding" })}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>+ Add Restaurant</span>
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Metric label="Restaurants" value={String(data.restaurants.length)} />
        <Metric label="Active subscribers" value={String(active)} />
        <Metric label="Churned" value={String(churned)} />
        <Metric label="Platform GMV" value={currency(gmv)} />
        <Metric label="Orders" value={String(data.orders.length)} />
        <Metric label="Open tickets" value={String(data.tickets.filter((t) => t.status === "open").length)} />
      </div>

      <h2 className="mb-3 font-display text-sm font-semibold">Restaurants</h2>
      <div className="mb-6 space-y-2">
        {data.restaurants.map((r) => (
          <div key={r.id} className="surface-card flex items-center justify-between rounded-2xl p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.city ?? "—"} · joined {shortDate(r.created_at)}
              </p>
            </div>
            <Button
              variant={r.is_suspended ? "default" : "secondary"}
              className="tap-target rounded-2xl"
              onClick={() => suspend.mutate({ id: r.id, value: !r.is_suspended })}
            >
              {r.is_suspended ? "Unsuspend" : "Suspend"}
            </Button>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-display text-sm font-semibold">Recent support tickets</h2>
      <div className="space-y-2">
        {data.tickets.map((t) => (
          <div key={t.id} className="surface-card flex items-center justify-between rounded-2xl p-4">
            <p className="min-w-0 truncate text-sm">{t.subject}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[10px] uppercase",
                t.status === "open" ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
              )}
            >
              {t.status}
            </span>
          </div>
        ))}
      </div>
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
