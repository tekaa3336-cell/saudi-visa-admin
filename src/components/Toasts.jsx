import { BellRing, X, CheckCircle2, AlertTriangle } from 'lucide-react'
const KIND = { success: [CheckCircle2, 'text-emerald-300', 'bg-pine-900'], error: [AlertTriangle, 'text-rose-200', 'bg-rose-900'], new: [BellRing, 'text-sand-400', 'bg-pine-900'] }

export default function Toasts({ items, dismiss, open }) {
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {items.map((t) => {
        const [Icon, tone, bg] = KIND[t.type] || KIND.success
        return (
          <div key={t.id} className={`flex items-start gap-3 rounded-lg p-3 text-sm text-white shadow-lg ${bg}`}>
            <Icon size={18} className={`mt-0.5 shrink-0 ${tone}`} />
            <button className="flex-1 text-left" onClick={() => { if (t.row) open(t.row); dismiss(t.id) }}>
              <div className="font-medium">{t.title}</div>{t.body && <div className="text-white/70">{t.body}</div>}
            </button>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={16} /></button>
          </div>
        )
      })}
    </div>
  )
}
