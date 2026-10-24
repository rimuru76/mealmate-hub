import type { TableName } from "./types";

/** Shared marketplace collections come from the live Consumer app. */
const shared: Partial<Record<TableName, string>> = {
  restaurants: "restaurants",
  restaurant_members: "restaurant_staff",
  branches: "restaurant_locations",
  menu_items: "menu_items",
  orders: "restaurant_orders",
  order_items: "order_items",
  promotions: "restaurant_promotions",
  promotion_redemptions: "promotion_redemptions",
  user_roles: "user_roles",
};
export const collectionName = (table: TableName) => shared[table] ?? `hub_${table}`;
export const tableName = (collection: string) =>
  (Object.keys(shared).find((k) => shared[k as TableName] === collection) ??
    collection.replace(/^hub_/, "")) as TableName;
export const CONSUMER_URL = "https://mealsmates.site";
