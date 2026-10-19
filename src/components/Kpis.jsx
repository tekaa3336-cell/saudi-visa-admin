import { Inbox, Clock, CheckCircle2, Banknote } from 'lucide-react'
import { fmtMoney, isToday } from '../lib/utils'
import { Skeleton } from './Skeleton'

export default function Kpis({ rows, loading }) {
  const pending = rows.filter((r) => r.status === 'pending').length
  const approvedToday = rows.filter((r) => r.status === 'approved' && isToday(r.reviewed_at)).length
  const revenue = rows.filter((r) => r.status === 'approved').reduce((s, r) => s + Number(r.fee || 0), 0)
  const items = [
    { icon: Inbox, label: 'Total applications', value: rows.length },
    { icon: Clock, label: 'Pending review', value: pending, hot: pending > 0 },
    { icon: CheckCircle2, label: 'Approved today', value: approvedToday },
    { icon: Banknote, label: 'Fees from approvals', value: fmtMoney(revenue) },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ icon: Icon, label, value, hot }) => (
        <div key={label} className={`rounded-lg border p-4 ${hot ? 'border-sand-500 bg-sand-400/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'}`}>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Icon size={16} />{label}</div>
          {loading ? <Skeleton className="mt-3 h-7 w-20" /> : <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>}
        </div>
      ))}
    </div>
  )
}
