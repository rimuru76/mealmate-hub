import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center rounded-3xl px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="surface-card flex flex-col items-center rounded-3xl px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-6 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-4 tap-target" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-3xl bg-card" />
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label ?? "Loading…"}
    </div>
  );
}
