import { BellRing, X } from 'lucide-react'
export default function Toasts({ items, dismiss, open }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="flex items-start gap-3 rounded-lg bg-pine-900 p-3 text-sm text-white shadow-lg">
          <BellRing size={18} className="mt-0.5 shrink-0 text-sand-400" />
          <button className="flex-1 text-left" onClick={() => { t.row && open(t.row); dismiss(t.id) }}>
            <div className="font-medium">{t.title}</div><div className="text-white/70">{t.body}</div>
          </button>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
