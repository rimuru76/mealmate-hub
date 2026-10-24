import { createFileRoute } from "@tanstack/react-router";
import type { RevenueCatEvent } from "@/integrations/firebase/billing.server";

export const Route = createFileRoute("/api/public/revenuecat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["REVENUECAT_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const provided = request.headers.get("authorization") ?? "";
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const digest = (value: string) => createHash("sha256").update(value).digest();
        if (
          !timingSafeEqual(digest(provided), digest(`Bearer ${secret}`)) &&
          !timingSafeEqual(digest(provided), digest(secret))
        )
          return new Response("Invalid signature", { status: 401 });
        let payload: { event?: RevenueCatEvent };
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!payload?.event?.app_user_id && !payload?.event?.original_app_user_id)
          return new Response("Missing app_user_id", { status: 400 });
        const { applyRevenueCatEvent } = await import("@/integrations/firebase/billing.server");
        // Throw on persistence failures so RevenueCat retries instead of losing events.
        await applyRevenueCatEvent(payload);
        return Response.json({ received: true });
      },
    },
  },
});
