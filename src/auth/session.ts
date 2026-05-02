import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
  // True iff the call succeeded but Supabase didn't issue a session
  // (project has "Confirm email" enabled and the user must click the
  // link in their inbox before signin will work). UI surfaces this
  // as a "check your inbox" state instead of the success path.
  needsEmailConfirmation?: boolean;
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

// Translate Supabase's technical error messages into something a
// player can act on. The default messages ("Invalid login
// credentials", "Email not confirmed") are accurate but read as
// hostile; the player needs to know WHAT TO DO next.
const friendlyError = (raw: string): string => {
  const s = raw.toLowerCase();
  if (s.includes("email not confirmed") || s.includes("not confirmed")) {
    return "Your email isn't confirmed yet. Check your inbox for the confirmation link, then try signing in again. (Use \"Resend confirmation email\" below if you didn't get it.)";
  }
  if (s.includes("invalid login credentials") || s.includes("invalid_credentials")) {
    return "That email and password don't match. Double-check both. If you registered but never confirmed, the account may need its confirmation link clicked first.";
  }
  if (s.includes("user already registered") || s.includes("already_registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (s.includes("rate limit") || s.includes("too many")) {
    return "Too many attempts in a short window. Wait a minute and try again.";
  }
  if (s.includes("password") && s.includes("short")) {
    return "Password is too short. Use at least 6 characters.";
  }
  return raw;
};

export const signUp = async (email: string, password: string): Promise<AuthResult> => {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth not configured." };
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { ok: false, error: friendlyError(error.message) };
  // CRITICAL: when "Confirm email" is enabled in Supabase (the
  // default for new projects), signUp returns data.user with
  // email_confirmed_at: null AND data.session: null. The user is
  // NOT actually logged in until they click the confirmation link
  // in their email. Earlier code checked `data.user` here and
  // treated its presence as success — which routed unconfirmed
  // users straight into the game and left them unable to sign
  // back in later. Now we check session, which is the actual
  // authoritative signal.
  const needsEmailConfirmation = !data.session;
  return {
    ok: true,
    user: data.user ?? undefined,
    needsEmailConfirmation
  };
};

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth not configured." };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true, user: data.user ?? undefined };
};

export const signOut = async (): Promise<void> => {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
};

// Re-send the confirmation email for an already-registered but
// unconfirmed account. Surfaced via "Resend confirmation email"
// affordance in AuthScene's signin mode so the user has a recovery
// path when they didn't get the original link (spam folder, expired,
// etc.).
export const resendConfirmation = async (email: string): Promise<AuthResult> => {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth not configured." };
  const { error } = await sb.auth.resend({ type: "signup", email });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
};

// Send a password reset email. Surfaced via "Forgot password?"
// affordance. The user clicks the link in their inbox and Supabase's
// hosted reset flow handles the actual password change; we don't
// need a custom reset UI in the game.
export const resetPassword = async (email: string): Promise<AuthResult> => {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Auth not configured." };
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
};
