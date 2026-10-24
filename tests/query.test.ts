import { expect, test } from "bun:test";
import { DocumentQuery, matchesFilters } from "../src/integrations/firebase/query";

test("search handles SQL wildcards and treats regex characters literally", () => {
  expect(
    matchesFilters({ name: "Meal (A)+ Grill" }, [{ field: "name", op: "ilike", value: "%(a)+%" }]),
  ).toBe(true);
  expect(
    matchesFilters({ name: "Meal AAA Grill" }, [{ field: "name", op: "ilike", value: "%(a)+%" }]),
  ).toBe(false);
  expect(matchesFilters({ name: "AB" }, [{ field: "name", op: "ilike", value: "a_" }])).toBe(true);
});

test("single results reject duplicates and required missing documents", async () => {
  const duplicate = new DocumentQuery("plans", async () => ({
    data: [{ id: "a" }, { id: "b" }],
    error: null,
    count: 2,
  }));
  expect((await duplicate.maybeSingle()).error?.code).toBe("multiple-documents");
  const empty = () => new DocumentQuery("plans", async () => ({ data: [], error: null, count: 0 }));
  expect((await empty().maybeSingle()).error).toBeNull();
  expect((await empty().single()).error?.code).toBe("not-found");
});
