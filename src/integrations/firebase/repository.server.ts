import "@tanstack/react-start/server-only";
import { createHash, randomUUID } from "node:crypto";
import type { DocumentData, Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { collectionName } from "./collections";
import { decodeMarketplace, encodeMarketplace } from "./marketplace";
import { getFirebaseAdmin } from "./admin.server";
import { defaults, fieldTypes, relationships, requiredFields, nonNullFields } from "./schema";
import { DocumentQuery, matchesFilters, type DataResult, type QuerySpec } from "./query";
import type { TableName } from "./types";

type Row = Record<string, unknown> & { id: string };
export type Actor = { uid: string; email: string | null; emailVerified: boolean; admin: boolean };
const tableNames = Object.keys(defaults) as [TableName, ...TableName[]];
const specSchema = z.object({
  table: z.enum(tableNames),
  action: z.enum(["select", "insert", "update", "delete", "upsert"]),
  filters: z
    .array(
      z.object({
        field: z.string().regex(/^\w+$/),
        op: z.enum(["eq", "in", "gte", "ilike"]),
        value: z.unknown(),
      }),
    )
    .max(20),
  fields: z.string().max(1000),
  values: z.array(z.record(z.unknown())).max(200),
  sort: z.array(z.object({ field: z.string().regex(/^\w+$/), ascending: z.boolean() })).max(5),
  take: z.number().int().min(0).max(5000).nullable(),
  conflict: z.string().nullable(),
  head: z.boolean(),
});
const managerTables = new Set<TableName>([
  "branches",
  "menu_categories",
  "menu_items",
  "modifier_groups",
  "modifiers",
  "customers",
  "order_items",
  "order_item_modifiers",
  "promotions",
  "promotion_redemptions",
  "staff_invites",
]);
const billingTables = new Set<TableName>(["subscriptions", "subscription_events", "invoices"]);
const immutableFields = ["id", "restaurant_id", "user_id", "owner_id", "created_by", "created_at"];
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const rowOf = (doc: {
  id: string;
  ref: { parent: { id: string } };
  data(): DocumentData | undefined;
}): Row => decodeMarketplace(doc.ref.parent.id, doc.id, doc.data() ?? {});
const failure = (error: unknown): DataResult<never> => ({
  data: null,
  error: {
    code: "data-error",
    message: error instanceof Error ? error.message : "Unable to access data.",
  },
  count: null,
});
function assert(condition: unknown, message = "Forbidden"): asserts condition {
  if (!condition) throw new Error(message);
}

type Access = { roles: Map<string, string>; admin: boolean };
async function accessFor(actor: Actor | null): Promise<Access> {
  if (!actor || actor.admin) return { roles: new Map(), admin: true };
  const { db } = getFirebaseAdmin();
  const [docs, owned] = await Promise.all([
    db.collection(collectionName("restaurant_members")).where("user_id", "==", actor.uid).get(),
    db.collection("restaurants").where("owner_id", "==", actor.uid).get(),
  ]);
  const access = {
    admin: false,
    roles: new Map(
      docs.docs
        .filter((d) => d.data()["is_active"] !== false)
        .map((d) => [
          d.data()["restaurant_id"] as string,
          (d.data()["role"] === "general_manager" ? "manager" : d.data()["role"]) as string,
        ]),
    ),
  };
  for (const restaurant of owned.docs) access.roles.set(restaurant.id, "owner");
  return access;
}
function roleAt(access: Access, restaurantId: unknown) {
  return access.admin ? "owner" : access.roles.get(String(restaurantId));
}
function manager(access: Access, restaurantId: unknown) {
  return ["owner", "manager"].includes(roleAt(access, restaurantId) ?? "");
}
function readable(table: TableName, row: Row, actor: Actor | null, access: Access): boolean {
  if (access.admin || table === "plans") return true;
  if (!actor) return false;
  if (table === "profiles") return row.id === actor.uid;
  if (table === "user_roles" || table === "notification_preferences")
    return row["user_id"] === actor.uid;
  if (table === "restaurants") return row["owner_id"] === actor.uid || !!roleAt(access, row.id);
  if (table === "restaurant_members")
    return row["user_id"] === actor.uid || !!roleAt(access, row["restaurant_id"]);
  if (table === "support_tickets") return row["created_by"] === actor.uid;
  if (table === "notifications")
    return row["user_id"] === actor.uid || !!roleAt(access, row["restaurant_id"]);
  if (table === "ai_pricing_negotiations") return false;
  if (billingTables.has(table)) return manager(access, row["restaurant_id"]);
  if (table === "staff_invites")
    return (
      manager(access, row["restaurant_id"]) ||
      (actor.emailVerified && row["email"] === actor.email?.toLowerCase())
    );
  return !!roleAt(access, row["restaurant_id"]);
}
function writable(
  table: TableName,
  before: Row | null,
  after: Row | null,
  actor: Actor | null,
  access: Access,
) {
  if (!actor) return;
  const row = before ?? after;
  assert(row);
  // Billing and role grants always require trusted server code, including for admins.
  assert(!billingTables.has(table) && table !== "plans" && table !== "user_roles");
  if (before && after) {
    for (const field of immutableFields)
      assert(before[field] === after[field], `Cannot change ${field}.`);
  }
  if (table === "profiles") {
    assert(row.id === actor.uid && after !== null);
    return;
  }
  if (table === "notification_preferences") {
    assert(row["user_id"] === actor.uid && after !== null);
    return;
  }
  if (table === "restaurants") {
    if (!before) assert(after?.["owner_id"] === actor.uid && after?.["is_suspended"] === false);
    else {
      assert(after ? manager(access, row.id) : roleAt(access, row.id) === "owner");
      if (after && !access.admin)
        assert(
          before["is_suspended"] === after["is_suspended"],
          "Only platform admins can suspend restaurants.",
        );
    }
    return;
  }
  if (table === "restaurant_members") {
    assert(before && after, "Memberships are created through verified invitations.");
    assert(roleAt(access, row["restaurant_id"]) === "owner");
    assert(before["role"] !== "owner", "Owner membership cannot be changed.");
    assert(["manager", "staff"].includes(String(after["role"])));
    return;
  }
  if (table === "orders") {
    assert(before && after && !!roleAt(access, row["restaurant_id"]));
    const allowed: Record<string, string[]> = {
      new: ["accepted", "cancelled"],
      accepted: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["out_for_delivery", "completed", "cancelled"],
      out_for_delivery: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
      rejected: [],
    };
    assert(
      Object.keys(after).every(
        (k) =>
          ["status", "completed_at", "rejection_reason", "updated_at"].includes(k) ||
          JSON.stringify(after[k]) === JSON.stringify(before[k]),
      ),
      "Only order status can be changed.",
    );
    assert(
      after["status"] === before["status"] ||
        allowed[String(before["status"])]?.includes(String(after["status"])),
      "Invalid order status transition.",
    );
    return;
  }
  if (table === "notifications") {
    assert(before && after && readable(table, before, actor, access));
    assert(
      Object.keys(after).every(
        (k) =>
          k === "is_read" ||
          k === "updated_at" ||
          JSON.stringify(after[k]) === JSON.stringify(before[k]),
      ),
    );
    return;
  }
  if (table === "support_tickets") {
    assert(after && (access.admin || row["created_by"] === actor.uid));
    return;
  }
  if (table === "ai_pricing_negotiations") {
    assert(access.admin);
    return;
  }
  assert(managerTables.has(table) && manager(access, row["restaurant_id"]));
  if (table === "staff_invites" && after)
    assert(["manager", "staff"].includes(String(after["role"])));
}
async function scopedRows(
  table: TableName,
  actor: Actor | null,
  access: Access,
  filters: QuerySpec["filters"],
): Promise<Row[]> {
  const { db } = getFirebaseAdmin();
  const col = db.collection(collectionName(table));
  const idFilter = filters.find((f) => f.field === "id" && f.op === "eq");
  if (idFilter) {
    assert(validId(idFilter.value), "Invalid document ID.");
    let doc = await col.doc(idFilter.value).get();
    if (!doc.exists && table === "restaurant_members")
      doc = await db.collection("hub_inactive_members").doc(idFilter.value).get();
    if (table === "profiles" && actor && idFilter.value === actor.uid && !doc.exists)
      return [await profileFallback(actor)];
    if (table === "order_items" && doc.exists && !doc.data()?.["restaurant_id"]) {
      const order = await db
        .collection(collectionName("orders"))
        .doc(String(doc.data()?.["order_id"]))
        .get();
      if (!order.exists || !readable("orders", rowOf(order), actor, access)) return [];
      return [{ ...rowOf(doc), restaurant_id: order.data()?.["restaurant_id"] }];
    }
    return doc.exists && readable(table, rowOf(doc), actor, access) ? [rowOf(doc)] : [];
  }
  if (table === "order_items") {
    const orders = await scopedRows(
      "orders",
      actor,
      access,
      filters.filter((f) => f.field === "restaurant_id"),
    );
    const items: Row[] = [];
    for (const order of orders) {
      const docs = await col.where("order_id", "==", order.id).get();
      items.push(...docs.docs.map((d) => ({ ...rowOf(d), restaurant_id: order["restaurant_id"] })));
    }
    return items;
  }
  const restaurantFilter = filters.find((f) => f.field === "restaurant_id" && f.op === "eq");
  if (restaurantFilter && table !== "restaurants") {
    assert(validId(restaurantFilter.value), "Invalid restaurant ID.");
    if (!access.admin && !roleAt(access, restaurantFilter.value)) return [];
    const found = (await col.where("restaurant_id", "==", restaurantFilter.value).get()).docs.map(
      rowOf,
    );
    if (table === "restaurant_members")
      found.push(
        ...(
          await db
            .collection("hub_inactive_members")
            .where("restaurant_id", "==", restaurantFilter.value)
            .get()
        ).docs.map(rowOf),
      );
    return found.filter((r) => readable(table, r, actor, access));
  }
  if (access.admin || table === "plans") return (await col.get()).docs.map(rowOf);
  assert(actor);
  const results: Row[] = [];
  const by = async (field: string, value: string) => {
    results.push(...(await col.where(field, "==", value).get()).docs.map(rowOf));
  };
  if (table === "profiles") {
    const d = await col.doc(actor.uid).get();
    return d.exists ? [rowOf(d)] : [await profileFallback(actor)];
  }
  if (table === "user_roles" || table === "notification_preferences")
    await by("user_id", actor.uid);
  else if (table === "support_tickets") await by("created_by", actor.uid);
  else if (table !== "ai_pricing_negotiations") {
    if (table === "restaurants") await by("owner_id", actor.uid);
    if (table === "restaurant_members" || table === "notifications") await by("user_id", actor.uid);
    if (table === "staff_invites" && actor.emailVerified && actor.email)
      await by("email", actor.email.toLowerCase());
    const ids = [...access.roles.keys()].filter(
      (id) => !billingTables.has(table) || manager(access, id),
    );
    for (let i = 0; i < ids.length; i += 30) {
      const docs = await col
        .where(table === "restaurants" ? "id" : "restaurant_id", "in", ids.slice(i, i + 30))
        .get();
      results.push(...docs.docs.map(rowOf));
    }
  }
  if (table === "restaurant_members") {
    for (const [id, role] of access.roles)
      if (
        role === "owner" &&
        !results.some((r) => r["restaurant_id"] === id && r["user_id"] === actor.uid)
      )
        results.push({
          id: `${id}_${actor.uid}`,
          restaurant_id: id,
          user_id: actor.uid,
          role: "owner",
          is_active: true,
        });
  }
  return [
    ...new Map(
      results.filter((r) => readable(table, r, actor, access)).map((r) => [r.id, r]),
    ).values(),
  ];
}
async function profileFallback(actor: Actor): Promise<Row> {
  const { db, auth } = getFirebaseAdmin();
  const consumer = (await db.collection("users").doc(actor.uid).get()).data() ?? {};
  const user = await auth.getUser(actor.uid).catch(() => null);
  return decodeMarketplace(collectionName("profiles"), actor.uid, {
    full_name: consumer["full_name"] ?? user?.displayName ?? null,
    phone: consumer["phone"] ?? user?.phoneNumber ?? null,
  });
}
function prepare(table: TableName, value: Record<string, unknown>, id: string, before?: Row): Row {
  const allowed = new Set(["id", ...Object.keys(defaults[table]), ...requiredFields[table]]);
  for (const key of Object.keys(value)) assert(allowed.has(key), `Unknown ${table} field: ${key}`);
  for (const key of nonNullFields[table] ?? [])
    assert(
      value[key] !== null || (table === "restaurants" && key === "owner_id"),
      `${key} cannot be null.`,
    );
  if (table === "orders" && value["status"] === "rejected")
    value = {
      ...value,
      status: "cancelled",
      rejection_reason: value["rejection_reason"] || "Rejected by restaurant",
    };
  const now = new Date().toISOString();
  const base = Object.fromEntries(
    Object.entries(defaults[table]).map(([k, v]) => [k, v === "$now" ? now : structuredClone(v)]),
  );
  const row: Row = { ...base, ...before, ...value, id };
  if ("updated_at" in row) row["updated_at"] = now;
  for (const field of requiredFields[table])
    assert(
      row[field] !== null && row[field] !== undefined && row[field] !== "",
      `${field} is required.`,
    );
  for (const key of Object.keys(row))
    if (key.endsWith("_id") && row[key] != null) assert(validId(row[key]), `Invalid ${key}.`);
  for (const [key, kind] of Object.entries(fieldTypes[table])) {
    const actual = row[key];
    if (actual == null) continue;
    assert(
      kind === "array"
        ? Array.isArray(actual)
        : kind === "object"
          ? typeof actual === "object"
          : typeof actual === kind,
      `Invalid ${key}.`,
    );
    if (kind === "number") assert(Number.isFinite(actual), `Invalid ${key}.`);
  }
  if (table === "orders")
    assert(
      [
        "new",
        "accepted",
        "preparing",
        "ready",
        "out_for_delivery",
        "completed",
        "cancelled",
        "rejected",
      ].includes(String(row["status"])),
      "Invalid order status.",
    );
  if (table === "promotions")
    assert(
      ["percentage", "fixed", "bogo", "free_delivery", "combo", "first_order"].includes(
        String(row["type"]),
      ),
      "This promotion type is not supported by the marketplace.",
    );
  if (table === "menu_items" && value["category_id"] === null) row["category"] = null;
  if (table === "staff_invites") row["email"] = String(row["email"]).trim().toLowerCase();
  if (table === "restaurants" && row["owner_email"])
    row["owner_email"] = String(row["owner_email"]).trim().toLowerCase();
  return row;
}
async function validateReferences(tx: Transaction, table: TableName, row: Row) {
  const { db } = getFirebaseAdmin();
  for (const relation of relationships.filter((r) => r.child === table)) {
    if (table === "orders" && relation.field === "customer_id") continue; // Consumer customer IDs are Firebase UIDs.
    const id = row[relation.field];
    if (!id) continue;
    const ref = await tx.get(db.collection(collectionName(relation.parent)).doc(String(id)));
    assert(ref.exists, `${relation.parent} document does not exist.`);
    if (table === "menu_items" && relation.field === "category_id")
      row["category"] = ref.data()?.["name"] ?? null;
    if (relation.parent !== "restaurants" && row["restaurant_id"])
      assert(
        ref.data()?.["restaurant_id"] === row["restaurant_id"],
        "Related document belongs to another restaurant.",
      );
  }
}

async function joinRows(spec: QuerySpec, rows: Row[], actor: Actor | null, access: Access) {
  const { db } = getFirebaseAdmin();
  if (spec.table === "restaurant_members" && spec.fields.includes("restaurants(")) {
    for (const row of rows) {
      const d = await db
        .collection(collectionName("restaurants"))
        .doc(String(row["restaurant_id"]))
        .get();
      row["restaurants"] =
        d.exists && readable("restaurants", rowOf(d), actor, access) ? rowOf(d) : null;
    }
  }
  if (spec.table === "orders" && spec.fields.includes("order_items(")) {
    for (const row of rows) {
      const items: Row[] = (
        await db.collection(collectionName("order_items")).where("order_id", "==", row.id).get()
      ).docs
        .map((d) => ({ ...rowOf(d), restaurant_id: row["restaurant_id"] }))
        .filter((r) => readable("order_items", r, actor, access));
      for (const item of items) {
        const embedded = Array.isArray(item["modifiers"])
          ? (item["modifiers"] as Record<string, unknown>[])
          : [];
        const stored = (
          await db
            .collection(collectionName("order_item_modifiers"))
            .where("order_item_id", "==", item.id)
            .get()
        ).docs
          .map(rowOf)
          .filter((r) => readable("order_item_modifiers", r, actor, access));
        item["order_item_modifiers"] = [
          ...stored,
          ...embedded.map((m, i) => ({
            id: `${item.id}_${i}`,
            name: m["option_name"] ?? m["name"],
            price: m["price_delta"] ?? m["price"] ?? 0,
          })),
        ];
      }
      row["order_items"] = items;
    }
  }
}

export function createRepository(actor: Actor | null) {
  const execute = async (input: QuerySpec): Promise<DataResult<unknown[]>> => {
    try {
      const spec = specSchema.parse(input) as QuerySpec;
      const access = await accessFor(actor);
      let rows: Row[];
      if (spec.table === "user_roles" && actor)
        rows = actor.admin ? [{ id: `${actor.uid}_admin`, user_id: actor.uid, role: "admin" }] : [];
      else rows = await scopedRows(spec.table, actor, access, spec.filters);
      rows = rows.filter((row) => matchesFilters(row, spec.filters));
      for (const sort of [...spec.sort].reverse())
        rows.sort((a, b) => {
          const av = a[sort.field] as string | number | null;
          const bv = b[sort.field] as string | number | null;
          return (
            (av === bv ? 0 : av == null ? 1 : bv == null ? -1 : av < bv ? -1 : 1) *
            (sort.ascending ? 1 : -1)
          );
        });
      const count = rows.length;
      if (spec.take !== null) rows = rows.slice(0, spec.take);
      if (spec.action === "select") {
        if (!spec.head) await joinRows(spec, rows, actor, access);
        return { data: spec.head ? null : rows, error: null, count };
      }
      const { db } = getFirebaseAdmin();
      if (spec.action === "insert" || spec.action === "upsert") {
        assert(spec.values.length > 0, "No documents supplied.");
        if (spec.action === "upsert")
          assert(
            (spec.table === "notification_preferences" && spec.conflict === "user_id") ||
              (spec.table === "profiles" && spec.conflict === "id") ||
              (!actor && spec.table === "subscriptions" && spec.conflict === "restaurant_id"),
            "Unsupported upsert.",
          );
        const ids = spec.values.map((v) =>
          spec.action === "upsert" ? String(v[spec.conflict!]) : String(v["id"] ?? randomUUID()),
        );
        assert(
          ids.every(validId) && new Set(ids).size === ids.length,
          "Invalid or duplicate document ID.",
        );
        rows = await db.runTransaction(async (tx) => {
          const prepared: Row[] = [];
          const counterRef = db.collection("hub_counters").doc("orders");
          let orderNumber =
            spec.table === "orders" ? Number((await tx.get(counterRef)).data()?.["value"] ?? 0) : 0;
          for (let i = 0; i < spec.values.length; i++) {
            const id = ids[i]!;
            const existing = await tx.get(db.collection(collectionName(spec.table)).doc(id));
            assert(spec.action === "upsert" || !existing.exists, "Document already exists.");
            const before = existing.exists ? rowOf(existing) : null;
            const value = { ...spec.values[i]! };
            if (spec.table === "orders" && !value["order_number"])
              value["order_number"] = `MM-${++orderNumber}`;
            const after = prepare(spec.table, value, id, before ?? undefined);
            writable(spec.table, before, after, actor, access);
            await validateReferences(tx, spec.table, after);
            prepared.push(after);
          }
          if (spec.table === "orders") tx.set(counterRef, { value: orderNumber });
          for (const row of prepared) {
            tx.set(
              db.collection(collectionName(spec.table)).doc(row.id),
              encodeMarketplace(spec.table, row, null),
            );
            if (spec.table === "restaurants") {
              tx.set(db.collection("restaurant_applications").doc(row.id), {
                id: row.id,
                restaurant_id: row.id,
                applicant_id: row["owner_id"],
                status: "pending",
                submitted_data: { name: row["name"], owner_name: row["owner_name"] },
                created_at: row["created_at"],
              });
              assert(validId(row["owner_id"]));
              const membershipId = `${row.id}_${row["owner_id"]}`;
              tx.set(
                db.collection(collectionName("restaurant_members")).doc(membershipId),
                prepare(
                  "restaurant_members",
                  { restaurant_id: row.id, user_id: row["owner_id"], role: "owner" },
                  membershipId,
                ),
              );
              tx.set(
                db.collection(collectionName("subscriptions")).doc(row.id),
                prepare("subscriptions", { restaurant_id: row.id }, row.id),
              );
            }
          }
          return prepared;
        });
      } else {
        assert(spec.filters.length > 0, "A filter is required for updates and deletes.");
        assert(rows.length <= 200, "Too many documents in a single mutation.");
        rows = await db.runTransaction(async (tx) => {
          const pending: { before: Row; after: Row | null }[] = [];
          const cascade = new Map<
            string,
            { ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> | null }
          >();
          for (const row of rows) {
            let current = await tx.get(db.collection(collectionName(spec.table)).doc(row.id));
            if (!current.exists && spec.table === "restaurant_members")
              current = await tx.get(db.collection("hub_inactive_members").doc(row.id));
            if (!current.exists) continue;
            const before = rowOf(current);
            if (!matchesFilters(before, spec.filters)) continue;
            const after =
              spec.action === "delete"
                ? null
                : prepare(spec.table, spec.values[0] ?? {}, row.id, before);
            writable(spec.table, before, after, actor, access);
            if (after) await validateReferences(tx, spec.table, after);
            if (!after) await collectDeletion(tx, spec.table, row.id, cascade);
            pending.push({ before, after });
          }
          assert(
            cascade.size + pending.length <= 450,
            "Restaurant has too much data for automatic deletion; contact support.",
          );
          for (const { ref, patch } of cascade.values()) {
            if (patch) tx.update(ref, patch);
            else tx.delete(ref);
          }
          for (const { before, after } of pending) {
            const ref = db.collection(collectionName(spec.table)).doc(before.id);
            if (after && spec.table === "restaurant_members") {
              const archive = db.collection("hub_inactive_members").doc(before.id);
              if (after["is_active"] === false) {
                tx.set(archive, after);
                tx.delete(ref);
              } else {
                tx.set(ref, after);
                tx.delete(archive);
              }
            } else if (after) tx.set(ref, encodeMarketplace(spec.table, after, before));
            else tx.delete(ref);
          }
          return pending.map((p) => p.after ?? p.before);
        });
      }
      return { data: rows, error: null, count: rows.length };
    } catch (error) {
      return failure(error);
    }
  };

  const rpc = async (name: string, args: Record<string, unknown>) => {
    try {
      assert(actor);
      if (name === "is_platform_admin") return { data: actor.admin, error: null };
      if (name === "claim_restaurant_owner_invites")
        return { data: await claimInvites(actor), error: null };
      if (name === "create_restaurant_owner_invite")
        return { data: await createOwnerInvite(actor, args), error: null };
      throw new Error("Unknown operation.");
    } catch (error) {
      return { data: null, error: failure(error).error };
    }
  };
  return {
    execute,
    rpc,
    async assertManager(restaurantId: string) {
      assert(
        manager(await accessFor(actor), restaurantId),
        "Only restaurant managers can upload images.",
      );
    },
    from<T extends TableName>(table: T) {
      return new DocumentQuery(table, execute);
    },
  };
}

async function createOwnerInvite(actor: Actor, args: Record<string, unknown>) {
  assert(actor.admin);
  const email = z.string().email().parse(args["p_owner_email"]).trim().toLowerCase();
  const { db, auth } = getFirebaseAdmin();
  let ownerId: string | null = null;
  try {
    const user = await auth.getUserByEmail(email);
    if (user.emailVerified) ownerId = user.uid;
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
  const id = randomUUID();
  const lockId = createHash("sha256").update(email).digest("hex");
  return db.runTransaction(async (tx) => {
    const lock = db.collection("hub_owner_invites").doc(lockId);
    assert(
      !(await tx.get(lock)).exists,
      "This email already has a pending invitation for another restaurant.",
    );
    const values = Object.fromEntries(
      Object.entries(args)
        .filter(([k]) => k.startsWith("p_"))
        .map(([k, v]) => [k.slice(2), v]),
    );
    delete values["contact_email"];
    const row = prepare(
      "restaurants",
      {
        ...values,
        owner_id: ownerId ?? actor.uid,
        email: args["p_contact_email"] ?? email,
        owner_email: email,
        onboarding_complete: true,
      },
      id,
    );
    if (!ownerId) {
      row["owner_id"] = null;
      tx.set(lock, { email, restaurant_id: id, created_at: new Date().toISOString() });
    }
    tx.set(
      db.collection(collectionName("restaurants")).doc(id),
      encodeMarketplace("restaurants", row, null),
    );
    const memberId = `${id}_${ownerId ?? actor.uid}`;
    tx.set(
      db.collection(collectionName("restaurant_members")).doc(memberId),
      prepare(
        "restaurant_members",
        { restaurant_id: id, user_id: ownerId ?? actor.uid, role: ownerId ? "owner" : "manager" },
        memberId,
      ),
    );
    tx.set(
      db.collection(collectionName("subscriptions")).doc(id),
      prepare("subscriptions", { restaurant_id: id }, id),
    );
    return row;
  });
}
async function claimInvites(actor: Actor) {
  // Only a verified email can accept invitations created for that identity.
  if (!actor.email || !actor.emailVerified) return 0;
  const { db } = getFirebaseAdmin();
  const email = actor.email.toLowerCase();
  const lock = db
    .collection("hub_owner_invites")
    .doc(createHash("sha256").update(email).digest("hex"));
  return db.runTransaction(async (tx) => {
    const ownerInvite = await tx.get(lock);
    const ownerId = ownerInvite.data()?.["restaurant_id"] as string | undefined;
    const restaurant = ownerId
      ? await tx.get(db.collection(collectionName("restaurants")).doc(ownerId))
      : null;
    const staffInvites = await tx.get(
      db.collection(collectionName("staff_invites")).where("email", "==", email),
    );
    const pending = staffInvites.docs.filter((d) => d.data()["status"] === "pending");
    assert(pending.length <= 100, "Too many pending invitations; contact support.");
    const staffMemberships = [];
    for (const invite of pending) {
      const data = invite.data();
      const id = `${data["restaurant_id"]}_${actor.uid}`;
      const ref = db.collection(collectionName("restaurant_members")).doc(id);
      const active = await tx.get(ref);
      const existing = active.exists
        ? active
        : await tx.get(db.collection("hub_inactive_members").doc(id));
      const target = await tx.get(
        db.collection(collectionName("restaurants")).doc(String(data["restaurant_id"])),
      );
      if (target.exists && ["manager", "staff"].includes(String(data["role"])))
        staffMemberships.push({ invite, data, id, ref, existing });
    }
    let claimed = 0;
    if (ownerInvite.exists) {
      if (restaurant?.exists && restaurant.data()?.["owner_id"] === null && ownerId) {
        tx.update(restaurant.ref, { owner_id: actor.uid, updated_at: new Date().toISOString() });
        const memberId = `${ownerId}_${actor.uid}`;
        tx.set(
          db.collection(collectionName("restaurant_members")).doc(memberId),
          prepare(
            "restaurant_members",
            { restaurant_id: ownerId, user_id: actor.uid, role: "owner" },
            memberId,
          ),
        );
        claimed++;
      }
      tx.delete(lock);
    }
    for (const { invite, data, id, ref, existing } of staffMemberships) {
      // An old invitation must never downgrade or reactivate an existing membership.
      if (!existing.exists && data["restaurant_id"] !== ownerId)
        tx.create(
          ref,
          prepare(
            "restaurant_members",
            {
              restaurant_id: data["restaurant_id"],
              user_id: actor.uid,
              role: data["role"],
              branch_id: data["branch_id"] ?? null,
            },
            id,
          ),
        );
      tx.update(invite.ref, { status: "accepted", accepted_at: new Date().toISOString() });
      claimed++;
    }
    return claimed;
  });
}

type DeletionPlan = Map<
  string,
  { ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> | null }
>;
async function collectDeletion(
  tx: Transaction,
  table: TableName,
  id: string,
  plan: DeletionPlan,
): Promise<void> {
  const { db } = getFirebaseAdmin();
  for (const relation of relationships.filter((r) => r.parent === table)) {
    const docs = await tx.get(
      db.collection(collectionName(relation.child)).where(relation.field, "==", id),
    );
    for (const doc of docs.docs) {
      const previous = plan.get(doc.ref.path);
      if (relation.cascade) {
        if (previous?.patch === null) continue;
        plan.set(doc.ref.path, { ref: doc.ref, patch: null });
        assert(plan.size <= 450, "Too much data for automatic deletion; contact support.");
        await collectDeletion(tx, relation.child, doc.id, plan);
      } else if (previous?.patch !== null)
        plan.set(doc.ref.path, {
          ref: doc.ref,
          patch: { ...previous?.patch, [relation.field]: null },
        });
    }
  }
  if (table === "restaurants") {
    for (const collection of [
      "hub_owner_invites",
      "hub_inactive_members",
      "restaurant_applications",
    ]) {
      const documents = await tx.get(db.collection(collection).where("restaurant_id", "==", id));
      for (const doc of documents.docs) plan.set(doc.ref.path, { ref: doc.ref, patch: null });
    }
  }
}
