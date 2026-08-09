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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deposits: {
        Row: {
          amount_ton: number
          asset: string
          created_at: string
          from_addr: string | null
          id: string
          memo: string
          status: string
          tx_hash: string
          user_id: string
        }
        Insert: {
          amount_ton: number
          asset?: string
          created_at?: string
          from_addr?: string | null
          id?: string
          memo: string
          status?: string
          tx_hash: string
          user_id: string
        }
        Update: {
          amount_ton?: number
          asset?: string
          created_at?: string
          from_addr?: string | null
          id?: string
          memo?: string
          status?: string
          tx_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      margins: {
        Row: {
          created_at: string
          id: string
          kind: string
          percent: number
          platform: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          percent?: number
          platform: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          percent?: number
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_ton: number
          completed_at: string | null
          created_at: string
          id: string
          link: string
          memo: string
          paid_at: string | null
          provider_order_id: string | null
          provider_response: Json | null
          public_code: string
          quantity: number
          sent_at: string | null
          service_id: string
          status: Database["public"]["Enums"]["order_status"]
          tx_amount_ton: number | null
          tx_hash: string | null
          user_id: string | null
        }
        Insert: {
          amount_ton: number
          completed_at?: string | null
          created_at?: string
          id?: string
          link: string
          memo: string
          paid_at?: string | null
          provider_order_id?: string | null
          provider_response?: Json | null
          public_code: string
          quantity: number
          sent_at?: string | null
          service_id: string
          status?: Database["public"]["Enums"]["order_status"]
          tx_amount_ton?: number | null
          tx_hash?: string | null
          user_id?: string | null
        }
        Update: {
          amount_ton?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          link?: string
          memo?: string
          paid_at?: string | null
          provider_order_id?: string | null
          provider_response?: Json | null
          public_code?: string
          quantity?: number
          sent_at?: string | null
          service_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          tx_amount_ton?: number | null
          tx_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance_ton: number
          created_at: string
          deposit_memo: string
          preferred_currency: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          balance_ton?: number
          created_at?: string
          deposit_memo: string
          preferred_currency?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          balance_ton?: number
          created_at?: string
          deposit_memo?: string
          preferred_currency?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          avg_time: string | null
          category: string | null
          id: string
          max_qty: number
          min_qty: number
          name: string
          platform: string | null
          provider_id: string
          rate_per_1k: number
          rate_per_1k_ton: number
          remarks: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avg_time?: string | null
          category?: string | null
          id?: string
          max_qty?: number
          min_qty?: number
          name: string
          platform?: string | null
          provider_id: string
          rate_per_1k?: number
          rate_per_1k_ton?: number
          remarks?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avg_time?: string | null
          category?: string | null
          id?: string
          max_qty?: number
          min_qty?: number
          name?: string
          platform?: string | null
          provider_id?: string
          rate_per_1k?: number
          rate_per_1k_ton?: number
          remarks?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      ton_txs: {
        Row: {
          amount_ton: number
          from_addr: string | null
          hash: string
          lt: string | null
          matched_order_id: string | null
          memo: string | null
          seen_at: string
        }
        Insert: {
          amount_ton: number
          from_addr?: string | null
          hash: string
          lt?: string | null
          matched_order_id?: string | null
          memo?: string | null
          seen_at?: string
        }
        Update: {
          amount_ton?: number
          from_addr?: string | null
          hash?: string
          lt?: string | null
          matched_order_id?: string | null
          memo?: string | null
          seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ton_txs_matched_order_id_fkey"
            columns: ["matched_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      topup_requests: {
        Row: {
          admin_note: string | null
          amount_xof: number
          country: string
          created_at: string
          id: string
          operator: string
          phone: string
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_xof: number
          country: string
          created_at?: string
          id?: string
          operator: string
          phone: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_xof?: number
          country?: string
          created_at?: string
          id?: string
          operator?: string
          phone?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      credit_balance: {
        Args: { _amount: number; _user: string }
        Returns: undefined
      }
      debit_balance: {
        Args: { _amount: number; _user: string }
        Returns: boolean
      }
      generate_deposit_memo: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      order_status:
        | "pending"
        | "paid"
        | "sent"
        | "completed"
        | "failed"
        | "cancelled"
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
      app_role: ["admin", "user"],
      order_status: [
        "pending",
        "paid",
        "sent",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
