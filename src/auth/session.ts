import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
}

export const isAuthEnabled = (): boolean => supabaseConfigured();

export const currentUser = async (): Promise<User | null> => {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
};

export const currentSession = async (): Promise<Session | null> => {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
};

export const signUp = async (email: string, password: string): Promise<AuthResult> => {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth not configured." };
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  // If email confirmations are enabled in Supabase, data.session will be null.
  return { ok: true, user: data.user ?? undefined };
};

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth not configured." };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user ?? undefined };
};

export const signOut = async (): Promise<void> => {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
};
