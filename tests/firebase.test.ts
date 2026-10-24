import { collectionName } from "../src/integrations/firebase/collections";
import { storeImage, removeImage } from "../src/integrations/firebase/storage.server";
import { applyRevenueCatEvent } from "../src/integrations/firebase/billing.server";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { createRepository, type Actor } from "../src/integrations/firebase/repository.server";
import { getFirebaseAdmin } from "../src/integrations/firebase/admin.server";

if (!process.env["FIRESTORE_EMULATOR_HOST"] || !process.env["FIREBASE_AUTH_EMULATOR_HOST"])
  throw new Error("Run these tests against Firebase emulators only.");
process.env["FIREBASE_PROJECT_ID"] = "demo-mealmate";
const owner: Actor = {
  uid: "owner",
  email: "owner@example.test",
  emailVerified: true,
  admin: false,
};
const stranger: Actor = {
  uid: "stranger",
  email: "stranger@example.test",
  emailVerified: true,
  admin: false,
};
const staff: Actor = {
  uid: "staff",
  email: "staff@example.test",
  emailVerified: true,
  admin: false,
};
const ownerRepo = createRepository(owner);
const strangerRepo = createRepository(stranger);
const staffRepo = createRepository(staff);
const trusted = createRepository(null);
let env: RulesTestEnvironment;
let restaurantId: string;
let otherId: string;
let orderId: string;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mealmate",
    firestore: { rules: readFileSync("firebase/firestore.rules", "utf8") },
    storage: { rules: readFileSync("firebase/storage.rules", "utf8") },
  });
  await env.clearFirestore();
  const created = await ownerRepo
    .from("restaurants")
    .insert({ name: "Owner Grill", owner_id: owner.uid })
    .single();
  expect(created.error).toBeNull();
  restaurantId = created.data!.id;
  const other = await strangerRepo
    .from("restaurants")
    .insert({ name: "Other Grill", owner_id: stranger.uid })
    .single();
  expect(other.error).toBeNull();
  otherId = other.data!.id;
  const member = await trusted.from("restaurant_members").insert({
    id: `${restaurantId}_${staff.uid}`,
    restaurant_id: restaurantId,
    user_id: staff.uid,
    role: "staff",
  });
  expect(member.error).toBeNull();
  const order = await trusted.from("orders").insert({ restaurant_id: restaurantId }).single();
  expect(order.error).toBeNull();
  orderId = order.data!.id;
}, 30000);

afterAll(async () => {
  await env?.cleanup();
});

test("onboarding atomically creates membership, subscription and document defaults", async () => {
  const memberships = await ownerRepo
    .from("restaurant_members")
    .select("restaurant_id, role, restaurants(*)")
    .eq("user_id", owner.uid);
  expect(memberships.error).toBeNull();
  expect(memberships.data?.[0]?.role).toBe("owner");
  expect(memberships.data?.[0]?.restaurants?.name).toBe("Owner Grill");
  const subscription = await ownerRepo
    .from("subscriptions")
    .eq("restaurant_id", restaurantId)
    .single();
  expect(subscription.data?.status).toBe("none");
  const restaurant = await ownerRepo.from("restaurants").eq("id", restaurantId).single();
  expect(restaurant.data?.is_suspended).toBe(false);
  expect(restaurant.data?.country).toBe("South Africa");
});

test("server queries and mutations isolate restaurant data", async () => {
  const read = await strangerRepo.from("orders").eq("restaurant_id", restaurantId);
  expect(read.data).toEqual([]);
  const mutation = await strangerRepo
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);
  expect(mutation.data).toEqual([]);
  expect((await ownerRepo.from("orders").eq("id", orderId).single()).data?.status).toBe("new");
  expect(
    (await strangerRepo.from("menu_items").insert({ restaurant_id: restaurantId, name: "Attack" }))
      .error,
  ).not.toBeNull();
  expect(
    (await ownerRepo.from("restaurants").insert({ name: "Attack", owner_id: stranger.uid })).error,
  ).not.toBeNull();
});

test("staff may update orders, but cannot edit menus, billing or grant roles", async () => {
  expect(
    (await staffRepo.from("orders").update({ status: "accepted" }).eq("id", orderId)).error,
  ).toBeNull();
  expect(
    (await staffRepo.from("menu_items").insert({ restaurant_id: restaurantId, name: "Staff Item" }))
      .error,
  ).not.toBeNull();
  expect(
    (
      await ownerRepo
        .from("subscriptions")
        .update({ status: "active" })
        .eq("restaurant_id", restaurantId)
    ).error,
  ).not.toBeNull();
  expect(
    (await ownerRepo.from("user_roles").insert({ user_id: owner.uid, role: "admin" })).error,
  ).not.toBeNull();
  expect(
    (
      await ownerRepo
        .from("restaurant_members")
        .update({ role: "owner" })
        .eq("id", `${restaurantId}_${staff.uid}`)
    ).error,
  ).not.toBeNull();
  expect(
    (
      await ownerRepo
        .from("restaurant_members")
        .update({ is_active: false })
        .eq("id", `${restaurantId}_${owner.uid}`)
    ).error,
  ).not.toBeNull();
});

test("cross-restaurant references and invalid input are rejected without partial documents", async () => {
  const branch = await strangerRepo
    .from("branches")
    .insert({ restaurant_id: otherId, name: "Other branch" })
    .single();
  expect(branch.error).toBeNull();
  expect(
    (
      await ownerRepo
        .from("menu_items")
        .insert({ restaurant_id: restaurantId, branch_id: branch.data!.id, name: "Attack" })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await ownerRepo.from("menu_items").insert([
        { restaurant_id: restaurantId, name: "Good" },
        { restaurant_id: otherId, name: "Bad" },
      ])
    ).error,
  ).not.toBeNull();
  expect((await ownerRepo.from("menu_items").eq("restaurant_id", restaurantId)).data).toEqual([]);
});

test("notifications, preferences, counts and nested order items preserve screen contracts", async () => {
  await trusted.from("notifications").insert([
    { restaurant_id: restaurantId, user_id: null, type: "order", title: "Owner notification" },
    { restaurant_id: otherId, user_id: null, type: "order", title: "Other notification" },
  ]);
  const notifications = await ownerRepo
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  expect(notifications.data?.length).toBe(1);
  expect((await strangerRepo.from("notifications").select()).data?.[0]?.is_read).toBe(false);
  expect(
    (
      await ownerRepo
        .from("notification_preferences")
        .upsert({ user_id: owner.uid, billing: false }, { onConflict: "user_id" })
    ).error,
  ).toBeNull();
  expect(
    (
      await ownerRepo
        .from("notification_preferences")
        .upsert({ user_id: owner.uid, new_orders: false }, { onConflict: "user_id" })
    ).error,
  ).toBeNull();
  const prefs = await ownerRepo.from("notification_preferences").eq("user_id", owner.uid).single();
  expect(prefs.data?.billing).toBe(false);
  expect(prefs.data?.new_orders).toBe(false);
  const item = await trusted
    .from("order_items")
    .insert({ restaurant_id: restaurantId, order_id: orderId, name: "Burger", quantity: 2 })
    .single();
  expect(item.error).toBeNull();
  await trusted
    .from("order_item_modifiers")
    .insert({ restaurant_id: restaurantId, order_item_id: item.data!.id, name: "Cheese" });
  const order = await ownerRepo
    .from("orders")
    .select("*, order_items(*, order_item_modifiers(*))")
    .eq("id", orderId)
    .single();
  expect(
    (order.data as unknown as { order_items: { order_item_modifiers: { name: string }[] }[] })
      .order_items[0]?.order_item_modifiers[0]?.name,
  ).toBe("Cheese");
  const count = await ownerRepo
    .from("orders")
    .select("id", { head: true, count: "exact" })
    .eq("restaurant_id", restaurantId);
  expect(count.count).toBe(1);
  expect(count.data).toBeNull();
});

test("shared Consumer rules remain intact and partner browser writes stay denied", async () => {
  const ownDb = env.authenticatedContext(owner.uid).firestore();
  const otherDb = env.authenticatedContext(stranger.uid).firestore();
  await assertFails(getDoc(doc(ownDb, "restaurant_orders", orderId)));
  await assertFails(getDoc(doc(otherDb, "restaurant_orders", orderId)));
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), "restaurant_orders", orderId)),
  );
  await assertFails(setDoc(doc(ownDb, "restaurant_orders", orderId), { total: 0 }));
  await assertFails(setDoc(doc(ownDb, "hub_subscriptions", restaurantId), { status: "active" }));
  // Consumer catalog reads keep their existing approved/non-demo boundary.
  const { db } = getFirebaseAdmin();
  await db
    .collection("restaurants")
    .doc(restaurantId)
    .update({ approval_status: "approved", is_demo: false });
  await assertSucceeds(getDoc(doc(otherDb, "restaurants", restaurantId)));
  await assertFails(getDoc(doc(otherDb, "restaurants", otherId)));
});

test("Consumer orders and lines appear in Partners, with safe status transitions", async () => {
  const { db } = getFirebaseAdmin();
  const id = "consumer-order";
  await db.collection("restaurant_orders").doc(id).set({
    id,
    restaurant_id: restaurantId,
    customer_id: "customer",
    status: "new",
    fulfillment_type: "pickup",
    discount_total: 5,
    total: 45,
    payment_status: "unpaid",
    placed_at: new Date().toISOString(),
  });
  await db
    .collection("order_items")
    .doc("consumer-line")
    .set({
      id: "consumer-line",
      order_id: id,
      name: "Consumer Burger",
      quantity: 2,
      unit_price: 25,
      line_total: 50,
      modifiers: [{ option_name: "Cheese", price_delta: 3 }],
    });
  const result = await ownerRepo
    .from("orders")
    .select("*, order_items(*,order_item_modifiers(*))")
    .eq("id", id)
    .single();
  expect(result.data?.fulfillment).toBe("pickup");
  const line = (
    result.data as unknown as {
      order_items: { total_price: number; order_item_modifiers: { name: string }[] }[];
    }
  ).order_items[0]!;
  expect(line.total_price).toBe(50);
  expect(line.order_item_modifiers[0]?.name).toBe("Cheese");
  expect(
    (await ownerRepo.from("orders").update({ status: "completed" }).eq("id", id)).error,
  ).not.toBeNull();
  expect((await ownerRepo.from("orders").update({ total: 0 }).eq("id", id)).error).not.toBeNull();
  expect(
    (await ownerRepo.from("orders").update({ status: "accepted" }).eq("id", id)).error,
  ).toBeNull();
  expect((await db.collection("restaurant_orders").doc(id).get()).data()?.["status"]).toBe(
    "accepted",
  );
});

test("catalog uploads enforce membership, file signatures and shared public image URLs", async () => {
  const data = {
    path: `menu-images/${restaurantId}/test.webp`,
    contentType: "image/webp",
    base64: Buffer.from("RIFF0000WEBP0000").toString("base64"),
  };
  await expect(storeImage(strangerRepo, data)).rejects.toThrow();
  await expect(storeImage(staffRepo, data)).rejects.toThrow();
  await expect(
    storeImage(ownerRepo, { ...data, base64: Buffer.from("not an image").toString("base64") }),
  ).rejects.toThrow("valid");
  const stored = await storeImage(ownerRepo, data);
  expect((await fetch(stored.url)).status).toBe(200);
  await expect(removeImage(strangerRepo, stored.url)).rejects.toThrow();
  await removeImage(ownerRepo, stored.url);
});

test("ownership invitations require admin authorization and a verified matching email", async () => {
  const admin = createRepository({ ...owner, admin: true });
  const args = {
    p_name: "Invited Grill",
    p_owner_name: "Invited Owner",
    p_owner_email: "invitee@example.test",
  };
  expect((await ownerRepo.rpc("create_restaurant_owner_invite", args)).error).not.toBeNull();
  const created = await admin.rpc("create_restaurant_owner_invite", args);
  expect(created.error).toBeNull();
  expect((await admin.rpc("create_restaurant_owner_invite", args)).error).not.toBeNull();
  const unverified = createRepository({
    uid: "invitee",
    email: "invitee@example.test",
    emailVerified: false,
    admin: false,
  });
  expect((await unverified.rpc("claim_restaurant_owner_invites", {})).data).toBe(0);
  const verified = createRepository({
    uid: "invitee",
    email: "invitee@example.test",
    emailVerified: true,
    admin: false,
  });
  expect((await verified.rpc("claim_restaurant_owner_invites", {})).data).toBe(1);
  expect(
    (
      await verified
        .from("restaurants")
        .eq("id", (created.data as { id: string }).id)
        .single()
    ).data?.owner_id,
  ).toBe("invitee");
  expect((await verified.rpc("claim_restaurant_owner_invites", {})).data).toBe(0);
});

test("restaurant deletion cleans up Firestore dependencies", async () => {
  const deleted = await strangerRepo.from("restaurants").delete().eq("id", otherId);
  expect(deleted.error).toBeNull();
  const { db } = getFirebaseAdmin();
  expect(
    (
      await db
        .collection(collectionName("restaurant_members"))
        .where("restaurant_id", "==", otherId)
        .get()
    ).empty,
  ).toBe(true);
  expect(
    (await db.collection(collectionName("branches")).where("restaurant_id", "==", otherId).get())
      .empty,
  ).toBe(true);
  expect((await db.collection(collectionName("subscriptions")).doc(otherId).get()).exists).toBe(
    false,
  );
});

test("staff invitations accept only a verified matching email", async () => {
  const invited = {
    uid: "new-staff",
    email: "new-staff@example.test",
    emailVerified: false,
    admin: false,
  };
  const invite = await ownerRepo
    .from("staff_invites")
    .insert({ restaurant_id: restaurantId, email: invited.email, role: "staff" });
  expect(invite.error).toBeNull();
  expect((await createRepository(invited).rpc("claim_restaurant_owner_invites", {})).data).toBe(0);
  const verified = createRepository({ ...invited, emailVerified: true });
  expect((await verified.rpc("claim_restaurant_owner_invites", {})).data).toBe(1);
  expect(
    (await verified.from("restaurant_members").eq("user_id", invited.uid).single()).data?.role,
  ).toBe("staff");
});

test("deleting a menu item cascades modifiers and preserves historical order lines", async () => {
  const menu = await ownerRepo
    .from("menu_items")
    .insert({ restaurant_id: restaurantId, name: "Historical Burger" })
    .single();
  const group = await trusted
    .from("modifier_groups")
    .insert({ restaurant_id: restaurantId, menu_item_id: menu.data!.id, name: "Extras" })
    .single();
  const modifier = await trusted
    .from("modifiers")
    .insert({ restaurant_id: restaurantId, group_id: group.data!.id, name: "Cheese" })
    .single();
  expect(modifier.error).toBeNull();
  const item = await trusted
    .from("order_items")
    .insert({
      restaurant_id: restaurantId,
      order_id: orderId,
      menu_item_id: menu.data!.id,
      name: "Historical Burger",
    })
    .single();
  expect(item.error).toBeNull();
  expect((await ownerRepo.from("menu_items").delete().eq("id", menu.data!.id)).error).toBeNull();
  expect((await trusted.from("modifiers").eq("id", modifier.data!.id)).data).toEqual([]);
  expect(
    (await trusted.from("order_items").eq("id", item.data!.id).single()).data?.menu_item_id,
  ).toBeNull();
});

test("billing webhook updates are atomic and duplicate events are idempotent", async () => {
  const event = {
    event: {
      id: "test-renewal",
      type: "RENEWAL",
      app_user_id: restaurantId,
      entitlement_ids: ["pro"],
      product_id: "pro-monthly",
    },
  };
  await applyRevenueCatEvent(event);
  await applyRevenueCatEvent(event);
  const { db } = getFirebaseAdmin();
  const events = await db
    .collection(collectionName("subscription_events"))
    .where("restaurant_id", "==", restaurantId)
    .get();
  expect(events.size).toBe(1);
  expect(
    (await ownerRepo.from("subscriptions").eq("restaurant_id", restaurantId).single()).data?.status,
  ).toBe("active");
  let missingError: unknown;
  try {
    await applyRevenueCatEvent({
      event: { ...event.event, id: "bad-restaurant", app_user_id: "missing-restaurant" },
    });
  } catch (error) {
    missingError = error;
  }
  expect(missingError).toBeInstanceOf(Error);
  expect(
    (
      await db
        .collection(collectionName("subscription_events"))
        .where("restaurant_id", "==", "missing-restaurant")
        .get()
    ).empty,
  ).toBe(true);
});

test("shared catalog fields and approval survive partner edits", async () => {
  const { db } = getFirebaseAdmin();
  await db
    .collection("restaurants")
    .doc(restaurantId)
    .update({ approval_status: "approved", currency: "ZAR", is_accepting_orders: true });
  expect(
    (await ownerRepo.from("restaurants").update({ name: "Updated Grill" }).eq("id", restaurantId))
      .error,
  ).toBeNull();
  const restaurant = (await db.collection("restaurants").doc(restaurantId).get()).data()!;
  expect(restaurant["approval_status"]).toBe("approved");
  expect(restaurant["is_accepting_orders"]).toBe(true);
  const category = await ownerRepo
    .from("menu_categories")
    .insert({ restaurant_id: restaurantId, name: "Grills" })
    .single();
  const item = await ownerRepo
    .from("menu_items")
    .insert({
      restaurant_id: restaurantId,
      category_id: category.data!.id,
      name: "Consumer Grill",
      price: 45,
      is_vegetarian: true,
    })
    .single();
  expect(item.error).toBeNull();
  const raw = (await db.collection("menu_items").doc(item.data!.id).get()).data()!;
  expect(raw["category"]).toBe("Grills");
  expect(raw["dietary_tags"]).toContain("vegetarian");
  expect(raw["is_hidden"]).toBe(false);
  expect(raw["sort_order"]).toBe(0);
});

test("deactivating staff revokes both apps and old invitations cannot restore access", async () => {
  const { db } = getFirebaseAdmin();
  const id = `${restaurantId}_${staff.uid}`;
  expect(
    (await ownerRepo.from("restaurant_members").update({ is_active: false }).eq("id", id)).error,
  ).toBeNull();
  expect((await db.collection("restaurant_staff").doc(id).get()).exists).toBe(false);
  expect((await staffRepo.from("orders").eq("restaurant_id", restaurantId)).data).toEqual([]);
  const members = await ownerRepo.from("restaurant_members").eq("restaurant_id", restaurantId);
  expect(members.data?.find((m) => m.id === id)?.is_active).toBe(false);
  await trusted
    .from("staff_invites")
    .insert({ restaurant_id: restaurantId, email: staff.email, role: "manager" });
  expect((await staffRepo.rpc("claim_restaurant_owner_invites", {})).error).toBeNull();
  expect((await db.collection("restaurant_staff").doc(id).get()).exists).toBe(false);
  expect(
    (await ownerRepo.from("restaurant_members").update({ is_active: true }).eq("id", id)).error,
  ).toBeNull();
  expect(
    (await staffRepo.from("orders").eq("restaurant_id", restaurantId)).data?.length,
  ).toBeGreaterThan(0);
});

test("existing accounts can save a partner profile and existing restaurants initialize partner billing", async () => {
  const { db } = getFirebaseAdmin();
  await db.collection("users").doc(owner.uid).set({ full_name: "Consumer Owner" });
  expect((await ownerRepo.from("profiles").eq("id", owner.uid).single()).data?.full_name).toBe(
    "Consumer Owner",
  );
  expect(
    (
      await ownerRepo
        .from("profiles")
        .upsert({ id: owner.uid, full_name: "Partner Owner" }, { onConflict: "id" })
    ).error,
  ).toBeNull();
  expect((await ownerRepo.from("profiles").eq("id", owner.uid).single()).data?.full_name).toBe(
    "Partner Owner",
  );
  await db.collection("hub_subscriptions").doc(restaurantId).delete();
  await applyRevenueCatEvent({
    event: { id: "existing-partner-renewal", type: "RENEWAL", app_user_id: restaurantId },
  });
  expect(
    (await ownerRepo.from("subscriptions").eq("restaurant_id", restaurantId).single()).data?.status,
  ).toBe("active");
});

test("explicit null cannot bypass database defaults", async () => {
  expect(
    (
      await ownerRepo
        .from("menu_items")
        .insert({ restaurant_id: restaurantId, name: "Invalid price", price: null })
    ).error,
  ).not.toBeNull();
  expect(
    (await ownerRepo.from("restaurants").update({ delivery_enabled: null }).eq("id", restaurantId))
      .error,
  ).not.toBeNull();
});
