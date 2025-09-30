import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Search, Edit, Trash2, SortAsc, SortDesc, User2, Home } from 'lucide-react'

import {
  listResidentes,
  deleteResidente,
  type Residente,
} from '@/services/residentes.service'

// catálogo de copropietarios para etiquetar la FK
import { listCopropietarios } from '@/services/copropietarios.service'
type CopropietarioLite = {
  id: number
  nombre: string
  apellido: string
  carnet: string
  correo: string
  usuario?: string
}

import { ResidenteFormDialog } from './ResidenteFormDialog'

// Campos ordenables localmente
type Ordering =
  | 'nombre' | '-nombre'
  | 'apellido' | '-apellido'
  | 'carnet' | '-carnet'
  | 'correo' | '-correo'
  | 'celular' | '-celular'
  | 'copropietario' | '-copropietario'

function coproLabel(c?: CopropietarioLite, fallback?: string) {
  if (!c) return fallback ?? ''
  const nom = (c.nombre ?? '').trim()
  const ape = (c.apellido ?? '').trim()
  const full = [nom, ape].filter(Boolean).join(' ')
  return full || fallback || `Copropietario ${c.id}`
}

export default function ResidentesListPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('apellido')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: Residente }>(null)

  // Debounce buscador
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Data: residentes (trae un lote grande y luego paginamos local)
  const residentesQ = useQuery<{ total: number; results: Residente[] }, Error>({
    queryKey: ['residentes_all'],
    queryFn: () => listResidentes({ page: 1, page_size: 1000, ordering: 'apellido' }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  // Catálogo de copropietarios
  const coprosQ = useQuery<{ total: number; results: CopropietarioLite[] }, Error>({
    queryKey: ['copropietarios_all_for_residentes'],
    queryFn: () => listCopropietarios({ page: 1, page_size: 1000, ordering: 'apellido' }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  // Mapa id -> copropietario
  const coproById = useMemo(() => {
    const list = coprosQ.data?.results ?? []
    const m = new Map<number, CopropietarioLite>()
    for (const c of list) m.set(c.id, c)
    return m
  }, [coprosQ.data])

  const del = useMutation({
    mutationFn: (id: number) => deleteResidente(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['residentes_all'] }),
  })

  const all = residentesQ.data?.results ?? []

  // --- Filtro local (incluye nombre del copropietario) ---
  const filtered: Residente[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter(r => {
      const cop = coproById.get(r.copropietario)
      const copTxt = coproLabel(cop, String(r.copropietario)).toLowerCase()
      return (
        hay(r.nombre).includes(needle) ||
        hay(r.apellido).includes(needle) ||
        hay(r.carnet).includes(needle) ||
        hay(r.correo).includes(needle) ||
        hay(r.celular).includes(needle) ||
        copTxt.includes(needle)
      )
    })
  }, [all, qDebounced, coproById])

  // --- Orden local ---
  const sorted: Residente[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = (ordering.replace('-', '') as 'nombre' | 'apellido' | 'carnet' | 'correo' | 'celular' | 'copropietario')
    const cmp = (a: Residente, b: Residente) => {
      const va = field === 'copropietario'
        ? coproLabel(coproById.get(a.copropietario), String(a.copropietario)).toLowerCase()
        : String((a as any)[field] ?? '').toLowerCase()
      const vb = field === 'copropietario'
        ? coproLabel(coproById.get(b.copropietario), String(b.copropietario)).toLowerCase()
        : String((b as any)[field] ?? '').toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return  1 * dir
      return 0
    }
    return [...filtered].sort(cmp)
  }, [filtered, ordering, coproById])

  // --- Paginación local ---
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'nombre' | 'apellido' | 'carnet' | 'correo' | 'celular' | 'copropietario') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  // Reiniciar a página 1 ante cambios
  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Residentes</h1>
        <div className="flex gap-2">
          <div className="relative w-72">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, carnet, correo, copropietario…"
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
            <User2 className="h-5 w-5" /> Nuevo
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <Th label="Nombre" ordering={ordering} field="nombre" onToggle={toggleOrdering} />
                <Th label="Apellido" ordering={ordering} field="apellido" onToggle={toggleOrdering} />
                <Th label="Carnet" ordering={ordering} field="carnet" onToggle={toggleOrdering} />
                <Th label="Correo" ordering={ordering} field="correo" onToggle={toggleOrdering} />
                <Th label="Celular" ordering={ordering} field="celular" onToggle={toggleOrdering} />
                <Th label="Copropietario" ordering={ordering} field="copropietario" onToggle={toggleOrdering} />
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {residentesQ.isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    ))}
                    <td className="px-4 py-3 text-right"><div className="h-8 bg-slate-200 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados para tu búsqueda.' : 'Aún no hay residentes.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => {
                  const cop = coproById.get(r.copropietario)
                  const label = coproLabel(cop, String(r.copropietario))
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3">{r.nombre}</td>
                      <td className="px-4 py-3">{r.apellido}</td>
                      <td className="px-4 py-3">{r.carnet}</td>
                      <td className="px-4 py-3">{r.correo}</td>
                      <td className="px-4 py-3">{r.celular}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <Home className="h-4 w-4 opacity-60" /> {label}
                        </span>
                      </td>
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
                              const ok = confirm(`¿Eliminar a "${r.nombre} ${r.apellido}"?`)
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t">
          <div className="text-sm text-slate-600">
            {residentesQ.isFetching ? 'Actualizando…' : `Total: ${total}`}
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

      {openForm && (
        <ResidenteFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['residentes_all'] })
          }}
        />
      )}
    </div>
  )
}

function Th({ label, ordering, field, onToggle }: {
  label: string
  ordering: string
  field: 'nombre' | 'apellido' | 'carnet' | 'correo' | 'celular' | 'copropietario'
  onToggle: (f: 'nombre' | 'apellido' | 'carnet' | 'correo' | 'celular' | 'copropietario') => void
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
