import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ChefHat, ReceiptText, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MealMate Partners — Run your restaurant. Grow your business." },
      {
        name: "description",
        content:
          "MealMate Partners by Taz Technologies: manage orders, menus, branches, staff and revenue for your MealMate restaurant.",
      },
      { property: "og:title", content: "MealMate Partners" },
      {
        property: "og:description",
        content: "The operating system for MealMate restaurants.",
      },
    ],
  }),
  component: Welcome,
});

const SLIDES = [
  {
    icon: UtensilsCrossed,
    title: "Welcome to MealMate Partners",
    body: "Everything you need to run your restaurant in one place.",
  },
  {
    icon: ReceiptText,
    title: "Manage Orders",
    body: "Stay on top of every order, live as it arrives.",
  },
  {
    icon: BarChart3,
    title: "Grow Your Restaurant",
    body: "Understand customers, revenue and performance.",
  },
  {
    icon: ChefHat,
    title: "Let's set up your restaurant",
    body: "Create your account and get your kitchen online in minutes.",
  },
];

function Welcome() {
  const navigate = useNavigate();
  const { session, loading } = useWorkspace();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center bg-background px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
      <div className="h-1 w-12 rounded-full bg-foreground/10" />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
          <slide.icon className="size-7 text-primary" strokeWidth={1.7} />
        </div>
        <p className="mb-9 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          MealMate Partners
        </p>
        <h1 className="max-w-[320px] font-display text-[34px] font-semibold italic leading-[1.14] text-foreground">
          {slide.title}
        </h1>
        <p className="mt-4 max-w-[280px] text-sm font-light leading-relaxed text-muted-foreground">
          {slide.body}
        </p>

        <div className="mt-10 flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
      </div>

      <div className="w-full space-y-3">
        <Button
          size="lg"
          className="tap-target h-13 w-full rounded-xl text-sm font-medium shadow-glow"
          onClick={() => (isLast ? navigate({ to: "/auth" }) : setIndex(index + 1))}
        >
          {isLast ? "Get started" : "Continue"}
        </Button>
        <Button
          variant="outline"
          className="tap-target h-13 w-full rounded-xl bg-card text-sm font-medium text-foreground"
          onClick={() => navigate({ to: "/auth" })}
        >
          Sign in <ArrowRight className="size-4" />
        </Button>
        <p className="pt-2 text-center text-[11px] text-muted-foreground">by Taz Technologies</p>
      </div>
    </div>
  );
}
