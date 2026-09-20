import { createFileRoute } from "@tanstack/react-router";

type RcEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string | null;
  expiration_at_ms?: number | null;
  period_type?: string | null;
};

const ACTIVE_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"]);

export const Route = createFileRoute("/api/public/revenuecat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["REVENUECAT_WEBHOOK_SECRET"];
        if (!secret) {
          return new Response("Webhook not configured", { status: 503 });
        }
        const provided = request.headers.get("authorization") ?? "";
        if (provided !== `Bearer ${secret}` && provided !== secret) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = (await request.json()) as { event?: RcEvent };
        const event = payload.event ?? {};
        const restaurantId = event.app_user_id ?? event.original_app_user_id ?? null;
        if (!restaurantId) return new Response("Missing app_user_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const entitlement = event.entitlement_ids?.[0] ?? event.entitlement_id ?? null;
        const type = event.type ?? "UNKNOWN";
        const expiration = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        let status: "active" | "trialing" | "cancelled" | "expired" | "past_due" = "expired";
        if (ACTIVE_EVENTS.has(type)) status = event.period_type === "TRIAL" ? "trialing" : "active";
        else if (type === "CANCELLATION") status = "cancelled";
        else if (type === "BILLING_ISSUE") status = "past_due";
        else if (type === "EXPIRATION") status = "expired";

        let planId: string | null = null;
        if (entitlement) {
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("id")
            .eq("entitlement", entitlement)
            .maybeSingle();
          planId = plan?.id ?? null;
        }

        await supabaseAdmin.from("subscription_events").insert({
          restaurant_id: restaurantId,
          event_type: type,
          entitlement,
          product_id: event.product_id ?? null,
          payload: payload as never,
        });

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status,
            entitlement,
            plan_id: planId,
            product_id: event.product_id ?? null,
            expiration_date: expiration,
            is_trial: event.period_type === "TRIAL",
            revenuecat_customer_id: event.original_app_user_id ?? restaurantId,
            app_user_id: restaurantId,
            last_synced_at: new Date().toISOString(),
          })
          .eq("restaurant_id", restaurantId);

        return Response.json({ received: true });
      },
    },
  },
});
