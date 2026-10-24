import type { Database, DocumentRow, TableName } from "./types";

export type DataError = { message: string; code: string };
export type DataResult<T> = { data: T | null; error: DataError | null; count: number | null };
export type Filter = { field: string; op: "eq" | "in" | "gte" | "ilike"; value: unknown };
export type QuerySpec = {
  table: TableName;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  filters: Filter[];
  fields: string;
  values: Record<string, unknown>[];
  sort: { field: string; ascending: boolean }[];
  take: number | null;
  conflict: string | null;
  head: boolean;
};
export type QueryExecutor = (spec: QuerySpec) => Promise<DataResult<unknown[]>>;
type Row<T extends TableName> = DocumentRow<T> & {
  restaurants: Database["public"]["Tables"]["restaurants"]["Row"] | null;
};

/** Small typed document query API shared by the screens and server handlers. */
export class DocumentQuery<T extends TableName> {
  private spec: QuerySpec;
  constructor(
    table: T,
    private execute: QueryExecutor,
  ) {
    this.spec = {
      table,
      action: "select",
      filters: [],
      fields: "*",
      values: [],
      sort: [],
      take: null,
      conflict: null,
      head: false,
    };
  }
  select(fields = "*", options?: { count?: "exact"; head?: boolean }) {
    this.spec.fields = fields;
    this.spec.head = options?.head ?? false;
    return this;
  }
  eq(field: string, value: unknown) {
    this.spec.filters.push({ field, op: "eq", value });
    return this;
  }
  in(field: string, value: unknown[]) {
    this.spec.filters.push({ field, op: "in", value });
    return this;
  }
  gte(field: string, value: unknown) {
    this.spec.filters.push({ field, op: "gte", value });
    return this;
  }
  ilike(field: string, value: string) {
    this.spec.filters.push({ field, op: "ilike", value });
    return this;
  }
  order(field: string, options?: { ascending?: boolean }) {
    this.spec.sort.push({ field, ascending: options?.ascending ?? true });
    return this;
  }
  limit(take: number) {
    this.spec.take = take;
    return this;
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.spec.action = "insert";
    this.spec.values = Array.isArray(values) ? values : [values];
    return this;
  }
  update(values: Record<string, unknown>) {
    this.spec.action = "update";
    this.spec.values = [values];
    return this;
  }
  delete() {
    this.spec.action = "delete";
    return this;
  }
  upsert(values: Record<string, unknown>, options: { onConflict: string }) {
    this.spec.action = "upsert";
    this.spec.values = [values];
    this.spec.conflict = options.onConflict;
    return this;
  }
  private async run(): Promise<DataResult<Row<T>[]>> {
    const result = (await this.execute(this.spec)) as DataResult<Row<T>[]>;
    if (result.error)
      result.error = Object.assign(new Error(result.error.message), { code: result.error.code });
    return result;
  }
  async maybeSingle(): Promise<DataResult<Row<T>>> {
    const result = await this.run();
    if ((result.data?.length ?? 0) > 1)
      return {
        data: null,
        error: { code: "multiple-documents", message: "Expected one document." },
        count: result.count,
      };
    return { ...result, data: result.data?.[0] ?? null };
  }
  async single(): Promise<DataResult<Row<T>>> {
    const result = await this.maybeSingle();
    if (!result.error && !result.data)
      result.error = { code: "not-found", message: "Document not found." };
    return result;
  }
  then<TResult1 = DataResult<Row<T>[]>, TResult2 = never>(
    onfulfilled?: ((value: DataResult<Row<T>[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export function matchesFilters(row: Record<string, unknown>, filters: Filter[]): boolean {
  return filters.every(({ field, op, value }) => {
    const actual = row[field];
    if (op === "eq") return actual === value;
    if (op === "in") return Array.isArray(value) && value.includes(actual);
    if (op === "gte")
      return actual != null && (actual as string | number) >= (value as string | number);
    // Match SQL's case-insensitive % and _ wildcards without accepting regex input.
    const pattern = String(value)
      .split("")
      .map((c) => (c === "%" ? ".*" : c === "_" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("");
    return new RegExp(`^${pattern}$`, "i").test(String(actual ?? ""));
  });
}
