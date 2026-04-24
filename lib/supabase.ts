import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let browserClient: SupabaseClient<Database> | null = null;

function getPublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public env vars are required.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function getBrowserSupabaseClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

// Server-side client with service role (for edge functions / API routes)
export function createServiceClient() {
  const { supabaseUrl } = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
