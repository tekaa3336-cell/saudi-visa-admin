import { useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAILS?.split(',')[0] || '')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    setErr((await signIn(email, password)) || ''); setBusy(false)
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <div className="hidden bg-pine-900 p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="flex items-center gap-2 text-sand-400"><ShieldCheck size={22} /><span className="font-semibold">Visa Desk</span></div>
        <div>
          <p className="max-w-md text-4xl font-semibold leading-tight">Every application, one queue.</p>
          <p className="mt-3 max-w-sm text-white/60">Review passports, decide in one click, and send the visa out.</p>
        </div>
        <p className="text-xs text-white/40">Staff access only</p>
      </div>
      <form onSubmit={submit} className="m-auto w-full max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <div><label className="mb-1 block text-sm">Email</label>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></div>
        <div><label className="mb-1 block text-sm">Password</label>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" autoFocus /></div>
        {err && <p role="alert" className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">{err}</p>}
        <button className="btn-primary w-full justify-center" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} Sign in
        </button>
      </form>
    </div>
  )
}
