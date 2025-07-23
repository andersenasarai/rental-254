import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          role: 'landlord' | 'tenant' | 'admin'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          role?: 'landlord' | 'tenant' | 'admin'
          avatar_url?: string | null
        }
        Update: {
          full_name?: string | null
          phone?: string | null
          role?: 'landlord' | 'tenant' | 'admin'
          avatar_url?: string | null
        }
      }
      properties: {
        Row: {
          id: string
          landlord_id: string
          title: string
          description: string | null
          address: string
          city: string
          state: string
          zip_code: string
          rent_amount: number
          deposit_amount: number | null
          bedrooms: number | null
          bathrooms: number | null
          square_feet: number | null
          amenities: string[] | null
          images: string[] | null
          status: 'available' | 'occupied' | 'maintenance'
          created_at: string
          updated_at: string
        }
        Insert: {
          landlord_id: string
          title: string
          description?: string | null
          address: string
          city: string
          state: string
          zip_code: string
          rent_amount: number
          deposit_amount?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          square_feet?: number | null
          amenities?: string[] | null
          images?: string[] | null
          status?: 'available' | 'occupied' | 'maintenance'
        }
        Update: {
          title?: string
          description?: string | null
          address?: string
          city?: string
          state?: string
          zip_code?: string
          rent_amount?: number
          deposit_amount?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          square_feet?: number | null
          amenities?: string[] | null
          images?: string[] | null
          status?: 'available' | 'occupied' | 'maintenance'
        }
      }
      leases: {
        Row: {
          id: string
          property_id: string
          tenant_id: string
          landlord_id: string
          start_date: string
          end_date: string
          rent_amount: number
          deposit_amount: number | null
          lease_terms: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      payments: {
        Row: {
          id: string
          lease_id: string
          tenant_id: string
          landlord_id: string
          amount: number
          due_date: string
          paid_date: string | null
          payment_method: string | null
          transaction_id: string | null
          status: 'pending' | 'paid' | 'overdue' | 'failed'
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      maintenance_requests: {
        Row: {
          id: string
          property_id: string
          tenant_id: string
          landlord_id: string
          title: string
          description: string
          priority: 'low' | 'medium' | 'high' | 'urgent'
          status: 'submitted' | 'in_progress' | 'completed' | 'cancelled'
          estimated_cost: number | null
          actual_cost: number | null
          contractor_name: string | null
          contractor_phone: string | null
          scheduled_date: string | null
          completed_date: string | null
          images: string[] | null
          created_at: string
          updated_at: string
        }
      }
    }
  }
}