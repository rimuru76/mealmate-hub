import { createServerFn } from "@tanstack/react-start";

import { requireFirebaseAuth } from "@/integrations/firebase/auth-middleware";

/** Permanently deletes the signed-in user's auth account. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { getFirebaseAdmin } = await import("@/integrations/firebase/admin.server");
    const { auth, db } = getFirebaseAdmin();
    // Delete personal data and revoke sessions before removing the identity.
    // Restaurant business records stay available to the restaurant's other members.
    const memberships = await db
      .collection("restaurant_staff")
      .where("user_id", "==", context.userId)
      .get();
    const batch = db.batch();
    for (const member of memberships.docs) {
      batch.set(db.collection("hub_inactive_members").doc(member.id), {
        ...member.data(),
        is_active: false,
      });
      batch.delete(member.ref);
    }
    batch.delete(db.collection("hub_profiles").doc(context.userId));
    batch.delete(db.collection("hub_notification_preferences").doc(context.userId));
    await batch.commit();
    await auth.revokeRefreshTokens(context.userId);
    await auth.deleteUser(context.userId);
    return { ok: true as const };
  });
