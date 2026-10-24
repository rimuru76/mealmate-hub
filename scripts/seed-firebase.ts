import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env["FIREBASE_PROJECT_ID"];
if (!projectId) throw new Error("Set FIREBASE_PROJECT_ID to the intended project before seeding.");
const service = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"]
  ? JSON.parse(process.env["FIREBASE_SERVICE_ACCOUNT_JSON"]!)
  : null;
const clientEmail = service?.client_email || process.env["FIREBASE_CLIENT_EMAIL"];
const privateKey = (service?.private_key || process.env["FIREBASE_PRIVATE_KEY"])?.replace(
  /\\n/g,
  "\n",
);
const app = initializeApp({
  projectId,
  credential:
    clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
});
const db = getFirestore(app);
const plans = [
  {
    id: "starter",
    name: "Starter",
    price_zar: 1200,
    entitlement: "starter",
    revenuecat_product_id: "mealmate_partners_starter_monthly",
    features: {
      max_branches: 1,
      max_promotions: 3,
      advanced_analytics: false,
      advanced_staff: false,
      max_staff: 5,
      premium_tools: false,
    },
    position: 1,
  },
  {
    id: "pro",
    name: "Pro",
    price_zar: 3000,
    entitlement: "pro",
    revenuecat_product_id: "mealmate_partners_pro_monthly",
    features: {
      max_branches: 25,
      max_promotions: 100,
      advanced_analytics: true,
      advanced_staff: true,
      max_staff: 100,
      premium_tools: true,
    },
    position: 2,
  },
];
// Do not overwrite a catalogue the owner has already configured.
await db.runTransaction(async (tx) => {
  const existing = await Promise.all(
    plans.map((plan) => tx.get(db.collection("hub_plans").doc(plan.id))),
  );
  for (let i = 0; i < plans.length; i++)
    if (!existing[i]!.exists)
      tx.create(db.collection("hub_plans").doc(plans[i]!.id), {
        ...plans[i],
        is_active: true,
        created_at: new Date().toISOString(),
      });
});
console.log("Plan catalogue initialized (existing plans preserved).");
