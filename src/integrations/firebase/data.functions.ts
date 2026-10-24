import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "./auth-middleware";
import type { QuerySpec } from "./query";

export const executeDataQuery = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((input: QuerySpec) => input)
  .handler(async ({ data, context }) => JSON.stringify(await context.firebaseClient.execute(data)));

export const executeOperation = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((input: { name: string; args: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) =>
    JSON.stringify(await context.firebaseClient.rpc(data.name, data.args)),
  );
