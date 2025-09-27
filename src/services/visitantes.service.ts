// services/visitantes.service.ts
// Solo lectura (GET / listar / buscar). Sin crear, editar ni eliminar.
// Endpoints (según tu backend):
//   Base pública móvil:      /mobile/visitantes/
//   Acción por fecha (GET):  /mobile/visitantes/por-fecha/?fecha=YYYY-MM-DD
//   Filtro soportado:        ?copropietario=<id>
// NOTA: seguimos tu convención de NO anteponer '/api' en la ruta (lo maneja api.ts)

import { api } from './api'

export type VisitanteEstado = 0 | 1 | 2 // 0=pending, 1=ingreso, 2=salio

export type Visitante = {
  id: number
  nombre: string
  fechaIngreso: string // YYYY-MM-DD
  fechaSalida: string | null
  horaIngreso: string // HH:MM:SS
  horaSalida: string | null
  placa: string
  estado: VisitanteEstado
  estado_texto: 'pendiente' | 'ingreso' | 'salio'
  foto1_b64: string // puede venir con o sin prefix data:
  foto2_b64: string
  copropietario: number
  created_at: string
  updated_at: string
}

export type ListParams = {
  page?: number
  page_size?: number
  // Aunque el backend no implementa SearchFilter, mantenemos la firma por consistencia
  search?: string
  ordering?: string
  copropietario?: number
}

type DRFPaginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// --- Helpers para tolerar backend con/sin paginación ---
export function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray((data as DRFPaginated<T>).results)) {
    return { total: (data as DRFPaginated<T>).count ?? (data as DRFPaginated<T>).results.length, results: (data as DRFPaginated<T>).results }
  }
  return { total: 0, results: [] }
}

// Convierte base64 (con o sin encabezado) a src usable en <img>
export function b64ToImgSrc(b64: string, mime = 'image/jpeg'): string {
  if (!b64) return ''
  if (b64.startsWith('data:')) return b64
  return `data:${mime};base64,${b64}`
}

const BASE = '/mobile/visitantes/'

// --- Solo lectura -----------------------------------------------------------
export async function listVisitantes(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering, copropietario } = params
  const { data } = await api.get(BASE, {
    params: { page, page_size, search, ordering, copropietario },
  })
  return normalizeList<Visitante>(data)
}

export async function getVisitante(id: number) {
  const { data } = await api.get(`${BASE}${id}/`)
  return data as Visitante
}

// Búsqueda por fecha exacta de ingreso (backend soportado)
export async function listVisitantesPorFecha(fechaISO: string, params: Omit<ListParams, 'search' | 'ordering'> = {}) {
  const { page = 1, page_size = 10, copropietario } = params
  const { data } = await api.get(`${BASE}por-fecha/`, {
    params: { fecha: fechaISO, page, page_size, copropietario },
  })
  return normalizeList<Visitante>(data)
}

// NOTA: intencionalmente NO exportamos create/update/delete para mantenerlo de solo lectura.
