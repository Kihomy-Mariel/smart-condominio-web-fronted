// services/avisos.service.ts
import { api } from './api'

// === Tipos ===
export type Aviso = {
  id: number
  titulo: string
  detalle: string
  fecha: string        // 'YYYY-MM-DD' (DRF DateField)
  administrador: number // FK (id)
}

export type CreateAvisoInput = {
  titulo: string
  detalle: string
  fecha: string | Date   // aceptamos Date y lo convertimos
  administrador: number
}

export type UpdateAvisoInput = Partial<CreateAvisoInput>

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // p.ej. "-fecha"
}

// --- Helpers ---
function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray(data.results)) {
    return { total: data.count ?? data.results.length, results: data.results }
  }
  return { total: 0, results: [] }
}

function toYMD(input: string | Date): string {
  if (input instanceof Date) {
    const y = input.getFullYear()
    const m = String(input.getMonth() + 1).padStart(2, '0')
    const d = String(input.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // asume que ya viene 'YYYY-MM-DD' o algo compatible
  const s = (input || '').toString().trim()
  // si viene con tiempo 'YYYY-MM-DDTHH:mm', recortamos
  if (s.length >= 10) return s.slice(0, 10)
  return s
}

// === CRUD ADMIN (protegido) ===
const BASE = '/avisos/'

export async function listAvisos(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = '-fecha' } = params
  const { data } = await api.get(BASE, {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Aviso>(data)
}

export async function getAviso(id: number) {
  const { data } = await api.get(`${BASE}${id}/`)
  return data as Aviso
}

export async function createAviso(input: CreateAvisoInput) {
  const payload = {
    ...input,
    titulo: input.titulo.trim(),
    detalle: input.detalle.trim(),
    fecha: toYMD(input.fecha),
  }
  const { data } = await api.post(BASE, payload)
  return data as Aviso
}

export async function updateAviso(id: number, input: UpdateAvisoInput) {
  const payload: UpdateAvisoInput = {
    ...input,
    titulo: input.titulo?.trim(),
    detalle: input.detalle?.trim(),
    fecha: input.fecha != null ? toYMD(input.fecha) : undefined,
  }
  const { data } = await api.patch(`${BASE}${id}/`, payload)
  return data as Aviso
}

export async function deleteAviso(id: number) {
  await api.delete(`${BASE}${id}/`)
  return true
}

// === MÓVIL (libre) ===
// GET /api/mobile/avisos/por-administrador/?administrador_id=#
export async function listAvisosPorAdministrador(
  administradorId: number,
  params: { page?: number; page_size?: number } = {}
) {
  const { page = 1, page_size = 10 } = params
  const { data } = await api.get('/mobile/avisos/por-administrador/', {
    params: { administrador_id: administradorId, page, page_size },
  })
  return normalizeList<Aviso>(data)
}
