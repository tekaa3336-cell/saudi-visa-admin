import { useEffect, useState } from 'react'
const ROUTES = ['overview', 'applications', 'settings']
const read = () => { const r = window.location.hash.replace(/^#\/?/, ''); return ROUTES.includes(r) ? r : 'overview' }
export function useHashRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => { const h = () => setRoute(read()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  return route
}
