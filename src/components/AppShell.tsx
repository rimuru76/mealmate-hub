import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  Grid2x2,
  LayoutDashboard,
  type LucideIcon,
  ReceiptText,
  UtensilsCrossed,
} from "lucide-react";
import type { ReactNode } from "react";

import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ReceiptText },
  { to: "/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/more", label: "More", icon: Grid2x2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background pb-[calc(76px+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        <a
          href="https://mealsmates.site"
          className="mb-4 inline-flex text-xs text-muted-foreground underline"
        >
          MealMate Consumer ↗
        </a>
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((tab) => {
            const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "tap-target flex flex-1 flex-col items-center gap-1 rounded-xl py-3 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className={cn("size-5", active && "drop-shadow")} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <header className="mb-5 flex items-start gap-3">
      {back ? (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate({ to: "/more" })}
          className="tap-target mt-0.5 flex items-center justify-center rounded-xl border border-border bg-card px-2 text-muted-foreground shadow-card"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
      <div className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function SubscriptionBanner() {
  const { subscriptionActive, subscription, isManager } = useWorkspace();
  if (subscriptionActive || !isManager) return null;
  return (
    <Link
      to="/subscription"
      className="mb-4 block rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
    >
      <span className="font-semibold text-warning">Your subscription needs attention.</span>{" "}
      <span className="text-muted-foreground">
        {subscription?.status === "expired" || subscription?.status === "past_due"
          ? "Premium features are limited until you renew."
          : "Choose a plan to unlock the full MealMate Partners toolkit."}
      </span>
    </Link>
  );
}
