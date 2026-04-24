export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  social: {
    Tables: {
      account_snapshots: {
        Row: {
          followers_count: number | null;
          impressions: number | null;
          platform: string;
          platform_account_id: string | null;
          reach: number | null;
          snapshot_date: string;
        };
        Insert: {
          followers_count?: number | null;
          impressions?: number | null;
          platform: string;
          platform_account_id?: string | null;
          reach?: number | null;
          snapshot_date: string;
        };
        Update: {
          followers_count?: number | null;
          impressions?: number | null;
          platform?: string;
          platform_account_id?: string | null;
          reach?: number | null;
          snapshot_date?: string;
        };
        Relationships: [];
      };
      connected_accounts: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          id: string;
          is_active: boolean | null;
          last_synced_at: string | null;
          platform: string;
          platform_username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          display_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_synced_at?: string | null;
          platform: string;
          platform_username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_synced_at?: string | null;
          platform?: string;
          platform_username?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
