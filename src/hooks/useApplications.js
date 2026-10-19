import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { A_KEYS, first, serviceName } from '../lib/applicant'

// Schema: applicants.application_id → applications.id (one applicant row per application); applicants(full_name, nationality, passport_number, phone, email,
// date_of_birth, country_of_residence) ; services is looked up separately to turn service_id into a readable name.
const SELECT = '*, applicants(*)'
const NO_ROWS = 'No rows changed – check the admin RLS policies (supabase/admin_setup.sql, v3–v5)'

const shape = (r) => ({ ...r, applicants: Array.isArray(r.applicants) ? r.applicants[0] : r.applicants })

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

const ORDER = { ascending: false }
const fetchAll = async () => {
  const res = await supabase.from('applications').select(SELECT).order('created_at', ORDER).limit(2000)
  const hasApplicant = (x) => (Array.isArray(x.applicants) ? x.applicants.length > 0 : !!x.applicants)
  // an embed returns [] (no error) when the FK is missing/uncached or RLS hides the rows, so check for emptiness too
  if (!res.error && (!res.data.length || res.data.some(hasApplicant))) return res
  console.warn('applicants embed failed or empty, joining manually:', res.error?.message)
  const flat = res.error ? await supabase.from('applications').select('*').order('created_at', ORDER).limit(2000) : res
  if (flat.error) return flat
  const { data: ap, error } = await supabase.from('applicants').select('*').limit(5000)
  if (error) { console.warn('applicants lookup failed:', error.message); return flat }
  const byApp = new Map(ap.map((x) => [x.application_id, x]))
  return { data: flat.data.map((x) => ({ ...x, applicants: byApp.get(x.id) })), error: null }
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
  const svcRef = useRef(svcMap); svcRef.current = svcMap
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
        if (p.eventType === 'INSERT') (async () => {
          // the user app inserts the application first and the applicant row a moment later:
          // show the row now, then refetch with its applicant before announcing it
          setRaw((r) => (r.some((x) => x.id === p.new.id) ? r : [shape(p.new), ...r]))
          await new Promise((res) => setTimeout(res, 1200))
          const { data } = await supabase.from('applications').select(SELECT).eq('id', p.new.id).maybeSingle()
          let row = shape(data || p.new)
          if (!row.applicants) { // no declared FK: look the applicant up directly
            const { data: ap } = await supabase.from('applicants').select('*').eq('application_id', p.new.id).maybeSingle()
            if (ap) row = { ...row, applicants: ap }
          }
          setRaw((r) => r.map((x) => (x.id === row.id ? row : x)))
          if (!own.current.has(row.id)) onNewRef.current?.(norm(row, svcRef.current))
        })()
        if (p.eventType === 'UPDATE') setRaw((r) => r.map((x) => (x.id === p.new.id ? { ...x, ...p.new } : x)))
        if (p.eventType === 'DELETE') setRaw((r) => r.filter((x) => x.id !== p.old.id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applicants' }, (p) => {
        if (p.eventType === 'DELETE' || !p.new?.application_id) return
        setRaw((r) => r.map((x) => (x.id === p.new.application_id ? { ...x, applicants: p.new } : x)))
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
      const { data, error } = await supabase.from('applicants').update(aPatch).in('application_id', list).select('id')
      if (error || !data?.length) return fail(error?.message || NO_ROWS)
    }
    if (Object.keys(appPatch).length) {
      const { data, error } = await supabase.from('applications').update(appPatch).in('id', list).select('id')
      if (error || !data?.length) return fail(error?.message || NO_ROWS)
    }
  }, [])

  // creates the application first, then its applicant row (applicants.application_id → applications.id); undoes the application if that fails
  const create = useCallback(async ({ service_id, ...applicant }) => {
    const { data: app, error: e1 } = await supabase.from('applications').insert({ service_id: service_id || null, status: 'pending' }).select().single()
    if (e1) return e1.message
    own.current.add(app.id)
    const { data: ap, error: e2 } = await supabase.from('applicants').insert({ ...applicant, application_id: app.id }).select().single()
    if (e2) { await supabase.from('applications').delete().eq('id', app.id); return e2.message }
    setRaw((r) => (r.some((x) => x.id === app.id) ? r.map((x) => (x.id === app.id ? { ...x, applicants: ap } : x)) : [shape({ ...app, applicants: ap }), ...r]))
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
