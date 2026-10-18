import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useApplications({ onNew } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [live, setLive] = useState('connecting')
  const onNewRef = useRef(onNew)
  onNewRef.current = onNew

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('applications').select('*').order('created_at', { ascending: false }).limit(2000)
    if (error) setError(error.message); else { setRows(data); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('applications-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (p) => {
        if (p.eventType === 'INSERT') { setRows((r) => [p.new, ...r]); onNewRef.current?.(p.new) }
        if (p.eventType === 'UPDATE') setRows((r) => r.map((x) => (x.id === p.new.id ? { ...x, ...p.new } : x)))
        if (p.eventType === 'DELETE') setRows((r) => r.filter((x) => x.id !== p.old.id))
      }).subscribe((s) => {
        if (s === 'SUBSCRIBED') { setLive((p) => { if (p === 'offline') load(); return 'live' }) }
        else if (['TIMED_OUT', 'CLOSED', 'CHANNEL_ERROR'].includes(s)) setLive('offline')
      })
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // patch one or many applications; optimistic, rolled back on error
  const update = useCallback(async (ids, patch) => {
    const list = Array.isArray(ids) ? ids : [ids]
    const full = { ...patch, ...(patch.status ? { reviewed_at: new Date().toISOString() } : {}) }
    const prev = rows
    setRows((r) => r.map((x) => (list.includes(x.id) ? { ...x, ...full } : x)))
    const { error } = await supabase.from('applications').update(full).in('id', list)
    if (error) { setRows(prev); return error.message }
  }, [rows])

  return { rows, loading, error, live, reload: load, update }
}
