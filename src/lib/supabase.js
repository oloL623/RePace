import { createClient } from "@supabase/supabase-js";

const env = import.meta.env ?? {};
const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey
);

// 환경변수가 없는 개발 환경에서도 기존 로컬 러닝 기능은 그대로 동작해야 한다.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session?.access_token ?? null;
}

export async function refreshAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    throw error;
  }

  return data.session?.access_token ?? null;
}
