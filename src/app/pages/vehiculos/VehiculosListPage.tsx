// src/app/pages/vehiculos/VehiculosListPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { listVehiculos, deleteVehiculo, type Vehiculo } from '@/services/vehiculos.service'
import { listCasas } from '@/services/casas.service'
import { Plus, Search, Edit, Trash2, SortAsc, SortDesc, CarFront, Tag, Building2 } from 'lucide-react'
import { VehiculoFormDialog } from './VehiculoFormDialog'

const WITH_DIALOG = true as const

type Ordering =
  | 'placa' | '-placa'
  | 'marca' | '-marca'
  | 'color' | '-color'
  | 'casa'  | '-casa'
  | 'id'    | '-id'

type CasaLite = {
  id: number
  direccion?: string | null
  bloque?: string | number | null
  numero?: string | number | null
}

function casaLabel(c?: CasaLite) {
  if (!c) return ''
  const dir = (c.direccion ?? '').toString().trim()
  if (dir) return dir
  const parts = [c.bloque, c.numero].map(v => (v ?? '').toString().trim()).filter(Boolean)
  if (parts.length) return parts.join(' - ')
  return `Casa ${c.id}`
}

export default function VehiculosListPage() {
  const qc = useQueryClient()

  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('placa')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: Vehiculo }>(null)

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Vehículos
  const { data, isLoading, isFetching } = useQuery<{ total: number; results: Vehiculo[] }, Error>({
    queryKey: ['vehiculos_all'],
    queryFn: () => listVehiculos({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
  const all = data?.results ?? []

  // Casas para mostrar dirección
  const casasQ = useQuery<{ total: number; results: CasaLite[] }, Error>({
    queryKey: ['casas_all_for_list'],
    queryFn: () => listCasas({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const casasArr = casasQ.data?.results ?? []
  const casaById = useMemo(() => {
    const m = new Map<number, CasaLite>()
    for (const c of casasArr) m.set(c.id, c)
    return m
  }, [casasArr])

  // Helpers basados en el mapa
  const vehCasaLabel = (v: Vehiculo) => casaLabel(casaById.get(v.casa))

  const del = useMutation({
    mutationFn: (id: number) => deleteVehiculo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehiculos_all'] }),
  })

  // --- Filtro local (incluye dirección de casa) ---
  const filtered: Vehiculo[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter(v =>
      hay(v.placa).includes(needle) ||
      hay(v.marca ?? '').includes(needle) ||
      hay(v.color ?? '').includes(needle) ||
      hay(v.descripcion ?? '').includes(needle) ||
      hay(vehCasaLabel(v)).includes(needle)
    )
  }, [all, qDebounced, casaById])

  // --- Orden local (cuando es 'casa' usa la etiqueta de dirección) ---
  const sorted: Vehiculo[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = ordering.replace('-', '') as 'placa' | 'marca' | 'color' | 'casa' | 'id'
    const cmp = (a: Vehiculo, b: Vehiculo) => {
      if (field === 'casa') {
        const sa = vehCasaLabel(a).toLowerCase()
        const sb = vehCasaLabel(b).toLowerCase()
        if (sa < sb) return -1 * dir
        if (sa > sb) return  1 * dir
        return 0
      }
      if (field === 'id') {
        const na = Number(a.id) || 0
        const nb = Number(b.id) || 0
        if (na < nb) return -1 * dir
        if (na > nb) return  1 * dir
        return 0
      }
      const sa = String((a as any)[field] ?? '').toLowerCase()
      const sb = String((b as any)[field] ?? '').toLowerCase()
      if (sa < sb) return -1 * dir
      if (sa > sb) return  1 * dir
      return 0
    }
    return [...filtered].sort(cmp)
  }, [filtered, ordering, casaById])

  // --- Paginación local ---
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering])

  function toggleOrdering(field: 'placa' | 'marca' | 'color' | 'casa' | 'id') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Vehículos</h1>
        <div className="flex gap-2">
          <div className="relative w-72">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por placa, marca, color, descripción o casa…"
              className="w-full rounded-xl border border-slate-300 bg-transparent px-10 py-2 outline-none focus:ring"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 opacity-70" />
            {!!q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label="Limpiar búsqueda"
              >✕</button>
            )}
          </div>
          <button
            onClick={() => setOpenForm({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow"
          >
            <Plus className="h-5 w-5" /> Nuevo
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <Th label="ID" ordering={ordering} field="id" onToggle={toggleOrdering} />
                <Th label="Placa" ordering={ordering} field="placa" onToggle={toggleOrdering} />
                <Th label="Marca" ordering={ordering} field="marca" onToggle={toggleOrdering} />
                <Th label="Color" ordering={ordering} field="color" onToggle={toggleOrdering} />
                <Th label="Casa" ordering={ordering} field="casa" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || casasQ.isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded w-28" />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="h-8 bg-slate-200 rounded w-28 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados para tu búsqueda.' : 'Aún no hay vehículos.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((v) => {
                  const casa = casaById.get(v.casa)
                  const casaText = casaLabel(casa)
                  return (
                    <tr key={v.id} className="border-t">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <Tag className="h-4 w-4 opacity-60" /> {v.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <CarFront className="h-4 w-4 opacity-60" /> {v.placa}
                        </span>
                      </td>
                      <td className="px-4 py-3">{v.marca ?? '-'}</td>
                      <td className="px-4 py-3">{v.color ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <Building2 className="h-4 w-4 opacity-60" /> {casaText || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {v.descripcion ? <span className="line-clamp-2 max-w-[28rem]">{v.descripcion}</span> : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setOpenForm({ mode: 'edit', record: v })}
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" /> Editar
                          </button>
                          <button
                            onClick={async () => {
                              const ok = confirm(`¿Eliminar vehículo ${v.placa}?`)
                              if (!ok) return
                              await del.mutateAsync(v.id)
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t">
          <div className="text-sm text-slate-600">
            {isFetching || casasQ.isFetching ? 'Actualizando…' : `Total: ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border px-2 py-1"
            >
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}/pág</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border px-3 py-1 disabled:opacity-50"
              >Anterior</button>
              <span className="text-sm">{page} / {pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="rounded-lg border px-3 py-1 disabled:opacity-50"
              >Siguiente</button>
            </div>
          </div>
        </div>
      </div>

      {WITH_DIALOG && openForm && (
        <VehiculoFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['vehiculos_all'] })
          }}
        />
      )}
    </div>
  )
}

function Th<T extends 'placa' | 'marca' | 'color' | 'casa' | 'id'>({
  label,
  ordering,
  field,
  onToggle,
}: {
  label: string
  ordering: string
  field: T
  onToggle: (f: T) => void
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
