// src/services/reportes.service.ts
import { api } from './api'

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA'

export type Solicitud = {
  id: number
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoSolicitud
  fotoComprobante?: string | null
  copropietario: number
  areacomun: number
}

function normalizeList<T>(data: any): { total: number; results: T[]; next: string | null } {
  if (Array.isArray(data)) return { total: data.length, results: data, next: null }
  if (data && Array.isArray(data.results)) {
    return { total: data.count ?? data.results.length, results: data.results, next: data.next ?? null }
  }
  return { total: 0, results: [], next: null }
}

export async function listSolicitudesPage(page = 1, page_size = 50) {
  const { data } = await api.get('/solicitudes/', { params: { page, page_size } })
  return normalizeList<Solicitud>(data)
}

// Trae TODAS (paginando). Ajusta límites según tu volumen real.
export async function listAllSolicitudes(maxPages = 100, page_size = 200): Promise<Solicitud[]> {
  let page = 1
  const acc: Solicitud[] = []
  for (let i = 0; i < maxPages; i++) {
    const { results, next } = await listSolicitudesPage(page, page_size)
    acc.push(...results)
    if (!next) break
    page += 1
  }
  return acc
}

export function durHours(fecha: string, hi: string, hf: string) {
  const start = new Date(`${fecha}T${hi}`)
  const end   = new Date(`${fecha}T${hf}`)
  return Math.max(0, (end.getTime() - start.getTime()) / 36e5)
}

export function filtrarSolicitudes(
  rows: Solicitud[],
  opts: { areaId?: number; desde?: string; hasta?: string; estado?: EstadoSolicitud }
) {
  const d0 = opts.desde ? new Date(opts.desde) : null
  const d1 = opts.hasta ? new Date(opts.hasta) : null
  return rows.filter((r: Solicitud) => {
    const okArea = opts.areaId ? r.areacomun === opts.areaId : true
    const d = new Date(r.fecha)
    const okDesde = d0 ? d >= d0 : true
    const okHasta = d1 ? d <= d1 : true
    const okEstado = opts.estado ? r.estado === opts.estado : true
    return okArea && okDesde && okHasta && okEstado
  })
}

export function kpisPorArea(rows: Solicitud[]) {
  type KPI = {
    areaId: number
    total: number
    aprobadas: number
    canceladas: number
    rechazadas: number
    horasReservadas: number
  }

  const map: Record<number, KPI> = {}

  for (const r of rows) {
    const m = map[r.areacomun] ?? (map[r.areacomun] = {
      areaId: r.areacomun,
      total: 0,
      aprobadas: 0,
      canceladas: 0,
      rechazadas: 0,
      horasReservadas: 0
    })
    m.total += 1
    if (r.estado === 'APROBADA') {
      m.aprobadas += 1
      m.horasReservadas += durHours(r.fecha, r.horaInicio, r.horaFin)
    } else if (r.estado === 'CANCELADA') m.canceladas += 1
    else if (r.estado === 'RECHAZADA') m.rechazadas += 1
  }

  return Object.values(map)
}
