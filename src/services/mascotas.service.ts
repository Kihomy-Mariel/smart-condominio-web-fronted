// services/mascotas.service.ts
import { api } from './api'

export type Mascota = {
  id: number
  nombre: string
  raza?: string | null
  color?: string | null
  foto?: string | null // base64 opcional
  casa: number         // FK al backend
}

export type CreateMascotaInput = {
  nombre: string
  casa: number
  raza?: string | null
  color?: string | null
  foto?: string | null // base64 opcional
}

export type UpdateMascotaInput = Partial<CreateMascotaInput>

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // e.g. "nombre" o "-nombre"
}

type DRFPaginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// --- Helpers para tolerar backend con/sin paginación ---
function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray(data.results)) {
    return { total: data.count ?? data.results.length, results: data.results }
  }
  return { total: 0, results: [] }
}

/**
 * ===========================
 *  ADMIN (CRUD protegido)
 *  Base: /api/ + router "mascotas"  -> en el FE usamos "/mascotas/"
 *  Requiere IsAuthenticated + IsAdminUser (JWT de admin)
 * ===========================
 */

// Listar (admin)
export async function listMascotas(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'nombre' } = params
  const { data } = await api.get<DRFPaginated<Mascota> | Mascota[]>('/mascotas/', {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Mascota>(data)
}

// Obtener (admin)
export async function getMascota(id: number) {
  const { data } = await api.get<Mascota>(`/mascotas/${id}/`) // ← slash final
  return data
}

// Crear (admin)
export async function createMascota(input: CreateMascotaInput) {
  // Sugerencia: trim básico para nombre
  const payload = { ...input, nombre: input.nombre?.trim() }
  const { data } = await api.post<Mascota>('/mascotas/', payload)
  return data
}

// Actualizar parcial (admin)
export async function updateMascota(id: number, input: UpdateMascotaInput) {
  const payload = { ...input }
  if (typeof payload.nombre === 'string') payload.nombre = payload.nombre.trim()
  const { data } = await api.patch<Mascota>(`/mascotas/${id}/`, payload)
  return data
}

// Eliminar (admin)
export async function deleteMascota(id: number) {
  await api.delete(`/mascotas/${id}/`)
  return true
}

/**
 * ===========================
 *  MÓVIL (público)
 *  Base esperada: /api/mobile/mascotas/...
 *  En tu urls.py principal se incluye "mascotas_mob_urls" bajo path("api/", ...),
 *  así que en FE llamamos a "/mobile/mascotas/..."
 * ===========================
 */

// Listado público (con paginación opcional del lado DRF)
export async function listMascotasPublic(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'nombre' } = params
  const { data } = await api.get<DRFPaginated<Mascota> | Mascota[]>('/mobile/mascotas/', {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Mascota>(data)
}

// Listado público filtrado por casa (GET /mobile/mascotas/por-casa/?casa_id=#)
export async function listMascotasPorCasa(casa_id: number, params: Omit<ListParams, 'search' | 'ordering'> = {}) {
  const { page = 1, page_size = 10 } = params
  const { data } = await api.get<DRFPaginated<Mascota> | Mascota[]>('/mobile/mascotas/por-casa/', {
    params: { casa_id, page, page_size },
  })
  return normalizeList<Mascota>(data)
}

/**
 * ===========================
 *  Utils extra (opcionales)
 * ===========================
 */

// Valida que la imagen parezca base64 simple (mismo criterio del serializer)
export function looksLikeBase64(str?: string | null) {
  if (!str) return true
  const allowed = /^[A-Za-z0-9+/=\r\n]+$/
  return allowed.test(str.trim())
}
