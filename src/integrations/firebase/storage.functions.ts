import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "./auth-middleware";
const PathSchema = z
  .string()
  .regex(/^(restaurant-assets|menu-images)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/);

export const uploadRestaurantImage = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        path: PathSchema,
        base64: z.string().max(2800000),
        contentType: z.enum(["image/webp", "image/png", "image/jpeg"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { storeImage } = await import("./storage.server");
    return storeImage(context.firebaseClient, data);
  });
export const removeRestaurantImage = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((input: unknown) => z.object({ reference: z.string().max(3000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { removeImage } = await import("./storage.server");
    await removeImage(context.firebaseClient, data.reference);
    return { ok: true };
  });
