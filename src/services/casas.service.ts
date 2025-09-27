import { api } from './api'

// --- Tipos base ---
export type CasaTipo = 'CASA' | 'DEPARTAMENTO'

export type Casa = {
  id: number
  numero: string
  piso: number | null
  tipo: CasaTipo
  torre?: string | null
  bloque?: string | null
  direccion?: string | null
  area_m2?: number | string | null
  copropietario: number // id del dueño principal
}

export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string // ej: "numero", "-piso", etc., si activas OrderingFilter en DRF
}

type DRFPaginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// --- Helpers ---
function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray(data.results)) {
    return { total: data.count ?? data.results.length, results: data.results }
  }
  return { total: 0, results: [] }
}

// --- Inputs de creación/edición ---
export type CasaBaseInput = {
  numero: string
  torre?: string | null
  bloque?: string | null
  direccion?: string | null
  area_m2?: number | string | null
  copropietario: number
}

export type CreateCasaInput = CasaBaseInput & {
  // para crear directamente via POST /casas/ debes enviar el tipo
  tipo: CasaTipo
  // regla: si tipo='CASA' => piso debe ir null; si 'DEPARTAMENTO' => piso requerido
  piso?: number | null
}

export type CreateCasaCasaInput = CasaBaseInput & {
  // action /admin/crear-casa NO requiere tipo ni piso
  // (el backend setea tipo='CASA' y fuerza piso=null)
}

export type CreateDepartamentoInput = CasaBaseInput & {
  piso: number // requerido por acción /admin/crear-departamento
  // tipo lo pone el backend a 'DEPARTAMENTO'
}

export type UpdateCasaInput = Partial<Omit<Casa, 'id' | 'tipo'>> & {
  // si quieres permitir cambiar tipo vía PATCH a /casas/:id/ (no via acciones), añádelo aquí:
  tipo?: CasaTipo
}

// ===================== CRUD estándar (ModelViewSet) =====================

export async function listCasas(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = 'numero' } = params
  const { data } = await api.get<DRFPaginated<Casa> | Casa[]>('/casas/', {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Casa>(data)
}

export async function getCasa(id: number) {
  const { data } = await api.get<Casa>(`/casas/${id}/`)
  return data
}

export async function createCasaDirect(input: CreateCasaInput) {
  // Úsala solo si quieres crear en /casas/ pasando tipo y piso según reglas.
  // Nota: si tipo='CASA' asegúrate de enviar piso:null
  const payload = { ...input, piso: input.tipo === 'CASA' ? null : input.piso }
  const { data } = await api.post<Casa>('/casas/', payload)
  return data
}

export async function updateCasa(id: number, input: UpdateCasaInput) {
  const { data } = await api.patch<Casa>(`/casas/${id}/`, input)
  return data
}

export async function deleteCasa(id: number) {
  await api.delete(`/casas/${id}/`)
  return true
}

// ===================== Acciones admin (ya definidas en tu backend) =====================

// POST /api/casas/admin/crear-casa/  → setea tipo='CASA' y piso=null
export async function crearCasa(input: CreateCasaCasaInput) {
  // el backend ya pone piso=null; si por alguna razón llega '', lo limpiamos
  const { data } = await api.post<Casa>('/casas/admin/crear-casa/', {
    ...input,
    piso: null,
  })
  return data
}

// POST /api/casas/admin/crear-departamento/ → setea tipo='DEPARTAMENTO' (piso requerido)
export async function crearDepartamento(input: CreateDepartamentoInput) {
  if (input.piso == null || Number.isNaN(Number(input.piso))) {
    throw new Error('piso es obligatorio para DEPARTAMENTO')
  }
  const { data } = await api.post<Casa>('/casas/admin/crear-departamento/', input)
  return data
}

// ===================== Endpoints móviles (lecturas públicas) =====================

// GET /api/mobile/casas/casas?copropietario_id=#
export async function listCasasPorCopropietario(copropietarioId: number) {
  const { data } = await api.get<Casa[]>('/mobile/casas/casas', {
    params: { copropietario_id: copropietarioId },
  })
  return data
}

// GET /api/mobile/casas/departamentos?copropietario_id=#
export async function listDepartamentosPorCopropietario(copropietarioId: number) {
  const { data } = await api.get<Casa[]>('/mobile/casas/departamentos', {
    params: { copropietario_id: copropietarioId },
  })
  return data
}
