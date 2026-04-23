export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          admin_email: string;
          admin_id: string;
          created_at: string;
          id: string;
          ip_address: unknown;
          new_data: Json | null;
          old_data: Json | null;
          resource_id: string | null;
          resource_type: string;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          admin_email: string;
          admin_id: string;
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          resource_id?: string | null;
          resource_type: string;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          admin_email?: string;
          admin_id?: string;
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          resource_id?: string | null;
          resource_type?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      allergens: {
        Row: {
          code: string;
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          severity: string | null;
          updated_at: string | null;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          severity?: string | null;
          updated_at?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          severity?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      canonical_ingredient_allergens: {
        Row: {
          allergen_id: string;
          canonical_ingredient_id: string;
        };
        Insert: {
          allergen_id: string;
          canonical_ingredient_id: string;
        };
        Update: {
          allergen_id?: string;
          canonical_ingredient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'canonical_ingredient_allergens_allergen_id_fkey';
            columns: ['allergen_id'];
            isOneToOne: false;
            referencedRelation: 'allergens';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canonical_ingredient_allergens_canonical_ingredient_id_fkey';
            columns: ['canonical_ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      canonical_ingredient_dietary_tags: {
        Row: {
          canonical_ingredient_id: string;
          dietary_tag_id: string;
        };
        Insert: {
          canonical_ingredient_id: string;
          dietary_tag_id: string;
        };
        Update: {
          canonical_ingredient_id?: string;
          dietary_tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'canonical_ingredient_dietary_tags_canonical_ingredient_id_fkey';
            columns: ['canonical_ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_ingredients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canonical_ingredient_dietary_tags_dietary_tag_id_fkey';
            columns: ['dietary_tag_id'];
            isOneToOne: false;
            referencedRelation: 'dietary_tags';
            referencedColumns: ['id'];
          },
        ];
      };
      canonical_ingredients: {
        Row: {
          canonical_name: string;
          created_at: string | null;
          id: string;
          ingredient_family_name: string;
          is_vegan: boolean | null;
          is_vegetarian: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          canonical_name: string;
          created_at?: string | null;
          id?: string;
          ingredient_family_name?: string;
          is_vegan?: boolean | null;
          is_vegetarian?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          canonical_name?: string;
          created_at?: string | null;
          id?: string;
          ingredient_family_name?: string;
          is_vegan?: boolean | null;
          is_vegetarian?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      dietary_tags: {
        Row: {
          category: string | null;
          code: string;
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          code: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          code?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      dish_analytics: {
        Row: {
          dish_id: string;
          engagement_rate: number | null;
          favorite_count: number | null;
          first_tracked_at: string | null;
          is_trending: boolean | null;
          last_updated_at: string | null;
          order_count: number | null;
          popularity_score: number | null;
          recent_views_24h: number | null;
          super_like_count: number | null;
          view_count: number | null;
        };
        Insert: {
          dish_id: string;
          engagement_rate?: number | null;
          favorite_count?: number | null;
          first_tracked_at?: string | null;
          is_trending?: boolean | null;
          last_updated_at?: string | null;
          order_count?: number | null;
          popularity_score?: number | null;
          recent_views_24h?: number | null;
          super_like_count?: number | null;
          view_count?: number | null;
        };
        Update: {
          dish_id?: string;
          engagement_rate?: number | null;
          favorite_count?: number | null;
          first_tracked_at?: string | null;
          is_trending?: boolean | null;
          last_updated_at?: string | null;
          order_count?: number | null;
          popularity_score?: number | null;
          recent_views_24h?: number | null;
          super_like_count?: number | null;
          view_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dish_analytics_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: true;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
        ];
      };
      dish_categories: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean;
          is_drink: boolean;
          name: string;
          parent_category_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_drink?: boolean;
          name: string;
          parent_category_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_drink?: boolean;
          name?: string;
          parent_category_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dish_categories_parent_category_id_fkey';
            columns: ['parent_category_id'];
            isOneToOne: false;
            referencedRelation: 'dish_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      dish_course_items: {
        Row: {
          course_id: string;
          id: string;
          links_to_dish_id: string | null;
          option_label: string;
          price_delta: number;
          sort_order: number;
        };
        Insert: {
          course_id: string;
          id?: string;
          links_to_dish_id?: string | null;
          option_label: string;
          price_delta?: number;
          sort_order?: number;
        };
        Update: {
          course_id?: string;
          id?: string;
          links_to_dish_id?: string | null;
          option_label?: string;
          price_delta?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      dish_courses: {
        Row: {
          choice_type: string;
          course_name: string | null;
          course_number: number;
          dish_id: string;
          id: string;
          required_count: number;
        };
        Insert: {
          choice_type: string;
          course_name?: string | null;
          course_number: number;
          dish_id: string;
          id?: string;
          required_count?: number;
        };
        Update: {
          choice_type?: string;
          course_name?: string | null;
          course_number?: number;
          dish_id?: string;
          id?: string;
          required_count?: number;
        };
        Relationships: [];
      };
      dish_ingredients: {
        Row: {
          created_at: string | null;
          dish_id: string;
          ingredient_id: string;
          quantity: string | null;
        };
        Insert: {
          created_at?: string | null;
          dish_id: string;
          ingredient_id: string;
          quantity?: string | null;
        };
        Update: {
          created_at?: string | null;
          dish_id?: string;
          ingredient_id?: string;
          quantity?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dish_ingredients_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dish_ingredients_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      dish_opinions: {
        Row: {
          created_at: string | null;
          dish_id: string;
          id: string;
          note: string | null;
          opinion: string;
          photo_id: string | null;
          source: string | null;
          tags: string[] | null;
          updated_at: string | null;
          user_id: string;
          visit_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          dish_id: string;
          id?: string;
          note?: string | null;
          opinion: string;
          photo_id?: string | null;
          source?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
          user_id: string;
          visit_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          dish_id?: string;
          id?: string;
          note?: string | null;
          opinion?: string;
          photo_id?: string | null;
          source?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
          visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dish_opinions_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dish_opinions_photo_id_fkey';
            columns: ['photo_id'];
            isOneToOne: false;
            referencedRelation: 'dish_photos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dish_opinions_visit_id_fkey';
            columns: ['visit_id'];
            isOneToOne: false;
            referencedRelation: 'user_visits';
            referencedColumns: ['id'];
          },
        ];
      };
      dish_photos: {
        Row: {
          created_at: string | null;
          dish_id: string;
          id: string;
          photo_url: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          dish_id: string;
          id?: string;
          photo_url: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          dish_id?: string;
          id?: string;
          photo_url?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dish_photos_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
        ];
      };
      dishes: {
        Row: {
          allergens: string[] | null;
          allergens_override: string[] | null;
          calories: number | null;
          created_at: string | null;
          description: string | null;
          description_visibility: string;
          dietary_tags: string[] | null;
          dietary_tags_override: string[] | null;
          dish_category_id: string | null;
          dish_kind: string;
          display_price_prefix: string;
          embedding: string | null;
          embedding_input: string | null;
          enrichment_confidence: string | null;
          enrichment_payload: Json | null;
          enrichment_source: string;
          enrichment_status: string;
          id: string;
          image_url: string | null;
          ingredients_visibility: string;
          is_available: boolean | null;
          is_parent: boolean;
          is_template: boolean;
          menu_category_id: string | null;
          name: string;
          parent_dish_id: string | null;
          price: number;
          price_per_person: number | null;
          primary_protein: string | null;
          protein_canonical_names: string[] | null;
          protein_families: string[] | null;
          restaurant_id: string | null;
          serves: number;
          source_image_index: number | null;
          source_region: Json | null;
          spice_level: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          allergens?: string[] | null;
          allergens_override?: string[] | null;
          calories?: number | null;
          created_at?: string | null;
          description?: string | null;
          description_visibility?: string;
          dietary_tags?: string[] | null;
          dietary_tags_override?: string[] | null;
          dish_category_id?: string | null;
          dish_kind?: string;
          display_price_prefix?: string;
          embedding?: string | null;
          embedding_input?: string | null;
          enrichment_confidence?: string | null;
          enrichment_payload?: Json | null;
          enrichment_source?: string;
          enrichment_status?: string;
          id?: string;
          image_url?: string | null;
          ingredients_visibility?: string;
          is_available?: boolean | null;
          is_parent?: boolean;
          is_template?: boolean;
          menu_category_id?: string | null;
          name?: string;
          parent_dish_id?: string | null;
          price?: number;
          price_per_person?: number | null;
          primary_protein?: string | null;
          protein_canonical_names?: string[] | null;
          protein_families?: string[] | null;
          restaurant_id?: string | null;
          serves?: number;
          source_image_index?: number | null;
          source_region?: Json | null;
          spice_level?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          allergens?: string[] | null;
          allergens_override?: string[] | null;
          calories?: number | null;
          created_at?: string | null;
          description?: string | null;
          description_visibility?: string;
          dietary_tags?: string[] | null;
          dietary_tags_override?: string[] | null;
          dish_category_id?: string | null;
          dish_kind?: string;
          display_price_prefix?: string;
          embedding?: string | null;
          embedding_input?: string | null;
          enrichment_confidence?: string | null;
          enrichment_payload?: Json | null;
          enrichment_source?: string;
          enrichment_status?: string;
          id?: string;
          image_url?: string | null;
          ingredients_visibility?: string;
          is_available?: boolean | null;
          is_parent?: boolean;
          is_template?: boolean;
          menu_category_id?: string | null;
          name?: string;
          parent_dish_id?: string | null;
          price?: number;
          price_per_person?: number | null;
          primary_protein?: string | null;
          protein_canonical_names?: string[] | null;
          protein_families?: string[] | null;
          restaurant_id?: string | null;
          serves?: number;
          source_image_index?: number | null;
          source_region?: Json | null;
          spice_level?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dishes_dish_category_id_fkey';
            columns: ['dish_category_id'];
            isOneToOne: false;
            referencedRelation: 'dish_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dishes_menu_id_fkey';
            columns: ['menu_category_id'];
            isOneToOne: false;
            referencedRelation: 'menu_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dishes_parent_dish_id_fkey';
            columns: ['parent_dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dishes_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'dishes_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      eat_together_members: {
        Row: {
          current_location: unknown;
          id: string;
          is_host: boolean | null;
          joined_at: string | null;
          left_at: string | null;
          session_id: string;
          user_id: string;
        };
        Insert: {
          current_location?: unknown;
          id?: string;
          is_host?: boolean | null;
          joined_at?: string | null;
          left_at?: string | null;
          session_id: string;
          user_id: string;
        };
        Update: {
          current_location?: unknown;
          id?: string;
          is_host?: boolean | null;
          joined_at?: string | null;
          left_at?: string | null;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'eat_together_members_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'eat_together_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      eat_together_recommendations: {
        Row: {
          compatibility_score: number;
          created_at: string | null;
          dietary_compatibility: Json | null;
          distance_from_center: number | null;
          id: string;
          members_satisfied: number;
          restaurant_id: string;
          session_id: string;
          total_members: number;
        };
        Insert: {
          compatibility_score: number;
          created_at?: string | null;
          dietary_compatibility?: Json | null;
          distance_from_center?: number | null;
          id?: string;
          members_satisfied: number;
          restaurant_id: string;
          session_id: string;
          total_members: number;
        };
        Update: {
          compatibility_score?: number;
          created_at?: string | null;
          dietary_compatibility?: Json | null;
          distance_from_center?: number | null;
          id?: string;
          members_satisfied?: number;
          restaurant_id?: string;
          session_id?: string;
          total_members?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'eat_together_recommendations_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'eat_together_recommendations_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'eat_together_recommendations_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'eat_together_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      eat_together_sessions: {
        Row: {
          closed_at: string | null;
          created_at: string | null;
          expires_at: string | null;
          host_id: string;
          id: string;
          location_mode: Database['public']['Enums']['location_mode'] | null;
          selected_restaurant_id: string | null;
          session_code: string;
          status: Database['public']['Enums']['session_status'] | null;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          host_id: string;
          id?: string;
          location_mode?: Database['public']['Enums']['location_mode'] | null;
          selected_restaurant_id?: string | null;
          session_code: string;
          status?: Database['public']['Enums']['session_status'] | null;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          host_id?: string;
          id?: string;
          location_mode?: Database['public']['Enums']['location_mode'] | null;
          selected_restaurant_id?: string | null;
          session_code?: string;
          status?: Database['public']['Enums']['session_status'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'eat_together_sessions_selected_restaurant_id_fkey';
            columns: ['selected_restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'eat_together_sessions_selected_restaurant_id_fkey';
            columns: ['selected_restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      eat_together_votes: {
        Row: {
          created_at: string | null;
          id: string;
          restaurant_id: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          restaurant_id: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          restaurant_id?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'eat_together_votes_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'eat_together_votes_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'eat_together_votes_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'eat_together_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string | null;
          id: string;
          subject_id: string;
          subject_type: Database['public']['Enums']['subject_type'];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          subject_id: string;
          subject_type: Database['public']['Enums']['subject_type'];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          subject_id?: string;
          subject_type?: Database['public']['Enums']['subject_type'];
          user_id?: string;
        };
        Relationships: [];
      };
      google_api_usage: {
        Row: {
          api_calls: number | null;
          estimated_cost_usd: number | null;
          id: string;
          month: string;
          updated_at: string | null;
        };
        Insert: {
          api_calls?: number | null;
          estimated_cost_usd?: number | null;
          id?: string;
          month: string;
          updated_at?: string | null;
        };
        Update: {
          api_calls?: number | null;
          estimated_cost_usd?: number | null;
          id?: string;
          month?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ingredient_aliases: {
        Row: {
          canonical_ingredient_id: string;
          created_at: string | null;
          display_name: string;
          id: string;
          language: string;
          search_vector: unknown;
          updated_at: string | null;
        };
        Insert: {
          canonical_ingredient_id: string;
          created_at?: string | null;
          display_name: string;
          id?: string;
          language?: string;
          search_vector?: unknown;
          updated_at?: string | null;
        };
        Update: {
          canonical_ingredient_id?: string;
          created_at?: string | null;
          display_name?: string;
          id?: string;
          language?: string;
          search_vector?: unknown;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ingredient_aliases_canonical_ingredient_id_fkey';
            columns: ['canonical_ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      menu_categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          menu_id: string | null;
          name: string;
          restaurant_id: string | null;
          type: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          menu_id?: string | null;
          name?: string;
          restaurant_id?: string | null;
          type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          menu_id?: string | null;
          name?: string;
          restaurant_id?: string | null;
          type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_categories_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'menus';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'menus_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'menus_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      menu_scan_confirmations: {
        Row: {
          created_at: string;
          idempotency_key: string;
          job_id: string;
          result: Json;
        };
        Insert: {
          created_at?: string;
          idempotency_key: string;
          job_id: string;
          result: Json;
        };
        Update: {
          created_at?: string;
          idempotency_key?: string;
          job_id?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_scan_confirmations_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'menu_scan_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      menu_scan_jobs: {
        Row: {
          attempts: number;
          created_at: string | null;
          created_by: string | null;
          dishes_found: number | null;
          dishes_saved: number | null;
          error_message: string | null;
          id: string;
          image_count: number;
          image_filenames: string[] | null;
          image_storage_paths: string[] | null;
          input: Json | null;
          last_error: string | null;
          locked_until: string | null;
          processing_ms: number | null;
          restaurant_id: string;
          result_json: Json | null;
          saved_at: string | null;
          saved_dish_ids: Json | null;
          status: 'pending' | 'processing' | 'needs_review' | 'completed' | 'failed';
          updated_at: string | null;
        };
        Insert: {
          attempts?: number;
          created_at?: string | null;
          created_by?: string | null;
          dishes_found?: number | null;
          dishes_saved?: number | null;
          error_message?: string | null;
          id?: string;
          image_count?: number;
          image_filenames?: string[] | null;
          image_storage_paths?: string[] | null;
          input?: Json | null;
          last_error?: string | null;
          locked_until?: string | null;
          processing_ms?: number | null;
          restaurant_id: string;
          result_json?: Json | null;
          saved_at?: string | null;
          saved_dish_ids?: Json | null;
          status?: 'pending' | 'processing' | 'needs_review' | 'completed' | 'failed';
          updated_at?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string | null;
          created_by?: string | null;
          dishes_found?: number | null;
          dishes_saved?: number | null;
          error_message?: string | null;
          id?: string;
          image_count?: number;
          image_filenames?: string[] | null;
          image_storage_paths?: string[] | null;
          input?: Json | null;
          last_error?: string | null;
          locked_until?: string | null;
          processing_ms?: number | null;
          restaurant_id?: string;
          result_json?: Json | null;
          saved_at?: string | null;
          saved_dish_ids?: Json | null;
          status?: 'pending' | 'processing' | 'needs_review' | 'completed' | 'failed';
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_scan_jobs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'menu_scan_jobs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      menus: {
        Row: {
          available_days: string[] | null;
          available_end_time: string | null;
          available_start_time: string | null;
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          menu_type: string;
          name: string;
          restaurant_id: string;
          schedule_type: string;
          status: 'draft' | 'published' | 'archived';
          updated_at: string | null;
        };
        Insert: {
          available_days?: string[] | null;
          available_end_time?: string | null;
          available_start_time?: string | null;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          menu_type?: string;
          name: string;
          restaurant_id: string;
          schedule_type?: string;
          status?: 'draft' | 'published' | 'archived';
          updated_at?: string | null;
        };
        Update: {
          available_days?: string[] | null;
          available_end_time?: string | null;
          available_start_time?: string | null;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          menu_type?: string;
          name?: string;
          restaurant_id?: string;
          schedule_type?: string;
          status?: 'draft' | 'published' | 'archived';
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'menus_new_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'menus_new_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      option_groups: {
        Row: {
          created_at: string | null;
          description: string | null;
          dish_id: string;
          display_order: number;
          id: string;
          is_active: boolean;
          max_selections: number | null;
          min_selections: number;
          name: string;
          restaurant_id: string;
          selection_type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          dish_id: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          max_selections?: number | null;
          min_selections?: number;
          name: string;
          restaurant_id: string;
          selection_type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          dish_id?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          max_selections?: number | null;
          min_selections?: number;
          name?: string;
          restaurant_id?: string;
          selection_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'option_groups_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'option_groups_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'option_groups_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      options: {
        Row: {
          calories_delta: number | null;
          canonical_ingredient_id: string | null;
          created_at: string | null;
          description: string | null;
          display_order: number;
          id: string;
          is_available: boolean;
          name: string;
          option_group_id: string;
          price_delta: number;
          updated_at: string | null;
        };
        Insert: {
          calories_delta?: number | null;
          canonical_ingredient_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_available?: boolean;
          name: string;
          option_group_id: string;
          price_delta?: number;
          updated_at?: string | null;
        };
        Update: {
          calories_delta?: number | null;
          canonical_ingredient_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_available?: boolean;
          name?: string;
          option_group_id?: string;
          price_delta?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'options_canonical_ingredient_id_fkey';
            columns: ['canonical_ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'canonical_ingredients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'options_option_group_id_fkey';
            columns: ['option_group_id'];
            isOneToOne: false;
            referencedRelation: 'option_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_experience_responses: {
        Row: {
          created_at: string | null;
          id: string;
          question_type: string;
          response: boolean;
          restaurant_id: string;
          user_id: string;
          visit_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          question_type: string;
          response: boolean;
          restaurant_id: string;
          user_id: string;
          visit_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          question_type?: string;
          response?: boolean;
          restaurant_id?: string;
          user_id?: string;
          visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_experience_responses_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'restaurant_experience_responses_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_experience_responses_visit_id_fkey';
            columns: ['visit_id'];
            isOneToOne: false;
            referencedRelation: 'user_visits';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_import_jobs: {
        Row: {
          admin_email: string;
          admin_id: string;
          api_calls_used: number | null;
          completed_at: string | null;
          created_at: string | null;
          errors: Json | null;
          estimated_cost_usd: number | null;
          id: string;
          restaurant_ids: string[] | null;
          search_params: Json | null;
          source: string;
          status: string;
          total_fetched: number | null;
          total_flagged: number | null;
          total_inserted: number | null;
          total_skipped: number | null;
        };
        Insert: {
          admin_email: string;
          admin_id: string;
          api_calls_used?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          errors?: Json | null;
          estimated_cost_usd?: number | null;
          id?: string;
          restaurant_ids?: string[] | null;
          search_params?: Json | null;
          source: string;
          status?: string;
          total_fetched?: number | null;
          total_flagged?: number | null;
          total_inserted?: number | null;
          total_skipped?: number | null;
        };
        Update: {
          admin_email?: string;
          admin_id?: string;
          api_calls_used?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          errors?: Json | null;
          estimated_cost_usd?: number | null;
          id?: string;
          restaurant_ids?: string[] | null;
          search_params?: Json | null;
          source?: string;
          status?: string;
          total_fetched?: number | null;
          total_flagged?: number | null;
          total_inserted?: number | null;
          total_skipped?: number | null;
        };
        Relationships: [];
      };
      restaurants: {
        Row: {
          accepts_reservations: boolean | null;
          address: string;
          city: string | null;
          country_code: string | null;
          created_at: string | null;
          cuisine_types: string[] | null;
          delivery_available: boolean | null;
          description: string | null;
          dine_in_available: boolean | null;
          google_place_id: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean | null;
          location: Json;
          location_point: unknown;
          name: string;
          neighbourhood: string | null;
          open_hours: Json | null;
          owner_id: string | null;
          payment_methods: string | null;
          phone: string | null;
          postal_code: string | null;
          rating: number | null;
          restaurant_type: string | null;
          restaurant_vector: string | null;
          service_speed: string | null;
          skip_menu_scan: boolean;
          state: string | null;
          status: 'draft' | 'published' | 'archived';
          suspended_at: string | null;
          suspended_by: string | null;
          suspension_reason: string | null;
          takeout_available: boolean | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          accepts_reservations?: boolean | null;
          address: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string | null;
          cuisine_types?: string[] | null;
          delivery_available?: boolean | null;
          description?: string | null;
          dine_in_available?: boolean | null;
          google_place_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          location: Json;
          location_point?: unknown;
          name: string;
          neighbourhood?: string | null;
          open_hours?: Json | null;
          owner_id?: string | null;
          payment_methods?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          rating?: number | null;
          restaurant_type?: string | null;
          restaurant_vector?: string | null;
          service_speed?: string | null;
          skip_menu_scan?: boolean;
          state?: string | null;
          status?: 'draft' | 'published' | 'archived';
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          takeout_available?: boolean | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          accepts_reservations?: boolean | null;
          address?: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string | null;
          cuisine_types?: string[] | null;
          delivery_available?: boolean | null;
          description?: string | null;
          dine_in_available?: boolean | null;
          google_place_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          location?: Json;
          location_point?: unknown;
          name?: string;
          neighbourhood?: string | null;
          open_hours?: Json | null;
          owner_id?: string | null;
          payment_methods?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          rating?: number | null;
          restaurant_type?: string | null;
          restaurant_vector?: string | null;
          service_speed?: string | null;
          skip_menu_scan?: boolean;
          state?: string | null;
          status?: 'draft' | 'published' | 'archived';
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          takeout_available?: boolean | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      security_documentation: {
        Row: {
          category: string;
          created_at: string | null;
          description: string;
          id: number;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          description: string;
          id?: number;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          description?: string;
          id?: number;
        };
        Relationships: [];
      };
      session_views: {
        Row: {
          created_at: string | null;
          duration_seconds: number | null;
          entity_id: string;
          entity_type: string;
          id: string;
          session_id: string;
          user_id: string;
          viewed_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          duration_seconds?: number | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          session_id: string;
          user_id: string;
          viewed_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          duration_seconds?: number | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          session_id?: string;
          user_id?: string;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'session_views_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'user_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      spatial_ref_sys: {
        Row: {
          auth_name: string | null;
          auth_srid: number | null;
          proj4text: string | null;
          srid: number;
          srtext: string | null;
        };
        Insert: {
          auth_name?: string | null;
          auth_srid?: number | null;
          proj4text?: string | null;
          srid: number;
          srtext?: string | null;
        };
        Update: {
          auth_name?: string | null;
          auth_srid?: number | null;
          proj4text?: string | null;
          srid?: number;
          srtext?: string | null;
        };
        Relationships: [];
      };
      user_behavior_profiles: {
        Row: {
          avg_calories_viewed: number | null;
          avg_view_duration: number | null;
          favorite_dish_ids: string[] | null;
          last_active_at: string | null;
          most_active_time_of_day: string | null;
          preference_vector: string | null;
          preference_vector_updated_at: string | null;
          preferred_cuisines: string[] | null;
          preferred_dietary_tags: string[] | null;
          preferred_dish_types: string[] | null;
          preferred_price_range: number[] | null;
          profile_updated_at: string | null;
          profile_version: number | null;
          user_id: string;
        };
        Insert: {
          avg_calories_viewed?: number | null;
          avg_view_duration?: number | null;
          favorite_dish_ids?: string[] | null;
          last_active_at?: string | null;
          most_active_time_of_day?: string | null;
          preference_vector?: string | null;
          preference_vector_updated_at?: string | null;
          preferred_cuisines?: string[] | null;
          preferred_dietary_tags?: string[] | null;
          preferred_dish_types?: string[] | null;
          preferred_price_range?: number[] | null;
          profile_updated_at?: string | null;
          profile_version?: number | null;
          user_id: string;
        };
        Update: {
          avg_calories_viewed?: number | null;
          avg_view_duration?: number | null;
          favorite_dish_ids?: string[] | null;
          last_active_at?: string | null;
          most_active_time_of_day?: string | null;
          preference_vector?: string | null;
          preference_vector_updated_at?: string | null;
          preferred_cuisines?: string[] | null;
          preferred_dietary_tags?: string[] | null;
          preferred_dish_types?: string[] | null;
          preferred_price_range?: number[] | null;
          profile_updated_at?: string | null;
          profile_version?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_dish_interactions: {
        Row: {
          created_at: string | null;
          dish_id: string;
          id: string;
          interaction_type: string;
          session_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          dish_id: string;
          id?: string;
          interaction_type: string;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          dish_id?: string;
          id?: string;
          interaction_type?: string;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_dish_interactions_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
        ];
      };
      user_points: {
        Row: {
          action_type: string;
          created_at: string | null;
          description: string | null;
          id: string;
          points: number;
          reference_id: string | null;
          user_id: string;
        };
        Insert: {
          action_type: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          points: number;
          reference_id?: string | null;
          user_id: string;
        };
        Update: {
          action_type?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          points?: number;
          reference_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          allergies: string[] | null;
          created_at: string | null;
          default_max_distance: number | null;
          diet_preference: string | null;
          diet_types: string[] | null;
          exclude: string[] | null;
          favorite_cuisines: Json | null;
          favorite_dishes: Json | null;
          ingredients_to_avoid: Json;
          meal_times: Json | null;
          onboarding_completed: boolean | null;
          onboarding_completed_at: string | null;
          protein_preferences: Json | null;
          religious_restrictions: string[] | null;
          service_preferences: Json | null;
          spice_tolerance: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          allergies?: string[] | null;
          created_at?: string | null;
          default_max_distance?: number | null;
          diet_preference?: string | null;
          diet_types?: string[] | null;
          exclude?: string[] | null;
          favorite_cuisines?: Json | null;
          favorite_dishes?: Json | null;
          ingredients_to_avoid?: Json;
          meal_times?: Json | null;
          onboarding_completed?: boolean | null;
          onboarding_completed_at?: string | null;
          protein_preferences?: Json | null;
          religious_restrictions?: string[] | null;
          service_preferences?: Json | null;
          spice_tolerance?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          allergies?: string[] | null;
          created_at?: string | null;
          default_max_distance?: number | null;
          diet_preference?: string | null;
          diet_types?: string[] | null;
          exclude?: string[] | null;
          favorite_cuisines?: Json | null;
          favorite_dishes?: Json | null;
          ingredients_to_avoid?: Json;
          meal_times?: Json | null;
          onboarding_completed?: boolean | null;
          onboarding_completed_at?: string | null;
          protein_preferences?: Json | null;
          religious_restrictions?: string[] | null;
          service_preferences?: Json | null;
          spice_tolerance?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_sessions: {
        Row: {
          created_at: string | null;
          ended_at: string | null;
          id: string;
          is_active: boolean | null;
          started_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          ended_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          started_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          ended_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          started_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_visits: {
        Row: {
          confirmed_at: string | null;
          created_at: string | null;
          id: string;
          restaurant_id: string;
          session_id: string | null;
          source: string | null;
          user_id: string;
          visited_at: string | null;
        };
        Insert: {
          confirmed_at?: string | null;
          created_at?: string | null;
          id?: string;
          restaurant_id: string;
          session_id?: string | null;
          source?: string | null;
          user_id: string;
          visited_at?: string | null;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string | null;
          id?: string;
          restaurant_id?: string;
          session_id?: string | null;
          source?: string | null;
          user_id?: string;
          visited_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_visits_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_ratings_summary';
            referencedColumns: ['restaurant_id'];
          },
          {
            foreignKeyName: 'user_visits_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_visits_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'user_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      user_badges: {
        Row: {
          badge_type: string;
          earned_at: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          badge_type: string;
          earned_at?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          badge_type?: string;
          earned_at?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_badges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_streaks: {
        Row: {
          created_at: string | null;
          current_streak: number | null;
          id: string;
          last_rating_week: string | null;
          longest_streak: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          current_streak?: number | null;
          id?: string;
          last_rating_week?: string | null;
          longest_streak?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          current_streak?: number | null;
          id?: string;
          last_rating_week?: string | null;
          longest_streak?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_streaks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          profile_name: string | null;
          roles: Database['public']['Enums']['user_roles'][] | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          profile_name?: string | null;
          roles?: Database['public']['Enums']['user_roles'][] | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          profile_name?: string | null;
          roles?: Database['public']['Enums']['user_roles'][] | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      admin_dashboard_stats: {
        Row: {
          active_dishes: number | null;
          active_restaurants: number | null;
          admin_users: number | null;
          restaurant_owners: number | null;
          suspended_restaurants: number | null;
          total_dishes: number | null;
          total_restaurants: number | null;
        };
        Relationships: [];
      };
      dish_ratings_summary: {
        Row: {
          dish_id: string | null;
          dislike_percentage: number | null;
          disliked_count: number | null;
          like_percentage: number | null;
          liked_count: number | null;
          okay_count: number | null;
          okay_percentage: number | null;
          recent_notes: string[] | null;
          top_tags: string[] | null;
          total_ratings: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dish_opinions_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
        ];
      };
      geography_columns: {
        Row: {
          coord_dimension: number | null;
          f_geography_column: unknown;
          f_table_catalog: unknown;
          f_table_name: unknown;
          f_table_schema: unknown;
          srid: number | null;
          type: string | null;
        };
        Relationships: [];
      };
      geometry_columns: {
        Row: {
          coord_dimension: number | null;
          f_geometry_column: unknown;
          f_table_catalog: string | null;
          f_table_name: unknown;
          f_table_schema: unknown;
          srid: number | null;
          type: string | null;
        };
        Insert: {
          coord_dimension?: number | null;
          f_geometry_column?: unknown;
          f_table_catalog?: string | null;
          f_table_name?: unknown;
          f_table_schema?: unknown;
          srid?: number | null;
          type?: string | null;
        };
        Update: {
          coord_dimension?: number | null;
          f_geometry_column?: unknown;
          f_table_catalog?: string | null;
          f_table_name?: unknown;
          f_table_schema?: unknown;
          srid?: number | null;
          type?: string | null;
        };
        Relationships: [];
      };
      restaurant_ratings_summary: {
        Row: {
          cleanliness_percentage: number | null;
          food_score: number | null;
          overall_percentage: number | null;
          restaurant_id: string | null;
          service_percentage: number | null;
          total_dish_ratings: number | null;
          total_experience_responses: number | null;
          value_percentage: number | null;
          wait_time_percentage: number | null;
          would_recommend_percentage: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string };
        Returns: undefined;
      };
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown };
        Returns: unknown;
      };
      _postgis_pgsql_version: { Args: never; Returns: string };
      _postgis_scripts_pgsql_version: { Args: never; Returns: string };
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown };
        Returns: number;
      };
      _postgis_stats: {
        Args: { ''?: string; att_name: string; tbl: unknown };
        Returns: string;
      };
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_dwithin: {
        Args: {
          geog1: unknown;
          geog2: unknown;
          tolerance: number;
          use_spheroid?: boolean;
        };
        Returns: boolean;
      };
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown };
        Returns: number;
      };
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_sortablehash: { Args: { geom: unknown }; Returns: number };
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      _st_voronoi: {
        Args: {
          clip?: unknown;
          g1: unknown;
          return_polygons?: boolean;
          tolerance?: number;
        };
        Returns: unknown;
      };
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      add_user_role: {
        Args: {
          p_role: Database['public']['Enums']['user_roles'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      addauth: { Args: { '': string }; Returns: boolean };
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string;
              column_name: string;
              new_dim: number;
              new_srid_in: number;
              new_type: string;
              schema_name: string;
              table_name: string;
              use_typmod?: boolean;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: string;
              new_dim: number;
              new_srid: number;
              new_type: string;
              schema_name: string;
              table_name: string;
              use_typmod?: boolean;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: string;
              new_dim: number;
              new_srid: number;
              new_type: string;
              table_name: string;
              use_typmod?: boolean;
            };
            Returns: string;
          };
      analyze_spatial_query_performance: {
        Args: { p_lat: number; p_lng: number; p_radius_km: number };
        Returns: {
          execution_time_ms: number;
          index_used: boolean;
          query_type: string;
          rows_returned: number;
        }[];
      };
      award_points: {
        Args: {
          p_action_type: string;
          p_description?: string;
          p_points: number;
          p_reference_id?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      calculate_dish_allergens: {
        Args: { p_dish_id: string };
        Returns: string[];
      };
      calculate_dish_dietary_tags: {
        Args: { p_dish_id: string };
        Returns: string[];
      };
      calculate_distance_km: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number };
        Returns: number;
      };
      compute_dish_protein_families: {
        Args: { p_dish_id: string };
        Returns: undefined;
      };
      disablelongtransactions: { Args: never; Returns: string };
      dishes_within_radius: {
        Args: {
          p_lat: number;
          p_limit?: number;
          p_lng: number;
          p_radius_km: number;
        };
        Returns: {
          dish_id: string;
          dish_name: string;
          dish_price: number;
          distance_km: number;
          restaurant_cuisine_types: string[];
          restaurant_id: string;
          restaurant_name: string;
        }[];
      };
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string;
              column_name: string;
              schema_name: string;
              table_name: string;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: string;
              schema_name: string;
              table_name: string;
            };
            Returns: string;
          }
        | { Args: { column_name: string; table_name: string }; Returns: string };
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string;
              schema_name: string;
              table_name: string;
            };
            Returns: string;
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string };
      enablelongtransactions: { Args: never; Returns: string };
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      expire_old_sessions: { Args: never; Returns: number };
      generate_candidates: {
        Args: {
          p_allergens?: string[];
          p_current_day?: string;
          p_current_time?: string;
          p_diet_tag?: string;
          p_disliked_dish_ids?: string[];
          p_exclude_families?: string[];
          p_exclude_spicy?: boolean;
          p_group_meals?: boolean;
          p_lat: number;
          p_limit?: number;
          p_lng: number;
          p_preference_vector?: string;
          p_radius_m?: number;
          p_religious_tags?: string[];
          p_schedule_type?: string;
        };
        Returns: {
          allergens: string[];
          calories: number;
          description: string;
          dietary_tags: string[];
          dish_kind: string;
          display_price_prefix: string;
          distance_m: number;
          enrichment_status: string;
          id: string;
          image_url: string;
          is_available: boolean;
          name: string;
          parent_dish_id: string;
          popularity_score: number;
          price: number;
          price_per_person: number;
          protein_canonical_names: string[];
          protein_families: string[];
          restaurant_cuisines: string[];
          restaurant_id: string;
          restaurant_location: Json;
          restaurant_name: string;
          restaurant_rating: number;
          serves: number;
          spice_level: string;
          vector_distance: number;
          view_count: number;
        }[];
      };
      generate_session_code: { Args: never; Returns: string };
      geometry: { Args: { '': string }; Returns: unknown };
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      geomfromewkt: { Args: { '': string }; Returns: unknown };
      get_active_members_count: {
        Args: { p_session_id: string };
        Returns: number;
      };
      get_admin_user_counts: { Args: never; Returns: Record<string, unknown> };
      get_group_candidates: {
        Args: {
          p_allergens?: string[];
          p_diet_tag?: string;
          p_group_vector?: string;
          p_lat: number;
          p_limit?: number;
          p_lng: number;
          p_radius_m?: number;
          p_religious_tags?: string[];
        };
        Returns: {
          address: string;
          cuisine_types: string[];
          distance_m: number;
          id: string;
          location: Json;
          name: string;
          phone: string;
          rating: number;
          restaurant_vector: string;
          vector_distance: number;
        }[];
      };
      get_nearest_restaurants: {
        Args: { p_lat: number; p_limit?: number; p_lng: number };
        Returns: {
          cuisine_types: string[];
          distance_km: number;
          id: string;
          name: string;
          rating: number;
        }[];
      };
      get_popular_dishes: {
        Args: { p_limit?: number };
        Returns: {
          dish_id: string;
          dish_name: string;
          engagement_rate: number;
          popularity_score: number;
          restaurant_name: string;
          view_count: number;
        }[];
      };
      get_trending_dishes: {
        Args: { p_limit?: number };
        Returns: {
          dish_id: string;
          dish_name: string;
          engagement_rate: number;
          popularity_score: number;
          recent_swipes_24h: number;
          restaurant_name: string;
        }[];
      };
      get_user_liked_dishes: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          dish_id: string;
          dish_name: string;
          last_swiped: string;
          swipe_count: number;
        }[];
      };
      get_user_swipe_stats: {
        Args: { p_user_id: string };
        Returns: {
          left_swipes: number;
          right_swipe_rate: number;
          right_swipes: number;
          super_swipes: number;
          total_swipes: number;
        }[];
      };
      get_user_total_points: { Args: { p_user_id: string }; Returns: number };
      get_users_needing_vector_update: {
        Args: { p_limit?: number };
        Returns: {
          user_id: string;
        }[];
      };
      get_vote_results: {
        Args: { p_session_id: string };
        Returns: {
          percentage: number;
          restaurant_id: string;
          total_voters: number;
          vote_count: number;
        }[];
      };
      gettransactionid: { Args: never; Returns: unknown };
      is_admin: { Args: never; Returns: boolean };
      is_session_host: {
        Args: { p_session_id: string; p_user_id: string };
        Returns: boolean;
      };
      log_admin_action: {
        Args: {
          p_action: string;
          p_new_data?: Json;
          p_old_data?: Json;
          p_resource_id: string;
          p_resource_type: string;
        };
        Returns: string;
      };
      longtransactionsenabled: { Args: never; Returns: boolean };
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string };
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: number;
      };
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: number;
      };
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string };
        Returns: string;
      };
      postgis_extensions_upgrade: { Args: never; Returns: string };
      postgis_full_version: { Args: never; Returns: string };
      postgis_geos_version: { Args: never; Returns: string };
      postgis_lib_build_date: { Args: never; Returns: string };
      postgis_lib_revision: { Args: never; Returns: string };
      postgis_lib_version: { Args: never; Returns: string };
      postgis_libjson_version: { Args: never; Returns: string };
      postgis_liblwgeom_version: { Args: never; Returns: string };
      postgis_libprotobuf_version: { Args: never; Returns: string };
      postgis_libxml_version: { Args: never; Returns: string };
      postgis_proj_version: { Args: never; Returns: string };
      postgis_scripts_build_date: { Args: never; Returns: string };
      postgis_scripts_installed: { Args: never; Returns: string };
      postgis_scripts_released: { Args: never; Returns: string };
      postgis_svn_version: { Args: never; Returns: string };
      postgis_type_name: {
        Args: {
          coord_dimension: number;
          geomname: string;
          use_new_name?: boolean;
        };
        Returns: string;
      };
      postgis_version: { Args: never; Returns: string };
      postgis_wagyu_version: { Args: never; Returns: string };
      recalculate_all_profiles: { Args: never; Returns: number };
      recalculate_user_profile: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      refresh_dish_ratings_summary: { Args: never; Returns: undefined };
      refresh_materialized_views: { Args: never; Returns: undefined };
      refresh_restaurant_ratings_summary: { Args: never; Returns: undefined };
      restaurants_within_radius: {
        Args: { p_lat: number; p_lng: number; p_radius_km: number };
        Returns: {
          cuisine_types: string[];
          distance_km: number;
          id: string;
          name: string;
          rating: number;
        }[];
      };
      run_analyze_dishes: { Args: never; Returns: undefined };
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown };
            Returns: number;
          };
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { '': string }; Returns: number };
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number };
        Returns: string;
      };
      st_asewkt: { Args: { '': string }; Returns: string };
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number };
            Returns: string;
          }
        | {
            Args: {
              geom_column?: string;
              maxdecimaldigits?: number;
              pretty_bool?: boolean;
              r: Record<string, unknown>;
            };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string };
      st_asgml:
        | {
            Args: {
              geog: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
            };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string }
        | {
            Args: {
              geog: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
              version: number;
            };
            Returns: string;
          }
        | {
            Args: {
              geom: unknown;
              id?: string;
              maxdecimaldigits?: number;
              nprefix?: string;
              options?: number;
              version: number;
            };
            Returns: string;
          };
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string };
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string };
        Returns: string;
      };
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string };
      st_asmvtgeom: {
        Args: {
          bounds: unknown;
          buffer?: number;
          clip_geom?: boolean;
          extent?: number;
          geom: unknown;
        };
        Returns: unknown;
      };
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number };
            Returns: string;
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number };
            Returns: string;
          }
        | { Args: { '': string }; Returns: string };
      st_astext: { Args: { '': string }; Returns: string };
      st_astwkb:
        | {
            Args: {
              geom: unknown;
              prec?: number;
              prec_m?: number;
              prec_z?: number;
              with_boxes?: boolean;
              with_sizes?: boolean;
            };
            Returns: string;
          }
        | {
            Args: {
              geom: unknown[];
              ids: number[];
              prec?: number;
              prec_m?: number;
              prec_z?: number;
              with_boxes?: boolean;
              with_sizes?: boolean;
            };
            Returns: string;
          };
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number };
        Returns: string;
      };
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number };
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown };
        Returns: unknown;
      };
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number };
            Returns: unknown;
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number };
            Returns: unknown;
          };
      st_centroid: { Args: { '': string }; Returns: unknown };
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown };
        Returns: unknown;
      };
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown };
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean;
          param_geom: unknown;
          param_pctconvex: number;
        };
        Returns: unknown;
      };
      st_contains: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_coorddim: { Args: { geometry: unknown }; Returns: number };
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number };
        Returns: unknown;
      };
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean };
            Returns: number;
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number };
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number };
            Returns: number;
          };
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_dwithin: {
        Args: {
          geog1: unknown;
          geog2: unknown;
          tolerance: number;
          use_spheroid?: boolean;
        };
        Returns: boolean;
      };
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number };
            Returns: unknown;
          }
        | {
            Args: {
              dm?: number;
              dx: number;
              dy: number;
              dz?: number;
              geom: unknown;
            };
            Returns: unknown;
          };
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown };
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number };
        Returns: unknown;
      };
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number };
        Returns: unknown;
      };
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number };
        Returns: unknown;
      };
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number };
            Returns: unknown;
          };
      st_geogfromtext: { Args: { '': string }; Returns: unknown };
      st_geographyfromtext: { Args: { '': string }; Returns: unknown };
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string };
      st_geomcollfromtext: { Args: { '': string }; Returns: unknown };
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean;
          g: unknown;
          max_iter?: number;
          tolerance?: number;
        };
        Returns: unknown;
      };
      st_geometryfromtext: { Args: { '': string }; Returns: unknown };
      st_geomfromewkt: { Args: { '': string }; Returns: unknown };
      st_geomfromgeojson:
        | { Args: { '': Json }; Returns: unknown }
        | { Args: { '': Json }; Returns: unknown }
        | { Args: { '': string }; Returns: unknown };
      st_geomfromgml: { Args: { '': string }; Returns: unknown };
      st_geomfromkml: { Args: { '': string }; Returns: unknown };
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown };
      st_geomfromtext: { Args: { '': string }; Returns: unknown };
      st_gmltosql: { Args: { '': string }; Returns: unknown };
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean };
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number };
        Returns: unknown;
      };
      st_hexagongrid: {
        Args: { bounds: unknown; size: number };
        Returns: Record<string, unknown>[];
      };
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown };
        Returns: number;
      };
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown };
        Returns: Database['public']['CompositeTypes']['valid_detail'];
        SetofOptions: {
          from: '*';
          to: 'valid_detail';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { '': string }; Returns: number };
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown };
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown };
        Returns: number;
      };
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string };
        Returns: unknown;
      };
      st_linefromtext: { Args: { '': string }; Returns: unknown };
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown };
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number };
        Returns: unknown;
      };
      st_locatebetween: {
        Args: {
          frommeasure: number;
          geometry: unknown;
          leftrightoffset?: number;
          tomeasure: number;
        };
        Returns: unknown;
      };
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number };
        Returns: unknown;
      };
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_makevalid: {
        Args: { geom: unknown; params: string };
        Returns: unknown;
      };
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: number;
      };
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number };
        Returns: unknown;
      };
      st_mlinefromtext: { Args: { '': string }; Returns: unknown };
      st_mpointfromtext: { Args: { '': string }; Returns: unknown };
      st_mpolyfromtext: { Args: { '': string }; Returns: unknown };
      st_multilinestringfromtext: { Args: { '': string }; Returns: unknown };
      st_multipointfromtext: { Args: { '': string }; Returns: unknown };
      st_multipolygonfromtext: { Args: { '': string }; Returns: unknown };
      st_node: { Args: { g: unknown }; Returns: unknown };
      st_normalize: { Args: { geom: unknown }; Returns: unknown };
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string };
        Returns: unknown;
      };
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: boolean;
      };
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean };
        Returns: number;
      };
      st_pointfromtext: { Args: { '': string }; Returns: unknown };
      st_pointm: {
        Args: {
          mcoordinate: number;
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
        };
        Returns: unknown;
      };
      st_pointz: {
        Args: {
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
          zcoordinate: number;
        };
        Returns: unknown;
      };
      st_pointzm: {
        Args: {
          mcoordinate: number;
          srid?: number;
          xcoordinate: number;
          ycoordinate: number;
          zcoordinate: number;
        };
        Returns: unknown;
      };
      st_polyfromtext: { Args: { '': string }; Returns: unknown };
      st_polygonfromtext: { Args: { '': string }; Returns: unknown };
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown };
        Returns: unknown;
      };
      st_quantizecoordinates: {
        Args: {
          g: unknown;
          prec_m?: number;
          prec_x: number;
          prec_y?: number;
          prec_z?: number;
        };
        Returns: unknown;
      };
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number };
        Returns: unknown;
      };
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string };
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number };
        Returns: unknown;
      };
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown };
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number };
        Returns: unknown;
      };
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown };
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number };
        Returns: unknown;
      };
      st_squaregrid: {
        Args: { bounds: unknown; size: number };
        Returns: Record<string, unknown>[];
      };
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number };
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number };
        Returns: unknown[];
      };
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown };
        Returns: unknown;
      };
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number };
        Returns: unknown;
      };
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown };
        Returns: unknown;
      };
      st_tileenvelope: {
        Args: {
          bounds?: unknown;
          margin?: number;
          x: number;
          y: number;
          zoom: number;
        };
        Returns: unknown;
      };
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string };
            Returns: unknown;
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number };
            Returns: unknown;
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown };
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown };
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number };
            Returns: unknown;
          };
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number };
        Returns: unknown;
      };
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean };
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown };
      st_wkttosql: { Args: { '': string }; Returns: unknown };
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number };
        Returns: unknown;
      };
      sync_all_restaurant_ratings: { Args: never; Returns: number };
      unlockrows: { Args: { '': string }; Returns: number };
      update_restaurant_vector: {
        Args: { p_restaurant_id: string };
        Returns: undefined;
      };
      update_trending_dishes: { Args: never; Returns: number };
      updategeometrysrid: {
        Args: {
          catalogn_name: string;
          column_name: string;
          new_srid_in: number;
          schema_name: string;
          table_name: string;
        };
        Returns: string;
      };
      user_has_role: {
        Args: {
          p_role: Database['public']['Enums']['user_roles'];
          p_user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      location_mode: 'host_location' | 'midpoint' | 'max_radius';
      preference_type: 'swipe_like' | 'swipe_dislike' | 'ordered' | 'favorited' | 'rated';
      session_status: 'waiting' | 'recommending' | 'voting' | 'decided' | 'cancelled' | 'expired';
      subject_type: 'dish' | 'restaurant';
      user_roles: 'consumer' | 'restaurant_owner' | 'admin';
    };
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null;
        geom: unknown;
      };
      valid_detail: {
        valid: boolean | null;
        reason: string | null;
        location: unknown;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      location_mode: ['host_location', 'midpoint', 'max_radius'],
      preference_type: ['swipe_like', 'swipe_dislike', 'ordered', 'favorited', 'rated'],
      session_status: ['waiting', 'recommending', 'voting', 'decided', 'cancelled', 'expired'],
      subject_type: ['dish', 'restaurant'],
      user_roles: ['consumer', 'restaurant_owner', 'admin'],
    },
  },
} as const;
