// services/admins.service.ts
import { api } from './api'

export type Admin = {
  id: number
  nombres: string
  apellido: string
  carnet: string
  telefono: string
  direccion: string
  usuario: string // generado en backend (read-only)
  email: string
}

export type CreateAdminInput = {
  nombres: string
  apellido: string
  carnet: string
  telefono?: string
  direccion?: string
  email?: string
  password?: string // opcional; si no se envía, backend usará el carnet
}

export type UpdateAdminInput = Partial<Omit<CreateAdminInput, 'carnet'>> & {
  // por defecto permitimos cambiar telefono/direccion/email/nombres/apellido/password
  // evita cambiar 'carnet' si tu negocio no lo permite; si SÍ quieres permitirlo, remueve el Omit
  carnet?: string
}

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // ej: "apellido" o "-apellido"
}

type DRFPaginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// --- Helper para tolerar backend con/sin paginación ---
function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray(data.results)) {
    return { total: data.count ?? data.results.length, results: data.results }
  }
  return { total: 0, results: [] }
}

// LIST
export async function listAdmins(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'apellido' } = params
  const { data } = await api.get<DRFPaginated<Admin> | Admin[]>('/admins/', {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Admin>(data)
}

// RETRIEVE
export async function getAdmin(id: number) {
  const { data } = await api.get<Admin>(`/admins/${id}/`)
  return data
}

// CREATE
export async function createAdmin(input: CreateAdminInput) {
  // No enviar 'usuario' porque es read-only y lo genera el backend
  const { data } = await api.post<Admin>('/admins/', input)
  return data
}

// UPDATE (PATCH)
export async function updateAdmin(id: number, input: UpdateAdminInput) {
  // PATCH parcial; si incluyes password aquí, el backend hará set_password
  const { data } = await api.patch<Admin>(`/admins/${id}/`, input)
  return data
}

// DELETE
export async function deleteAdmin(id: number) {
  await api.delete(`/admins/${id}/`)
  return true
}

// Atajos útiles
export async function changeAdminPassword(id: number, newPassword: string) {
  const { data } = await api.patch<Admin>(`/admins/${id}/`, { password: newPassword })
  return data
}

