import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { firebaseClient } from "@/integrations/firebase/client";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/firebase/types";

type Branch = Database["public"]["Tables"]["branches"]["Row"];

export const Route = createFileRoute("/_authenticated/branches")({
  head: () => ({
    meta: [
      { title: "Branches — MealMate Partners" },
      { name: "description", content: "Manage every branch, its hours and delivery radius." },
      { property: "og:title", content: "Branches — MealMate Partners" },
      { property: "og:description", content: "Multi-branch management for MealMate restaurants." },
    ],
  }),
  component: BranchesPage,
});

const empty = {
  name: "",
  address: "",
  phone: "",
  manager_name: "",
  delivery_radius_km: "5",
  pickup_enabled: true,
  is_active: true,
};

function BranchesPage() {
  const { restaurant, isManager, features, activeBranchId, setActiveBranch } = useWorkspace();
  const restaurantId = restaurant?.id ?? null;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ ...empty });

  const query = useQuery({
    queryKey: ["branches", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("branches")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  const count = query.data?.length ?? 0;
  const limitReached = count >= features.max_branches;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        restaurant_id: restaurantId!,
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        manager_name: form.manager_name.trim() || null,
        delivery_radius_km: form.delivery_radius_km ? Number(form.delivery_radius_km) : null,
        pickup_enabled: form.pickup_enabled,
        is_active: form.is_active,
      };
      const { error } = editing
        ? await firebaseClient.from("branches").update(payload).eq("id", editing.id)
        : await firebaseClient.from("branches").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches", restaurantId] });
      setOpen(false);
      toast.success(editing ? "Branch updated" : "Branch added");
    },
    onError: () => toast.error("Branch couldn't be saved. Please try again."),
  });

  return (
    <div className="pb-8">
      <PageHeader
        title="Branches"
        subtitle={`${count} of ${features.max_branches} allowed on your plan`}
        action={
          isManager ? (
            <Button
              className="tap-target rounded-2xl"
              onClick={() => {
                if (limitReached) {
                  toast.error("Your plan's branch limit is reached. Upgrade to add more branches.");
                  return;
                }
                setEditing(null);
                setForm({ ...empty });
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Branch
            </Button>
          ) : undefined
        }
      />

      {query.isLoading ? <ListSkeleton /> : null}
      {query.isError ? (
        <ErrorState
          message="Couldn't load branches. Check your connection and try again."
          onRetry={() => query.refetch()}
        />
      ) : null}
      {query.data && count === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No branches yet"
          description="Add your first branch so orders and analytics can be split per location."
        />
      ) : null}

      <div className="space-y-3">
        {(query.data ?? []).map((branch) => (
          <article key={branch.id} className="surface-card rounded-3xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-sm font-semibold">{branch.name}</h3>
                <p className="truncate text-xs text-muted-foreground">{branch.address}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {branch.manager_name ? `${branch.manager_name} · ` : ""}
                  {branch.delivery_radius_km ?? 0} km radius ·{" "}
                  {branch.pickup_enabled ? "Pickup on" : "Pickup off"}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] uppercase",
                  branch.is_active
                    ? "bg-success/15 text-success"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {branch.is_active ? "Active" : "Disabled"}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant={activeBranchId === branch.id ? "default" : "secondary"}
                className="tap-target flex-1 rounded-2xl"
                onClick={() => setActiveBranch(activeBranchId === branch.id ? null : branch.id)}
              >
                {activeBranchId === branch.id ? "Viewing this branch" : "View this branch"}
              </Button>
              {isManager ? (
                <Button
                  variant="secondary"
                  className="tap-target rounded-2xl"
                  onClick={() => {
                    setEditing(branch);
                    setForm({
                      name: branch.name,
                      address: branch.address ?? "",
                      phone: branch.phone ?? "",
                      manager_name: branch.manager_name ?? "",
                      delivery_radius_km: String(branch.delivery_radius_km ?? ""),
                      pickup_enabled: branch.pickup_enabled,
                      is_active: branch.is_active,
                    });
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editing ? "Edit branch" : "New branch"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            {[
              ["name", "Branch name"],
              ["address", "Address"],
              ["phone", "Phone"],
              ["manager_name", "Branch manager"],
              ["delivery_radius_km", "Delivery radius (km)"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {label}
                </Label>
                <Input
                  className="h-12 rounded-xl"
                  value={(form as Record<string, string | boolean>)[key!] as string}
                  onChange={(e) => setForm({ ...form, [key!]: e.target.value })}
                />
              </div>
            ))}
            <label className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-3 py-3 text-sm">
              Pickup enabled
              <Switch
                checked={form.pickup_enabled}
                onCheckedChange={(v) => setForm({ ...form, pickup_enabled: v })}
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-3 py-3 text-sm">
              Active
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </label>
            <Button
              className="tap-target h-12 w-full rounded-2xl"
              disabled={!form.name || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save branch"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
