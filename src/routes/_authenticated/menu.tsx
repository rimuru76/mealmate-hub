import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { firebaseClient } from "@/integrations/firebase/client";
import { currency } from "@/lib/format";
import { uploadImage } from "@/lib/storage";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/firebase/types";

type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
type Category = Database["public"]["Tables"]["menu_categories"]["Row"];

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Menu — MealMate Partners" },
      { name: "description", content: "Create categories, items, prices, photos and modifiers." },
      { property: "og:title", content: "Menu — MealMate Partners" },
      { property: "og:description", content: "Manage your MealMate menu." },
    ],
  }),
  component: MenuPage,
});

const emptyItem = {
  name: "",
  description: "",
  price: "",
  sku: "",
  prep_time_minutes: "",
  calories: "",
  allergens: "",
  is_vegetarian: false,
  is_vegan: false,
  is_halaal: false,
  is_spicy: false,
  is_available: true,
};

function MenuPage() {
  const { restaurant, isManager } = useWorkspace();
  const restaurantId = restaurant?.id ?? null;
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyItem });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["categories", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["menu-items", restaurantId, categoryId],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = firebaseClient
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("position")
        .limit(200);
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await firebaseClient.from("menu_categories").insert({
        restaurant_id: restaurantId!,
        name,
        position: (categoriesQuery.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", restaurantId] });
      toast.success("Category added");
    },
    onError: () => toast.error("Category couldn't be saved."),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await firebaseClient.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] });
      toast.success("Item deleted");
    },
    onError: () => toast.error("Menu item couldn't be deleted."),
  });

  const toggleAvailable = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await firebaseClient
        .from("menu_items")
        .update({ is_available: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] }),
    onError: () => toast.error("Menu item couldn't be saved."),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...emptyItem });
    setFile(null);
    setSheetOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      sku: item.sku ?? "",
      prep_time_minutes: item.prep_time_minutes ? String(item.prep_time_minutes) : "",
      calories: item.calories ? String(item.calories) : "",
      allergens: (item.allergens ?? []).join(", "),
      is_vegetarian: item.is_vegetarian,
      is_vegan: item.is_vegan,
      is_halaal: item.is_halaal,
      is_spicy: item.is_spicy,
      is_available: item.is_available,
    });
    setFile(null);
    setSheetOpen(true);
  }

  async function saveItem() {
    if (!restaurantId) return;
    setSaving(true);
    try {
      let imageRef = editing?.image_url ?? null;
      if (file) imageRef = await uploadImage("menu-images", restaurantId, file, "item");
      const payload = {
        restaurant_id: restaurantId,
        category_id: categoryId ?? editing?.category_id ?? categoriesQuery.data?.[0]?.id ?? null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price || 0),
        sku: form.sku.trim() || null,
        prep_time_minutes: form.prep_time_minutes ? Number(form.prep_time_minutes) : null,
        calories: form.calories ? Number(form.calories) : null,
        allergens: form.allergens
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        is_vegetarian: form.is_vegetarian,
        is_vegan: form.is_vegan,
        is_halaal: form.is_halaal,
        is_spicy: form.is_spicy,
        is_available: form.is_available,
        image_url: imageRef,
      };
      const { error } = editing
        ? await firebaseClient.from("menu_items").update(payload).eq("id", editing.id)
        : await firebaseClient.from("menu_items").insert(payload);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["menu-items", restaurantId] });
      setSheetOpen(false);
      toast.success(editing ? "Item updated" : "Item added to your menu");
    } catch {
      toast.error("Menu item couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-8">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {itemsQuery.data?.length ?? 0} item{(itemsQuery.data?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        {isManager ? (
          <Button className="tap-target rounded-2xl" onClick={openNew}>
            <Plus className="size-4" /> Item
          </Button>
        ) : null}
      </header>

      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2">
          <Chip active={categoryId === null} onClick={() => setCategoryId(null)}>
            All
          </Chip>
          {(categoriesQuery.data ?? []).map((c) => (
            <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </Chip>
          ))}
          {isManager ? (
            <Chip
              active={false}
              onClick={() => {
                const name = window.prompt("New category name");
                if (name) addCategory.mutate(name.trim());
              }}
            >
              + Category
            </Chip>
          ) : null}
        </div>
      </div>

      {itemsQuery.isLoading ? <ListSkeleton /> : null}
      {itemsQuery.isError ? (
        <ErrorState
          message="Couldn't load your menu. Check your connection and try again."
          onRetry={() => itemsQuery.refetch()}
        />
      ) : null}

      {itemsQuery.data && itemsQuery.data.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Your menu is empty"
          description="Add your first item so customers can order from you on MealMate."
          action={
            isManager ? (
              <Button className="rounded-2xl" onClick={openNew}>
                Add first item
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <div className="space-y-3">
        {(itemsQuery.data ?? []).map((item) => (
          <article key={item.id} className="surface-card flex gap-3 rounded-3xl p-3">
            <SignedImage
              reference={item.image_url}
              alt={item.name}
              className="size-20 shrink-0 rounded-2xl"
              fallback={<ImagePlus className="size-5 text-muted-foreground" />}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-sm font-semibold">{item.name}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <p className="font-display text-sm font-semibold">{currency(Number(item.price))}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.is_halaal ? <Tag>Halaal</Tag> : null}
                {item.is_vegan ? <Tag>Vegan</Tag> : null}
                {item.is_vegetarian ? <Tag>Veg</Tag> : null}
                {item.is_spicy ? <Tag>Spicy</Tag> : null}
              </div>
              {isManager ? (
                <div className="mt-3 flex items-center gap-3">
                  <Switch
                    checked={item.is_available}
                    onCheckedChange={(value) => toggleAvailable.mutate({ id: item.id, value })}
                    aria-label="Available"
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.is_available ? "Available" : "Hidden"}
                  </span>
                  <button
                    type="button"
                    className="tap-target ml-auto text-muted-foreground"
                    aria-label="Edit item"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="tap-target text-destructive"
                    aria-label="Delete item"
                    onClick={() => {
                      if (window.confirm(`Delete ${item.name}?`)) removeItem.mutate(item.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editing ? "Edit item" : "New menu item"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <Row label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-12 rounded-xl"
              />
            </Row>
            <Row label="Description">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl"
              />
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Price (R)">
                <Input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </Row>
              <Row label="SKU">
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </Row>
              <Row label="Prep time (min)">
                <Input
                  inputMode="numeric"
                  value={form.prep_time_minutes}
                  onChange={(e) => setForm({ ...form, prep_time_minutes: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </Row>
              <Row label="Calories">
                <Input
                  inputMode="numeric"
                  value={form.calories}
                  onChange={(e) => setForm({ ...form, calories: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </Row>
            </div>
            <Row label="Allergens (comma separated)">
              <Input
                value={form.allergens}
                onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                className="h-12 rounded-xl"
              />
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Toggle
                label="Vegetarian"
                value={form.is_vegetarian}
                onChange={(v) => setForm({ ...form, is_vegetarian: v })}
              />
              <Toggle
                label="Vegan"
                value={form.is_vegan}
                onChange={(v) => setForm({ ...form, is_vegan: v })}
              />
              <Toggle
                label="Halaal"
                value={form.is_halaal}
                onChange={(v) => setForm({ ...form, is_halaal: v })}
              />
              <Toggle
                label="Spicy"
                value={form.is_spicy}
                onChange={(v) => setForm({ ...form, is_spicy: v })}
              />
              <Toggle
                label="Available"
                value={form.is_available}
                onChange={(v) => setForm({ ...form, is_available: v })}
              />
            </div>
            <Row label="Photo">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
                <ImagePlus className="size-5" />
                <span className="truncate">{file ? file.name : "Upload a photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </Row>
            <Button
              className="tap-target h-12 w-full rounded-2xl"
              disabled={saving || !form.name}
              onClick={saveItem}
            >
              {saving ? "Saving…" : "Save item"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap-target whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-3 py-3 text-sm">
      {label}
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}
