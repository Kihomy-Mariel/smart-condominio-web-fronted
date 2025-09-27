// services/vehiculos.service.ts
import { api } from './api'

/** ===== Tipos ===== */
export type Vehiculo = {
  id: number
  placa: string
  marca?: string | null
  color?: string | null
  descripcion?: string | null
  casa: number            // FK: id de Casa
}

export type CreateVehiculoInput = {
  placa: string
  marca?: string | null
  color?: string | null
  descripcion?: string | null
  casa: number
}

export type UpdateVehiculoInput = Partial<CreateVehiculoInput>

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // "placa", "-placa", "marca", etc.
  casa_id?: number  // por si filtras en backend
}

type DRFPaginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** ===== Helpers ===== */

// Soporta respuestas paginadas (DRF) o listas simples
function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray((data as DRFPaginated<T>).results)) {
    const d = data as DRFPaginated<T>
    return { total: d.count ?? d.results.length, results: d.results }
  }
  return { total: 0, results: [] }
}

// Normaliza la placa antes de enviar (tu serializer ya uppercasa, pero evitamos roundtrip)
function normPlaca(s: string) {
  return (s ?? '').trim().toUpperCase()
}

/** ===== CRUD ADMIN (rutas protegidas) =====
 * Nota: aquí asumo que tu router quedó montado como `/vehiculos/`.
 * Si tu proyecto lo montó en `/api/admin/vehiculos/` u otro prefijo,
 * solo cambia la constante BASE abajo.
 */
const BASE = '/vehiculos/'

// Listar
export async function listVehiculos(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'placa', casa_id } = params
  const { data } = await api.get(BASE, {
    params: { page, page_size, search, ordering, casa_id },
  })
  return normalizeList<Vehiculo>(data)
}

// Obtener por id
export async function getVehiculo(id: number) {
  const { data } = await api.get(`${BASE}${id}/`)
  return data as Vehiculo
}

// Crear
export async function createVehiculo(input: CreateVehiculoInput) {
  const payload: CreateVehiculoInput = {
    ...input,
    placa: normPlaca(input.placa),
  }
  const { data } = await api.post(BASE, payload)
  return data as Vehiculo
}

// Actualizar parcial (PATCH)
export async function updateVehiculo(id: number, input: UpdateVehiculoInput) {
  const payload: UpdateVehiculoInput = {
    ...input,
    ...(input.placa ? { placa: normPlaca(input.placa) } : {}),
  }
  const { data } = await api.patch(`${BASE}${id}/`, payload)
  return data as Vehiculo
}

// Eliminar
export async function deleteVehiculo(id: number) {
  await api.delete(`${BASE}${id}/`)
  return true
}

/** ===== (Opcional) Endpoints públicos si usas tu ViewSet Mobile =====
 * Descomenta y ajusta el prefijo si los tienes montados.
 */
// const MOBILE_BASE = '/mobile/vehiculos/'

// export async function listVehiculosPublic(params: ListParams = {}) {
//   const { page = 1, page_size = 10, ordering = 'placa' } = params
//   const { data } = await api.get(MOBILE_BASE, { params: { page, page_size, ordering } })
//   return normalizeList<Vehiculo>(data)
// }

// export async function listVehiculosPorCasa(casa_id: number, params: ListParams = {}) {
//   const { page = 1, page_size = 10, ordering = 'placa' } = params
//   const { data } = await api.get(`${MOBILE_BASE}por-casa/`, {
//     params: { casa_id, page, page_size, ordering },
//   })
//   return normalizeList<Vehiculo>(data)
// }
