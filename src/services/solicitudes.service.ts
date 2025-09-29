// services/solicitudes.service.ts
import { api } from './api'

/** Estados que expone el backend (choices en el modelo) */
export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA'

/** Modelo que devuelve DRF (serializer fields) */
export type Solicitud = {
  id: number
  fecha: string            // 'YYYY-MM-DD'
  horaInicio: string       // 'HH:MM[:SS]'
  horaFin: string          // 'HH:MM[:SS]'
  estado: EstadoSolicitud
  fotoComprobante?: string | null
  copropietario: number
  areacomun: number
}

/** Crear/actualizar (mismos campos salvo id) */
export type CreateSolicitudInput = {
  fecha: string
  horaInicio: string
  horaFin: string
  estado?: EstadoSolicitud         // opcional, default=PENDIENTE en backend
  fotoComprobante?: string | null  // base64 opcional
  copropietario: number
  areacomun: number
}
export type UpdateSolicitudInput = Partial<CreateSolicitudInput>

/** Parámetros de listado (admin y móvil) */
export type ListParams = {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

/** Respuesta de verificar disponibilidad (action móvil) */
export type Verificacion = {
  disponible: boolean
  conflictos: Array<{
    id: number
    copropietario_id: number
    horaInicio: string
    horaFin: string
  }>
}

/** Normaliza DRF con/sin paginación a { total, results } */
function normalizeList<T>(data: any): { total: number; results: T[] } {
  if (Array.isArray(data)) return { total: data.length, results: data }
  if (data && Array.isArray(data.results)) {
    return { total: data.count ?? data.results.length, results: data.results }
  }
  return { total: 0, results: [] }
}

/** ---------- ADMIN: solo lectura (IsAdminUser) ---------- */
/** GET /api/solicitudes/ */
export async function listSolicitudesAdmin(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = '-fecha' } = params
  const { data } = await api.get('/solicitudes/', {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Solicitud>(data)
}

/** GET /api/solicitudes/{id}/ */
export async function getSolicitudAdmin(id: number) {
  const { data } = await api.get(`/solicitudes/${id}/`)
  return data as Solicitud
}

/** ---------- MÓVIL: CRUD libre + verificar ---------- */
/** GET /api/mobile/solicitudes/ */
export async function listSolicitudes(params: ListParams = {}) {
  const { page = 1, page_size = 10, search = '', ordering = '-fecha' } = params
  const { data } = await api.get('/mobile/solicitudes/', {
    params: { page, page_size, search, ordering },
  })
  return normalizeList<Solicitud>(data)
}

/** GET /api/mobile/solicitudes/{id}/ */
export async function getSolicitud(id: number) {
  const { data } = await api.get(`/mobile/solicitudes/${id}/`)
  return data as Solicitud
}

/** POST /api/mobile/solicitudes/ */
export async function createSolicitud(input: CreateSolicitudInput) {
  try {
    const { data } = await api.post('/mobile/solicitudes/', input)
    return data as Solicitud
  } catch (err: any) {
    // DRF ValidationError para la regla "horaFin > horaInicio"
    const detail = err?.response?.data
    if (detail?.horaFin) {
      throw new Error(Array.isArray(detail.horaFin) ? detail.horaFin.join(', ') : String(detail.horaFin))
    }
    if (detail?.detail) throw new Error(String(detail.detail))
    throw err
  }
}

/** PATCH /api/mobile/solicitudes/{id}/ */
export async function updateSolicitud(id: number, input: UpdateSolicitudInput) {
  try {
    const { data } = await api.patch(`/mobile/solicitudes/${id}/`, input)
    return data as Solicitud
  } catch (err: any) {
    const detail = err?.response?.data
    if (detail?.horaFin) {
      throw new Error(Array.isArray(detail.horaFin) ? detail.horaFin.join(', ') : String(detail.horaFin))
    }
    if (detail?.detail) throw new Error(String(detail.detail))
    throw err
  }
}

/** DELETE /api/mobile/solicitudes/{id}/ */
export async function deleteSolicitud(id: number) {
  await api.delete(`/mobile/solicitudes/${id}/`)
  return true
}

/** GET /api/mobile/solicitudes/verificar/?areacomun_id=&fecha=&horaInicio=&horaFin= */
export async function verificarDisponibilidad(params: {
  areacomun_id: number | string
  fecha: string            // 'YYYY-MM-DD'
  horaInicio: string       // 'HH:MM'
  horaFin: string          // 'HH:MM'
}) {
  const { data } = await api.get('/mobile/solicitudes/verificar/', { params })
  return data as Verificacion
}