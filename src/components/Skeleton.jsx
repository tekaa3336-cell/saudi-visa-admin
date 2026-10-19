export const Skeleton = ({ className = '' }) => <div aria-hidden className={`animate-pulse rounded bg-slate-200 dark:bg-white/10 ${className}`} />
export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10"><Icon size={22} /></div>
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
