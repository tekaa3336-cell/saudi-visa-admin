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
const DOCS_BUCKET = import.meta.env.VITE_DOCS_BUCKET || 'documents'
export async function fileUrl(value, bucket = DOCS_BUCKET) {
  if (!value) return null
  if (/^https?:\/\//.test(value)) return value
  const sign = async (b, k) => (await supabase.storage.from(b).createSignedUrl(k, 3600)).data?.signedUrl ?? null
  const url = await sign(bucket, value)
  if (url || !value.includes('/')) return url
  const [b, ...rest] = value.split('/') // storage_key may be stored as "bucket/path/file.jpg"
  return sign(b, rest.join('/'))
}
