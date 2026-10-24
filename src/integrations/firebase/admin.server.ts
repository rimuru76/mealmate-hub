import "@tanstack/react-start/server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function getFirebaseAdmin() {
  const encoded = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  const service = encoded
    ? (JSON.parse(encoded) as { project_id?: string; client_email?: string; private_key?: string })
    : null;
  const projectId =
    process.env["FIREBASE_PROJECT_ID"] ||
    process.env["VITE_FIREBASE_PROJECT_ID"] ||
    service?.project_id;
  if (!projectId) throw new Error("Firebase server project is not configured.");
  if (service?.project_id && service.project_id !== projectId)
    throw new Error("Firebase server project does not match the service account.");
  const clientEmail = service?.client_email || process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = (service?.private_key || process.env["FIREBASE_PRIVATE_KEY"])?.replace(
    /\\n/g,
    "\n",
  );
  const app =
    getApps().find((a) => a.name === "mealmate-server") ??
    initializeApp(
      {
        projectId,
        credential:
          clientEmail && privateKey
            ? cert({ projectId, clientEmail, privateKey })
            : applicationDefault(),
        ...(process.env["VITE_FIREBASE_STORAGE_BUCKET"]
          ? { storageBucket: process.env["VITE_FIREBASE_STORAGE_BUCKET"] }
          : {}),
      },
      "mealmate-server",
    );
  return {
    auth: getAuth(app),
    db: getFirestore(
      app,
      process.env["FIREBASE_FIRESTORE_DATABASE_ID"] ||
        process.env["VITE_FIREBASE_FIRESTORE_DATABASE_ID"] ||
        "(default)",
    ),
    app,
  };
}
