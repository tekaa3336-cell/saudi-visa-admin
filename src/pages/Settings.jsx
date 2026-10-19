import { useEffect, useState } from 'react'
import { Loader2, Save, Trash2, Plus, RotateCcw } from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

const Card = ({ title, hint, children }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
    <h2 className="font-medium">{title}</h2>{hint && <p className="mb-2 mt-0.5 text-sm text-slate-500">{hint}</p>}{children}
  </section>
)
function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div><div className="text-sm font-medium">{label}</div>{hint && <div className="text-sm text-slate-500">{hint}</div>}</div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-pine-800' : 'bg-slate-300 dark:bg-white/20'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

export default function Settings({ settings, loading, error, saving, onSave, rows, onUpdateRows, notify, dark, setDark }) {
  const [d, setD] = useState(null)
  const [newType, setNewType] = useState('')
  useEffect(() => { if (settings) setD(structuredClone(settings)) }, [settings])

  if (loading || !d) return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>

  const dirty = JSON.stringify(d) !== JSON.stringify(settings)
  const set = (sec, k, v) => setD((x) => ({ ...x, [sec]: { ...x[sec], [k]: v } }))
  const types = [...new Set([...rows.map((r) => r.visa_type).filter(Boolean), ...Object.keys(d.fees)])].sort()
  const setFee = (t, v) => setD((x) => { const fees = { ...x.fees }; if (v === '') delete fees[t]; else fees[t] = Number(v); return { ...x, fees } })
  const addType = () => { const t = newType.trim(); if (t && d.fees[t] === undefined) setD((x) => ({ ...x, fees: { ...x.fees, [t]: 0 } })); setNewType('') }
  const save = async () => { const err = await onSave(d); notify(err ? `Save failed: ${err}` : 'Settings saved', err ? 'error' : 'success') }
  const applyFee = async (t) => {
    const ids = rows.filter((r) => r.status === 'pending' && r.visa_type === t).map((r) => r.id)
    const err = await onUpdateRows(ids, { fee: d.fees[t] })
    notify(err ? `Update failed: ${err}` : `Fee ${d.fees[t]} applied to ${ids.length} pending application(s)`, err ? 'error' : 'success')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      {error && <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">Settings could not be loaded from Supabase ({error}). Run the v3 block of supabase/admin_setup.sql, then reload. Defaults are shown.</p>}

      <Card title="Visa fees" hint="Fee per visa type (SAR). The user app can read these from admin_settings to price new requests.">
        <ul className="divide-y divide-slate-100 dark:divide-white/10">
          {types.length === 0 && <li className="py-3 text-sm text-slate-500">No visa types yet. Add one below.</li>}
          {types.map((t) => {
            const pending = rows.filter((r) => r.status === 'pending' && r.visa_type === t).length
            const configured = d.fees[t] !== undefined
            return (
              <li key={t} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-[140px] flex-1 text-sm font-medium">{t}</span>
                <input aria-label={`Fee for ${t}`} type="number" min="0" className="field w-28" placeholder="Fee" value={d.fees[t] ?? ''} onChange={(e) => setFee(t, e.target.value)} />
                <button className="btn-ghost" disabled={!configured || !pending || dirty} title={dirty ? 'Save settings first' : ''} onClick={() => applyFee(t)}>Apply to {pending} pending</button>
                <button aria-label={`Remove ${t}`} className="btn-ghost" disabled={!configured} onClick={() => setFee(t, '')}><Trash2 size={15} /></button>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex gap-2">
          <input className="field" placeholder="Add visa type (e.g. Umrah)" aria-label="New visa type" value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addType()} />
          <button className="btn-ghost" onClick={addType}><Plus size={16} />Add</button>
        </div>
      </Card>

      <Card title="Notifications">
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          <Toggle label="Pop-up for new applications" hint="Toast alert while the dashboard is open." checked={d.notifications.toast_new} onChange={(v) => set('notifications', 'toast_new', v)} />
          <Toggle label="Sound alert" hint="Short beep on a new application (the browser may need one click on the page first)." checked={d.notifications.sound_new} onChange={(v) => set('notifications', 'sound_new', v)} />
          <Toggle label="Email me about new applications" hint="Saved as a preference. Sending needs a backend (e.g. a Supabase Edge Function) that reads this value." checked={d.notifications.email_admin_new} onChange={(v) => set('notifications', 'email_admin_new', v)} />
          <div className="py-3"><label className="mb-1 block text-sm font-medium" htmlFor="ae">Admin notification email</label>
            <input id="ae" type="email" className="field max-w-sm" value={d.notifications.admin_email} onChange={(e) => set('notifications', 'admin_email', e.target.value)} /></div>
          <Toggle label="Email applicants on status changes" hint="Saved as a preference for the same backend job. This dashboard does not send email itself." checked={d.notifications.email_applicant_status} onChange={(v) => set('notifications', 'email_applicant_status', v)} />
        </div>
      </Card>

      <Card title="Operations" hint="Read by the user app to open or pause intake.">
        <Toggle label="Accepting new applications" hint="Turn off to pause intake (the user app must honour this flag)." checked={d.ops.accepting} onChange={(v) => set('ops', 'accepting', v)} />
        {!d.ops.accepting && (<><label className="mb-1 block text-sm font-medium" htmlFor="cm">Message shown while paused</label>
          <textarea id="cm" dir="auto" rows={2} className="field mb-3" value={d.ops.closed_message} onChange={(e) => set('ops', 'closed_message', e.target.value)} /></>)}
        <label className="mb-1 block text-sm font-medium" htmlFor="pd">Estimated processing time (days)</label>
        <input id="pd" type="number" min="1" className="field w-28" value={d.prefs.processing_days} onChange={(e) => set('prefs', 'processing_days', Number(e.target.value))} />
      </Card>

      <Card title="Preferences">
        <Toggle label="Dark mode" hint="Saved on this device." checked={dark} onChange={setDark} />
        <label className="mb-1 mt-2 block text-sm font-medium" htmlFor="cc">Default country code for WhatsApp</label>
        <input id="cc" inputMode="numeric" className="field w-28" value={d.prefs.country_code} onChange={(e) => set('prefs', 'country_code', e.target.value.replace(/\D/g, ''))} />
        <p className="mt-1 text-sm text-slate-500">Used when an applicant's number starts with 0 (e.g. 05… becomes 966…).</p>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-night/95 md:left-56">
        {dirty && <span className="mr-auto text-sm text-slate-500">Unsaved changes</span>}
        <button className="btn-ghost" disabled={!dirty} onClick={() => setD(structuredClone(settings))}><RotateCcw size={15} />Discard</button>
        <button className="btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save settings</button>
      </div>
    </div>
  )
}
