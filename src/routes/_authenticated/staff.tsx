import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { firebaseClient } from "@/integrations/firebase/client";
import { shortDate } from "@/lib/format";
import { useWorkspace, type MemberRole } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff — MealMate Partners" },
      { name: "description", content: "Invite your team and control what each person can do." },
      { property: "og:title", content: "Staff — MealMate Partners" },
      { property: "og:description", content: "Role-based team management." },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const { restaurant, isManager, isOwner, features } = useWorkspace();
  const restaurantId = restaurant?.id ?? null;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("staff");

  const membersQuery = useQuery({
    queryKey: ["members", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("restaurant_members")
        .select("id, role, is_active, user_id, created_at")
        .eq("restaurant_id", restaurantId!);
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profiles } = await firebaseClient
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        for (const p of profiles ?? []) names.set(p.id, p.full_name ?? "Team member");
      }
      return (data ?? []).map((m) => ({ ...m, full_name: names.get(m.user_id) ?? "Team member" }));
    },
  });

  const invitesQuery = useQuery({
    queryKey: ["invites", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("staff_invites")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await firebaseClient.from("staff_invites").insert({
        restaurant_id: restaurantId!,
        email: email.trim().toLowerCase(),
        role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites", restaurantId] });
      setOpen(false);
      setEmail("");
      toast.success("Invitation created. They'll join once they sign up with this email.");
    },
    onError: () => toast.error("Invitation couldn't be sent. Please try again."),
  });

  const toggleMember = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await firebaseClient
        .from("restaurant_members")
        .update({ is_active: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", restaurantId] }),
    onError: () => toast.error("Couldn't update this team member."),
  });

  const teamSize = membersQuery.data?.length ?? 0;

  return (
    <div className="pb-8">
      <PageHeader
        title="Staff"
        subtitle={`${teamSize} of ${features.max_staff} seats used`}
        action={
          isManager ? (
            <Button
              className="tap-target rounded-2xl"
              onClick={() => {
                if (teamSize >= features.max_staff) {
                  toast.error("Your plan's staff limit is reached. Upgrade to add more people.");
                  return;
                }
                setOpen(true);
              }}
            >
              <UserPlus className="size-4" /> Invite
            </Button>
          ) : undefined
        }
      />

      {membersQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {membersQuery.isError ? (
        <ErrorState
          message="Couldn't load your team. Check your connection and try again."
          onRetry={() => membersQuery.refetch()}
        />
      ) : null}

      <div className="space-y-3">
        {(membersQuery.data ?? []).map((m) => (
          <article
            key={m.id}
            className="surface-card flex items-center justify-between rounded-3xl p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">{m.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {m.role} · joined {shortDate(m.created_at)}
              </p>
            </div>
            {isOwner && m.role !== "owner" ? (
              <Button
                variant="secondary"
                className="tap-target rounded-2xl"
                onClick={() => toggleMember.mutate({ id: m.id, value: !m.is_active })}
              >
                {m.is_active ? "Disable" : "Enable"}
              </Button>
            ) : (
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] uppercase",
                  m.is_active ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
                )}
              >
                {m.is_active ? "Active" : "Disabled"}
              </span>
            )}
          </article>
        ))}
      </div>

      <h2 className="mb-3 mt-6 font-display text-sm font-semibold">Pending invitations</h2>
      {(invitesQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title="No invitations"
          description="Invite a manager or staff member to help run your restaurant."
        />
      ) : (
        <div className="space-y-2">
          {(invitesQuery.data ?? []).map((i) => (
            <div
              key={i.id}
              className="surface-card flex items-center justify-between rounded-2xl p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{i.email}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {i.role} · {i.status}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{shortDate(i.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display">Invite a team member</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
              <Input
                type="email"
                className="h-12 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["manager", "staff"] as MemberRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "tap-target flex-1 rounded-2xl border px-3 py-3 text-sm capitalize",
                    role === r
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button
              className="tap-target h-12 w-full rounded-2xl"
              disabled={!email || invite.isPending}
              onClick={() => invite.mutate()}
            >
              {invite.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
