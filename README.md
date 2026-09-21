# MealMate Hub

Build MEALMATE PARTNERS, a production-ready mobile-first restaurant management app operated by Taz Technologies.



This is NOT a static mockup, prototype, fake dashboard, or frontend-only demo. Build the complete application with a real Supabase backend, real authentication, real database persistence, real-time order updates, secure role-based access, and RevenueCat for all in-app subscriptions.



1. PRODUCT



App name:



MealMate Partners



Tagline:



Run your restaurant. Grow your business.



Purpose:



MealMate Partners is the restaurant-side operating system for restaurants that partner with MealMate.



Restaurants use the app to:



- Manage their restaurant profile

- Manage branches

- Create and edit menus

- Manage food items

- Upload food images

- Set prices

- Manage modifiers/add-ons

- Receive orders

- Accept/reject orders

- Update order status

- Manage customers

- Create promotions

- View revenue and analytics

- Manage staff

- Manage opening hours

- Manage delivery/pickup settings

- Manage their MealMate subscription

- View invoices/payment history

- Contact support

- Monitor restaurant performance



The consumer MealMate app and MealMate Partners must be treated as separate applications sharing the same backend.



---



2. TECHNOLOGY



Use:



- React + TypeScript

- Mobile-first responsive UI

- Tailwind CSS

- Supabase

- PostgreSQL

- Supabase Auth

- Supabase Storage

- Supabase Realtime

- RevenueCat for subscriptions

- Secure server-side functions where required

- Production-ready architecture



Do NOT use:



- Fake data

- Hardcoded restaurant data

- Mock checkout

- Fake subscription status

- Local-only database

- Static dashboard cards pretending to contain real data

- Stripe Checkout inside the mobile app

- Stripe subscription logic for restaurant app subscriptions



RevenueCat is the ONLY subscription/billing layer for MealMate Partners.



---



3. AUTHENTICATION



Create real Supabase authentication.



Support:



- Email/password signup

- Email/password login

- Forgot password

- Password reset

- Logout

- Session persistence

- Account deletion

- Email verification



Restaurant onboarding:



1. Create account

2. Enter restaurant name

3. Owner name

4. Phone

5. Email

6. Restaurant category

7. Address

8. City

9. Province

10. Country

11. Upload logo

12. Upload cover image

13. Select subscription

14. Complete RevenueCat purchase

15. Restaurant dashboard becomes active



Do not allow unauthorized users to access another restaurant's data.



---



4. USER ROLES



Create secure roles:



Owner



Full restaurant access.



Manager



Can manage:



- Orders

- Menu

- Customers

- Promotions

- Analytics

- Branches



Cannot:



- Change ownership

- Delete restaurant account

- Change billing ownership



Staff



Can:



- View orders

- Accept/reject orders

- Update order status

- View relevant menu information



Cannot:



- Access billing

- Access financial analytics

- Manage staff

- Delete restaurant

- Change subscription



Admin



Taz Technologies internal administration role.



Admin can manage the entire MealMate Partners platform.



Never use editable frontend metadata as the source of authorization. Store authorization securely in the database/app-level authorization system and enforce it server-side/RLS.



---



5. MAIN NAVIGATION



Mobile bottom navigation:



- Dashboard

- Orders

- Menu

- More



Inside More:



- Restaurant

- Branches

- Customers

- Promotions

- Analytics

- Staff

- Payments

- Subscription

- Settings

- Support



Use a clean mobile navigation system.



---



6. DASHBOARD



Create a premium restaurant dashboard.



Top:



Good morning, [Restaurant Name]



Show:



- Today's orders

- Today's revenue

- Pending orders

- Completed orders

- Average order value

- Active customers



Charts:



- Revenue over time

- Orders over time

- Popular menu items

- Customer growth



Quick actions:



- New Menu Item

- View Orders

- Create Promotion

- Add Branch

- Invite Staff



Add live status indicators.



Use real Supabase data.



---



7. ORDERS



Create a complete restaurant order-management system.



Order tabs:



- New

- Accepted

- Preparing

- Ready

- Out for delivery

- Completed

- Cancelled



Each order shows:



- Order number

- Customer

- Items

- Modifiers

- Quantity

- Price

- Delivery/pickup

- Address where applicable

- Customer notes

- Order time

- Payment status

- Total



Actions:



- Accept

- Reject

- Start preparing

- Mark ready

- Mark completed

- Cancel



Use Supabase Realtime so new orders appear without refreshing.



Add sound/vibration-friendly visual notification states for new orders.



---



8. MENU



Create a complete menu management system.



Categories:



- Breakfast

- Burgers

- Pizza

- Chicken

- Sides

- Drinks

- Desserts

- Custom categories



Restaurants can:



- Create category

- Rename category

- Delete category

- Reorder categories

- Add item

- Edit item

- Delete item

- Disable item

- Set availability

- Upload images

- Set price

- Add description

- Add modifiers

- Add dietary information



Menu item fields:



- Name

- Description

- Price

- Image

- Category

- SKU

- Availability

- Preparation time

- Calories

- Allergens

- Vegetarian

- Vegan

- Halaal

- Spicy



Modifiers:



- Size

- Extra cheese

- Extra sauce

- Add-ons

- Custom modifiers



Support modifier pricing.



---



9. RESTAURANT PROFILE



Restaurant profile management:



- Restaurant name

- Description

- Logo

- Cover image

- Phone

- Email

- Website

- Address

- GPS coordinates

- Cuisine

- Opening hours

- Delivery availability

- Pickup availability

- Minimum order

- Estimated preparation time



Allow restaurants to preview how their profile appears inside MealMate.



---



10. BRANCHES



Support multiple restaurant branches.



Each branch has:



- Name

- Address

- Phone

- Manager

- Opening hours

- Delivery radius

- Pickup availability

- Active/inactive status



Allow owners to:



- Add branch

- Edit branch

- Disable branch

- Switch active branch



Dashboard analytics should allow:



- All branches

- Individual branch



---



11. CUSTOMERS



Create a customer management page.



Show:



- Customer name

- Orders

- Total spent

- Last order

- Average order value

- Favorite items

- Branch

- Customer since



Search and filter customers.



Do not expose unnecessary private customer information.



---



12. PROMOTIONS



Restaurants can create promotions.



Promotion types:



- Percentage discount

- Fixed discount

- Buy one get one

- Free item

- Free delivery

- Limited-time promotion



Fields:



- Name

- Description

- Discount

- Start date

- End date

- Minimum order

- Maximum uses

- Eligible items

- Eligible branches

- Active/inactive



Track:



- Views

- Uses

- Revenue generated

- Conversion



---



13. ANALYTICS



Create production analytics.



Metrics:



- Revenue

- Orders

- Average order value

- Customers

- Repeat customers

- Popular items

- Cancelled orders

- Completion rate

- Branch performance

- Promotion performance



Date filters:



- Today

- 7 days

- 30 days

- 90 days

- Custom



Use real database queries.



---



14. STAFF



Owner/manager can:



- Invite staff

- Assign role

- Assign branch

- Disable staff

- Remove staff



Roles:



- Owner

- Manager

- Staff



Create secure role-based permissions.



---



15. PAYMENTS



This section is for restaurant financial information related to MealMate orders and subscription records.



Show:



- Revenue

- Completed orders

- Pending amounts

- Payout history where available

- Transaction history

- Subscription charges

- Invoices



Do not create fake transactions.



---



16. REVENUECAT SUBSCRIPTIONS



IMPORTANT:



RevenueCat is the ONLY subscription system for the MealMate Partners mobile application.



Do NOT implement:



- Stripe Checkout

- Stripe Payment Links

- Stripe subscription UI

- Web Stripe billing inside the mobile app



Create RevenueCat subscription products for the available restaurant plans.



Suggested plans:



Starter



R1,200/month



Pro



R3,000/month



Display:



- Current plan

- Price

- Renewal date

- Trial status if applicable

- Subscription status

- Features

- Upgrade

- Downgrade

- Restore purchases

- Manage subscription



RevenueCat must be the source of truth for the user's entitlement.



Use RevenueCat customer IDs and entitlement IDs.



Never trust a subscription status supplied directly by the client.



Synchronize RevenueCat entitlement information with Supabase using a secure server-side webhook/integration.



Store:



- revenuecat_customer_id

- entitlement

- product_id

- subscription_status

- expiration_date

- last_synced_at



Never store RevenueCat secret/API keys in frontend code.



---



17. SUBSCRIPTION ACCESS



Create entitlement-based feature access.



Starter:



- Restaurant profile

- Menu

- Orders

- Customers

- Basic analytics

- Limited promotions

- Basic staff management



Pro:



- Everything in Starter

- Advanced analytics

- Multiple branches

- Advanced promotions

- Advanced staff management

- More analytics

- Premium restaurant tools



The exact feature limits must be configurable from the backend rather than hardcoded throughout the frontend.



When subscription expires:



- Do not delete restaurant data

- Show subscription warning

- Restrict premium features

- Keep essential account access

- Allow the owner to renew



---



18. REVENUECAT WEBHOOK



Create a secure backend endpoint for RevenueCat webhooks.



Handle events such as:



- INITIAL_PURCHASE

- RENEWAL

- CANCELLATION

- EXPIRATION

- BILLING_ISSUE

- PRODUCT_CHANGE



Validate the webhook securely.



Update the restaurant subscription record.



Do not allow the frontend to directly change entitlement status.



---



19. AI PRICING NEGOTIATION



Create a section:



AI Pricing Engine



Purpose:



Help Taz Technologies negotiate restaurant partnership pricing.



Fields:



- Base Price

- Minimum Price

- Maximum Discount

- Discount Reason

- Contract Length

- Upfront Payment Discount

- Branch Count

- Restaurant Size

- Order Volume

- Negotiation Attempts

- Current Offer

- Final Offer

- Human Approval Required



Display:



- Recommended negotiation range

- Current offer

- Suggested counter-offer

- Explanation



IMPORTANT:



AI recommendations are advisory only.



Never automatically finalize a contract or payment.



Require human approval before applying a final commercial offer.



---



20. SUPPORT



Create:



- Help center

- Contact support

- Report problem

- Feature request

- Account support



Ticket fields:



- Subject

- Category

- Description

- Priority

- Status

- Created date



---



21. SETTINGS



Settings:



- Profile

- Restaurant

- Notifications

- Security

- Staff permissions

- Subscription

- Privacy

- Terms

- Logout

- Delete account



---



22. DATABASE



Use Supabase PostgreSQL.



Create appropriate relational tables including:



- profiles

- restaurants

- restaurant_members

- branches

- menus

- menu_categories

- menu_items

- menu_item_modifiers

- modifiers

- customers

- orders

- order_items

- order_item_modifiers

- promotions

- promotion_redemptions

- staff_invites

- restaurant_analytics

- subscriptions

- subscription_events

- invoices

- support_tickets

- notifications

- ai_pricing_negotiations



Use UUID primary keys.



Use timestamps.



Use foreign keys.



Add indexes for:



- restaurant_id

- branch_id

- user_id

- order status

- created_at

- subscription status



---



23. SECURITY



This is critical.



Enable Row Level Security on every exposed Supabase table.



Restaurant users must only access restaurants they are members of.



Owners/managers/staff must have permissions according to their roles.



Do not expose:



- service-role keys

- RevenueCat secret keys

- webhook secrets

- private API keys

- payment provider secrets



Frontend may only use public/publishable configuration.



Use secure backend functions for privileged operations.



---



24. STORAGE



Use Supabase Storage for:



- Restaurant logos

- Restaurant covers

- Menu item images

- Staff/profile images where required



Storage policies must prevent one restaurant from accessing another restaurant's private assets.



Optimize/compress images.



Generate appropriate thumbnails where useful.



---



25. REAL-TIME



Use Supabase Realtime for:



- New orders

- Order status changes

- Notifications

- Staff changes where appropriate



The restaurant should not need to refresh the app to see a new order.



---



26. NOTIFICATIONS



Create notification infrastructure.



Types:



- New order

- Order accepted

- Order cancelled

- Subscription renewal

- Billing issue

- Promotion performance

- Staff invitation

- System announcement



Include notification preferences.



---



27. DESIGN SYSTEM



Premium dark-first UI.



Background:



#0D0D0D



Cards:



#121212



Primary CTA:



#FF4B26



Use:



- Rounded cards

- Smooth transitions

- Glass effects where appropriate

- Clean typography

- Large touch targets

- Mobile-first layouts

- Bottom sheets

- Modals

- Skeleton loading

- Empty states

- Error states

- Success states



The app should feel like a premium restaurant SaaS product, not a generic admin template.



---



28. MOBILE EXPERIENCE



Optimize primarily for:



- Android phones

- iPhones

- Tablets



Responsive breakpoints.



Make all buttons touch-friendly.



Avoid desktop-only tables.



Use cards and bottom sheets on mobile.



Support:



- Pull to refresh

- Loading states

- Offline-friendly cached UI where appropriate

- Network error recovery



---



29. ERROR HANDLING



Never silently fail.



Display useful messages such as:



"Couldn't load orders. Check your connection and try again."



"Your subscription needs attention."



"Menu item couldn't be saved."



Log technical errors securely.



Never show secret keys or sensitive backend information to users.



---



30. ONBOARDING



Create an impressive first-run experience.



Screen 1:



Welcome to MealMate Partners



"Everything you need to run your restaurant in one place."



Screen 2:



Manage Orders



"Stay on top of every order."



Screen 3:



Grow Your Restaurant



"Understand customers, revenue and performance."



Screen 4:



Let's set up your restaurant



Then restaurant onboarding.



---



31. EMPTY STATES



Use useful empty states.



Orders:



"No orders yet. New MealMate orders will appear here."



Menu:



"Your menu is empty. Add your first item."



Customers:



"Customers will appear after your first completed order."



Promotions:



"Create your first promotion to attract more customers."



Analytics:



"Complete orders to start generating analytics."



---



32. ADMIN/Taz TECHNOLOGIES



Create an internal admin capability separate from normal restaurant accounts.



Admin dashboard:



- Total restaurants

- Active restaurants

- Subscribers

- Revenue

- Orders

- Customers

- Subscription distribution

- Churn

- Support tickets

- Platform activity



Admin can:



- View restaurants

- Suspend restaurant

- Manage restaurant access

- View subscription state

- View orders

- Handle support

- Review AI pricing negotiations



Do not expose admin functionality to normal restaurant users.



---



33. DATA RELATIONSHIPS



A user can belong to one or more restaurants through restaurant_members.



A restaurant can have multiple branches.



A branch can have menus/orders/customers.



Orders belong to a restaurant and branch.



Menu items belong to a restaurant/category.



Subscription belongs to the restaurant/business account.



RevenueCat customer information must be associated with the appropriate authenticated account.



---



34. PERFORMANCE



Optimize:



- Database queries

- Images

- Realtime subscriptions

- Pagination

- Search

- Analytics



Do not load thousands of orders at once.



Use pagination/infinite scrolling.



Cache appropriate read-only data.



---



35. PRODUCTION QUALITY



Before considering the app complete, test:



- Signup

- Login

- Logout

- Password reset

- Restaurant creation

- Restaurant switching

- Branch creation

- Menu creation

- Menu editing

- Image uploads

- Order creation

- Order acceptance

- Order status updates

- Realtime orders

- Customer creation

- Promotions

- Staff invitations

- Role permissions

- Analytics

- RevenueCat purchase

- RevenueCat restore

- Subscription expiration

- RevenueCat webhook

- Subscription entitlement synchronization

- Account deletion

- Error states



Fix all console errors.



Do not leave TODOs.



Do not use fake data.



Do not claim a feature works unless it actually works.



---



36. ENVIRONMENT VARIABLES



Frontend public configuration may include:



SUPABASE URL



SUPABASE PUBLISHABLE/ANON KEY



REVENUECAT PUBLIC SDK KEY



Never expose:



SUPABASE SERVICE ROLE KEY



REVENUECAT SECRET API KEY



REVENUECAT WEBHOOK SECRET



Any other private server credentials.



Keep secrets in secure environment variables/server secrets.



---



37. FINAL REQUIREMENT



The finished product must feel like a real commercial mobile SaaS application operated by:



Taz Technologies



Brand:



MealMate Partners



Positioning:



The operating system for MealMate restaurants.



Build the real backend first and connect every screen to real data.



No fake dashboard.



No mock subscription.



No fake RevenueCat status.



No fake orders.



No placeholder backend.



No Stripe subscription implementation.



RevenueCat handles subscriptions. Supabase handles application data, authentication, authorization, storage, realtime and backend infrastructure.



Make the entire application production-ready, secure, responsive, polished and ready for mobile app packaging and store submission.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9deb22a5-4e7d-4814-a3f1-61884e64f130).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
