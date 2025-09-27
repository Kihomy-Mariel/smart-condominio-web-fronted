// services/guardias.service.ts
// Estilo alineado con tu ejemplo de copropietarios.service.ts
// Usa una instancia compartida `api` y helpers para tolerar backend con/sin paginación.

import { api } from './api'

// --- Tipos base (según tu serializer) ---------------------------------------
export type GuardiaTurno = 'DIA' | 'NOCHE' | 'ROTATIVO'

export type Guardia = {
  id: number
  nombre: string
  apellido: string
  carnet: string
  correo: string
  telefono: string
  usuario: string // read-only generado en backend
  turno: GuardiaTurno
  empresa: string
  puesto: string
  created_at: string
  updated_at: string
}

export type CreateGuardiaInput = {
  nombre: string
  apellido: string
  carnet: string
  correo: string
  telefono?: string
  turno?: GuardiaTurno // default backend = 'ROTATIVO'
  empresa?: string
  puesto?: string
  new_password?: string // si no envías, backend usará carnet
}

export type UpdateGuardiaInput = Partial<CreateGuardiaInput>

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // ej: 'apellido' | '-created_at'
  turno?: GuardiaTurno // (si implementas filtro en backend)
}

// --- Helpers para tolerar backend con/sin paginación ------------------------
type DRFPaginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray(data.results)) return { total: data.count ?? data.results.length, results: data.results }
  return { total: 0, results: [] }
}

// Nota de rutas: en tu ejemplo usas paths "sin /api". Mantengo ese patrón.
const BASE = '/guardias/'

// --- CRUD ------------------------------------------------------------------
export async function listGuardias(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'apellido' } = params
  const { data } = await api.get(BASE, {
    params: { page, page_size, search, ordering, turno: params.turno },
  })
  return normalizeList<Guardia>(data)
}

export async function getGuardia(id: number) {
  const { data } = await api.get(`${BASE}${id}/`)
  return data as Guardia
}

export async function createGuardia(input: CreateGuardiaInput) {
  const { data } = await api.post(BASE, input)
  return data as Guardia
}

export async function updateGuardia(id: number, input: UpdateGuardiaInput) {
  const { data } = await api.patch(`${BASE}${id}/`, input)
  return data as Guardia
}

export async function deleteGuardia(id: number) {
  await api.delete(`${BASE}${id}/`)
  return true
}

// --- Helper específico ------------------------------------------------------
/** Cambia la contraseña del guardia usando el campo write-only `new_password`. */
export async function changeGuardiaPassword(id: number, new_password: string) {
  return updateGuardia(id, { new_password })
}

// --- Ejemplos de uso --------------------------------------------------------
// import { setAuthToken } from './api' // si tu instancia `api` expone esto
// setAuthToken(jwt)
// const { results } = await listGuardias({ page: 1, page_size: 20, ordering: 'apellido,nombre' })
// const nuevo = await createGuardia({ nombre:'Ana', apellido:'Roca', carnet:'789', correo:'ana@x.com' })
// await changeGuardiaPassword(nuevo.id, 'ClaveSegura2025!')
// await deleteGuardia(nuevo.id)
