import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function Confirm({ title, body, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    // capture phase so Esc closes only this dialog, not the view behind it
    const h = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel() } }
    window.addEventListener('keydown', h, true); return () => window.removeEventListener('keydown', h, true)
  }, [onCancel])
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-night dark:ring-1 dark:ring-white/10">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel} autoFocus>Cancel</button>
          <button className="btn bg-rose-700 text-white hover:bg-rose-600" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false) }}>
            {busy && <Loader2 size={15} className="animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
