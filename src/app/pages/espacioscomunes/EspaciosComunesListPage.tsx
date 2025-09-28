import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  listEspaciosComunes,
  deleteEspacioComun,
  toggleEstadoEspacioComun,
  type EspacioComun,
} from '@/services/espacioscomunes.service'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  SortAsc,
  SortDesc,
  RefreshCcw,
} from 'lucide-react'
import EspacioFormDialog from './EspacioComunFormDialog' // 👈 el diálogo correcto SIN usar en el router

type Ordering = 'nombre' | '-nombre' | 'estado' | '-estado'

export default function EspaciosComunesListPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('nombre')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: EspacioComun }>(null)

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data, isLoading, isFetching, refetch } = useQuery<{ total: number; results: EspacioComun[] }, Error>({
    queryKey: ['espacioscomunes_all'],
    queryFn: () => listEspaciosComunes({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const del = useMutation({
    mutationFn: (id: number) => deleteEspacioComun(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['espacioscomunes_all'] }),
  })

  const toggleMut = useMutation({
    mutationFn: (r: EspacioComun) => toggleEstadoEspacioComun(r.id, r.estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['espacioscomunes_all'] }),
  })

  const all = data?.results ?? []

  const filtered: EspacioComun[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter(
      (r) =>
        hay(r.nombre).includes(needle) ||
        hay(r.descripcion).includes(needle) ||
        hay(r.estado).includes(needle),
    )
  }, [all, qDebounced])

  const sorted: EspacioComun[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = ordering.replace('-', '') as 'nombre' | 'estado'
    const cmp = (a: EspacioComun, b: EspacioComun) => {
      const va = String((a as any)[field] ?? '').toLowerCase()
      const vb = String((b as any)[field] ?? '').toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    }
    return [...filtered].sort(cmp)
  }, [filtered, ordering])

  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'nombre' | 'estado') {
    setOrdering((prev) => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  useEffect(() => {
    setPage(1)
  }, [qDebounced, pageSize, ordering])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Espacios comunes</h1>
        <div className="flex gap-2">
          <div className="relative w-72">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, descripción o estado…"
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
            <Plus className="h-5 w-5" /> Nuevo
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border hover:bg-slate-50"
            title="Refrescar"
          >
            <RefreshCcw className="h-5 w-5" /> {isFetching ? 'Actualizando…' : 'Refrescar'}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3">Foto</th>
                <Th label="Nombre" ordering={ordering} field="nombre" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Descripción</th>
                <Th label="Estado" ordering={ordering} field="estado" onToggle={toggleOrdering} />
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-12 w-16 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-40" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-64" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-8 bg-slate-200 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'Sin resultados.' : 'Aún no hay espacios comunes.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      {r.foto ? (
                        <img
                          src={b64ToImgSrc(r.foto)}
                          alt={r.nombre}
                          className="h-12 w-16 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded border flex items-center justify-center text-slate-400">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 line-clamp-2">{r.descripcion ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.estado === 'ACTIVO' ? (
                        <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /> ACTIVO</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500"><XCircle className="h-4 w-4" /> INACTIVO</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleMut.mutate(r)}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                          title="Activar/Desactivar"
                          disabled={toggleMut.isPending}
                        >
                          {r.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => setOpenForm({ mode: 'edit', record: r })}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" /> Editar
                        </button>
                        <button
                          onClick={async () => {
                            const ok = confirm(`¿Eliminar "${r.nombre}"?`)
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
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}/pág</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border px-3 py-1 disabled:opacity-50"
              >Anterior</button>
              <span className="text-sm">{page} / {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="rounded-lg border px-3 py-1 disabled:opacity-50"
              >Siguiente</button>
            </div>
          </div>
        </div>
      </div>

      {openForm && (
        <EspacioFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['espacioscomunes_all'] })
          }}
        />
      )}
    </div>
  )
}

function Th({ label, ordering, field, onToggle }: {
  label: string
  ordering: string
  field: 'nombre' | 'estado'
  onToggle: (f: 'nombre' | 'estado') => void
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

function b64ToImgSrc(b64: string) {
  const trimmed = (b64 || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('data:')) return trimmed
  return `data:image/jpeg;base64,${trimmed}`
}