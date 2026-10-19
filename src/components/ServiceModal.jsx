import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import Switch from './Switch'

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2)

export default function ServiceModal({ service, onSave, onClose, notify }) {
  const editing = !!service
  const [v, setV] = useState(() => service
    ? { name: service.name, code: service.code, description: service.description, service_fee: service.service_fee, government_fee: service.government_fee, total_cost: service.total_cost, available: service.available }
    : { name: '', code: '', description: '', service_fee: '', government_fee: '', total_cost: '', available: true })
  // total follows service + government fee until the admin types a different total
  const [auto, setAuto] = useState(() => !service || Math.abs(service.total_cost - (service.service_fee + service.government_fee)) < 0.005)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])

  const set = (k, val) => setV((x) => {
    const n = { ...x, [k]: val }
    if (auto && (k === 'service_fee' || k === 'government_fee')) n.total_cost = money((Number(n.service_fee) || 0) + (Number(n.government_fee) || 0))
    return n
  })
  const submit = async (e) => {
    e.preventDefault()
    if (!v.name.trim()) return setErr('Name is required')
    if (!editing && !v.code.trim()) return setErr('Category / code is required (e.g. family_visit)')
    setBusy(true)
    const e2 = await onSave({ ...v, name: v.name.trim(), code: v.code.trim(), description: v.description.trim() })
    setBusy(false)
    if (e2) setErr(e2); else { notify(editing ? 'Service updated' : 'Service created'); onClose() }
  }
  const num = (k, label) => (
    <div><label className="mb-1 block text-xs text-slate-500" htmlFor={`s-${k}`}>{label}</label>
      <input id={`s-${k}`} className="field" type="number" min="0" step="0.01" value={v[k]} onChange={(e) => { if (k === 'total_cost') setAuto(false); set(k, e.target.value) }} /></div>
  )

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-night dark:ring-1 dark:ring-white/10" aria-label={editing ? 'Edit service' : 'New service'}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{editing ? 'Edit service' : 'Add new service'}</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="space-y-3">
          <div><label className="mb-1 block text-xs text-slate-500" htmlFor="s-name">Name *</label>
            <input id="s-name" dir="auto" className="field" value={v.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
          <div><label className="mb-1 block text-xs text-slate-500" htmlFor="s-code">Category / code *</label>
            <input id="s-code" className="field disabled:opacity-60" value={v.code} disabled={editing} placeholder="family_visit"
              onChange={(e) => set('code', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, ''))} />
            <p className="mt-1 text-xs text-slate-500">{editing ? 'The code cannot be changed: existing applications reference it.' : 'Saved as applications.service_id, so keep it short and stable.'}</p></div>
          <div><label className="mb-1 block text-xs text-slate-500" htmlFor="s-desc">Description</label>
            <textarea id="s-desc" dir="auto" rows={3} className="field" value={v.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {num('service_fee', 'Service fee')}{num('government_fee', 'Government fee')}{num('total_cost', 'Total cost')}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); if (e.target.checked) set('service_fee', v.service_fee) }} />Total = service fee + government fee</label>
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-white/15">
            <div><div className="text-sm font-medium">{v.available ? 'Available' : 'Currently unavailable'}</div><div className="text-xs text-slate-500" dir="rtl">{v.available ? 'متوفرة' : 'غير متوفرة حالياً'}</div></div>
            <Switch checked={v.available} onChange={(x) => set('available', x)} label="Availability" />
          </div>
        </div>
        {err && <p role="alert" className="mt-3 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}{editing ? 'Save changes' : 'Create service'}</button>
        </div>
      </form>
    </div>
  )
}
