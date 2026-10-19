import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Applicant details may live in a related `applicants` table. Embed it and flatten the fields the UI reads.
const SELECT = '*, applicants(*)'
const first = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k] }
const norm = (r) => {
  const a = Array.isArray(r.applicants) ? r.applicants[0] : r.applicants
  const get = (keys) => first(r, keys) ?? first(a, keys)
  const name = get(['full_name', 'name', 'applicant_name']) ?? ([first(a, ['first_name']), first(a, ['last_name'])].filter(Boolean).join(' ') || undefined)
  return {
    ...r, applicant: a,
    full_name: name ?? r.full_name,
    passport_number: get(['passport_number', 'passport_no', 'passport']) ?? r.passport_number,
    nationality: get(['nationality', 'country']) ?? r.nationality,
    email: get(['email']) ?? r.email,
    phone: get(['phone', 'mobile', 'whatsapp', 'phone_number']) ?? r.phone,
    visa_type: get(['visa_type', 'visa_type_name', 'type']) ?? r.visa_type,
    passport_url: get(['passport_url', 'passport_copy_url', 'passport_image']) ?? r.passport_url,
    photo_url: get(['photo_url', 'photo', 'photo_image']) ?? r.photo_url,
  }
}
const fetchAll = async () => {
  let res = await supabase.from('applications').select(SELECT).order('created_at', { ascending: false }).limit(2000)
  if (res.error) { // no foreign key to `applicants`: fall back to the flat table
    console.warn('applicants embed failed, using flat select:', res.error.message)
    res = await supabase.from('applications').select('*').order('created_at', { ascending: false }).limit(2000)
  }
  return res
}

const NO_ROWS = 'No rows changed – check the admin RLS policies (supabase/admin_setup.sql, v3)'

export function useApplications({ enabled = true, onNew } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [live, setLive] = useState('connecting')
  const onNewRef = useRef(onNew); onNewRef.current = onNew
  const rowsRef = useRef(rows); rowsRef.current = rows
  const own = useRef(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchAll()
    if (error) setError(error.message); else { setRows(data.map(norm)); setError(null) }
    setLoading(false)
  }, [])

  // only talk to Supabase once an admin session exists
  useEffect(() => {
    if (!enabled) return
    load()
    const ch = supabase.channel('applications-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (p) => {
        if (p.eventType === 'INSERT') (async () => { // realtime payloads have no joins: refetch this row with its applicant
          const { data } = await supabase.from('applications').select(SELECT).eq('id', p.new.id).maybeSingle()
          const row = norm(data || p.new)
          setRows((r) => (r.some((x) => x.id === row.id) ? r : [row, ...r]))
          if (!own.current.has(row.id)) onNewRef.current?.(row)
        })()
        if (p.eventType === 'UPDATE') setRows((r) => r.map((x) => (x.id === p.new.id ? { ...x, ...p.new } : x)))
        if (p.eventType === 'DELETE') setRows((r) => r.filter((x) => x.id !== p.old.id))
      }).subscribe((s) => {
        if (s === 'SUBSCRIBED') setLive((p) => { if (p === 'offline') load(); return 'live' })
        else if (['TIMED_OUT', 'CLOSED', 'CHANNEL_ERROR'].includes(s)) setLive('offline')
      })
    return () => { supabase.removeChannel(ch) }
  }, [enabled, load])

  const update = useCallback(async (ids, patch) => {
    const list = Array.isArray(ids) ? ids : [ids]
    const full = { ...patch, ...(patch.status ? { reviewed_at: new Date().toISOString() } : {}) }
    const prev = rowsRef.current
    setRows((r) => r.map((x) => (list.includes(x.id) ? { ...x, ...full } : x)))
    const { data, error } = await supabase.from('applications').update(full).in('id', list).select('id')
    if (error || !data?.length) { setRows(prev); return error?.message || NO_ROWS }
  }, [])

  const create = useCallback(async (values) => {
    const { data, error } = await supabase.from('applications').insert({ status: 'pending', ...values }).select().single()
    if (error) return error.message
    own.current.add(data.id)
    setRows((r) => (r.some((x) => x.id === data.id) ? r : [data, ...r]))
  }, [])

  const remove = useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids]
    const prev = rowsRef.current
    setRows((r) => r.filter((x) => !list.includes(x.id)))
    const { data, error } = await supabase.from('applications').delete().in('id', list).select('id')
    if (error || !data?.length) { setRows(prev); return error?.message || NO_ROWS }
  }, [])

  return { rows, loading, error, live, reload: load, update, create, remove }
}
