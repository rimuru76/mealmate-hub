import { defaults } from "./schema";
import { tableName } from "./collections";
import type { TableName } from "./types";
export type StoredRow = Record<string, unknown> & { id: string };

/** Translate the original partner UI to the existing Consumer document contract. */
export function decodeMarketplace(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): StoredRow {
  const table =
    collection === "hub_inactive_members" ? "restaurant_members" : tableName(collection);
  const base = Object.fromEntries(
    Object.entries(defaults[table] ?? {}).map(([k, v]) => [
      k,
      v === "$now" ? (data["created_at"] ?? new Date(0).toISOString()) : structuredClone(v),
    ]),
  );
  const row: StoredRow = { ...base, ...data, id };
  if (table === "restaurant_members") {
    row["is_active"] = data["is_active"] !== false;
    row["role"] = data["role"] === "general_manager" ? "manager" : data["role"];
  }
  if (table === "restaurants") {
    row["is_suspended"] = data["approval_status"] === "suspended";
    row["minimum_order"] = data["min_order_amount"] ?? data["minimum_order"] ?? 0;
    row["delivery_enabled"] = data["supports_delivery"] ?? true;
    row["pickup_enabled"] = data["supports_pickup"] ?? true;
  }
  if (table === "branches") row["name"] = data["label"] ?? data["name"];
  if (table === "menu_items") {
    row["position"] = data["sort_order"] ?? data["position"] ?? 0;
    const tags = Array.isArray(data["dietary_tags"]) ? data["dietary_tags"] : [];
    for (const [key, tag] of Object.entries({
      is_vegetarian: "vegetarian",
      is_vegan: "vegan",
      is_halaal: "halal",
      is_spicy: "spicy",
    }))
      row[key] = tags.includes(tag);
  }
  if (table === "orders") {
    row["created_at"] = data["created_at"] ?? data["placed_at"];
    row["fulfillment"] = data["fulfillment_type"] ?? "delivery";
    row["discount"] = data["discount_total"] ?? 0;
    row["customer_phone"] = data["contact_phone"] ?? null;
    row["payment_status"] =
      data["payment_status"] === "unpaid" ? "pending" : data["payment_status"];
  }
  if (table === "order_items")
    row["total_price"] =
      data["line_total"] ??
      data["total_price"] ??
      Number(data["unit_price"] ?? 0) * Number(data["quantity"] ?? 1);
  if (table === "promotions") {
    row["type"] =
      ({ percent_off: "percentage", amount_off: "fixed" } as Record<string, string>)[
        String(data["kind"])
      ] ?? data["kind"];
    row["minimum_order"] = data["min_order_amount"] ?? 0;
    row["uses"] = data["usage_count"] ?? 0;
    row["usage_limit"] = data["usage_limit_total"] ?? null;
    row["eligible_item_ids"] = data["applicable_menu_item_ids"] ?? [];
  }
  return row;
}

export function encodeMarketplace(
  table: TableName,
  row: StoredRow,
  before: StoredRow | null,
): StoredRow {
  const data = { ...row };
  if (table === "restaurants") {
    data["min_order_amount"] = row["minimum_order"];
    data["supports_delivery"] = row["delivery_enabled"];
    data["supports_pickup"] = row["pickup_enabled"];
    if (!before)
      Object.assign(data, {
        slug:
          row["slug"] ||
          `${String(row["name"])
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")}-${row.id.slice(0, 8)}`,
        approval_status: "pending",
        is_demo: false,
        is_accepting_orders: false,
        currency: "ZAR",
        delivery_fee: 0,
        delivery_radius_km: 10,
        delivery_estimate_minutes: 35,
      });
    else if (row["is_suspended"] !== before["is_suspended"])
      data["approval_status"] = row["is_suspended"] ? "suspended" : "pending";
  }
  if (table === "branches") data["label"] = row["name"];
  if (table === "menu_items") {
    data["sort_order"] = row["position"];
    data["is_hidden"] = row["is_hidden"] ?? false;
    const tags = new Set(Array.isArray(row["dietary_tags"]) ? row["dietary_tags"] : []);
    for (const [key, tag] of Object.entries({
      is_vegetarian: "vegetarian",
      is_vegan: "vegan",
      is_halaal: "halal",
      is_spicy: "spicy",
    })) {
      if (row[key]) tags.add(tag);
      else tags.delete(tag);
    }
    data["dietary_tags"] = [...tags];
  }
  if (table === "orders") {
    data["fulfillment_type"] = row["fulfillment"];
    data["discount_total"] = row["discount"];
    data["contact_phone"] = row["customer_phone"];
    data["payment_status"] = row["payment_status"] === "pending" ? "unpaid" : row["payment_status"];
  }
  if (table === "order_items") data["line_total"] = row["total_price"];
  if (table === "promotions")
    Object.assign(data, {
      kind:
        ({ percentage: "percent_off", fixed: "amount_off" } as Record<string, string>)[
          String(row["type"])
        ] ?? row["type"],
      min_order_amount: row["minimum_order"],
      usage_count: row["uses"],
      usage_limit_total: row["usage_limit"],
      applicable_menu_item_ids: row["eligible_item_ids"],
    });
  return data;
}
