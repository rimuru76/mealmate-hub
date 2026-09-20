import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, ChefHat, ReceiptText, UtensilsCrossed } from "lucide-react";
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
    <div className="flex min-h-screen flex-col bg-background px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(32px+env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <div className="brand-gradient flex size-9 items-center justify-center rounded-xl">
          <ChefHat className="size-5 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold">MealMate Partners</p>
          <p className="text-[11px] text-muted-foreground">by Taz Technologies</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="glass-card rounded-[28px] p-8">
          <div className="brand-gradient mb-6 flex size-14 items-center justify-center rounded-2xl shadow-glow">
            <slide.icon className="size-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-semibold leading-tight">{slide.title}</h1>
          <p className="mt-3 text-base text-muted-foreground">{slide.body}</p>
        </div>

        <div className="mt-6 flex justify-center gap-2">
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

      <div className="space-y-3">
        <Button
          size="lg"
          className="tap-target h-12 w-full rounded-2xl text-base"
          onClick={() => (isLast ? navigate({ to: "/auth" }) : setIndex(index + 1))}
        >
          {isLast ? "Get started" : "Continue"}
        </Button>
        <Button
          variant="ghost"
          className="tap-target h-11 w-full rounded-2xl text-muted-foreground"
          onClick={() => navigate({ to: "/auth" })}
        >
          I already have an account
        </Button>
      </div>
    </div>
  );
}
