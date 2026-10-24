import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { defaults } from "./schema";
import { collectionName } from "./collections";
import { getFirebaseAdmin } from "./admin.server";

export type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string | null;
  expiration_at_ms?: number | null;
  period_type?: string | null;
};
const activeEvents = new Set(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"]);

/** Called only after webhook authentication. Persist the audit event and state together. */
export async function applyRevenueCatEvent(payload: { event?: RevenueCatEvent }) {
  const event = payload.event;
  const restaurantId = event?.app_user_id ?? event?.original_app_user_id;
  if (!event || !restaurantId || !/^[A-Za-z0-9_-]{1,128}$/.test(restaurantId))
    throw new Error("Invalid app_user_id.");
  const { db } = getFirebaseAdmin();
  const entitlement = event.entitlement_ids?.[0] ?? event.entitlement_id ?? null;
  const plans = entitlement
    ? await db.collection(collectionName("plans")).where("entitlement", "==", entitlement).get()
    : null;
  const eventId = createHash("sha256")
    .update(event.id ?? JSON.stringify(payload))
    .digest("hex");
  const eventRef = db.collection(collectionName("subscription_events")).doc(eventId);
  const subscriptionRef = db.collection(collectionName("subscriptions")).doc(restaurantId);
  const type = event.type ?? "UNKNOWN";
  const expiration = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  let status = "expired";
  if (activeEvents.has(type)) status = event.period_type === "TRIAL" ? "trialing" : "active";
  else if (type === "CANCELLATION") status = "cancelled";
  else if (type === "BILLING_ISSUE") status = "past_due";
  await db.runTransaction(async (tx) => {
    const existingEvent = await tx.get(eventRef);
    const restaurant = await tx.get(db.collection("restaurants").doc(restaurantId));
    const subscription = await tx.get(subscriptionRef);
    if (existingEvent.exists) return;
    if (!restaurant.exists) throw new Error("Restaurant subscription not found.");
    const now = new Date().toISOString();
    tx.create(eventRef, {
      id: eventId,
      restaurant_id: restaurantId,
      event_type: type,
      entitlement,
      product_id: event.product_id ?? null,
      payload,
      created_at: now,
    });
    tx.set(subscriptionRef, {
      ...(!subscription.exists
        ? Object.fromEntries(
            Object.entries(defaults["subscriptions"]).map(([k, v]) => [k, v === "$now" ? now : v]),
          )
        : subscription.data()),
      id: restaurantId,
      restaurant_id: restaurantId,
      status,
      entitlement,
      plan_id: plans?.docs[0]?.id ?? null,
      product_id: event.product_id ?? null,
      expiration_date: expiration,
      is_trial: event.period_type === "TRIAL",
      revenuecat_customer_id: event.original_app_user_id ?? restaurantId,
      app_user_id: restaurantId,
      last_synced_at: now,
      updated_at: now,
    });
  });
}
