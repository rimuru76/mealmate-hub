import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

let services:
  | {
      auth: ReturnType<typeof getAuth>;
    }
  | undefined;

export function getFirebase() {
  if (services) return services;
  const config = {
    apiKey: import.meta.env["VITE_FIREBASE_API_KEY"],
    authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"],
    projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"],
    storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"],
    messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"],
    appId: import.meta.env["VITE_FIREBASE_APP_ID"],
  };
  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error(
      "Firebase is not configured. Add the Firebase web app settings to the Vercel environment variables.",
    );
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  // Explicit local opt-in; production never redirects to emulators.
  if (import.meta.env.DEV && import.meta.env["VITE_FIREBASE_USE_EMULATORS"] === "true") {
    const host = import.meta.env["VITE_FIREBASE_EMULATOR_HOST"] || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  }
  services = { auth };
  return services;
}
