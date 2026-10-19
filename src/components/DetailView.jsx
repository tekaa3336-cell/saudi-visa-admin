import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Printer, MessageCircle, Mail, Upload, FileText, Send, Loader2, Trash2, Wand2, Pencil } from 'lucide-react'
import StatusBadge from './StatusBadge'
import LiveBadge from './LiveBadge'
import Confirm from './Confirm'
import { useAuth } from '../context/AuthContext'
import { supabase, fileUrl } from '../lib/supabase'
import { STATUSES, fmtDate } from '../lib/utils'
import { statusMessage, whatsappUrl, mailtoUrl } from '../lib/contact'

const FIELDS = (r) => [
  ['Full name', r.full_name], ['Nationality', r.nationality], ['Passport number', r.passport_number],
  ['Visa type', r.visa_type], ['Email', r.email], ['Phone', r.phone],
  ['Submitted', fmtDate(r.created_at)], ['Fee', r.fee], ['Application ID', r.id],
]

export default function DetailView({ row, live, cc, visaTypes, onClose, onUpdate, onDelete, notify }) {
  const { user } = useAuth()
  const [urls, setUrls] = useState({})
  const [status, setStatus] = useState(row.status)
  const [msg, setMsg] = useState(row.user_feedback || '')
  const [file, setFile] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const notes = row.admin_notes_log || []
  const dirty = status !== row.status || msg !== (row.user_feedback || '') || !!file

  useEffect(() => {
    Promise.all([fileUrl(row.passport_url), fileUrl(row.photo_url), fileUrl(row.visa_pdf_url, 'visa-documents')])
      .then(([passport, photo, visa]) => setUrls({ passport, photo, visa }))
  }, [row.id, row.visa_pdf_url])

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    const done = () => document.body.classList.remove('printing-summary')
    window.addEventListener('keydown', esc); window.addEventListener('afterprint', done)
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('afterprint', done) }
  }, [onClose])

  const text = msg.trim() ? statusMessage(status, row, '').split('\n').slice(0, 1).concat(msg.trim()).join('\n') : statusMessage(status, row)
  const wa = whatsappUrl(row, text, cc)
  const mail = mailtoUrl(row, status, text)

  const saveAndNotify = async () => {
    setBusy(true)
    let visa_pdf_url = row.visa_pdf_url
    if (file) {
      const path = `${row.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await supabase.storage.from('visa-documents').upload(path, file, { contentType: 'application/pdf' })
      if (error) { setBusy(false); return notify(`Upload failed: ${error.message}`) }
      visa_pdf_url = path
    }
    const err = await onUpdate(row.id, {
      ...(status !== row.status ? { status } : {}),
      user_feedback: msg, visa_pdf_url, notified_at: new Date().toISOString(),
    })
    setBusy(false); setFile(null)
    notify(err ? `Save failed: ${err}`
      : status === 'approved' && !visa_pdf_url ? 'Saved. Applicant sees "Approved" but no visa PDF is attached yet'
      : 'Saved. The applicant sees the update in their app')
  }

  const addNote = async () => {
    const t = note.trim(); if (!t) return
    const err = await onUpdate(row.id, { admin_notes_log: [{ id: crypto.randomUUID(), text: t, by: user?.email, at: new Date().toISOString() }, ...notes] })
    err ? notify(`Note failed: ${err}`) : setNote('')
  }
  const delNote = (id) => onUpdate(row.id, { admin_notes_log: notes.filter((n) => n.id !== id) })
  const print = () => { document.body.classList.add('printing-summary'); window.print() }
  const saveEdit = async (patch) => {
    const err = await onUpdate(row.id, patch)
    notify(err ? `Save failed: ${err}` : 'Details updated', err ? 'error' : 'success'); if (!err) setEditing(false)
  }
  const doDelete = async () => {
    const err = await onDelete([row.id]); setConfirmDel(false)
    if (err) notify(`Delete failed: ${err}`, 'error'); else { notify('Application deleted'); onClose() }
  }

  const Doc = ({ label, url }) => (
    <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
      {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="h-72 w-full bg-slate-100 object-contain dark:bg-black/30" /></a>
           : <div className="grid h-72 place-items-center text-sm text-slate-400">No file uploaded</div>}
      <figcaption className="border-t border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-white/10">{label}</figcaption>
    </figure>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-paper dark:bg-night print:hidden" role="dialog" aria-label="Application details">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <button className="btn-ghost" onClick={onClose}><ArrowLeft size={16} />Back</button>
          <h2 className="text-lg font-semibold">{row.full_name}</h2>
          <StatusBadge status={row.status} />
          <LiveBadge live={live} className="text-slate-500" />
          <div className="ml-auto flex flex-wrap gap-2">
            <a className={`btn bg-emerald-700 text-white hover:bg-emerald-600 ${wa ? '' : 'pointer-events-none opacity-50'}`} href={wa || undefined} target="_blank" rel="noreferrer"><MessageCircle size={16} />Open WhatsApp Chat</a>
            <a className={`btn-ghost ${mail ? '' : 'pointer-events-none opacity-50'}`} href={mail || undefined}><Mail size={16} />Email</a>
            <button className="btn-ghost" onClick={print}><Printer size={16} />Print summary</button>
            <button className="btn-ghost" onClick={() => setEditing(!editing)}><Pencil size={16} />{editing ? 'Cancel edit' : 'Edit details'}</button>
            <button className="btn-ghost text-rose-700 dark:text-rose-300" onClick={() => setConfirmDel(true)}><Trash2 size={16} />Delete</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              {editing ? <EditForm row={row} visaTypes={visaTypes} onSave={saveEdit} onCancel={() => setEditing(false)} /> : (
              <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-4 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
                {FIELDS(row).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5 text-sm"><dt className="text-slate-500">{k}</dt><dd className="break-all text-right font-medium">{v || '—'}</dd></div>
                ))}
              </dl>)}
              <section>
                <h3 className="mb-2 font-medium">Admin notes <span className="text-sm font-normal text-slate-500">(private, staff only)</span></h3>
                <textarea className="field mb-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && addNote()} placeholder="Add a note…  (Ctrl+Enter)" />
                <button className="btn-ghost mb-3" onClick={addNote} disabled={!note.trim()}>Add note</button>
                <ul className="space-y-2">
                  {notes.length === 0 && <li className="text-sm text-slate-500">No notes yet.</li>}
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-white/5">
                      <p className="whitespace-pre-wrap">{n.text}</p>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>{n.by} · {new Date(n.at).toLocaleString('en-GB')}</span>
                        <button aria-label="Delete note" onClick={() => delNote(n.id)}><Trash2 size={14} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3"><Doc label="Passport copy" url={urls.passport} /><Doc label="Applicant photo" url={urls.photo} /></div>
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="msg">Message to applicant</label>
                  <button className="flex items-center gap-1 text-sm underline" onClick={() => setMsg(statusMessage(status, row).split('\n').slice(1).join('\n'))}><Wand2 size={14} />Use template</button>
                </div>
                <textarea id="msg" dir="auto" className="field" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Shown in the user app. Also used in WhatsApp and email drafts." />
              </section>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-night">
          <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="flex min-w-[220px] flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm dark:border-white/25"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; f?.type === 'application/pdf' && setFile(f) }}>
            {file || urls.visa ? <FileText size={16} /> : <Upload size={16} />}
            <span className="truncate">{file ? file.name : urls.visa ? 'Visa PDF attached – drop to replace' : 'Drop the final visa PDF here or click to choose'}</span>
            {!file && urls.visa && <a className="ml-auto underline" href={urls.visa} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open</a>}
            <input type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <button className="btn-primary px-5 py-2.5" disabled={busy || !dirty} onClick={saveAndNotify}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Save &amp; Notify
          </button>
        </footer>
        {confirmDel && <Confirm title="Delete this application?" body="This permanently removes it from the database. It cannot be undone." onConfirm={doDelete} onCancel={() => setConfirmDel(false)} />}
      </div>
      {createPortal(<PrintSummary row={row} />, document.body)}
    </>
  )
}

// Customer-facing printout: internal notes are intentionally excluded.
function PrintSummary({ row }) {
  return (
    <div className="print-summary p-8 text-black">
      <h1 className="text-2xl font-bold">Visa Application Summary</h1>
      <p className="mb-4 text-sm">Printed {new Date().toLocaleString('en-GB')}</p>
      <p className="mb-4 text-lg">Status: <b>{STATUSES[row.status]?.label}</b></p>
      <table className="w-full border-collapse text-sm">
        <tbody>{FIELDS(row).map(([k, v]) => <tr key={k}><th className="w-1/3 border border-black p-2 text-left">{k}</th><td className="border border-black p-2">{v || '—'}</td></tr>)}</tbody>
      </table>
      {row.user_feedback && <p className="mt-4 whitespace-pre-wrap border border-black p-3" dir="auto">{row.user_feedback}</p>}
    </div>
  )
}

function EditForm({ row, visaTypes = [], onSave, onCancel }) {
  const [v, setV] = useState({ full_name: row.full_name || '', nationality: row.nationality || '', passport_number: row.passport_number || '', visa_type: row.visa_type || '', email: row.email || '', phone: row.phone || '', fee: row.fee ?? '' })
  const [busy, setBusy] = useState(false)
  const field = (k, label, type = 'text') => (
    <div key={k}><label className="mb-1 block text-xs text-slate-500" htmlFor={`e-${k}`}>{label}</label>
      <input id={`e-${k}`} className="field" type={type} value={v[k]} list={k === 'visa_type' ? 'visa-types-edit' : undefined} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
  )
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('full_name', 'Full name')}{field('nationality', 'Nationality')}{field('passport_number', 'Passport number')}
        {field('visa_type', 'Visa type')}{field('email', 'Email', 'email')}{field('phone', 'Phone')}{field('fee', 'Fee', 'number')}
      </div>
      <datalist id="visa-types-edit">{visaTypes.map((t) => <option key={t} value={t} />)}</datalist>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); await onSave({ ...v, fee: v.fee === '' ? null : Number(v.fee) }); setBusy(false) }}>
          {busy && <Loader2 size={15} className="animate-spin" />}Save details</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
