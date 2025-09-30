// services/residentes.service.ts
import { api } from './api'

// === Tipos ===
export type Residente = {
  id: number
  nombre: string
  apellido: string
  carnet: string
  correo: string
  celular: string
  copropietario: number // FK (id)
}

export type CreateResidenteInput = {
  nombre: string
  apellido: string
  carnet: string
  correo: string
  celular: string
  copropietario: number
}

export type UpdateResidenteInput = Partial<CreateResidenteInput>

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // e.g. "apellido" | "-apellido"
}

// --- Helpers: tolerar backend con/sin paginación ---
function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray(data.results)) {
    return { total: data.count ?? data.results.length, results: data.results }
  }
  return { total: 0, results: [] }
}

// === CRUD ADMIN (protegido con token de admin) ===
// Base: /api/residentes/ -> en api.get usamos path SIN "/api" porque `api` ya lo incluye
const BASE = '/residentes/'

export async function listResidentes(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'apellido' } = params
  const { data } = await api.get(BASE, {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Residente>(data)
}

export async function getResidente(id: number) {
  const { data } = await api.get(`${BASE}${id}/`)
  return data as Residente
}

export async function createResidente(input: CreateResidenteInput) {
  const { data } = await api.post(BASE, input)
  return data as Residente
}

export async function updateResidente(id: number, input: UpdateResidenteInput) {
  const { data } = await api.patch(`${BASE}${id}/`, input)
  return data as Residente
}

export async function deleteResidente(id: number) {
  await api.delete(`${BASE}${id}/`)
  return true
}

// === MÓVIL / PÚBLICO ===
// GET /api/mobile/residentes/por-copropietario/?copropietario_id=#
export async function listResidentesPorCopropietario(
  copropietarioId: number,
  params: { page?: number; page_size?: number } = {}
) {
  const { page = 1, page_size = 10 } = params
  const { data } = await api.get('/mobile/residentes/por-copropietario/', {
    params: { copropietario_id: copropietarioId, page, page_size },
  })
  return normalizeList<Residente>(data)
}
