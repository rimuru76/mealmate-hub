import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@/integrations/firebase/client";

import { firebaseClient } from "@/integrations/firebase/client";
import type { Database } from "@/integrations/firebase/types";

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];

const ACTIVE_KEY = "mmp.active_restaurant";
const ACTIVE_BRANCH_KEY = "mmp.active_branch";

export type PlanFeatures = {
  max_branches: number;
  max_promotions: number;
  max_staff: number;
  advanced_analytics: boolean;
  advanced_staff: boolean;
  premium_tools: boolean;
};

const FREE_FALLBACK: PlanFeatures = {
  max_branches: 1,
  max_promotions: 1,
  max_staff: 2,
  advanced_analytics: false,
  advanced_staff: false,
  premium_tools: false,
};

type WorkspaceValue = {
  session: Session | null;
  userId: string | null;
  email: string | null;
  loading: boolean;
  memberships: { restaurant_id: string; role: MemberRole; restaurant: Restaurant | null }[];
  restaurant: Restaurant | null;
  role: MemberRole | null;
  isOwner: boolean;
  isManager: boolean;
  isPlatformAdmin: boolean;
  subscription: Subscription | null;
  plan: Plan | null;
  features: PlanFeatures;
  subscriptionActive: boolean;
  activeBranchId: string | null;
  setActiveBranch: (id: string | null) => void;
  switchRestaurant: (id: string) => void;
  refresh: () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    firebaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = firebaseClient.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveId(window.localStorage.getItem(ACTIVE_KEY));
    setActiveBranchId(window.localStorage.getItem(ACTIVE_BRANCH_KEY));
  }, []);

  const membershipsQuery = useQuery({
    queryKey: ["memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("restaurant_members")
        .select("restaurant_id, role, restaurants(*)")
        .eq("user_id", userId!)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        restaurant_id: row.restaurant_id,
        role: row.role as MemberRole,
        restaurant: (row.restaurants as Restaurant | null) ?? null,
      }));
    },
  });

  const adminQuery = useQuery({
    queryKey: ["platform-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const memberships = membershipsQuery.data ?? [];
  const current = memberships.find((m) => m.restaurant_id === activeId) ?? memberships[0] ?? null;
  const restaurantId = current?.restaurant_id ?? null;

  const subQuery = useQuery({
    queryKey: ["subscription", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("subscriptions")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const plansQuery = useQuery({
    queryKey: ["plans"],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await firebaseClient
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const subscription = subQuery.data ?? null;
  const plans = plansQuery.data ?? [];
  const plan =
    plans.find((p) => p.entitlement === subscription?.entitlement) ??
    plans.find((p) => p.id === subscription?.plan_id) ??
    null;

  const subscriptionActive =
    !!subscription &&
    (subscription.status === "active" || subscription.status === "trialing") &&
    (!subscription.expiration_date || new Date(subscription.expiration_date) > new Date());

  const features: PlanFeatures = useMemo(() => {
    if (!subscriptionActive || !plan) return FREE_FALLBACK;
    return { ...FREE_FALLBACK, ...((plan.features ?? {}) as Partial<PlanFeatures>) };
  }, [plan, subscriptionActive]);

  const value: WorkspaceValue = {
    session,
    userId,
    email: session?.user.email ?? null,
    loading: sessionLoading || membershipsQuery.isLoading,
    memberships,
    restaurant: current?.restaurant ?? null,
    role: current?.role ?? null,
    isOwner: current?.role === "owner",
    isManager: current?.role === "owner" || current?.role === "manager",
    isPlatformAdmin: adminQuery.data ?? false,
    subscription,
    plan,
    features,
    subscriptionActive,
    activeBranchId,
    setActiveBranch: (id) => {
      setActiveBranchId(id);
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem(ACTIVE_BRANCH_KEY, id);
        else window.localStorage.removeItem(ACTIVE_BRANCH_KEY);
      }
    },
    switchRestaurant: (id) => {
      setActiveId(id);
      setActiveBranchId(null);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_KEY, id);
        window.localStorage.removeItem(ACTIVE_BRANCH_KEY);
      }
      queryClient.invalidateQueries();
    },
    refresh: () => queryClient.invalidateQueries(),
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
