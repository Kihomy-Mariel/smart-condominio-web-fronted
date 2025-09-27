import { api, setAccessToken } from './api'
import { storage } from './storage'
import type { AdminUser, LoginResponse } from './types'

export async function login(usuario: string, password: string): Promise<{ user: AdminUser; access: string; refresh: string }> {
  const { data } = await api.post<LoginResponse>('/auth/login/', { usuario: usuario, password })
  const user: AdminUser = {
    id: data.id,
    usuario: data.usuario,
    nombres: data.nombres,
    apellido: data.apellido,
    carnet: data.carnet,
    telefono: data.telefono,
    direccion: data.direccion,
    email: data.email,
  }
  storage.setAccess(data.access)
  storage.setRefresh(data.refresh)
  setAccessToken(data.access)
  return { user, access: data.access, refresh: data.refresh }
}

export async function me(): Promise<AdminUser> {
  const { data } = await api.get('/auth/me/')
  // MeView retorna: id, username, first_name, last_name, email
  const u: AdminUser = {
    id: data.id,
    usuario: data.username,
    nombres: data.first_name,
    apellido: data.last_name,
    email: data.email || '',
  }
  return u
}

export async function refreshAccess(): Promise<string> {
  const refresh = storage.getRefresh()
  if (!refresh) throw new Error('No refresh token')
  const { data } = await api.post('/auth/refresh/', { refresh })
  const newAccess: string = data.access
  storage.setAccess(newAccess)
  setAccessToken(newAccess)
  return newAccess
}

export async function logout(): Promise<void> {
  const refresh = storage.getRefresh()
  try {
    if (refresh) await api.post('/auth/logout/', { refresh })
  } catch (_) { /* no-op */ }
  storage.clear()
  setAccessToken(null)
}
