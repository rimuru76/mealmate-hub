import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect } from "react";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const PREFS = [
  ["new_orders", "New orders"],
  ["order_updates", "Order updates"],
  ["billing", "Billing & subscription"],
  ["promotions", "Promotion performance"],
  ["announcements", "System announcements"],
] as const;

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MealMate Partners" },
      { name: "description", content: "Order, billing and platform alerts for your restaurant." },
      { property: "og:title", content: "Notifications — MealMate Partners" },
      { property: "og:description", content: "Stay on top of everything happening." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { userId, restaurant } = useWorkspace();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["notifications", userId, restaurant?.id],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const prefsQuery = useQuery({
    queryKey: ["notification-prefs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const setPref = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId!, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-prefs", userId] }),
  });

  const markRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  return (
    <div className="pb-8">
      <PageHeader
        title="Notifications"
        action={
          <Button variant="secondary" className="tap-target rounded-2xl" onClick={() => markRead.mutate()}>
            Mark all read
          </Button>
        }
      />

      <section className="surface-card mb-5 space-y-3 rounded-3xl p-4">
        <p className="font-display text-sm font-semibold">Preferences</p>
        {PREFS.map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-sm">
            {label}
            <Switch
              checked={(prefsQuery.data?.[key] as boolean | undefined) ?? true}
              onCheckedChange={(v) => setPref.mutate({ [key]: v })}
            />
          </label>
        ))}
      </section>

      {listQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {listQuery.isError ? (
        <ErrorState
          message="Couldn't load notifications. Check your connection and try again."
          onRetry={() => listQuery.refetch()}
        />
      ) : null}
      {listQuery.data && listQuery.data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="Order, billing and platform alerts will appear here."
        />
      ) : null}

      <div className="space-y-2">
        {(listQuery.data ?? []).map((n) => (
          <article
            key={n.id}
            className={cn("surface-card rounded-2xl p-4", !n.is_read && "border-primary/50")}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{n.title}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
            </div>
            {n.body ? <p className="mt-1 text-xs text-muted-foreground">{n.body}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
