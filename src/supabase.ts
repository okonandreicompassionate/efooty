import { createClient } from '@supabase/supabase-js';

// Safely retrieve keys from import.meta.env or process.env
const getEnvVar = (key: string): string => {
  if (typeof window !== 'undefined' && (window as any)._env_?.[key]) {
    return (window as any)._env_[key];
  }
  // Check import.meta.env
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const metaEnv = (import.meta as any).env;
    if (metaEnv[key]) return metaEnv[key];
    if (metaEnv[`VITE_${key}`]) return metaEnv[`VITE_${key}`];
  }
  // Check process.env (fallback)
  try {
    if (typeof process !== 'undefined' && process.env) {
      if ((process.env as any)[key]) return (process.env as any)[key];
      if ((process.env as any)[`VITE_${key}`]) return (process.env as any)[`VITE_${key}`];
    }
  } catch (e) {
    // Ignore ReferenceError
  }
  return '';
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('SUPABASE_URL') || '';
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY') || '';

// Check if valid keys are provided (and not placeholders)
export const isSupabaseConfigured = 
  supabaseUrl.trim() !== '' && 
  supabaseAnonKey.trim() !== '' && 
  !supabaseUrl.includes('YOUR_') && 
  !supabaseAnonKey.includes('YOUR_');

// Initialize the client. If not configured, we create a dummy client or export null 
// so that compile doesn't fail, and we handle the offline fallback gracefully.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Export helpers for the client if they want to check configuration status
export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured: isSupabaseConfigured,
});

