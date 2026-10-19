import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const FIELDS = [['full_name', 'Full name *'], ['nationality', 'Nationality'], ['passport_number', 'Passport number *'],
  ['email', 'Email', 'email'], ['phone', 'Phone'], ['country_of_residence', 'Country of residence']]

export default function NewApplicationModal({ services, onCreate, onClose, notify }) {
  const [v, setV] = useState({ full_name: '', nationality: '', passport_number: '', email: '', phone: '', country_of_residence: '', service_id: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    if (!v.full_name.trim() || !v.passport_number.trim()) return setErr('Name and passport number are required')
    setBusy(true)
    const clean = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]))
    const e2 = await onCreate(clean)
    setBusy(false)
    if (e2) setErr(e2); else { notify('Application created'); onClose() }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-night dark:ring-1 dark:ring-white/10" aria-label="New application">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">New application</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, label, type = 'text']) => (
            <div key={k}><label className="mb-1 block text-xs text-slate-500" htmlFor={`n-${k}`}>{label}</label>
              <input id={`n-${k}`} className="field" type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} autoFocus={k === 'full_name'} /></div>
          ))}
          <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-500" htmlFor="n-service">Visa service</label>
            <select id="n-service" className="field" value={v.service_id} onChange={(e) => setV({ ...v, service_id: e.target.value })}>
              <option value="">{services.length ? 'Select a service…' : 'No services found'}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
        </div>
        {err && <p role="alert" className="mt-3 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Create</button>
        </div>
      </form>
    </div>
  )
}
