import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChefHat, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";

type Mode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MealMate Partners" },
      {
        name: "description",
        content: "Sign in or create your MealMate Partners restaurant account.",
      },
      { property: "og:title", content: "Sign in — MealMate Partners" },
      { property: "og:description", content: "Access your MealMate restaurant dashboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useWorkspace();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/onboarding" });
        } else {
          toast.success("Check your inbox to verify your email, then sign in.");
          setMode("signin");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent. Check your email.");
        setMode("signin");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="brand-gradient flex size-11 items-center justify-center rounded-2xl shadow-glow">
            <ChefHat className="size-6 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold">MealMate Partners</p>
            <p className="text-xs text-muted-foreground">Run your restaurant. Grow your business.</p>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6">
          <h1 className="font-display text-2xl font-semibold">
            {mode === "signup"
              ? "Create your account"
              : mode === "signin"
                ? "Welcome back"
                : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We'll email you a secure link to set a new password."
              : "Use your restaurant email address."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" ? (
              <div className="space-y-2">
                <Label htmlFor="fullName">Your name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Thabo Nkosi"
                  required
                  className="h-12 rounded-xl"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.co.za"
                required
                className="h-12 rounded-xl"
              />
            </div>

            {mode !== "forgot" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="h-12 rounded-xl"
                />
              </div>
            ) : null}

            <Button type="submit" disabled={busy} className="tap-target h-12 w-full rounded-2xl text-base">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm">
            {mode !== "forgot" ? (
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode("forgot")}
              >
                Forgot password?
              </button>
            ) : null}
            <p className="text-muted-foreground">
              {mode === "signup" ? "Already a partner?" : "New to MealMate?"}{" "}
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
