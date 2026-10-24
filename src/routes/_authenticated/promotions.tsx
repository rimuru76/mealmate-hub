import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { firebaseClient } from "@/integrations/firebase/client";
import { currency, shortDate } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/firebase/types";

type Promotion = Database["public"]["Tables"]["promotions"]["Row"];
type PromoType = Database["public"]["Enums"]["promo_type"];

const TYPES: { key: PromoType; label: string }[] = [
  { key: "percentage", label: "% discount" },
  { key: "fixed", label: "Fixed discount" },
  { key: "bogo", label: "Buy one get one" },
  { key: "free_delivery", label: "Free delivery" },
];

export const Route = createFileRoute("/_authenticated/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions — MealMate Partners" },
      { name: "description", content: "Run discounts and track how they perform." },
      { property: "og:title", content: "Promotions — MealMate Partners" },
      { property: "og:description", content: "Create and measure MealMate promotions." },
    ],
  }),
  component: PromotionsPage,
});

const empty = {
  name: "",
  description: "",
  type: "percentage" as PromoType,
  value: "10",
  minimum_order: "0",
  max_uses: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
};

function PromotionsPage() {
  const { restaurant, isManager, features } = useWorkspace();
  const restaurantId = restaurant?.id ?? null;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState({ ...empty });

  const query = useQuery({
    queryKey: ["promotions", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("promotions")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Promotion[];
    },
  });

  const count = query.data?.length ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        restaurant_id: restaurantId!,
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        value: Number(form.value || 0),
        minimum_order: Number(form.minimum_order || 0),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        is_active: form.is_active,
      };
      const { error } = editing
        ? await firebaseClient.from("promotions").update(payload).eq("id", editing.id)
        : await firebaseClient.from("promotions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions", restaurantId] });
      setOpen(false);
      toast.success("Promotion saved");
    },
    onError: () => toast.error("Promotion couldn't be saved. Please try again."),
  });

  return (
    <div className="pb-8">
      <PageHeader
        title="Promotions"
        subtitle={`${count} of ${features.max_promotions} allowed on your plan`}
        action={
          isManager ? (
            <Button
              className="tap-target rounded-2xl"
              onClick={() => {
                if (count >= features.max_promotions) {
                  toast.error("Your plan's promotion limit is reached. Upgrade for more.");
                  return;
                }
                setEditing(null);
                setForm({ ...empty });
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New
            </Button>
          ) : undefined
        }
      />

      {query.isLoading ? <ListSkeleton /> : null}
      {query.isError ? (
        <ErrorState
          message="Couldn't load promotions. Check your connection and try again."
          onRetry={() => query.refetch()}
        />
      ) : null}
      {query.data && count === 0 ? (
        <EmptyState
          icon={Tag}
          title="No promotions yet"
          description="Create your first promotion to attract more customers."
        />
      ) : null}

      <div className="space-y-3">
        {(query.data ?? []).map((p) => (
          <article key={p.id} className="surface-card rounded-3xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-sm font-semibold">{p.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {TYPES.find((t) => t.key === p.type)?.label} ·{" "}
                  {p.type === "percentage" ? `${p.value}%` : currency(Number(p.value))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.starts_at ? shortDate(p.starts_at) : "Anytime"} →{" "}
                  {p.ends_at ? shortDate(p.ends_at) : "No end"}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] uppercase",
                  p.is_active ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
                )}
              >
                {p.is_active ? "Live" : "Paused"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="Views" value={String(p.views)} />
              <Stat label="Uses" value={String(p.uses)} />
              <Stat label="Revenue" value={currency(Number(p.revenue_generated))} />
              <Stat
                label="Conv."
                value={p.views > 0 ? `${Math.round((p.uses / p.views) * 100)}%` : "—"}
              />
            </dl>
            {isManager ? (
              <Button
                variant="secondary"
                className="tap-target mt-3 w-full rounded-2xl"
                onClick={() => {
                  setEditing(p);
                  setForm({
                    name: p.name,
                    description: p.description ?? "",
                    type: p.type,
                    value: String(p.value),
                    minimum_order: String(p.minimum_order),
                    max_uses: p.max_uses ? String(p.max_uses) : "",
                    starts_at: p.starts_at ? p.starts_at.slice(0, 10) : "",
                    ends_at: p.ends_at ? p.ends_at.slice(0, 10) : "",
                    is_active: p.is_active,
                  });
                  setOpen(true);
                }}
              >
                Edit promotion
              </Button>
            ) : null}
          </article>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editing ? "Edit promotion" : "New promotion"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <Field label="Name">
              <Input
                className="h-12 rounded-xl"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={3}
                className="rounded-xl"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setForm({ ...form, type: t.key })}
                    className={cn(
                      "tap-target rounded-full border px-3 py-2 text-xs",
                      form.type === t.key
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Value">
                <Input
                  inputMode="decimal"
                  className="h-12 rounded-xl"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </Field>
              <Field label="Minimum order (R)">
                <Input
                  inputMode="decimal"
                  className="h-12 rounded-xl"
                  value={form.minimum_order}
                  onChange={(e) => setForm({ ...form, minimum_order: e.target.value })}
                />
              </Field>
              <Field label="Max uses">
                <Input
                  inputMode="numeric"
                  className="h-12 rounded-xl"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                />
              </Field>
              <Field label="Starts">
                <Input
                  type="date"
                  className="h-12 rounded-xl"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="date"
                  className="h-12 rounded-xl"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </Field>
            </div>
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
              {save.isPending ? "Saving…" : "Save promotion"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/50 px-1 py-3">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xs font-medium">{value}</dd>
    </div>
  );
}
