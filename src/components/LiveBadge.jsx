const MAP = {
  live:       ['bg-emerald-500', 'Live'],
  connecting: ['bg-amber-500', 'Connecting…'],
  offline:    ['bg-rose-500', 'Offline – reload to resync'],
}
export default function LiveBadge({ live, className = '' }) {
  const [dot, label] = MAP[live] || MAP.connecting
  return (
    <span className={`inline-flex items-center gap-2 text-sm ${className}`} role="status">
      <span className={`h-2 w-2 rounded-full ${dot}`} />{label}
    </span>
  )
}
