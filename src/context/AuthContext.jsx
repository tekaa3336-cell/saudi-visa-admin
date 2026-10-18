import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, ADMIN_EMAILS } from '../lib/supabase'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const email = session?.user?.email?.toLowerCase()
  const isAdmin = !!email && ADMIN_EMAILS.includes(email)

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message
  }
  const signOut = () => supabase.auth.signOut()

  return <Ctx.Provider value={{ session, user: session?.user, isAdmin, loading, signIn, signOut }}>{children}</Ctx.Provider>
}
