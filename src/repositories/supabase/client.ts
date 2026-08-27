import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

let client: SupabaseClient | null = null

/**
 * Lazily created so that a `local` build never opens a network client and the
 * Supabase SDK stays out of the critical path for the default driver.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new Error(
        'Supabase driver selected but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.',
      )
    }
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}
