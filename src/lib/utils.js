export const STATUSES = {
  pending:       { label: 'Pending',       dot: 'bg-amber-500',   cls: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200' },
  approved:      { label: 'Approved',      dot: 'bg-emerald-600', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200' },
  rejected:      { label: 'Rejected',      dot: 'bg-rose-600',    cls: 'bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-200' },
  action_needed: { label: 'Action needed', dot: 'bg-sky-600',     cls: 'bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200' },
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0)
export const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString()
export const fmtNum = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? undefined : Number(n).toFixed(2))
