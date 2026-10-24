import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  sendEmailVerification,
  onIdTokenChanged,
  confirmPasswordReset,
  type User,
} from "firebase/auth";
import { getFirebase } from "./app";
import { executeDataQuery, executeOperation } from "./data.functions";
import { DocumentQuery, type DataResult, type DataError } from "./query";
import type { TableName } from "./types";

export type Session = { user: { id: string; email: string | null }; access_token: string };
const toError = (error: unknown): DataError => ({
  message: error instanceof Error ? error.message : String(error),
  code: "firebase-error",
});
async function sessionFor(user: User | null): Promise<Session | null> {
  return user
    ? { user: { id: user.uid, email: user.email }, access_token: await user.getIdToken() }
    : null;
}
async function currentUser() {
  const { auth } = getFirebase();
  await auth.authStateReady();
  return auth.currentUser;
}

export const firebaseClient = {
  from<T extends TableName>(table: T) {
    return new DocumentQuery(
      table,
      async (spec) => JSON.parse(await executeDataQuery({ data: spec })) as DataResult<unknown[]>,
    );
  },
  async rpc(name: string, args?: Record<string, unknown>) {
    return JSON.parse(await executeOperation({ data: { name, args: args ?? {} } })) as {
      data: unknown;
      error: DataError | null;
    };
  },
  auth: {
    async getSession() {
      try {
        return { data: { session: await sessionFor(await currentUser()) }, error: null };
      } catch (error) {
        return { data: { session: null }, error: toError(error) };
      }
    },
    async getUser() {
      try {
        const user = await currentUser();
        return { data: { user: user ? { id: user.uid, email: user.email } : null }, error: null };
      } catch (error) {
        return { data: { user: null }, error: toError(error) };
      }
    },
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
      let unsubscribe = () => {};
      let active = true;
      try {
        let previousId: string | null = null;
        unsubscribe = onIdTokenChanged(
          getFirebase().auth,
          async (user) => {
            const session = await sessionFor(user);
            if (!active) return;
            const event = user
              ? previousId === user.uid
                ? "TOKEN_REFRESHED"
                : "SIGNED_IN"
              : "SIGNED_OUT";
            previousId = user?.uid ?? null;
            callback(event, session);
          },
          () => {
            if (active) callback("SIGNED_OUT", null);
          },
        );
      } catch {
        queueMicrotask(() => {
          if (active) callback("SIGNED_OUT", null);
        });
      }
      return {
        data: {
          subscription: {
            unsubscribe() {
              active = false;
              unsubscribe();
            },
          },
        },
      };
    },
    async signUp(input: {
      email: string;
      password: string;
      options: { emailRedirectTo: string; data: { full_name: string } };
    }) {
      try {
        const { auth } = getFirebase();
        const { user } = await createUserWithEmailAndPassword(auth, input.email, input.password);
        await updateProfile(user, { displayName: input.options.data.full_name });
        const profile = await firebaseClient
          .from("profiles")
          .insert({ id: user.uid, full_name: user.displayName });
        if (profile.error) throw new Error(profile.error.message);
        await sendEmailVerification(user, { url: input.options.emailRedirectTo });
        return { data: { session: await sessionFor(user) }, error: null };
      } catch (error) {
        return { data: { session: null }, error: toError(error) };
      }
    },
    async signInWithGoogle() {
      try {
        await signInWithPopup(getFirebase().auth, new GoogleAuthProvider());
        return { error: null };
      } catch (error) {
        return { error: toError(error) };
      }
    },
    async signInWithPassword(input: { email: string; password: string }) {
      try {
        await signInWithEmailAndPassword(getFirebase().auth, input.email, input.password);
        return { error: null };
      } catch (error) {
        return { error: toError(error) };
      }
    },
    async resetPasswordForEmail(email: string, options: { redirectTo: string }) {
      try {
        await sendPasswordResetEmail(getFirebase().auth, email, { url: options.redirectTo });
        return { error: null };
      } catch (error) {
        return { error: toError(error) };
      }
    },
    async updateUser(input: { password: string }) {
      try {
        const user = await currentUser();
        if (!user) throw new Error("Sign in again to update your password.");
        await updatePassword(user, input.password);
        return { error: null };
      } catch (error) {
        return { error: toError(error) };
      }
    },
    async confirmPasswordReset(code: string, password: string) {
      try {
        await confirmPasswordReset(getFirebase().auth, code, password);
        return { error: null };
      } catch (error) {
        return { error: toError(error) };
      }
    },
    async signOut() {
      await signOut(getFirebase().auth);
      return { error: null };
    },
  },
  /** Match the live Consumer app: authorized server polling keeps customer data private. */
  watch(
    table: "orders" | "notifications",
    field: "restaurant_id" | "user_id",
    id: string,
    callback: (event: { eventType: string }) => void,
  ) {
    let stopped = false;
    let previous: Map<string, string> | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await firebaseClient
          .from(table)
          .eq(field, id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (stopped) return;
        if (result.error) throw new Error(result.error.message);
        const next = new Map((result.data ?? []).map((row) => [row.id, JSON.stringify(row)]));
        if (previous) {
          for (const [key, value] of next)
            if (previous.get(key) !== value)
              callback({ eventType: previous.has(key) ? "UPDATE" : "INSERT" });
          for (const key of previous.keys()) if (!next.has(key)) callback({ eventType: "DELETE" });
        }
        previous = next;
      } catch (error) {
        if (!stopped) console.error("Live updates failed", error);
      } finally {
        if (!stopped) timer = setTimeout(poll, 15000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  },
};
