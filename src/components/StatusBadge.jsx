import { STATUSES } from '../lib/utils'
export default function StatusBadge({ status }) {
  const s = STATUSES[status] || STATUSES.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  )
}
