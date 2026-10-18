import { createClient } from '@supabase/supabase-js'

// Browser uses the ANON key only. Never ship the service-role key in a Vite bundle.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { params: { eventsPerSecond: 5 } } }
)

export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

// Resolve a storage path or URL into a viewable URL (signed for private buckets).
export async function fileUrl(value, bucket = 'documents') {
  if (!value) return null
  if (/^https?:\/\//.test(value)) return value
  const { data } = await supabase.storage.from(bucket).createSignedUrl(value, 3600)
  return data?.signedUrl ?? null
}
