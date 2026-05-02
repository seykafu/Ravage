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

// Resolve the URL Supabase should redirect to after the user clicks
// a confirmation or password-reset link in their email. We use the
// CURRENT page origin + path so the email link returns the player
// to whatever domain they signed up from — works on localhost
// (http://localhost:5173/play/), Vercel previews, and production
// (https://ravage.game/play/) without per-environment config.
//
// IMPORTANT: this only takes effect if the URL is also added to
// Supabase's "Redirect URLs" allowlist in the project dashboard
// (Authentication → URL Configuration). Without that allowlist
// entry, Supabase falls back to the project's Site URL setting —
// which is `http://localhost:3000` by default for new projects,
// hence the "link goes to localhost" bug. See docs in commit
// message + the README's Supabase section.
const emailRedirectUrl = (): string => {
  if (typeof window === "undefined") return "";
  // Strip any trailing query / hash so the redirect lands on a clean
  // canonical URL. Supabase appends its own hash params with the
  // session tokens — those are read by detectSessionInUrl on the
  // resulting page load.
  return `${window.location.origin}${window.location.pathname}`;
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
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      // Where Supabase should send the user after they click the
      // confirmation link in their email. Without this, the link
      // hardcodes the project's Site URL (default: localhost:3000)
      // and the player ends up on localhost instead of the game.
      emailRedirectTo: emailRedirectUrl()
    }
  });
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
  const { error } = await sb.auth.resend({
    type: "signup",
    email,
    options: {
      // Same redirect override as signUp — without this, resent
      // confirmation links also hardcode Supabase's Site URL.
      emailRedirectTo: emailRedirectUrl()
    }
  });
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
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    // Where Supabase's hosted password-reset flow should redirect
    // the user after they finish setting a new password. Same
    // current-page-origin trick as signUp's emailRedirectTo.
    redirectTo: emailRedirectUrl()
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
};
