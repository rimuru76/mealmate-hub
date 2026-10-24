import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const header = getRequest().headers.get("authorization");
    const token = /^Bearer ([^\s,]+)$/.exec(header ?? "")?.[1];
    if (!token) throw new Error("Unauthorized");
    const { getFirebaseAdmin } = await import("./admin.server");
    const { createRepository } = await import("./repository.server");
    const { auth, db } = getFirebaseAdmin();
    const claims = await auth.verifyIdToken(token, true);
    const roles = await db.collection("user_roles").where("user_id", "==", claims.uid).get();
    const firebaseClient = createRepository({
      uid: claims.uid,
      email: claims.email ?? null,
      emailVerified: claims.email_verified === true,
      admin:
        claims["platform_admin"] === true || roles.docs.some((d) => d.data()["role"] === "admin"),
    });
    return next({ context: { firebaseClient, userId: claims.uid, claims } });
  },
);
