// services/espacioscomunes.service.ts
import { api } from './api'

export type EstadoEspacio = 'ACTIVO' | 'INACTIVO'

export type EspacioComun = {
  id: number
  nombre: string
  descripcion?: string | null
  estado: EstadoEspacio
  /** base64 opcional (texto plano, no multipart) */
  foto?: string | null
}

export type CreateEspacioComunInput = {
  nombre: string
  descripcion?: string
  estado?: EstadoEspacio // default en backend: ACTIVO
  foto?: string | null    // opcional, base64
}

export type UpdateEspacioComunInput = Partial<CreateEspacioComunInput>

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // p.ej. "nombre" o "-nombre"
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
 * ADMIN (protegido: IsAuthenticated + IsAdminUser)
 * GET /api/espacioscomunes/
 * Nota: el ViewSet ordena por 'nombre' en el backend.
 */
export async function listEspaciosComunes(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'nombre' } = params
  const { data } = await api.get('/espacioscomunes/', {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<EspacioComun>(data)
}

/**
 * ADMIN
 * GET /api/espacioscomunes/:id/
 */
export async function getEspacioComun(id: number) {
  const { data } = await api.get(`/espacioscomunes/${id}/`)
  return data as EspacioComun
}

/**
 * ADMIN
 * POST /api/espacioscomunes/
 * Enviar 'foto' como string base64 (texto), no multipart.
 */
export async function createEspacioComun(input: CreateEspacioComunInput) {
  const payload = {
    ...input,
    nombre: (input.nombre ?? '').trim(),
  }
  const { data } = await api.post('/espacioscomunes/', payload)
  return data as EspacioComun
}

/**
 * ADMIN
 * PATCH /api/espacioscomunes/:id/
 */
export async function updateEspacioComun(
  id: number,
  input: UpdateEspacioComunInput
) {
  const payload = {
    ...input,
    ...(input.nombre !== undefined ? { nombre: (input.nombre ?? '').trim() } : {}),
  }
  const { data } = await api.patch(`/espacioscomunes/${id}/`, payload)
  return data as EspacioComun
}

/**
 * ADMIN
 * DELETE /api/espacioscomunes/:id/
 */
export async function deleteEspacioComun(id: number) {
  await api.delete(`/espacioscomunes/${id}/`)
  return true
}

/**
 * ADMIN helper rápido para alternar estado ACTIVO/INACTIVO
 */
export async function toggleEstadoEspacioComun(
  id: number,
  estadoActual: EstadoEspacio
) {
  const nuevo = estadoActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
  const { data } = await api.patch(`/espacioscomunes/${id}/`, { estado: nuevo })
  return data as EspacioComun
}

/**
 * MÓVIL/PÚBLICO (AllowAny)
 * GET /api/mobile/espacioscomunes/  -> solo ACTIVO (según tu ViewSet móvil)
 * Útil si deseas mostrar catálogo público en web también.
 */
export async function listEspaciosComunesPublic(
  params: Partial<Pick<ListParams, 'page' | 'page_size'>> = {}
) {
  const { page = 1, page_size = 10 } = params
  const { data } = await api.get('/mobile/espacioscomunes/', {
    params: { page, page_size },
  })
  return normalizeList<EspacioComun>(data)
}