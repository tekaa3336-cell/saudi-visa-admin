import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const DEFAULTS = {
  fees: {},
  notifications: { toast_new: true, sound_new: false, email_admin_new: false, admin_email: '', email_applicant_status: true },
  prefs: { country_code: '966', processing_days: 5 },
  ops: { accepting: true, closed_message: '' },
}
const merge = (d = {}) => ({
  fees: { ...d.fees },
  notifications: { ...DEFAULTS.notifications, ...d.notifications },
  prefs: { ...DEFAULTS.prefs, ...d.prefs },
  ops: { ...DEFAULTS.ops, ...d.ops },
})

export function useSettings(enabled) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!enabled) return
    supabase.from('admin_settings').select('data').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) setError(error.message)
      setSettings(merge(data?.data)); setLoading(false)
    })
  }, [enabled])

  const save = useCallback(async (next) => {
    setSaving(true)
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('admin_settings').upsert({ id: 1, data: next, updated_at: new Date().toISOString(), updated_by: u.user?.email })
    setSaving(false)
    if (error) return error.message
    setSettings(merge(next)); setError(null)
  }, [])

  return { settings, loading, error, saving, save }
}
