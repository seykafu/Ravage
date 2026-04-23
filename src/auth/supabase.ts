import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Vite exposes import.meta.env.VITE_* to the client at build time.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export const supabaseConfigured = (): boolean => Boolean(url && anonKey);

export const getSupabase = (): SupabaseClient | null => {
  if (!supabaseConfigured()) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: localStorage
      }
    });
  }
  return client;
};
