import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, FileStack, Settings, LogOut, Sun, Moon } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useApplications } from './hooks/useApplications'
import Login from './components/Login'
import Kpis from './components/Kpis'
import ApplicationsTable from './components/ApplicationsTable'
import DetailView from './components/DetailView'
import LiveBadge from './components/LiveBadge'
import Toasts from './components/Toasts'

export default function App() {
  const { user, isAdmin, loading, signOut } = useAuth()
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [toasts, setToasts] = useState([])
  const [openId, setOpenId] = useState(null)

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('theme', dark ? 'dark' : 'light') }, [dark])

  const push = useCallback((t) => {
    const id = crypto.randomUUID(); setToasts((x) => [...x, { id, ...t }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 7000)
  }, [])
  const notify = (title) => push({ title, body: '' })

  const { rows, loading: rowsLoading, error, live, reload, update } = useApplications({
    onNew: (r) => push({ title: 'New application', body: `${r.full_name || 'Applicant'} · ${r.visa_type || 'Visa'}`, row: r }),
  })

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>
  if (!user) return <Login />
  if (!isAdmin) return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div><p className="mb-3">This account does not have admin access.</p><button className="btn-ghost" onClick={signOut}>Sign out</button></div>
    </div>
  )

  const current = rows.find((r) => r.id === openId)
  const nav = [[LayoutDashboard, 'Overview', true], [FileStack, 'Applications'], [Settings, 'Settings']]

  return (
    <div className="flex min-h-screen">
      <nav className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-pine-900 p-4 text-white md:flex">
        <div className="mb-8 px-2 text-lg font-semibold text-sand-400">Visa Desk</div>
        <ul className="space-y-1">
          {nav.map(([Icon, label, on]) => (
            <li key={label}><a href="#" className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${on ? 'bg-white/10' : 'text-white/60 hover:bg-white/5'}`}><Icon size={16} />{label}</a></li>
          ))}
        </ul>
        <div className="mt-auto space-y-2 text-sm">
          <LiveBadge live={live} className="px-2 text-white/70" />
          <div className="truncate px-2 text-white/50">{user.email}</div>
          <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-white/70 hover:bg-white/10"><LogOut size={15} />Sign out</button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3"><h1 className="text-xl font-semibold">Applications</h1><LiveBadge live={live} className="text-slate-500 md:hidden" /></div>
          <div className="flex gap-2">
            <button className="btn-ghost md:hidden" onClick={signOut}><LogOut size={16} /></button>
            <button className="btn-ghost" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          </div>
        </header>
        <Kpis rows={rows} />
        <ApplicationsTable rows={rows} loading={rowsLoading} error={error} reload={reload} onOpen={(r) => setOpenId(r.id)} onBulk={update} notify={notify} />
      </main>
      {current && <DetailView key={current.id} row={current} live={live} onClose={() => setOpenId(null)} onUpdate={update} notify={notify} />}
      <Toasts items={toasts} dismiss={(id) => setToasts((x) => x.filter((t) => t.id !== id))} open={(r) => setOpenId(r.id)} />
    </div>
  )
}
