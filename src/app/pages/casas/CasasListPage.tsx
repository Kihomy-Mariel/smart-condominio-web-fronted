import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { listCasas, deleteCasa, type Casa } from '@/services/casas.service'
import {
  Plus, Search, Edit, Trash2, Home, Building2, Ruler,
  SortAsc, SortDesc, User,
} from 'lucide-react'
import CasaFormDialog from './CasaFormDialog'

// Catálogo de copropietarios para mapear ID → nombre
import {
  listCopropietarios,
  type Copropietario,
} from '@/services/copropietarios.service'

type Ordering = 'numero' | '-numero' | 'tipo' | '-tipo' | 'piso' | '-piso'

export default function CasasListPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('numero')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: Casa }>(null)

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Trae TODAS las casas (paginación local)
  const { data: casasData, isLoading, isFetching } = useQuery<
    { total: number; results: Casa[] },
    Error
  >({
    queryKey: ['casas_all'],
    queryFn: () => listCasas({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  // Trae TODOS los copropietarios para mapear el nombre (catálogo)
  const { data: copData } = useQuery<
    { total: number; results: Copropietario[] },
    Error
  >({
    queryKey: ['copropietarios_all_for_casas'],
    queryFn: () => listCopropietarios({ page: 1, page_size: 2000 }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  // Mapa id → "Apellido, Nombre"
  const copMap = useMemo(() => {
    const m = new Map<number, string>()
    const items = copData?.results ?? []
    for (const c of items) {
      const label = [c.apellido, c.nombre].filter(Boolean).join(', ') || `#${c.id}`
      m.set(c.id, label)
    }
    return m
  }, [copData])

  const del = useMutation({
    mutationFn: (id: number) => deleteCasa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['casas_all'] }),
  })

  const all = casasData?.results ?? []

  // Filtro local (incluye nombre del copropietario)
  const filtered: Casa[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | number | null) => String(v ?? '').toLowerCase()
    return all.filter(r => {
      const owner = copMap.get(r.copropietario) ?? String(r.copropietario)
      return (
        hay(r.tipo).includes(needle) ||
        hay(r.numero).includes(needle) ||
        hay(r.piso).includes(needle) ||
        hay(r.torre).includes(needle) ||
        hay(r.bloque).includes(needle) ||
        hay(r.direccion).includes(needle) ||
        hay(r.area_m2).includes(needle) ||
        owner.toLowerCase().includes(needle)
      )
    })
  }, [all, qDebounced, copMap])

  // Orden local
  const sorted: Casa[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = (ordering.replace('-', '') as 'numero' | 'tipo' | 'piso')
    return [...filtered].sort((a, b) => {
      const va = (a as any)[field]
      const vb = (b as any)[field]
      const na = Number(va)
      const nb = Number(vb)
      const cmp =
        Number.isFinite(na) && Number.isFinite(nb)
          ? (na < nb ? -1 : na > nb ? 1 : 0)
          : String(va ?? '').localeCompare(String(vb ?? ''), undefined, {
              numeric: true,
              sensitivity: 'base',
            })
      return cmp * dir
    })
  }, [filtered, ordering])

  // Paginación local
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'numero' | 'tipo' | 'piso') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  // Reset page al cambiar filtros/orden
  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering])

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Unidades (Casas y Departamentos)</h1>

        {/* Controles: SIEMPRE en fila, con scroll horizontal si no entra */}
        <div className="relative -mx-4 md:mx-0">
          <div
            className="mx-4 flex items-center gap-2 md:gap-3 overflow-x-auto whitespace-nowrap pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* Buscador */}
            <div className="relative shrink-0 w-[280px]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por tipo, número, torre, bloque, dirección…"
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

            {/* Botón crear (no se apila, ocupa su ancho) */}
            <button
              onClick={() => setOpenForm({ mode: 'create' })}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow"
              title="Crear nueva unidad"
            >
              <Plus className="h-5 w-5" /> Nueva unidad
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <Th label="Tipo" ordering={ordering} field="tipo" onToggle={toggleOrdering} />
                <Th label="Número" ordering={ordering} field="numero" onToggle={toggleOrdering} />
                <Th label="Piso" ordering={ordering} field="piso" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Torre</th>
                <th className="px-4 py-3">Bloque</th>
                <th className="px-4 py-3">Área (m²)</th>
                <th className="px-4 py-3">Dirección</th>
                <th className="px-4 py-3">Copropietario</th>
                {/* ancho fijo en desktop para que quepan ambos botones */}
                <th className="px-4 py-3 text-right w-40 md:w-56">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(9).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados.' : 'Aún no hay unidades registradas.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => {
                  const owner = copMap.get(r.copropietario) ?? `#${r.copropietario}`
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          {r.tipo === 'CASA' ? (
                            <Home className="h-4 w-4 opacity-70" />
                          ) : (
                            <Building2 className="h-4 w-4 opacity-70" />
                          )}
                          {r.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.numero}</td>
                      <td className="px-4 py-3">
                        {r.tipo === 'CASA' ? <span className="opacity-50">—</span> : (r.piso ?? <span className="opacity-50">—</span>)}
                      </td>
                      <td className="px-4 py-3">{r.torre || <span className="opacity-50">—</span>}</td>
                      <td className="px-4 py-3">{r.bloque || <span className="opacity-50">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <Ruler className="h-4 w-4 opacity-60" /> {r.area_m2 ?? <span className="opacity-50">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.direccion || <span className="opacity-50">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <User className="h-4 w-4 opacity-60" /> {owner}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {/* En móvil pueden apilarse; en md+ se fuerzan en una fila */}
                        <div className="flex justify-end gap-2 flex-wrap md:flex-nowrap md:min-w-[220px]">
                          <button
                            onClick={() => setOpenForm({ mode: 'edit', record: r })}
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50 whitespace-nowrap"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
                          <button
                            onClick={async () => {
                              const ok = confirm(`¿Eliminar ${r.tipo} ${r.numero}?`)
                              if (!ok) return
                              await del.mutateAsync(r.id)
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-red-50 text-red-600 border-red-200 whitespace-nowrap"
                            title="Eliminar"
                            disabled={del.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Eliminar</span>
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

        {/* Footer */}
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

      {/* Modal */}
      {openForm && (
        <CasaFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['casas_all'] })
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
  field: 'numero' | 'tipo' | 'piso'
  onToggle: (f: 'numero' | 'tipo' | 'piso') => void
}) {
  const active = ordering === field || ordering === `-${field}`
  const desc = ordering === `-${field}`
  return (
    <th className="px-4 py-3">
      <button onClick={() => onToggle(field)} className="inline-flex items-center gap-1 whitespace-nowrap">
        {label} {active ? (desc ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />) : null}
      </button>
    </th>
  )
}


