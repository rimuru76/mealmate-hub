import { createMiddleware } from "@tanstack/react-start";
import { getFirebase } from "./app";

export const attachFirebaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { auth } = getFirebase();
    await auth.authStateReady();
    const token = await auth.currentUser?.getIdToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
