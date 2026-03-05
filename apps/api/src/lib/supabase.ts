import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database schema type for Supabase v2.98+
// Each table requires Row, Insert, Update, and Relationships
interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          griffin_legal_person_url: string | null;
          griffin_account_url: string | null;
          griffin_onboarding_application_url: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: Partial<{
          id: string;
          griffin_legal_person_url: string | null;
          griffin_account_url: string | null;
          griffin_onboarding_application_url: string | null;
          display_name: string | null;
        }>;
        Update: Partial<{
          griffin_legal_person_url: string | null;
          griffin_account_url: string | null;
          griffin_onboarding_application_url: string | null;
          display_name: string | null;
        }>;
        Relationships: [];
      };
      conversations: {
        Row: { id: string; user_id: string; created_at: string; updated_at: string };
        Insert: { user_id: string };
        Update: Partial<{ updated_at: string }>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string | null;
          content_blocks: any;
          tool_calls: any;
          ui_components: any;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          role: string;
          content?: string | null;
          content_blocks?: any;
          tool_calls?: any;
          ui_components?: any;
        };
        Update: Partial<{ content: string; content_blocks: any }>;
        Relationships: [];
      };
      pending_actions: {
        Row: {
          id: string;
          user_id: string;
          tool_name: string;
          params: any;
          status: string;
          idempotency_key: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          tool_name: string;
          params: any;
          status?: string;
          idempotency_key?: string;
          expires_at: string;
        };
        Update: Partial<{ status: string }>;
        Relationships: [];
      };
      loans: {
        Row: {
          id: string;
          application_id: string;
          user_id: string;
          principal: number;
          balance_remaining: number;
          interest_rate: number;
          monthly_payment: number;
          term_months: number;
          next_payment_date: string | null;
          status: string;
          disbursed_at: string;
        };
        Insert: {
          application_id: string;
          user_id: string;
          principal: number;
          balance_remaining: number;
          interest_rate: number;
          monthly_payment: number;
          term_months: number;
          next_payment_date?: string;
          status?: string;
        };
        Update: Partial<{ balance_remaining: number; status: string; next_payment_date: string }>;
        Relationships: [];
      };
      loan_applications: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          term_months: number;
          purpose: string | null;
          status: string;
          decision_reason: string | null;
          interest_rate: number | null;
          monthly_payment: number | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          amount: number;
          term_months: number;
          purpose?: string;
          status?: string;
        };
        Update: Partial<{
          status: string;
          decision_reason: string;
          interest_rate: number;
          monthly_payment: number;
        }>;
        Relationships: [];
      };
      loan_products: {
        Row: {
          id: string;
          name: string;
          min_amount: number;
          max_amount: number;
          interest_rate: number;
          min_term_months: number;
          max_term_months: number;
        };
        Insert: {
          name: string;
          min_amount: number;
          max_amount: number;
          interest_rate: number;
          min_term_months: number;
          max_term_months: number;
        };
        Update: Partial<{
          name: string;
          interest_rate: number;
        }>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
}

let _client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      // Return a dummy client that will fail gracefully
      // This allows the server to start without Supabase for health checks
      return createClient<Database>('https://placeholder.supabase.co', 'placeholder');
    }
    _client = createClient<Database>(url, key);
  }
  return _client;
}

export type { Database };
