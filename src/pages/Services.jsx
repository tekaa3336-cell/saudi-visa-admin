import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Briefcase } from 'lucide-react'
import { useServices } from '../hooks/useServices'
import ServiceModal from '../components/ServiceModal'
import Switch from '../components/Switch'
import Confirm from '../components/Confirm'
import { Skeleton, EmptyState } from '../components/Skeleton'
import { fmtNum } from '../lib/utils'

export default function Services({ rows, notify, onChanged }) {
  const { items, loading, error, create, update, setAvailable, remove } = useServices(true)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit
  const [askDel, setAskDel] = useState(null)

  const view = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? items.filter((s) => [s.name, s.code].some((v) => String(v).toLowerCase().includes(t))) : items
  }, [items, q])
  const usage = (s) => rows.filter((r) => String(r.service_id) === String(s.code) || String(r.service_id) === String(s.id)).length

  const save = async (v) => { const err = editing ? await update(editing.id, v) : await create(v); if (!err) onChanged?.(); return err }
  const toggle = async (s, on) => {
    const err = await setAvailable(s.id, on)
    notify(err ? `Update failed: ${err}` : `${s.name}: ${on ? 'Available' : 'Unavailable'}`, err ? 'error' : 'success')
    if (!err) onChanged?.()
  }
  const del = async () => {
    const s = askDel; const err = await remove(s.id); setAskDel(null)
    notify(err ? `Delete failed: ${err}` : `${s.name} deleted`, err ? 'error' : 'success')
    if (!err) onChanged?.()
  }
  const used = askDel ? usage(askDel) : 0

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="field pl-9" placeholder="Search services…" aria-label="Search services" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => setEditing(null)}><Plus size={16} />Add new service</button>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
        {error && <p className="m-3 rounded-md bg-rose-100 p-3 text-sm text-rose-900">Could not load services: {error}. Run supabase/services_management.sql in the Supabase SQL editor.</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400">
              <tr>{['Service name', 'Category / type', 'Service fee', 'Government fee', 'Total cost', 'Availability', 'Actions'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-white/5">{[40, 24, 16, 16, 16, 28, 20].map((w, j) => <td key={j} className="p-3"><Skeleton className={`h-4 w-${w}`} /></td>)}</tr>
              ))}
              {view.map((s) => (
                <tr key={s.id} onClick={() => setEditing(s)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                  <td className="p-3"><div className="font-medium" dir="auto">{s.name || '—'}</div>{s.description && <div className="max-w-xs truncate text-xs text-slate-500" dir="auto">{s.description}</div>}</td>
                  <td className="p-3"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-white/10">{s.code || '—'}</code></td>
                  <td className="p-3 tabular-nums">{fmtNum(s.service_fee)}</td>
                  <td className="p-3 tabular-nums">{fmtNum(s.government_fee)}</td>
                  <td className="p-3 font-medium tabular-nums">{fmtNum(s.total_cost)}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.available} onChange={(on) => toggle(s, on)} label={s.available ? 'Available: switch off to mark unavailable' : 'غير متوفرة حالياً: switch on to make available'} />
                      <div className="leading-tight"><div className={s.available ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}>{s.available ? 'Available' : 'Unavailable'}</div>
                        {!s.available && <div className="text-xs text-slate-500" dir="rtl">غير متوفرة حالياً</div>}</div>
                    </div>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <button className="btn-ghost px-2" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={15} /></button>
                      <button className="btn-ghost px-2 text-rose-700 dark:text-rose-300" aria-label={`Delete ${s.name}`} onClick={() => setAskDel(s)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !error && items.length === 0 && <EmptyState icon={Briefcase} title="No services yet" body="Add the visa services applicants can choose from." action={<button className="btn-primary" onClick={() => setEditing(null)}><Plus size={16} />Add new service</button>} />}
          {!loading && items.length > 0 && view.length === 0 && <EmptyState icon={Search} title="No services match" body="Try a different search." />}
        </div>
      </section>

      {editing !== undefined && <ServiceModal service={editing} onSave={save} onClose={() => setEditing(undefined)} notify={notify} />}
      {askDel && (
        <Confirm title="Delete this service? / حذف الخدمة؟" confirmLabel="Delete / حذف" onConfirm={del} onCancel={() => setAskDel(null)}
          body={`Are you sure you want to delete this service? / هل أنت متأكد من الحذف؟ "${askDel.name}"${used ? ` is used by ${used} application(s); they will keep their service code but it will no longer match a service.` : ' cannot be recovered.'}`} />
      )}
    </>
  )
}
