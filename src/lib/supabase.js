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
// The bucket is not stored on the document row, so try: the one that worked last time, VITE_DOCS_BUCKET (default
// "documents"), every bucket the admin may list, then common names. Key variants: as stored, without a leading
// slash or "documents/" prefix, and as "bucket/path".
let lastGood
let listed // undefined = not asked yet
const GUESSES = ['documents', 'application-documents', 'application_documents', 'applications', 'passports', 'uploads', 'files', 'attachments']

async function candidateBuckets() {
  if (listed === undefined) {
    const { data, error } = await supabase.storage.listBuckets()
    listed = error || !data ? [] : data.map((b) => b.name)
  }
  return [...new Set([lastGood, DOCS_BUCKET, ...listed, ...(listed.length ? [] : GUESSES)].filter(Boolean))]
}

export async function fileLinks(value, filename) {
  if (!value) return { error: 'no storage_key on this document' }
  if (/^https?:\/\//.test(value)) return { url: value, download: value }
  const clean = value.replace(/^\/+/, '')
  const keys = [...new Set([value, clean, clean.replace(/^documents\//, '')])]
  const buckets = await candidateBuckets()
  const tries = buckets.flatMap((b) => keys.map((k) => [b, k]))
  if (clean.includes('/')) { const [b, ...rest] = clean.split('/'); tries.push([b, rest.join('/')]) }
  for (const [b, k] of tries) {
    const { data, error } = await supabase.storage.from(b).createSignedUrl(k, 3600)
    if (error || !data?.signedUrl) continue
    lastGood = b
    const dl = await supabase.storage.from(b).createSignedUrl(k, 3600, { download: filename || true })
    return { url: data.signedUrl, download: dl.data?.signedUrl || data.signedUrl, bucket: b }
  }
  return { error: `Object not found in any bucket I could try (${buckets.join(', ') || 'none'}). Either the bucket name differs (set VITE_DOCS_BUCKET) or the storage read policy is missing (SQL v5/v8)` }
}
