// services/copropietarios.service.ts
import { api } from './api'

export type Copropietario = {
  id: number
  nombre: string
  apellido: string
  carnet: string
  correo: string
  usuario: string // read-only generado en backend
}

export type CreateCopropietarioInput = {
  nombre: string
  apellido: string
  carnet: string
  correo: string
  new_password?: string
}

export type UpdateCopropietarioInput = Partial<CreateCopropietarioInput>

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // "apellido" o "-apellido", etc.
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
  if (data && Array.isArray(data.results)) return { total: data.count ?? data.results.length, results: data.results }
  return { total: 0, results: [] }
}

export async function listCopropietarios(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'apellido' } = params
  const { data } = await api.get('/copropietarios/', { // ← sin /api
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Copropietario>(data)
}

export async function getCopropietario(id: number) {
  const { data } = await api.get(`/copropietarios/${id}/`) // ← slash final
  return data
}

export async function createCopropietario(input: CreateCopropietarioInput) {
  const { data } = await api.post('/copropietarios/', input)
  return data
}

export async function updateCopropietario(id: number, input: UpdateCopropietarioInput) {
  const { data } = await api.patch(`/copropietarios/${id}/`, input)
  return data
}

export async function deleteCopropietario(id: number) {
  await api.delete(`/copropietarios/${id}/`)
  return true
}