import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { ErrorState, Spinner } from "@/components/states";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { useWorkspace } from "@/lib/workspace";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Hours = Record<string, { open: string; close: string; closed: boolean }>;

export const Route = createFileRoute("/_authenticated/restaurant")({
  head: () => ({
    meta: [
      { title: "Restaurant profile — MealMate Partners" },
      { name: "description", content: "Your restaurant details as customers see them on MealMate." },
      { property: "og:title", content: "Restaurant profile — MealMate Partners" },
      { property: "og:description", content: "Update your MealMate storefront details." },
    ],
  }),
  component: RestaurantPage,
});

function RestaurantPage() {
  const { restaurant, isManager, refresh } = useWorkspace();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState({ delivery: true, pickup: true });
  const [hours, setHours] = useState<Hours>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["restaurant-detail", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurant!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const r = query.data;
    if (!r) return;
    setForm({
      name: r.name ?? "",
      description: r.description ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      website: r.website ?? "",
      address: r.address ?? "",
      city: r.city ?? "",
      province: r.province ?? "",
      country: r.country ?? "",
      cuisine: r.cuisine ?? "",
      latitude: r.latitude != null ? String(r.latitude) : "",
      longitude: r.longitude != null ? String(r.longitude) : "",
      minimum_order: String(r.minimum_order ?? 0),
      prep_time_minutes: String(r.prep_time_minutes ?? 20),
    });
    setFlags({ delivery: r.delivery_enabled, pickup: r.pickup_enabled });
    const existing = (r.opening_hours ?? {}) as Hours;
    const next: Hours = {};
    for (const d of DAYS) next[d] = existing[d] ?? { open: "09:00", close: "21:00", closed: false };
    setHours(next);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      setSaving(true);
      let logoRef = query.data?.logo_url ?? null;
      let coverRef = query.data?.cover_url ?? null;
      if (logo) logoRef = await uploadImage("restaurant-assets", restaurant!.id, logo, "logo");
      if (cover) coverRef = await uploadImage("restaurant-assets", restaurant!.id, cover, "cover");
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: form.name,
          description: form.description || null,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          address: form.address || null,
          city: form.city || null,
          province: form.province || null,
          country: form.country || null,
          cuisine: form.cuisine || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          minimum_order: Number(form.minimum_order || 0),
          prep_time_minutes: Number(form.prep_time_minutes || 20),
          delivery_enabled: flags.delivery,
          pickup_enabled: flags.pickup,
          opening_hours: hours,
          logo_url: logoRef,
          cover_url: coverRef,
        })
        .eq("id", restaurant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-detail", restaurant?.id] });
      refresh();
      toast.success("Restaurant profile saved");
      setSaving(false);
    },
    onError: () => {
      toast.error("Your profile couldn't be saved. Check your connection and try again.");
      setSaving(false);
    },
  });

  if (query.isLoading) return <Spinner label="Loading your restaurant…" />;
  if (query.isError)
    return (
      <ErrorState
        message="Couldn't load your restaurant. Check your connection and try again."
        onRetry={() => query.refetch()}
      />
    );

  return (
    <div className="pb-8">
      <PageHeader title="Restaurant" subtitle="How your restaurant appears inside MealMate" />

      <section className="surface-card mb-4 overflow-hidden rounded-3xl">
        <SignedImage
          reference={query.data?.cover_url ?? null}
          alt="Cover"
          className="h-32 w-full"
          fallback={<ImagePlus className="size-5 text-muted-foreground" />}
        />
        <div className="flex items-center gap-3 p-4">
          <SignedImage
            reference={query.data?.logo_url ?? null}
            alt="Logo"
            className="size-14 rounded-2xl"
            fallback={<ImagePlus className="size-4 text-muted-foreground" />}
          />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold">{form.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[form.cuisine, form.city].filter(Boolean).join(" · ") || "Add a cuisine and city"}
            </p>
          </div>
        </div>
      </section>

      <fieldset disabled={!isManager} className="space-y-4">
        {[
          ["name", "Restaurant name"],
          ["cuisine", "Cuisine"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["website", "Website"],
          ["address", "Address"],
          ["city", "City"],
          ["province", "Province"],
          ["country", "Country"],
          ["latitude", "GPS latitude"],
          ["longitude", "GPS longitude"],
          ["minimum_order", "Minimum order (R)"],
          ["prep_time_minutes", "Estimated prep time (min)"],
        ].map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
            <Input
              className="h-12 rounded-xl"
              value={form[key] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
          <Textarea
            rows={4}
            className="rounded-xl"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-3 py-3 text-sm">
            Delivery
            <Switch
              checked={flags.delivery}
              onCheckedChange={(v) => setFlags({ ...flags, delivery: v })}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-3 py-3 text-sm">
            Pickup
            <Switch checked={flags.pickup} onCheckedChange={(v) => setFlags({ ...flags, pickup: v })} />
          </label>
        </div>

        <div className="surface-card space-y-3 rounded-3xl p-4">
          <p className="font-display text-sm font-semibold">Opening hours</p>
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-2">
              <span className="w-10 text-xs uppercase text-muted-foreground">{day}</span>
              <Input
                type="time"
                className="h-11 flex-1 rounded-xl"
                value={hours[day]?.open ?? "09:00"}
                onChange={(e) =>
                  setHours({ ...hours, [day]: { ...hours[day]!, open: e.target.value } })
                }
                disabled={hours[day]?.closed}
              />
              <Input
                type="time"
                className="h-11 flex-1 rounded-xl"
                value={hours[day]?.close ?? "21:00"}
                onChange={(e) =>
                  setHours({ ...hours, [day]: { ...hours[day]!, close: e.target.value } })
                }
                disabled={hours[day]?.closed}
              />
              <Switch
                checked={!hours[day]?.closed}
                onCheckedChange={(v) =>
                  setHours({ ...hours, [day]: { ...hours[day]!, closed: !v } })
                }
                aria-label={`${day} open`}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FilePick label={logo ? logo.name : "Change logo"} onPick={setLogo} />
          <FilePick label={cover ? cover.name : "Change cover"} onPick={setCover} />
        </div>

        {isManager ? (
          <Button
            className="tap-target h-12 w-full rounded-2xl"
            disabled={saving}
            onClick={() => save.mutate()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Only owners and managers can edit the restaurant profile.
          </p>
        )}
      </fieldset>
    </div>
  );
}

function FilePick({ label, onPick }: { label: string; onPick: (f: File | null) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/40 px-3 py-4 text-xs text-muted-foreground">
      <ImagePlus className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
