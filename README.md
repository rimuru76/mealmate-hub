# MealMate Partners

Restaurant management app built with React, TanStack Start, Firebase Authentication,
Cloud Firestore, and Firebase Storage. Imported from
[taz2011taz-sys/mealmate-hub](https://github.com/taz2011taz-sys/mealmate-hub)
at commit `0606d30f79cadd8b8064f45ef4d75c86a10d622b`.

## Connect your existing Firebase project on Vercel

The consumer app at [mealsmates.site](https://mealsmates.site) uses Firebase project
`mealmate-d2e53`. Its public web settings are in `.env.example`.

1. Set the public `VITE_FIREBASE_*` values from `.env.example` on the **Hub** Vercel
   project. Set server-only `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_JSON`
   from the existing consumer project. Split `FIREBASE_CLIENT_EMAIL` and
   `FIREBASE_PRIVATE_KEY`, or Application Default Credentials, are also supported.
   Never use a `VITE_` prefix for a service account. Database IDs are used exactly as configured: this project uses the named
   `default` database. `(default)` is a different database; leave the override unset
   for the standard database used by the local emulators.
2. Enable Email/Password and Google sign-in in Firebase Authentication. Add the
   partner domain to Authentication → Settings → Authorized domains. Both apps use
   the same identities; users still sign in separately on each domain.
3. Use the **existing** Firestore database, Storage bucket and consumer security
   rules. The copies under `firebase/` match the consumer source and are used for
   local tests. Do not replace production rules as part of deploying this portal.
4. Seed partner Starter and Pro plans with `bun run firebase:seed` using the server
   environment. Existing plan documents are preserved.
5. Connect `projectsmart947-crypto/mealmate-hub` to the Hub Vercel project. Select
   **Other**, install with `bun install --frozen-lockfile`, and build with
   `bun run build`. Nitro writes `.vercel/output`. Set the partner domain
   (`partner.mealsmates.site` is the consumer's existing link destination), confirm
   DNS, then verify sign-in and an approved restaurant before directing traffic.
   Public environment changes require a rebuild.
6. Password reset emails should open `https://YOUR_PARTNER_DOMAIN/reset-password`;
   the app consumes Firebase's `oobCode`.

The public Firebase configuration does not grant database administration. A valid
server credential and Vercel deployment are still required to connect live data.

## Run locally

Requires Node 22+ and Bun 1.4+. Install with `bun install --frozen-lockfile`.
Copy `.env.example` to `.env.local`, fill in your Firebase settings, then run
`bun run dev --host 0.0.0.0`. Build with `bun run build`.

For an isolated local backend, install Java 21+, run `bun run firebase:emulators`,
and use the synthetic `demo-mealmate` Firebase project. Set these public settings
in `.env.local`:

```dotenv
VITE_FIREBASE_API_KEY=demo-local-key
VITE_FIREBASE_AUTH_DOMAIN=demo-mealmate.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-mealmate
VITE_FIREBASE_STORAGE_BUCKET=demo-mealmate.appspot.com
VITE_FIREBASE_APP_ID=1:123456789:web:local
VITE_FIREBASE_USE_EMULATORS=true
```

Launch the app server with the corresponding server overrides:

```sh
FIREBASE_PROJECT_ID=demo-mealmate \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 bun run dev --host 0.0.0.0
```

Emulator data is disposable. Never set emulator overrides on Vercel production.
Run `firebase:seed` with the same server overrides to initialize local plans.

## Shared marketplace data and permissions

The bridge follows the consumer implementation at
`tatendamkhwanazi2-alt/mealsmatess` (`src/lib/restaurants.server.ts`,
`src/lib/marketplace.server.ts`, and their schemas).

| Partners screen  | Shared Firestore collection        |
| ---------------- | ---------------------------------- |
| Restaurants      | `restaurants`                      |
| Staff            | `restaurant_staff`                 |
| Branches         | `restaurant_locations`             |
| Menu             | `menu_items`                       |
| Orders and lines | `restaurant_orders`, `order_items` |
| Promotions       | `restaurant_promotions`            |
| Platform roles   | `user_roles`                       |

Additional partner features, including billing, categories, notifications and
preferences, use `hub_` collections. Existing consumer subscriptions stay separate.
Partner profiles initially read the consumer name/phone, then save their own copy.

- Authenticated server requests verify Firebase ID tokens, revocation and restaurant
  membership. Partners poll the server every 15 seconds for orders/notifications,
  following the consumer's access model. Browser database writes remain denied.
- The adapter preserves consumer approval, currency and other fields on edits;
  translates categories, dietary tags, promotion types, order lines and status;
  and rejects references to another restaurant. Unsupported free-item promotions
  are excluded because the consumer has no matching promotion kind.
- New restaurants create a pending application and stay paused until approved
  through the existing consumer admin process. No browser request grants approval,
  paid entitlements or platform roles.
- Owners/managers edit catalogs. Staff view restaurant data and progress orders
  through the consumer's allowed transitions. Disabling staff moves membership out
  of `restaurant_staff`, revoking the consumer's existence-based access as well.
- Platform admins use the existing `user_roles` admin role or the trusted
  `platform_admin` Auth claim. Invitations require a verified matching email.
- Catalog images are intentionally public Firebase download URLs for the consumer
  menu. Upload/delete goes through the server with manager checks, image signature
  validation and a 2 MB limit. Direct browser Storage access remains denied.
- Account deletion removes the shared Firebase Auth identity and revokes partner
  memberships, affecting sign-in to both apps. Restaurant business records remain.
- Restaurant deletion cascades dependent documents in a bounded transaction;
  large datasets require administrative cleanup. Menu deletion preserves order history.

No legacy provider records or accounts are imported automatically. This deployment
reuses the existing consumer Firebase data; any separate legacy dataset requires a
reviewed migration and identity mapping before import.

## Billing and optional AI

RevenueCat continues to be the billing authority. Set the existing
`REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_SECRET` in Vercel. Configure the
RevenueCat webhook at `/api/public/revenuecat` with the shared authorization secret.
The subscription sync handler and webhook write only through the Firebase Admin
SDK. Subscription documents use the restaurant ID as their document ID. No paid
entitlements are granted by browser requests or onboarding.

`LOVABLE_API_KEY` remains optional for the existing AI features. None of these
server keys belong in a public `VITE_` variable.

## Checks

```sh
bun run typecheck
bun run lint
bun run build
bun test tests/query.test.ts
bunx firebase emulators:exec --project demo-mealmate --only auth,firestore,storage 'bun test tests/firebase.test.ts'
```
