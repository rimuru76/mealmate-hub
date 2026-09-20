import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — MealMate Partners" },
      { name: "description", content: "Choose a new password for your MealMate Partners account." },
      { property: "og:title", content: "Set a new password — MealMate Partners" },
      { property: "og:description", content: "Secure password reset for restaurant partners." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="glass-card w-full max-w-md rounded-3xl p-6">
        <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open this page from the reset link we emailed you.
        </p>
        <div className="mt-6 space-y-2">
          <Label htmlFor="pw">New password</Label>
          <Input
            id="pw"
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <Button type="submit" disabled={busy} className="tap-target mt-6 h-12 w-full rounded-2xl">
          Update password
        </Button>
      </form>
    </div>
  );
}
