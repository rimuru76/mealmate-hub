import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your restaurant — MealMate Partners" },
      {
        name: "description",
        content: "Add your restaurant details, branding and plan to go live on MealMate.",
      },
      { property: "og:title", content: "Set up your restaurant — MealMate Partners" },
      { property: "og:description", content: "Restaurant onboarding for MealMate partners." },
    ],
  }),
  component: Onboarding,
});

const CATEGORIES = [
  "Fast food",
  "Family restaurant",
  "Café",
  "Bakery",
  "Pizzeria",
  "Grill / Steakhouse",
  "Chicken",
  "Desserts",
  "Other",
];

function Onboarding() {
  const navigate = useNavigate();
  const { session, loading, refresh, memberships, isPlatformAdmin } = useWorkspace();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    owner_name: "",
    phone: "",
    email: "",
    category: CATEGORIES[0]!,
    description: "",
    address: "",
    city: "",
    province: "",
    country: "South Africa",
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session?.user.email && !form.email) {
      setForm((f) => ({ ...f, email: session.user.email ?? "" }));
    }
  }, [session, form.email]);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!session) return;
    setBusy(true);
    try {
      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!currentUser.user || currentUser.user.id !== session.user.id) {
        throw new Error("Your Supabase session expired. Please sign in again.");
      }

      const { data: created, error } = await supabase
        .from("restaurants")
        .insert({
          owner_id: session.user.id,
          name: form.name.trim(),
          owner_name: form.owner_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          category: form.category,
          description: form.description.trim() || null,
          address: form.address.trim(),
          city: form.city.trim(),
          province: form.province.trim(),
          country: form.country.trim(),
          onboarding_complete: true,
        })
        .select()
        .single();
      if (error) throw error;

      const patch: { logo_url?: string; cover_url?: string } = {};
      if (logo) patch.logo_url = await uploadImage("restaurant-assets", created.id, logo, "logo");
      if (cover) patch.cover_url = await uploadImage("restaurant-assets", created.id, cover, "cover");
      if (Object.keys(patch).length) {
        const { error: brandingError } = await supabase
          .from("restaurants")
          .update(patch)
          .eq("id", created.id);
        if (brandingError) throw brandingError;
      }

      const { error: categoriesError } = await supabase.from("menu_categories").insert(
        ["Breakfast", "Burgers", "Pizza", "Chicken", "Sides", "Drinks", "Desserts"].map(
          (name, i) => ({ restaurant_id: created.id, name, position: i }),
        ),
      );
      if (categoriesError) throw categoriesError;

      if (typeof window !== "undefined") {
        window.localStorage.setItem("mmp.active_restaurant", created.id);
      }
      refresh();
      toast.success(
        isPlatformAdmin
          ? "Restaurant created. Owner access is active with no subscription required."
          : "Restaurant created. Choose your plan to activate everything.",
      );
      navigate({ to: isPlatformAdmin ? "/restaurant" : "/subscription" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create your restaurant.");
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { title: "Restaurant details", valid: form.name && form.owner_name && form.phone },
    { title: "Where are you?", valid: form.address && form.city && form.province },
    { title: "Branding", valid: true },
  ];
  const current = steps[step]!;

  return (
    <div className="min-h-screen bg-background px-5 pb-12 pt-[calc(24px+env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => setStep(step - 1)}
              className="tap-target flex items-center justify-center rounded-2xl border border-border bg-card px-2"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Step {step + 1} of {steps.length}
            </p>
            <h1 className="font-display text-2xl font-semibold">{current.title}</h1>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>

        {memberships.length > 0 ? (
          <p className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            You already manage {memberships.length} restaurant
            {memberships.length > 1 ? "s" : ""}. This will add another one.
          </p>
        ) : null}

        <div className="glass-card space-y-4 rounded-3xl p-5">
          {step === 0 ? (
            <>
              <Field label="Restaurant name">
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} className="h-12 rounded-xl" />
              </Field>
              <Field label="Owner name">
                <Input value={form.owner_name} onChange={(e) => update("owner_name", e.target.value)} className="h-12 rounded-xl" />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} inputMode="tel" className="h-12 rounded-xl" />
              </Field>
              <Field label="Contact email">
                <Input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" className="h-12 rounded-xl" />
              </Field>
              <Field label="Category">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update("category", c)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                        form.category === c
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field label="Street address">
                <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="h-12 rounded-xl" />
              </Field>
              <Field label="City">
                <Input value={form.city} onChange={(e) => update("city", e.target.value)} className="h-12 rounded-xl" />
              </Field>
              <Field label="Province">
                <Input value={form.province} onChange={(e) => update("province", e.target.value)} className="h-12 rounded-xl" />
              </Field>
              <Field label="Country">
                <Input value={form.country} onChange={(e) => update("country", e.target.value)} className="h-12 rounded-xl" />
              </Field>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Field label="Short description">
                <Textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={3}
                  className="rounded-xl"
                  placeholder="Flame-grilled burgers and hand-cut chips, made fresh daily."
                />
              </Field>
              <ImagePicker label="Logo" file={logo} onPick={setLogo} />
              <ImagePicker label="Cover image" file={cover} onPick={setCover} />
            </>
          ) : null}
        </div>

        <Button
          className="tap-target mt-6 h-12 w-full rounded-2xl text-base"
          disabled={!current.valid || busy}
          onClick={() => (step === steps.length - 1 ? submit() : setStep(step + 1))}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {step === steps.length - 1 ? "Create restaurant" : "Continue"}
        </Button>
      </div>
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

function ImagePicker({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
        <ImagePlus className="size-5" />
        <span className="truncate">{file ? file.name : `Upload ${label.toLowerCase()}`}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
