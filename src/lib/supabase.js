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

// Signed links for a stored file: `url` to view it, `download` forces a save-as with the original file name.
export async function fileLinks(value, filename, bucket = DOCS_BUCKET) {
  if (!value) return { error: 'no storage_key' }
  if (/^https?:\/\//.test(value)) return { url: value, download: value }
  const sign = (b, k, opts) => supabase.storage.from(b).createSignedUrl(k, 3600, opts)
  let b = bucket, k = value
  let res = await sign(b, k)
  if (res.error && value.includes('/')) { // key stored as "bucket/path/file"
    const [b2, ...rest] = value.split('/')
    const alt = await sign(b2, rest.join('/'))
    if (!alt.error) { res = alt; b = b2; k = rest.join('/') }
  }
  if (res.error) return { error: res.error.message }
  const dl = await sign(b, k, { download: filename || true })
  return { url: res.data.signedUrl, download: dl.data?.signedUrl || res.data.signedUrl }
}
