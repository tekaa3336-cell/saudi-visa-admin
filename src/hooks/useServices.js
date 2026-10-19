import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// public.services is read with select('*') and each logical field is mapped to whichever column exists
// (so a table using name_en / is_active etc. still works). Missing columns are created by supabase/services_management.sql.
const CANDIDATES = {
  name: ['name', 'name_en', 'title', 'label'],
  code: ['code', 'slug', 'key', 'category', 'type'],
  description: ['description', 'description_en', 'details'],
  service_fee: ['service_fee'],
  government_fee: ['government_fee', 'gov_fee'],
  total_cost: ['total_cost', 'total', 'price'],
  available: ['is_available', 'available', 'is_active', 'active'],
}
const CANON = { name: 'name', code: 'code', description: 'description', service_fee: 'service_fee', government_fee: 'government_fee', total_cost: 'total_cost', available: 'is_available' }
export const resolveCols = (row) => Object.fromEntries(Object.entries(CANDIDATES).map(([f, list]) => [f, (row && list.find((k) => k in row)) || CANON[f]]))

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const normalize = (r, c) => ({
  id: r.id, name: r[c.name] ?? '', code: r[c.code] ?? '', description: r[c.description] ?? '',
  service_fee: num(r[c.service_fee]), government_fee: num(r[c.government_fee]), total_cost: num(r[c.total_cost]),
  available: r[c.available] !== false,
})
const toPayload = (v, c) => ({
  [c.name]: v.name, [c.code]: v.code, [c.description]: v.description || null,
  [c.service_fee]: num(v.service_fee), [c.government_fee]: num(v.government_fee), [c.total_cost]: num(v.total_cost), [c.available]: !!v.available,
})
const NO_ROWS = 'No rows changed – check the admin policies (supabase/services_management.sql)'

export function useServices(enabled = true) {
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const cols = useMemo(() => resolveCols(raw[0]), [raw])
  const items = useMemo(() => raw.map((r) => normalize(r, cols)).sort((a, b) => String(a.name).localeCompare(String(b.name))), [raw, cols])

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('services').select('*')
    if (error) setError(error.message); else { setRaw(data); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    load()
    const ch = supabase.channel('services-live').on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [enabled, load])

  const create = useCallback(async (v) => {
    const { data, error } = await supabase.from('services').insert(toPayload(v, cols)).select().single()
    if (error) return error.message
    setRaw((r) => [...r, data])
  }, [cols])

  const update = useCallback(async (id, v) => {
    const payload = toPayload(v, cols)
    delete payload[cols.code] // the code is what applications reference: never rewrite it from the edit form
    const { data, error } = await supabase.from('services').update(payload).eq('id', id).select()
    if (error || !data?.length) return error?.message || NO_ROWS
    setRaw((r) => r.map((x) => (x.id === id ? { ...x, ...data[0] } : x)))
  }, [cols])

  const setAvailable = useCallback(async (id, on) => {
    const prev = raw
    setRaw((r) => r.map((x) => (x.id === id ? { ...x, [cols.available]: on } : x)))
    const { data, error } = await supabase.from('services').update({ [cols.available]: on }).eq('id', id).select('id')
    if (error || !data?.length) { setRaw(prev); return error?.message || NO_ROWS }
  }, [raw, cols])

  const remove = useCallback(async (id) => {
    const prev = raw
    setRaw((r) => r.filter((x) => x.id !== id))
    const { data, error } = await supabase.from('services').delete().eq('id', id).select('id')
    if (error || !data?.length) { setRaw(prev); return error?.message || NO_ROWS }
  }, [raw])

  return { items, loading, error, create, update, setAvailable, remove, reload: load }
}
