import "@tanstack/react-start/server-only";
import { createRepository } from "./repository.server";

/** Trusted server use only. Browser mutations always use a verified actor. */
export const firebaseAdmin = createRepository(null);
