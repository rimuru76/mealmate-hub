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

export type BillingDiagnostics = Awaited<ReturnType<typeof billingDiagnostics>>;

/**
 * Read-only billing diagnostics for owners/managers. Never returns key material —
 * only whether each server-side credential is present, plus catalogue, webhook and
 * subscription health pulled from RevenueCat and the database.
 */
export const billingDiagnostics = createServerFn({ method: "POST" })
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
    const webhookSecret = process.env["REVENUECAT_WEBHOOK_SECRET"];

    // Plan catalogue configured in the backend (source for entitlement mapping).
    const { data: plans } = await supabase
      .from("plans")
      .select("id, name, price_zar, entitlement, is_active")
      .order("position");

    // Webhook health: recent events recorded for this restaurant.
    const { data: events } = await supabase
      .from("subscription_events")
      .select("event_type, entitlement, product_id, created_at")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(
        "status, entitlement, product_id, plan_id, expiration_date, is_trial, revenuecat_customer_id, app_user_id, last_synced_at",
      )
      .eq("restaurant_id", data.restaurantId)
      .maybeSingle();

    let revenuecat: {
      reachable: boolean;
      message: string;
      customerId: string | null;
      entitlements: { id: string; productId: string | null; expires: string | null; active: boolean }[];
      products: { id: string; expires: string | null; store: string | null; periodType: string | null }[];
    } = {
      reachable: false,
      message: "RevenueCat key isn't configured yet.",
      customerId: null,
      entitlements: [],
      products: [],
    };

    if (secret) {
      try {
        const response = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(data.restaurantId)}`,
          { headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" } },
        );
        if (!response.ok) {
          revenuecat.message =
            response.status === 401
              ? "RevenueCat rejected the stored key. Check the secret API key."
              : "Couldn't reach RevenueCat right now. Try again shortly.";
        } else {
          const body = (await response.json()) as {
            subscriber?: {
              original_app_user_id?: string;
              entitlements?: Record<
                string,
                { expires_date: string | null; product_identifier: string | null }
              >;
              subscriptions?: Record<
                string,
                { expires_date: string | null; store: string | null; period_type: string | null }
              >;
            };
          };
          const now = Date.now();
          revenuecat = {
            reachable: true,
            message: "Connected to RevenueCat.",
            customerId: body.subscriber?.original_app_user_id ?? null,
            entitlements: Object.entries(body.subscriber?.entitlements ?? {}).map(([id, v]) => ({
              id,
              productId: v.product_identifier,
              expires: v.expires_date,
              active: !v.expires_date || new Date(v.expires_date).getTime() > now,
            })),
            products: Object.entries(body.subscriber?.subscriptions ?? {}).map(([id, v]) => ({
              id,
              expires: v.expires_date,
              store: v.store,
              periodType: v.period_type,
            })),
          };
        }
      } catch {
        revenuecat.message = "Couldn't reach RevenueCat right now. Try again shortly.";
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      credentials: {
        secretKey: !!secret,
        webhookSecret: !!webhookSecret,
      },
      revenuecat,
      plans: plans ?? [],
      events: events ?? [],
      subscription: subscription ?? null,
    };
  });
