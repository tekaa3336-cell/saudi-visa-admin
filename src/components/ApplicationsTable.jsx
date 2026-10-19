import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Download, X, Check, XCircle, MessageSquareWarning, RefreshCw, Trash2, Inbox, SearchX, ChevronDown } from 'lucide-react'
import { Skeleton, EmptyState } from './Skeleton'
import Confirm from './Confirm'
import { STATUSES, fmtDate, fmtNum } from '../lib/utils'
import { exportCsv, exportXlsx } from '../lib/export'

const PAGE = 50
const empty = { q: '', status: 'all', visa: 'all', from: '', to: '' }

export default function ApplicationsTable({ rows, loading, error, reload, onOpen, onUpdate, onDelete, notify }) {
  const [f, setF] = useState(empty)
  const [sel, setSel] = useState(new Set())
  const [limit, setLimit] = useState(PAGE)
  const [askDel, setAskDel] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => { // "/" focuses search
    const h = (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => setLimit(PAGE), [f])

  const visaTypes = useMemo(() => [...new Set(rows.map((r) => r.visa_type).filter(Boolean))], [rows])
  const counts = useMemo(() => rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {}), [rows])
  const view = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return rows.filter((r) =>
      (f.status === 'all' || r.status === f.status) && (f.visa === 'all' || r.visa_type === f.visa) &&
      (!f.from || (r.created_at || '') >= f.from) && (!f.to || (r.created_at || '') <= f.to + 'T23:59:59') &&
      (!q || [r.full_name, r.passport_number, r.email, r.phone, r.id].some((v) => String(v ?? '').toLowerCase().includes(q))))
  }, [rows, f])

  const filtered = JSON.stringify(f) !== JSON.stringify(empty)
  const allOn = view.length > 0 && view.every((r) => sel.has(r.id))
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const result = (err, ok) => notify(err ? `Update failed: ${err}` : ok, err ? 'error' : 'success')

  const bulk = async (status) => { const n = sel.size; const err = await onUpdate([...sel], { status }); result(err, `${n} application(s) set to ${STATUSES[status].label}`); if (!err) setSel(new Set()) }
  const del = async () => { const n = sel.size; const err = await onDelete([...sel]); setAskDel(false); result(err, `${n} application(s) deleted`); if (!err) setSel(new Set()) }
  const run = async (fn, list, name, e) => {
    e.currentTarget.closest('details')?.removeAttribute('open')
    if (!list.length) return notify('Nothing to export', 'error')
    await fn(list, name); notify(`Exported ${list.length} application(s)`)
  }
  const pendingRows = rows.filter((r) => r.status === 'pending')
  const selRows = rows.filter((r) => sel.has(r.id))
  const menu = [['Pending · CSV', exportCsv, pendingRows, 'pending'], ['Pending · Excel', exportXlsx, pendingRows, 'pending'],
    ['Current view · CSV', exportCsv, view, 'applications'], ['Current view · Excel', exportXlsx, view, 'applications'],
    ...(sel.size ? [['Selected · CSV', exportCsv, selRows, 'selected'], ['Selected · Excel', exportXlsx, selRows, 'selected']] : [])]

  return (
    <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="space-y-3 border-b border-slate-200 p-3 dark:border-white/10">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input ref={searchRef} className="field pl-9" placeholder="Search name, passport, email, phone…  ( / )" aria-label="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </div>
          <select className="field w-auto" value={f.visa} onChange={(e) => setF({ ...f, visa: e.target.value })} aria-label="Visa type">
            <option value="all">All visa types</option>{visaTypes.map((v) => <option key={v}>{v}</option>)}
          </select>
          <input type="date" className="field w-auto" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From date" />
          <input type="date" className="field w-auto" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To date" />
          <button className="btn-ghost" onClick={reload} aria-label="Reload"><RefreshCw size={16} /></button>
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none"><Download size={16} />Export<ChevronDown size={14} /></summary>
            <ul className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-white/15 dark:bg-night">
              {menu.map(([label, fn, list, name]) => (
                <li key={label}><button className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/10" onClick={(e) => run(fn, list, name, e)}>{label} <span className="text-slate-400">({list.length})</span></button></li>
              ))}
            </ul>
          </details>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[['all', 'All', rows.length], ...Object.entries(STATUSES).map(([k, v]) => [k, v.label, counts[k] || 0])].map(([k, label, n]) => (
            <button key={k} onClick={() => setF({ ...f, status: k })}
              className={`rounded-full border px-3 py-1 text-sm transition ${f.status === k ? 'border-pine-800 bg-pine-800 text-white' : 'border-slate-300 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10'}`}>
              {label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
          {filtered && <button className="text-sm underline" onClick={() => setF(empty)}>Clear filters</button>}
        </div>
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-pine-900 px-3 py-2 text-sm text-white">
            <span className="font-medium">{sel.size} selected</span>
            <button className="btn bg-white/10 hover:bg-white/20" onClick={() => bulk('approved')}><Check size={14} />Approve</button>
            <button className="btn bg-white/10 hover:bg-white/20" onClick={() => bulk('action_needed')}><MessageSquareWarning size={14} />Action needed</button>
            <button className="btn bg-white/10 hover:bg-white/20" onClick={() => bulk('rejected')}><XCircle size={14} />Reject</button>
            <button className="btn bg-rose-700/80 hover:bg-rose-600" onClick={() => setAskDel(true)}><Trash2 size={14} />Delete</button>
            <button className="ml-auto" aria-label="Clear selection" onClick={() => setSel(new Set())}><X size={16} /></button>
          </div>
        )}
      </div>

      {error && <p className="m-3 rounded-md bg-rose-100 p-3 text-sm text-rose-900">Could not load applications: {error}. Check the RLS policies in supabase/admin_setup.sql.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(view.map((r) => r.id)))} /></th>
              {['Applicant', 'Passport', 'Visa type', 'Submitted', 'Fee', 'Status'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-white/5">
                <td className="p-3"><Skeleton className="h-4 w-4" /></td>
                <td className="p-3"><Skeleton className="mb-1.5 h-4 w-36" /><Skeleton className="h-3 w-24" /></td>
                {[24, 20, 20, 10, 24].map((w, j) => <td key={j} className="p-3"><Skeleton className={`h-4 w-${w}`} /></td>)}
              </tr>
            ))}
            {view.slice(0, limit).map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.full_name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="p-3"><div className="font-medium">{r.full_name || '—'}</div><div className="text-xs text-slate-500">{r.email}</div></td>
                <td className="p-3 tabular-nums">{r.passport_number || '—'}</td>
                <td className="p-3">{r.visa_type || '—'}</td>
                <td className="p-3">{fmtDate(r.created_at)}</td>
                <td className="p-3 tabular-nums">{fmtNum(r.fee) ?? '—'}</td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <select aria-label={`Status for ${r.full_name}`} value={r.status}
                    onChange={async (e) => { const s = e.target.value; const err = await onUpdate(r.id, { status: s }); result(err, `${r.full_name}: ${STATUSES[s].label}`) }}
                    className={`cursor-pointer rounded-full border-0 py-1 pl-3 pr-7 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-pine-700 ${(STATUSES[r.status] || STATUSES.pending).cls}`}>
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k} className="text-slate-900">{v.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && <EmptyState icon={Inbox} title="No applications yet" body="New visa requests appear here the moment applicants submit them." />}
        {!loading && rows.length > 0 && view.length === 0 && <EmptyState icon={SearchX} title="No applications match" body="Try a different search or widen the date range." action={<button className="btn-ghost" onClick={() => setF(empty)}>Clear filters</button>} />}
      </div>
      {view.length > limit && (
        <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm dark:border-white/10">
          <span className="text-slate-500">Showing {limit} of {view.length}</span>
          <button className="btn-ghost" onClick={() => setLimit(limit + PAGE)}>Show more</button>
        </div>
      )}
      {askDel && <Confirm title={`Delete ${sel.size} application(s)?`} body="This permanently removes them from the database, and the applicants lose access to them. It cannot be undone." onConfirm={del} onCancel={() => setAskDel(false)} />}
    </section>
  )
}
