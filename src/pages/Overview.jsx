import { Inbox } from 'lucide-react'
import Kpis from '../components/Kpis'
import StatusBadge from '../components/StatusBadge'
import { Skeleton, EmptyState } from '../components/Skeleton'
import { STATUSES, fmtDate } from '../lib/utils'

export default function Overview({ rows, loading, onOpen }) {
  const total = rows.length || 1
  const recent = rows.slice(0, 8)
  return (
    <>
      <Kpis rows={rows} loading={loading} />
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-3 font-medium">Status breakdown</h2>
          <ul className="space-y-3">
            {Object.entries(STATUSES).map(([k, s]) => {
              const n = rows.filter((r) => r.status === k).length
              return (
                <li key={k}>
                  <div className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span className="tabular-nums text-slate-500">{loading ? '…' : n}</span></div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-2 rounded-full ${s.dot}`} style={{ width: `${(n / total) * 100}%` }} /></div>
                </li>
              )
            })}
          </ul>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between p-4 pb-2"><h2 className="font-medium">Latest applications</h2><a className="text-sm underline" href="#/applications">View all</a></div>
          {loading && rows.length === 0 && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
          {!loading && recent.length === 0 && <EmptyState icon={Inbox} title="Nothing to review" body="New applications show up here live." />}
          <ul>
            {recent.map((r) => (
              <li key={r.id}><button onClick={() => onOpen(r)} className="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                <div className="min-w-0"><div className="truncate font-medium">{r.full_name || '—'}</div><div className="text-xs text-slate-500">{r.visa_type || 'Visa'} · {fmtDate(r.created_at)}</div></div>
                <StatusBadge status={r.status} />
              </button></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
