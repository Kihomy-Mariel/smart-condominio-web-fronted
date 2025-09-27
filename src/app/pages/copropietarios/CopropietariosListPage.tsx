//CopropietariosListPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { listCopropietarios, deleteCopropietario, type Copropietario } from '@/services/copropietarios.service'
import { Plus, Search, Edit, Trash2, Mail, Lock, SortAsc, SortDesc } from 'lucide-react'
import { CopropietarioFormDialog } from './CopropietarioFormDialog'

type Ordering = 'apellido' | '-apellido' | 'nombre' | '-nombre' | 'carnet' | '-carnet'

export default function CopropietariosListPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('apellido')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: Copropietario }>(null)

  // Debounce para el buscador
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Traemos TODO en una sola query (page_size alto) y luego filtramos/ordenamos/paginamos localmente
  const { data, isLoading, isFetching } = useQuery<
    { total: number; results: Copropietario[] },
    Error
  >({
    queryKey: ['copropietarios_all'], // no depende de page/order porque es local
    queryFn: () => listCopropietarios({ page: 1, page_size: 1000 }), // 👈 pedimos bastante
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const del = useMutation({
    mutationFn: (id: number) => deleteCopropietario(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copropietarios_all'] }),
  })

  const all = data?.results ?? []

  // --- Filtro local por todos los atributos ---
  const filtered: Copropietario[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter(r =>
      hay(r.nombre).includes(needle) ||
      hay(r.apellido).includes(needle) ||
      String(r.carnet ?? '').toLowerCase().includes(needle) ||
      hay(r.correo).includes(needle) ||
      hay(r.usuario).includes(needle)
    )
  }, [all, qDebounced])

  // --- Orden local ---
  const sorted: Copropietario[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = (ordering.replace('-', '') as 'apellido' | 'nombre' | 'carnet')
    const cmp = (a: Copropietario, b: Copropietario) => {
      const va = String((a as any)[field] ?? '').toLowerCase()
      const vb = String((b as any)[field] ?? '').toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return  1 * dir
      return 0
    }
    return [...filtered].sort(cmp)
  }, [filtered, ordering])

  // --- Paginación local ---
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'apellido' | 'nombre' | 'carnet') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  // Reiniciar a página 1 cuando cambien filtros/orden/tamaño
  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Copropietarios</h1>
        <div className="flex gap-2">
          <div className="relative w-72">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, apellido, carnet, correo, usuario…"
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
                <Th label="Apellido" ordering={ordering} field="apellido" onToggle={toggleOrdering} />
                <Th label="Nombre" ordering={ordering} field="nombre" onToggle={toggleOrdering} />
                <Th label="Carnet" ordering={ordering} field="carnet" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Usuario (auto)</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-40" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-8 bg-slate-200 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados para tu búsqueda.' : 'Aún no hay copropietarios.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{r.apellido}</td>
                    <td className="px-4 py-3">{r.nombre}</td>
                    <td className="px-4 py-3">{r.carnet}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 opacity-60" /> {r.correo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-4 w-4 opacity-60" /> {r.usuario}
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
                            const ok = confirm(`¿Eliminar a ${r.apellido}, ${r.nombre}?`)
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
        <CopropietarioFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['copropietarios_all'] })
          }}
        />
      )}
    </div>
  )
}

function Th({ label, ordering, field, onToggle }: {
  label: string
  ordering: string
  field: 'apellido' | 'nombre' | 'carnet'
  onToggle: (f: 'apellido' | 'nombre' | 'carnet') => void
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
