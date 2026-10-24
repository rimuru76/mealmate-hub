export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Application documents stored in Firestore; dates use ISO 8601 strings. */
export type Database = {
  public: {
    Tables: {
      ai_pricing_negotiations: {
        Row: {
          approved_by: string | null;
          attempts: number;
          base_price: number;
          branch_count: number;
          contract_months: number;
          created_at: string;
          created_by: string | null;
          current_offer: number | null;
          discount_reason: string | null;
          final_offer: number | null;
          human_approved: boolean;
          id: string;
          max_discount_pct: number;
          minimum_price: number;
          order_volume: number;
          recommendation: string | null;
          restaurant_id: string | null;
          restaurant_name: string | null;
          restaurant_size: string | null;
          suggested_offer: number | null;
          updated_at: string;
          upfront_discount_pct: number;
        };
      };
      branches: {
        Row: {
          address: string | null;
          created_at: string;
          delivery_radius_km: number | null;
          id: string;
          is_active: boolean;
          manager_name: string | null;
          name: string;
          opening_hours: Json;
          phone: string | null;
          pickup_enabled: boolean;
          restaurant_id: string;
          updated_at: string;
        };
      };
      customers: {
        Row: {
          branch_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          last_order_at: string | null;
          name: string;
          phone: string | null;
          restaurant_id: string;
          total_orders: number;
          total_spent: number;
          updated_at: string;
          user_id: string | null;
        };
      };
      invoices: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          period_end: string | null;
          period_start: string | null;
          reference: string;
          restaurant_id: string;
          source: string;
          status: string;
        };
      };
      menu_categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
          restaurant_id: string;
          updated_at: string;
        };
      };
      menu_items: {
        Row: {
          allergens: string[];
          branch_id: string | null;
          calories: number | null;
          category_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean;
          is_halaal: boolean;
          is_spicy: boolean;
          is_vegan: boolean;
          is_vegetarian: boolean;
          name: string;
          position: number;
          prep_time_minutes: number | null;
          price: number;
          restaurant_id: string;
          sku: string | null;
          updated_at: string;
        };
      };
      modifier_groups: {
        Row: {
          created_at: string;
          id: string;
          is_required: boolean;
          max_select: number;
          menu_item_id: string | null;
          name: string;
          restaurant_id: string;
        };
      };
      modifiers: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          is_available: boolean;
          name: string;
          price: number;
          restaurant_id: string;
        };
      };
      notification_preferences: {
        Row: {
          announcements: boolean;
          billing: boolean;
          id: string;
          new_orders: boolean;
          order_updates: boolean;
          promotions: boolean;
          updated_at: string;
          user_id: string;
        };
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          restaurant_id: string | null;
          title: string;
          type: string;
          user_id: string | null;
        };
      };
      order_item_modifiers: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          order_item_id: string;
          price: number;
          restaurant_id: string;
        };
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          menu_item_id: string | null;
          name: string;
          notes: string | null;
          order_id: string;
          quantity: number;
          restaurant_id: string;
          total_price: number;
          unit_price: number;
        };
      };
      orders: {
        Row: {
          branch_id: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          delivery_address: string | null;
          delivery_fee: number;
          discount: number;
          fulfillment: Database["public"]["Enums"]["fulfillment_type"];
          id: string;
          notes: string | null;
          order_number: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          placed_at: string;
          promotion_id: string | null;
          restaurant_id: string;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total: number;
          updated_at: string;
        };
      };
      plans: {
        Row: {
          created_at: string;
          entitlement: string;
          features: Json;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
          price_zar: number;
          revenuecat_product_id: string | null;
        };
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
      };
      promotion_redemptions: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_id: string | null;
          promotion_id: string;
          restaurant_id: string;
        };
      };
      promotions: {
        Row: {
          branch_id: string | null;
          created_at: string;
          description: string | null;
          eligible_item_ids: string[];
          ends_at: string | null;
          id: string;
          is_active: boolean;
          max_uses: number | null;
          minimum_order: number;
          name: string;
          restaurant_id: string;
          revenue_generated: number;
          starts_at: string | null;
          type: Database["public"]["Enums"]["promo_type"];
          updated_at: string;
          uses: number;
          value: number;
          views: number;
        };
      };
      restaurant_members: {
        Row: {
          branch_id: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          restaurant_id: string;
          role: Database["public"]["Enums"]["member_role"];
          updated_at: string;
          user_id: string;
        };
      };
      restaurants: {
        Row: {
          address: string | null;
          category: string | null;
          city: string | null;
          country: string | null;
          cover_url: string | null;
          created_at: string;
          cuisine: string | null;
          delivery_enabled: boolean;
          description: string | null;
          email: string | null;
          id: string;
          is_suspended: boolean;
          latitude: number | null;
          logo_url: string | null;
          longitude: number | null;
          minimum_order: number;
          name: string;
          onboarding_complete: boolean;
          opening_hours: Json;
          owner_email: string | null;
          owner_id: string | null;
          owner_name: string | null;
          phone: string | null;
          pickup_enabled: boolean;
          prep_time_minutes: number;
          province: string | null;
          slug: string | null;
          updated_at: string;
          website: string | null;
        };
      };
      staff_invites: {
        Row: {
          accepted_at: string | null;
          branch_id: string | null;
          created_at: string;
          email: string;
          id: string;
          invited_by: string | null;
          restaurant_id: string;
          role: Database["public"]["Enums"]["member_role"];
          status: string;
        };
      };
      subscription_events: {
        Row: {
          created_at: string;
          entitlement: string | null;
          event_type: string;
          id: string;
          payload: Json;
          product_id: string | null;
          restaurant_id: string | null;
        };
      };
      subscriptions: {
        Row: {
          app_user_id: string | null;
          created_at: string;
          entitlement: string | null;
          expiration_date: string | null;
          id: string;
          is_trial: boolean;
          last_synced_at: string | null;
          plan_id: string | null;
          product_id: string | null;
          restaurant_id: string;
          revenuecat_customer_id: string | null;
          status: Database["public"]["Enums"]["sub_status"];
          updated_at: string;
        };
      };
      support_tickets: {
        Row: {
          category: string;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          priority: string;
          restaurant_id: string | null;
          status: Database["public"]["Enums"]["ticket_status"];
          subject: string;
          updated_at: string;
        };
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
      };
    };
    Enums: {
      fulfillment_type: "delivery" | "pickup";
      member_role: "owner" | "manager" | "staff";
      order_status:
        | "new"
        | "accepted"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "completed"
        | "cancelled"
        | "rejected";
      payment_status: "pending" | "paid" | "refunded" | "failed";
      platform_role: "admin";
      promo_type: "percentage" | "fixed" | "bogo" | "free_item" | "free_delivery";
      sub_status: "none" | "trialing" | "active" | "past_due" | "cancelled" | "expired";
      ticket_status: "open" | "in_progress" | "resolved" | "closed";
    };
  };
};
export type TableName = keyof Database["public"]["Tables"];
export type DocumentRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
