export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      house_inventory: {
        Row: {
          condition: string
          created_at: string
          current_condition: string
          description: string | null
          id: string
          item_category: string
          item_name: string
          location_in_house: string | null
          move_in_condition: string
          property_id: string
          updated_at: string
        }
        Insert: {
          condition: string
          created_at?: string
          current_condition: string
          description?: string | null
          id?: string
          item_category: string
          item_name: string
          location_in_house?: string | null
          move_in_condition: string
          property_id: string
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          current_condition?: string
          description?: string | null
          id?: string
          item_category?: string
          item_name?: string
          location_in_house?: string | null
          move_in_condition?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leases: {
        Row: {
          created_at: string
          end_date: string
          id: string
          monthly_rent: number
          property_id: string
          security_deposit: number | null
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          monthly_rent: number
          property_id: string
          security_deposit?: number | null
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          monthly_rent?: number
          property_id?: string
          security_deposit?: number | null
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          actual_cost: number | null
          created_at: string
          description: string
          estimated_cost: number | null
          id: string
          priority: string
          property_id: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          created_at?: string
          description: string
          estimated_cost?: number | null
          id?: string
          priority?: string
          property_id: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          created_at?: string
          description?: string
          estimated_cost?: number | null
          id?: string
          priority?: string
          property_id?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          lease_id: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          lease_id: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          lease_id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          description: string | null
          id: string
          monthly_rent: number | null
          property_type: string
          square_feet: number | null
          state: string
          status: string
          title: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          address: string
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          description?: string | null
          id?: string
          monthly_rent?: number | null
          property_type?: string
          square_feet?: number | null
          state: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          address?: string
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          monthly_rent?: number | null
          property_type?: string
          square_feet?: number | null
          state?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      tenant_bills: {
        Row: {
          amount: number
          bill_type: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bill_type: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_type?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_move_in_reports: {
        Row: {
          created_at: string
          id: string
          landlord_signature: boolean | null
          move_in_date: string
          overall_condition_notes: string | null
          property_id: string
          tenant_id: string
          tenant_signature: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          landlord_signature?: boolean | null
          move_in_date: string
          overall_condition_notes?: string | null
          property_id: string
          tenant_id: string
          tenant_signature?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          landlord_signature?: boolean | null
          move_in_date?: string
          overall_condition_notes?: string | null
          property_id?: string
          tenant_id?: string
          tenant_signature?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          lease_end_date: string | null
          lease_start_date: string | null
          monthly_rent: number | null
          notes: string | null
          phone: string | null
          property_address: string | null
          security_deposit: number | null
          status: string | null
          unit_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          monthly_rent?: number | null
          notes?: string | null
          phone?: string | null
          property_address?: string | null
          security_deposit?: number | null
          status?: string | null
          unit_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          monthly_rent?: number | null
          notes?: string | null
          phone?: string | null
          property_address?: string | null
          security_deposit?: number | null
          status?: string | null
          unit_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
