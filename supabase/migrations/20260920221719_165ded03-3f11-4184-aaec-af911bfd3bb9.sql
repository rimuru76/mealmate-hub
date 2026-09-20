
-- ENUMS
CREATE TYPE public.member_role AS ENUM ('owner','manager','staff');
CREATE TYPE public.platform_role AS ENUM ('admin');
CREATE TYPE public.order_status AS ENUM ('new','accepted','preparing','ready','out_for_delivery','completed','cancelled','rejected');
CREATE TYPE public.fulfillment_type AS ENUM ('delivery','pickup');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','refunded','failed');
CREATE TYPE public.promo_type AS ENUM ('percentage','fixed','bogo','free_item','free_delivery');
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','resolved','closed');
CREATE TYPE public.sub_status AS ENUM ('none','trialing','active','past_due','cancelled','expired');

-- UTIL
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- PLATFORM ADMIN ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.platform_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- RESTAURANTS
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  category TEXT,
  cuisine TEXT,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'South Africa',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  logo_url TEXT,
  cover_url TEXT,
  opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  pickup_enabled BOOLEAN NOT NULL DEFAULT true,
  minimum_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  prep_time_minutes INTEGER NOT NULL DEFAULT 20,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.restaurant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.member_role NOT NULL DEFAULT 'staff',
  branch_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_members TO authenticated;
GRANT ALL ON public.restaurant_members TO service_role;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_members_restaurant ON public.restaurant_members(restaurant_id);
CREATE INDEX idx_members_user ON public.restaurant_members(user_id);

-- AUTHZ HELPERS
CREATE OR REPLACE FUNCTION public.member_role_for(_restaurant_id UUID, _user_id UUID)
RETURNS public.member_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.restaurant_members
  WHERE restaurant_id = _restaurant_id AND user_id = _user_id AND is_active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_member(_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.member_role_for(_restaurant_id, auth.uid()) IS NOT NULL
      OR public.is_platform_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.member_role_for(_restaurant_id, auth.uid()) IN ('owner','manager')
      OR public.is_platform_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.member_role_for(_restaurant_id, auth.uid()) = 'owner'
      OR public.is_platform_admin(auth.uid());
$$;

-- BRANCHES
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_radius_km NUMERIC(6,2) DEFAULT 5,
  pickup_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_branches_restaurant ON public.branches(restaurant_id);

-- MENU
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_categories_restaurant ON public.menu_categories(restaurant_id);

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  sku TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  prep_time_minutes INTEGER,
  calories INTEGER,
  allergens TEXT[] NOT NULL DEFAULT '{}',
  is_vegetarian BOOLEAN NOT NULL DEFAULT false,
  is_vegan BOOLEAN NOT NULL DEFAULT false,
  is_halaal BOOLEAN NOT NULL DEFAULT false,
  is_spicy BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX idx_items_category ON public.menu_items(category_id);

CREATE TABLE public.modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  max_select INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modifier_groups TO authenticated;
GRANT ALL ON public.modifier_groups TO service_role;
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_modgroups_restaurant ON public.modifier_groups(restaurant_id);

CREATE TABLE public.modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modifiers TO authenticated;
GRANT ALL ON public.modifiers TO service_role;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_modifiers_restaurant ON public.modifiers(restaurant_id);

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_restaurant ON public.customers(restaurant_id);

-- ORDERS
CREATE SEQUENCE public.order_number_seq START 1000;
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL DEFAULT ('MM-' || nextval('public.order_number_seq')),
  status public.order_status NOT NULL DEFAULT 'new',
  fulfillment public.fulfillment_type NOT NULL DEFAULT 'delivery',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  promotion_id UUID,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT USAGE ON SEQUENCE public.order_number_seq TO authenticated, service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX idx_orders_branch ON public.orders(branch_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

CREATE TABLE public.order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_modifiers TO authenticated;
GRANT ALL ON public.order_item_modifiers TO service_role;
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;

-- PROMOTIONS
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type public.promo_type NOT NULL DEFAULT 'percentage',
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  minimum_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(12,2) NOT NULL DEFAULT 0,
  eligible_item_ids UUID[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_promotions_restaurant ON public.promotions(restaurant_id);

CREATE TABLE public.promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_redemptions TO authenticated;
GRANT ALL ON public.promotion_redemptions TO service_role;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;

-- STAFF INVITES
CREATE TABLE public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role public.member_role NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invites TO authenticated;
GRANT ALL ON public.staff_invites TO service_role;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invites_restaurant ON public.staff_invites(restaurant_id);

-- SUBSCRIPTION PLANS + FEATURE LIMITS (backend configurable)
CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_zar NUMERIC(10,2) NOT NULL,
  entitlement TEXT NOT NULL,
  revenuecat_product_id TEXT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.plans FOR SELECT USING (true);

INSERT INTO public.plans (id,name,price_zar,entitlement,revenuecat_product_id,features,position) VALUES
('starter','Starter',1200,'starter','mealmate_partners_starter_monthly',
 '{"max_branches":1,"max_promotions":3,"advanced_analytics":false,"advanced_staff":false,"max_staff":5,"premium_tools":false}'::jsonb,1),
('pro','Pro',3000,'pro','mealmate_partners_pro_monthly',
 '{"max_branches":25,"max_promotions":100,"advanced_analytics":true,"advanced_staff":true,"max_staff":100,"premium_tools":true}'::jsonb,2);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  revenuecat_customer_id TEXT,
  app_user_id TEXT,
  entitlement TEXT,
  product_id TEXT,
  plan_id TEXT REFERENCES public.plans(id),
  status public.sub_status NOT NULL DEFAULT 'none',
  is_trial BOOLEAN NOT NULL DEFAULT false,
  expiration_date TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_subs_status ON public.subscriptions(status);

CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  product_id TEXT,
  entitlement TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'paid',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'revenuecat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invoices_restaurant ON public.invoices(restaurant_id);

-- SUPPORT
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status public.ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_restaurant ON public.notifications(restaurant_id);

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  new_orders BOOLEAN NOT NULL DEFAULT true,
  order_updates BOOLEAN NOT NULL DEFAULT true,
  billing BOOLEAN NOT NULL DEFAULT true,
  promotions BOOLEAN NOT NULL DEFAULT true,
  announcements BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- AI PRICING
CREATE TABLE public.ai_pricing_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_reason TEXT,
  contract_months INTEGER NOT NULL DEFAULT 12,
  upfront_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  branch_count INTEGER NOT NULL DEFAULT 1,
  restaurant_size TEXT,
  order_volume INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  current_offer NUMERIC(12,2),
  suggested_offer NUMERIC(12,2),
  final_offer NUMERIC(12,2),
  recommendation TEXT,
  human_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_pricing_negotiations TO authenticated;
GRANT ALL ON public.ai_pricing_negotiations TO service_role;
ALTER TABLE public.ai_pricing_negotiations ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "restaurants read" ON public.restaurants FOR SELECT TO authenticated USING (public.is_member(id));
CREATE POLICY "restaurants insert" ON public.restaurants FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "restaurants update" ON public.restaurants FOR UPDATE TO authenticated USING (public.is_manager(id)) WITH CHECK (public.is_manager(id));
CREATE POLICY "restaurants delete" ON public.restaurants FOR DELETE TO authenticated USING (public.is_owner(id));

CREATE POLICY "members read" ON public.restaurant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(restaurant_id));
CREATE POLICY "members insert" ON public.restaurant_members FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(restaurant_id) OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
CREATE POLICY "members update" ON public.restaurant_members FOR UPDATE TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));
CREATE POLICY "members delete" ON public.restaurant_members FOR DELETE TO authenticated USING (public.is_owner(restaurant_id));

CREATE POLICY "branches read" ON public.branches FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "branches write" ON public.branches FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "categories read" ON public.menu_categories FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "categories write" ON public.menu_categories FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "items read" ON public.menu_items FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "items write" ON public.menu_items FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "modgroups read" ON public.modifier_groups FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "modgroups write" ON public.modifier_groups FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "modifiers read" ON public.modifiers FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "modifiers write" ON public.modifiers FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "customers read" ON public.customers FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "customers write" ON public.customers FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.is_manager(restaurant_id));
CREATE POLICY "orders delete" ON public.orders FOR DELETE TO authenticated USING (public.is_owner(restaurant_id));

CREATE POLICY "order items read" ON public.order_items FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "order items write" ON public.order_items FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "order item mods read" ON public.order_item_modifiers FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "order item mods write" ON public.order_item_modifiers FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "promotions read" ON public.promotions FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "promotions write" ON public.promotions FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "redemptions read" ON public.promotion_redemptions FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "redemptions write" ON public.promotion_redemptions FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "invites read" ON public.staff_invites FOR SELECT TO authenticated
  USING (public.is_manager(restaurant_id) OR lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));
CREATE POLICY "invites write" ON public.staff_invites FOR ALL TO authenticated
  USING (public.is_manager(restaurant_id)) WITH CHECK (public.is_manager(restaurant_id));

CREATE POLICY "subs read" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_manager(restaurant_id));
CREATE POLICY "sub events read" ON public.subscription_events FOR SELECT TO authenticated USING (public.is_manager(restaurant_id));
CREATE POLICY "invoices read" ON public.invoices FOR SELECT TO authenticated USING (public.is_manager(restaurant_id));

CREATE POLICY "tickets read" ON public.support_tickets FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tickets insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "tickets update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_platform_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (restaurant_id IS NOT NULL AND public.is_member(restaurant_id)));
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (restaurant_id IS NOT NULL AND public.is_member(restaurant_id)))
  WITH CHECK (true);
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (restaurant_id IS NULL OR public.is_member(restaurant_id));

CREATE POLICY "prefs all" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai pricing admin" ON public.ai_pricing_negotiations FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- TRIGGERS
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_restaurants_updated BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_items_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_promotions_updated BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- new user -> profile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- owner membership on restaurant create
CREATE OR REPLACE FUNCTION public.handle_new_restaurant() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.subscriptions (restaurant_id, status) VALUES (NEW.id, 'none') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_restaurant_created AFTER INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.handle_new_restaurant();

-- realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
