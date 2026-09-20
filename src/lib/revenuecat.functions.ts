import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Entitlement = { expires_date: string | null; product_identifier: string | null };

/**
 * Pulls the authoritative entitlement state for a restaurant from RevenueCat and
 * stores it on the subscription row. The client can never set entitlement state
 * itself — this runs server-side with the RevenueCat secret key.
 */
export const syncSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string }) => {
    if (!input?.restaurantId) throw new Error("restaurantId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership, error: memberError } = await supabase
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", data.restaurantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membership || !["owner", "manager"].includes(membership.role)) {
      throw new Error("Forbidden");
    }

    const secret = process.env["REVENUECAT_SECRET_API_KEY"];
    if (!secret) {
      return {
        ok: false as const,
        reason: "not_configured" as const,
        message: "Billing isn't connected yet. Add your RevenueCat key to enable subscriptions.",
      };
    }

    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(data.restaurantId)}`,
      { headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" } },
    );
    if (!response.ok) {
      return {
        ok: false as const,
        reason: "upstream_error" as const,
        message: "Couldn't reach the billing service. Please try again shortly.",
      };
    }

    const body = (await response.json()) as {
      subscriber?: {
        original_app_user_id?: string;
        entitlements?: Record<string, Entitlement>;
      };
    };

    const entitlements = body.subscriber?.entitlements ?? {};
    const now = Date.now();
    const active = Object.entries(entitlements).find(
      ([, value]) => !value.expires_date || new Date(value.expires_date).getTime() > now,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entitlement = active?.[0] ?? null;
    const productId = active?.[1]?.product_identifier ?? null;
    const expiration = active?.[1]?.expires_date ?? null;

    let planId: string | null = null;
    if (entitlement) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("entitlement", entitlement)
        .maybeSingle();
      planId = plan?.id ?? null;
    }

    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: entitlement ? "active" : "expired",
        entitlement,
        product_id: productId,
        plan_id: planId,
        expiration_date: expiration,
        revenuecat_customer_id: body.subscriber?.original_app_user_id ?? data.restaurantId,
        app_user_id: data.restaurantId,
        last_synced_at: new Date().toISOString(),
      })
      .eq("restaurant_id", data.restaurantId);
    if (updateError) throw updateError;

    return { ok: true as const, entitlement, expiration };
  });
