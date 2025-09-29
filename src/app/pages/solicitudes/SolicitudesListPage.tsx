// pages/solicitudes/SolicitudesListPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  listSolicitudes,
  deleteSolicitud,
  type Solicitud,
  type EstadoSolicitud,
} from '@/services/solicitudes.service'
import { listCopropietarios, type Copropietario } from '@/services/copropietarios.service'
import { listEspaciosComunes } from '@/services/espacioscomunes.service' // asegúrate de tenerlo
import { Plus, Search, Edit, Trash2, Calendar, Clock, User2, Building2, SortAsc, SortDesc } from 'lucide-react'
import { SolicitudFormDialog } from './SolicitudFormDialog'

type Ordering = 'fecha' | '-fecha' | 'estado' | '-estado'

export default function SolicitudesListPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('-fecha')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: Solicitud }>(null)

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // ====== Data principal: solicitudes (pedimos mucho y paginamos local) ======
  const { data: solData, isLoading, isFetching } = useQuery<{ total: number; results: Solicitud[] }, Error>({
    queryKey: ['solicitudes_all'],
    queryFn: () => listSolicitudes({ page: 1, page_size: 1000, ordering: '-fecha' }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const all = solData?.results ?? []

  // ====== Caches opcionales para mostrar nombres en lugar de IDs ======
  const copQ = useQuery({
    queryKey: ['copropietarios_cache'],
    queryFn: () => listCopropietarios({ page: 1, page_size: 1000, ordering: 'apellido' }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
  const espQ = useQuery({
    queryKey: ['espacios_cache'],
    queryFn: () => listEspaciosComunes({ page: 1, page_size: 1000, ordering: 'nombre' }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  const copById = useMemo(() => {
    const m = new Map<number, Copropietario>()
    for (const c of copQ.data?.results ?? []) m.set(c.id, c)
    return m
  }, [copQ.data])

  const espacioById = useMemo(() => {
    const m = new Map<number, { id: number; nombre?: string | null }>()
    for (const e of (espQ.data as any)?.results ?? []) m.set(e.id, e)
    return m
  }, [espQ.data])

  // ====== Mutación: eliminar ======
  const del = useMutation({
    mutationFn: (id: number) => deleteSolicitud(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes_all'] }),
  })

  // ====== Helpers de UI ======
  function renderEstadoBadge(estado: EstadoSolicitud) {
    const cls =
      estado === 'APROBADA'
        ? 'bg-green-100 text-green-700 border-green-200'
        : estado === 'RECHAZADA'
        ? 'bg-red-100 text-red-700 border-red-200'
        : estado === 'CANCELADA'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200'
    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{estado}</span>
  }

  const displayArea = (id: number) => espacioById.get(id)?.nombre ?? `#${id}`
  const displayCop = (id: number) => {
    const c = copById.get(id)
    return c ? `${c.apellido}, ${c.nombre}` : `#${id}`
  }

  // ====== Filtro local ======
  const filtered: Solicitud[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter((r) => {
      const area = displayArea(r.areacomun)
      const cop = displayCop(r.copropietario)
      return (
        hay(r.fecha).includes(needle) ||
        hay(`${r.horaInicio}-${r.horaFin}`).includes(needle) ||
        hay(r.estado).includes(needle) ||
        hay(area).includes(needle) ||
        hay(cop).includes(needle)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, qDebounced, espacioById, copById])

  // ====== Orden local ======
  const sorted: Solicitud[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = ordering.replace('-', '')
    const byFechaHora = (a: Solicitud, b: Solicitud) => {
      // fecha asc, luego horaInicio asc
      const fa = a.fecha ?? ''
      const fb = b.fecha ?? ''
      if (fa < fb) return -1 * dir
      if (fa > fb) return 1 * dir
      const ha = a.horaInicio ?? ''
      const hb = b.horaInicio ?? ''
      if (ha < hb) return -1 * dir
      if (ha > hb) return 1 * dir
      return 0
    }
    const byEstado = (a: Solicitud, b: Solicitud) => {
      const ea = a.estado ?? ''
      const eb = b.estado ?? ''
      if (ea < eb) return -1 * dir
      if (ea > eb) return 1 * dir
      return byFechaHora(a, b) // desempate
    }
    const data = [...filtered]
    if (field === 'fecha') return data.sort(byFechaHora)
    if (field === 'estado') return data.sort(byEstado)
    return data
  }, [filtered, ordering])

  // ====== Paginación local ======
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  useEffect(() => {
    setPage(1)
  }, [qDebounced, ordering, pageSize])

  function toggleOrdering(field: 'fecha' | 'estado') {
    setOrdering((prev) => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Solicitudes</h1>
        <div className="flex gap-2">
          <div className="relative w-80">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por área, copropietario, estado, fecha…"
              className="w-full rounded-xl border border-slate-300 bg-transparent px-10 py-2 outline-none focus:ring"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 opacity-70" />
            {!!q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => setOpenForm({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow"
          >
            <Plus className="h-5 w-5" /> Nueva
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <Th label="Fecha" ordering={ordering} field="fecha" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Horario</th>
                <th className="px-4 py-3">Área común</th>
                <th className="px-4 py-3">Copropietario</th>
                <Th label="Estado" ordering={ordering} field="estado" onToggle={toggleOrdering} />
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-40" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-40" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-200 rounded w-20" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-8 bg-slate-200 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados para tu búsqueda.' : 'Aún no hay solicitudes.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 opacity-60" />
                        {r.fecha}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Clock className="h-4 w-4 opacity-60" />
                        {r.horaInicio} – {r.horaFin}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Building2 className="h-4 w-4 opacity-60" />
                        {displayArea(r.areacomun)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <User2 className="h-4 w-4 opacity-60" />
                        {displayCop(r.copropietario)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderEstadoBadge(r.estado)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setOpenForm({ mode: 'edit', record: r })}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" /> Editar
                        </button>
                        <button
                          onClick={async () => {
                            const ok = confirm(
                              `¿Eliminar la solicitud del ${r.fecha} (${r.horaInicio}-${r.horaFin})?`
                            )
                            if (!ok) return
                            await del.mutateAsync(r.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-red-50 text-red-600 border-red-200"
                          title="Eliminar"
                          disabled={del.isPending}
                        >
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t">
          <div className="text-sm text-slate-600">
            {isFetching ? 'Actualizando…' : `Total: ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border px-2 py-1"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/pág
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border px-3 py-1 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm">
                {page} / {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="rounded-lg border px-3 py-1 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {openForm && (
        <SolicitudFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['solicitudes_all'] })
          }}
        />
      )}
    </div>
  )
}

function Th({
  label,
  ordering,
  field,
  onToggle,
}: {
  label: string
  ordering: string
  field: 'fecha' | 'estado'
  onToggle: (f: 'fecha' | 'estado') => void
}) {
  const active = ordering === field || ordering === `-${field}`
  const desc = ordering === `-${field}`
  return (
    <th className="px-4 py-3">
      <button onClick={() => onToggle(field)} className="inline-flex items-center gap-1">
        {label} {active ? (desc ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />) : null}
      </button>
    </th>
  )
}