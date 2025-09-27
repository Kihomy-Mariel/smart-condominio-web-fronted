import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as Auth from '../services/auth.service'
import { storage } from '../services/storage'
import { setAccessToken } from '../services/api'
import type { AdminUser } from '../services/types'

interface AuthContextValue {
  user: AdminUser | null
  loading: boolean
  login: (usuario: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Al iniciar: si hay tokens, intenta validar sesión
  useEffect(() => {
    const boot = async () => {
      try {
        const access = storage.getAccess()
        if (access) {
          setAccessToken(access)
          const u = await Auth.me()
          setUser(u)
        } else if (storage.getRefresh()) {
          const newAccess = await Auth.refreshAccess()
          setAccessToken(newAccess)
          const u = await Auth.me()
          setUser(u)
        }
      } catch (_) {
        await Auth.logout()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (usuario: string, password: string) => {
      const { user: u } = await Auth.login(usuario, password)
      setUser(u)
    },
    logout: async () => {
      await Auth.logout()
      setUser(null)
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within <AuthProvider>')
  return ctx
}
