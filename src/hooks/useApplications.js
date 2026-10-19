import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Schema: applications(service_id, applicant_id, …) → applicants(full_name, nationality, passport_number, phone, email,
// date_of_birth, country_of_residence) ; services is looked up separately to turn service_id into a readable name.
const SELECT = '*, applicants(*)'
const A_KEYS = ['full_name', 'nationality', 'passport_number', 'phone', 'email', 'date_of_birth', 'country_of_residence']
const NO_ROWS = 'No rows changed – check the admin RLS policies (supabase/admin_setup.sql, v3–v5)'

const first = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k] }
const shape = (r) => ({ ...r, applicants: Array.isArray(r.applicants) ? r.applicants[0] : r.applicants })
const serviceName = (s) => first(s, ['name', 'name_en', 'title', 'label', 'slug', 'code']) ?? String(s.id)

// flatten applicant fields + readable visa type onto the row the UI reads
const norm = (r, svc) => {
  const a = r.applicants
  const get = (keys) => first(r, keys) ?? first(a, keys)
  const full = get(['full_name', 'name']) ?? ([first(a, ['first_name']), first(a, ['last_name'])].filter(Boolean).join(' ') || undefined)
  return {
    ...r, applicant: a, full_name: full,
    passport_number: get(['passport_number']), nationality: get(['nationality']), email: get(['email']), phone: get(['phone']),
    date_of_birth: get(['date_of_birth']), country_of_residence: get(['country_of_residence']),
    visa_type: svc[r.service_id] ?? first(r, ['visa_type']) ?? r.service_id,
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

export function useApplications({ enabled = true, onNew } = {}) {
  const [raw, setRaw] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [live, setLive] = useState('connecting')
  const onNewRef = useRef(onNew); onNewRef.current = onNew
  const rawRef = useRef(raw); rawRef.current = raw
  const own = useRef(new Set())

  const svcMap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s.name])), [services])
  const rows = useMemo(() => raw.map((r) => norm(r, svcMap)), [raw, svcMap])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchAll()
    if (error) setError(error.message); else { setRaw(data.map(shape)); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    load()
    supabase.from('services').select('*').then(({ data, error }) => {
      if (error) console.warn('services lookup failed (visa type will show the raw service_id):', error.message)
      else setServices(data.map((s) => ({ id: s.id, name: serviceName(s) })))
    })
    const ch = supabase.channel('applications-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (p) => {
        if (p.eventType === 'INSERT') (async () => { // realtime payloads carry no joins: refetch this row with its applicant
          const { data } = await supabase.from('applications').select(SELECT).eq('id', p.new.id).maybeSingle()
          const row = shape(data || p.new)
          setRaw((r) => (r.some((x) => x.id === row.id) ? r : [row, ...r]))
          if (!own.current.has(row.id)) onNewRef.current?.(norm(row, {}))
        })()
        if (p.eventType === 'UPDATE') setRaw((r) => r.map((x) => (x.id === p.new.id ? { ...x, ...p.new } : x)))
        if (p.eventType === 'DELETE') setRaw((r) => r.filter((x) => x.id !== p.old.id))
      }).subscribe((s) => {
        if (s === 'SUBSCRIBED') setLive((p) => { if (p === 'offline') load(); return 'live' })
        else if (['TIMED_OUT', 'CLOSED', 'CHANNEL_ERROR'].includes(s)) setLive('offline')
      })
    return () => { supabase.removeChannel(ch) }
  }, [enabled, load])

  // Applicant fields are written to `applicants`, everything else to `applications`.
  const update = useCallback(async (ids, patch) => {
    const list = Array.isArray(ids) ? ids : [ids]
    const { visa_type: _ignored, ...rest } = patch
    const aPatch = {}, appPatch = {}
    for (const [k, v] of Object.entries(rest)) (A_KEYS.includes(k) ? aPatch : appPatch)[k] = v
    if (appPatch.status) appPatch.reviewed_at = new Date().toISOString()
    const prev = rawRef.current
    setRaw((r) => r.map((x) => (list.includes(x.id) ? { ...x, ...appPatch, ...(x.applicants ? { applicants: { ...x.applicants, ...aPatch } } : {}) } : x)))
    const fail = (m) => { setRaw(prev); return m }
    if (Object.keys(aPatch).length) {
      for (const id of list) {
        const row = prev.find((x) => x.id === id)
        const aid = row?.applicant_id ?? row?.applicants?.id
        if (!aid) return fail('No applicant is linked to this application')
        const { data, error } = await supabase.from('applicants').update(aPatch).eq('id', aid).select('id')
        if (error || !data?.length) return fail(error?.message || NO_ROWS)
      }
    }
    if (Object.keys(appPatch).length) {
      const { data, error } = await supabase.from('applications').update(appPatch).in('id', list).select('id')
      if (error || !data?.length) return fail(error?.message || NO_ROWS)
    }
  }, [])

  // creates the applicant first, then the application; undoes the applicant if the application insert fails
  const create = useCallback(async ({ service_id, ...applicant }) => {
    const { data: ap, error: e1 } = await supabase.from('applicants').insert(applicant).select().single()
    if (e1) return e1.message
    const { data, error } = await supabase.from('applications').insert({ applicant_id: ap.id, service_id: service_id || null, status: 'pending' }).select(SELECT).single()
    if (error) { await supabase.from('applicants').delete().eq('id', ap.id); return error.message }
    own.current.add(data.id)
    setRaw((r) => (r.some((x) => x.id === data.id) ? r : [shape({ ...data, applicants: data.applicants ?? ap }), ...r]))
  }, [])

  const remove = useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids]
    const prev = rawRef.current
    setRaw((r) => r.filter((x) => !list.includes(x.id)))
    const { data, error } = await supabase.from('applications').delete().in('id', list).select('id')
    if (error || !data?.length) { setRaw(prev); return error?.message || NO_ROWS }
  }, [])

  return { rows, services, loading, error, live, reload: load, update, create, remove }
}
