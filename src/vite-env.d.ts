/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DB_DRIVER?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_NOTION_DRIVER?: string
  readonly VITE_NOTION_PROXY_URL?: string
  readonly VITE_NOTION_REPORTS_DATABASE_ID?: string
  readonly VITE_NOTION_DELIVERIES_DATABASE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
