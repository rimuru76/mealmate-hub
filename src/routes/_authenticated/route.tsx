import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/states";
import { firebaseClient } from "@/integrations/firebase/client";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await firebaseClient.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, memberships } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && memberships.length === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, memberships.length, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner label="Loading your restaurant…" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
