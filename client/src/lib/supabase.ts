import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const missingSupabaseConfig = !supabaseUrl || !supabaseAnonKey;

const stubAuthError = () => ({ message: 'Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)' });

const stubSupabase = {
  auth: {
    signUp: async () => ({ data: null, error: stubAuthError() }),
    signInWithPassword: async () => ({ data: null, error: stubAuthError() }),
    signOut: async () => ({ error: stubAuthError() }),
    resetPasswordForEmail: async () => ({ data: null, error: stubAuthError() }),
    updateUser: async () => ({ data: null, error: stubAuthError() }),
    getSession: async () => ({ data: { session: null }, error: stubAuthError() }),
    getUser: async () => ({ data: { user: null }, error: stubAuthError() }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
} as const;

export const supabase = missingSupabaseConfig
  ? (stubSupabase as any)
  : createClient(supabaseUrl, supabaseAnonKey);

export type AuthUser = {
  id: string;
  email: string;
};

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}
