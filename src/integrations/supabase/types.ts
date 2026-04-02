export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          allow_host_edit: boolean
          auto_block: boolean
          checkin_code: string | null
          checkin_mode: string | null
          checkin_password: string | null
          confirmation_active: boolean
          confirmation_deadline: string | null
          cover_image_url: string | null
          created_at: string
          email_notifications: boolean | null
          event_date: string
          host_email: string | null
          host_password: string | null
          id: string
          name: string
          primary_color: string | null
          secondary_color: string | null
          short_message: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          allow_host_edit?: boolean
          auto_block?: boolean
          checkin_code?: string | null
          checkin_mode?: string | null
          checkin_password?: string | null
          confirmation_active?: boolean
          confirmation_deadline?: string | null
          cover_image_url?: string | null
          created_at?: string
          email_notifications?: boolean | null
          event_date: string
          host_email?: string | null
          host_password?: string | null
          id?: string
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          short_message?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          allow_host_edit?: boolean
          auto_block?: boolean
          checkin_code?: string | null
          checkin_mode?: string | null
          checkin_password?: string | null
          confirmation_active?: boolean
          confirmation_deadline?: string | null
          cover_image_url?: string | null
          created_at?: string
          email_notifications?: boolean | null
          event_date?: string
          host_email?: string | null
          host_password?: string | null
          id?: string
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          short_message?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      guests: {
        Row: {
          checkin_at: string | null
          checkin_done: boolean | null
          children: Json | null
          companions: Json | null
          confirmed_adults: number | null
          confirmed_at: string | null
          confirmed_children: number | null
          created_at: string
          event_id: string
          group_name: string | null
          id: string
          max_adults: number | null
          max_children: number | null
          name: string
          observations: string | null
          qr_code: string | null
          qr_used: boolean | null
          status: string | null
          updated_at: string
        }
        Insert: {
          checkin_at?: string | null
          checkin_done?: boolean | null
          children?: Json | null
          companions?: Json | null
          confirmed_adults?: number | null
          confirmed_at?: string | null
          confirmed_children?: number | null
          created_at?: string
          event_id: string
          group_name?: string | null
          id?: string
          max_adults?: number | null
          max_children?: number | null
          name: string
          observations?: string | null
          qr_code?: string | null
          qr_used?: boolean | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          checkin_at?: string | null
          checkin_done?: boolean | null
          children?: Json | null
          companions?: Json | null
          confirmed_adults?: number | null
          confirmed_at?: string | null
          confirmed_children?: number | null
          created_at?: string
          event_id?: string
          group_name?: string | null
          id?: string
          max_adults?: number | null
          max_children?: number | null
          name?: string
          observations?: string | null
          qr_code?: string | null
          qr_used?: boolean | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          email: string
          event_limit: number | null
          events_contracted: number | null
          events_used: number | null
          full_name: string
          id: string
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          event_limit?: number | null
          events_contracted?: number | null
          events_used?: number | null
          full_name: string
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          event_limit?: number | null
          events_contracted?: number | null
          events_used?: number | null
          full_name?: string
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_limit_history: {
        Row: {
          change_type: string | null
          changed_by: string
          created_at: string
          id: string
          new_limit: number | null
          new_value: number | null
          old_value: number | null
          previous_limit: number | null
          reason: string | null
          user_id: string
        }
        Insert: {
          change_type?: string | null
          changed_by: string
          created_at?: string
          id?: string
          new_limit?: number | null
          new_value?: number | null
          old_value?: number | null
          previous_limit?: number | null
          reason?: string | null
          user_id: string
        }
        Update: {
          change_type?: string | null
          changed_by?: string
          created_at?: string
          id?: string
          new_limit?: number | null
          new_value?: number | null
          old_value?: number | null
          previous_limit?: number | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_events: {
        Row: {
          auto_block: boolean | null
          checkin_code: string | null
          confirmation_active: boolean | null
          confirmation_deadline: string | null
          cover_image_url: string | null
          event_date: string | null
          id: string | null
          name: string | null
          primary_color: string | null
          secondary_color: string | null
          short_message: string | null
        }
        Insert: {
          auto_block?: boolean | null
          checkin_code?: string | null
          confirmation_active?: boolean | null
          confirmation_deadline?: string | null
          cover_image_url?: string | null
          event_date?: string | null
          id?: string | null
          name?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_message?: string | null
        }
        Update: {
          auto_block?: boolean | null
          checkin_code?: string | null
          confirmation_active?: boolean | null
          confirmation_deadline?: string | null
          cover_image_url?: string | null
          event_date?: string | null
          id?: string | null
          name?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_message?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_user_create_event: { Args: { _user_id: string }; Returns: boolean }
      get_available_events: { Args: { _user_id: string }; Returns: number }
      get_user_event_count: { Args: { _user_id: string }; Returns: number }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "organizer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "organizer"],
    },
  },
} as const
