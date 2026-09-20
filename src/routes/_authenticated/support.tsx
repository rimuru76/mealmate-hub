import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Help centre", "Contact support", "Report a problem", "Feature request", "Account"];
const PRIORITIES = ["low", "normal", "high"];

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — MealMate Partners" },
      { name: "description", content: "Get help from the Taz Technologies support team." },
      { property: "og:title", content: "Support — MealMate Partners" },
      { property: "og:description", content: "Raise and track support tickets." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { restaurant, userId } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    category: CATEGORIES[1]!,
    priority: "normal",
    description: "",
  });

  const query = useQuery({
    queryKey: ["tickets", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("support_tickets").insert({
        restaurant_id: restaurant?.id ?? null,
        created_by: userId!,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", userId] });
      setOpen(false);
      setForm({ ...form, subject: "", description: "" });
      toast.success("Ticket submitted. Our team will get back to you.");
    },
    onError: () => toast.error("Your ticket couldn't be sent. Please try again."),
  });

  return (
    <div className="pb-8">
      <PageHeader
        title="Support"
        subtitle="Taz Technologies is here to help"
        action={
          <Button className="tap-target rounded-2xl" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Ticket
          </Button>
        }
      />

      {query.isLoading ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState
          message="Couldn't load your tickets. Check your connection and try again."
          onRetry={() => query.refetch()}
        />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets yet"
          description="Ask a question, report a problem or request a feature and we'll respond."
        />
      ) : null}

      <div className="space-y-3">
        {(query.data ?? []).map((t) => (
          <article key={t.id} className="surface-card rounded-3xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-sm font-semibold">{t.subject}</h3>
                <p className="text-xs text-muted-foreground">
                  {t.category} · {t.priority} · {shortDate(t.created_at)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-[10px] uppercase",
                  t.status === "resolved" || t.status === "closed"
                    ? "bg-success/15 text-success"
                    : "bg-warning/15 text-warning",
                )}
              >
                {t.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
          </article>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display">New support ticket</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
              <Input
                className="h-12 rounded-xl"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, category: c })}
                  className={cn(
                    "tap-target rounded-full border px-3 py-2 text-xs",
                    form.category === c
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, priority: p })}
                  className={cn(
                    "tap-target flex-1 rounded-2xl border px-3 py-3 text-sm capitalize",
                    form.priority === p
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Description
              </Label>
              <Textarea
                rows={5}
                className="rounded-xl"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <Button
              className="tap-target h-12 w-full rounded-2xl"
              disabled={!form.subject || !form.description || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Sending…" : "Submit ticket"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
