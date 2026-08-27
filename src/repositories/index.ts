import { env } from '@/lib/env'
import { createLocalRepository } from './local/localRepository'
import type { WorklogRepository } from './types'

let instance: WorklogRepository | null = null

/**
 * The single place in the app that knows which database is in use.
 *
 * Services call `getRepository()`; components and hooks never do. Adding a third
 * driver (a REST backend, SQLite/WASM, …) means one more branch here.
 */
export function getRepository(): WorklogRepository {
  if (instance) return instance

  if (env.dbDriver === 'supabase') {
    // Imported lazily via require-style dynamic access so the Supabase SDK is not
    // evaluated at all in the default local build.
    throw new Error('Supabase driver must be initialised with initRepository() before use.')
  }

  instance = createLocalRepository()
  return instance
}

/** Called once from the app bootstrap; resolves the driver, async-importing Supabase. */
export async function initRepository(): Promise<WorklogRepository> {
  if (instance) return instance

  if (env.dbDriver === 'supabase') {
    const { createSupabaseRepository } = await import('./supabase/supabaseRepository')
    instance = createSupabaseRepository()
  } else {
    instance = createLocalRepository()
  }

  return instance
}

/** Test/reset seam. */
export function setRepository(repository: WorklogRepository): void {
  instance = repository
}

export type { WorklogRepository } from './types'
