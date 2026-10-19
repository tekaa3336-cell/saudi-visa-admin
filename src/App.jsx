import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, FileStack, Briefcase, Settings as SettingsIcon, LogOut, Sun, Moon } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useApplications } from './hooks/useApplications'
import { useSettings, DEFAULTS } from './hooks/useSettings'
import { useHashRoute } from './hooks/useHashRoute'
import { beep } from './lib/notify'
import Login from './components/Login'
import DetailView from './components/DetailView'
import LiveBadge from './components/LiveBadge'
import Toasts from './components/Toasts'
import Overview from './pages/Overview'
import Applications from './pages/Applications'
import Services from './pages/Services'
import Settings from './pages/Settings'

const NAV = [[LayoutDashboard, 'Overview', 'overview'], [FileStack, 'Applications', 'applications'], [Briefcase, 'Services', 'services'], [SettingsIcon, 'Settings', 'settings']]

export default function App() {
  const { user, isAdmin, loading, signOut } = useAuth()
  const route = useHashRoute()
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [toasts, setToasts] = useState([])
  const [openId, setOpenId] = useState(null)
  const ready = !!user && isAdmin

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('theme', dark ? 'dark' : 'light') }, [dark])

  const push = useCallback((t) => {
    const id = crypto.randomUUID(); setToasts((x) => [...x, { id, ...t }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 6000)
  }, [])
  const notify = useCallback((title, type) => push({ title, type: type || (/fail|error|could not/i.test(title) ? 'error' : 'success') }), [push])

  const { settings, loading: settingsLoading, error: settingsError, saving, save } = useSettings(ready)
  const cfg = settings ?? DEFAULTS

  const { rows, services, reloadServices, loading: rowsLoading, error, live, reload, update, create, remove } = useApplications({
    enabled: ready,
    onNew: (r) => {
      if (cfg.notifications.toast_new) push({ type: 'new', title: 'New application', body: `${r.full_name || 'Applicant'} · ${r.visa_type || 'Visa'}`, row: r })
      if (cfg.notifications.sound_new) beep()
    },
  })

  const pending = rows.filter((r) => r.status === 'pending').length
  const open = useCallback((r) => setOpenId(r.id), [])

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>
  if (!user) return <Login />
  if (!isAdmin) return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div><p className="mb-3">This account does not have admin access.</p><button className="btn-ghost" onClick={signOut}>Sign out</button></div>
    </div>
  )

  const current = rows.find((r) => r.id === openId)
  const title = NAV.find(([, , k]) => k === route)[1]

  return (
    <div className="flex min-h-screen">
      <nav className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-pine-900 p-4 text-white md:flex" aria-label="Main">
        <div className="mb-8 px-2 text-lg font-semibold text-sand-400">Visa Desk</div>
        <ul className="space-y-1">
          {NAV.map(([Icon, label, key]) => (
            <li key={key}><a href={`#/${key}`} aria-current={route === key ? 'page' : undefined} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${route === key ? 'bg-white/10' : 'text-white/60 hover:bg-white/5'}`}>
              <Icon size={16} />{label}
              {key === 'applications' && pending > 0 && <span className="ml-auto rounded-full bg-sand-500 px-2 text-xs font-semibold text-pine-950">{pending}</span>}
            </a></li>
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
          <div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{title}</h1><LiveBadge live={live} className="text-slate-500 md:hidden" /></div>
          <div className="flex gap-2">
            <button className="btn-ghost md:hidden" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button>
            <button className="btn-ghost" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          </div>
        </header>
        <div className="flex gap-1 md:hidden">
          {NAV.map(([, label, key]) => <a key={key} href={`#/${key}`} className={`rounded-full px-3 py-1 text-sm ${route === key ? 'bg-pine-800 text-white' : 'border border-slate-300 dark:border-white/15'}`}>{label}</a>)}
        </div>

        {route === 'overview' && <Overview rows={rows} loading={rowsLoading} onOpen={open} />}
        {route === 'applications' && (
          <Applications rows={rows} loading={rowsLoading} error={error} reload={reload} onOpen={open} onUpdate={update} onDelete={remove}
            onCreate={create} notify={notify} services={services} />
        )}
        {route === 'services' && <Services rows={rows} notify={notify} onChanged={reloadServices} />}
        {route === 'settings' && (
          <Settings settings={settings} loading={settingsLoading} error={settingsError} saving={saving} onSave={save} rows={rows} notify={notify} dark={dark} setDark={setDark} />
        )}
      </main>

      {current && <DetailView key={current.id} row={current} live={live} cc={cfg.prefs.country_code}
        onClose={() => setOpenId(null)} onUpdate={update} onDelete={remove} notify={notify} />}
      <Toasts items={toasts} dismiss={(id) => setToasts((x) => x.filter((t) => t.id !== id))} open={open} />
    </div>
  )
}
