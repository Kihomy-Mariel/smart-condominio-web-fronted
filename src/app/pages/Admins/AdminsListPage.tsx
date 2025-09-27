// src/pages/admins/AdminsListPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { listAdmins, deleteAdmin, type Admin } from '@/services/admins.service'
import { Plus, Search, Edit, Trash2, Mail, Lock, Phone, SortAsc, SortDesc } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Ordering = 'apellido' | '-apellido' | 'nombres' | '-nombres' | 'carnet' | '-carnet'

export default function AdminsListPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('apellido')

  // Debounce buscador
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Query de admins
  const { data, isLoading, isFetching } = useQuery<
    { total: number; results: Admin[] },
    Error
  >({
    queryKey: ['admins_all'],
    queryFn: () => listAdmins({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const del = useMutation({
    mutationFn: (id: number) => deleteAdmin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins_all'] }),
  })

  const all = data?.results ?? []

  // Filtro
  const filtered: Admin[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter(r =>
      hay(r.nombres).includes(needle) ||
      hay(r.apellido).includes(needle) ||
      String(r.carnet ?? '').toLowerCase().includes(needle) ||
      hay(r.email).includes(needle) ||
      hay(r.usuario).includes(needle) ||
      hay(r.telefono).includes(needle) ||
      hay(r.direccion).includes(needle)
    )
  }, [all, qDebounced])

  // Orden
  const sorted: Admin[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = (ordering.replace('-', '') as 'apellido' | 'nombres' | 'carnet')
    return [...filtered].sort((a, b) => {
      const va = String((a as any)[field] ?? '').toLowerCase()
      const vb = String((b as any)[field] ?? '').toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return  1 * dir
      return 0
    })
  }, [filtered, ordering])

  // Paginación local
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'apellido' | 'nombres' | 'carnet') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  // Reset page
  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Administradores</h1>
        <div className="flex gap-2">
          <div className="relative w-72">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, apellido, carnet, correo, usuario, teléfono…"
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
            onClick={() => navigate('/admins/new')}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow"
          >
            <Plus className="h-5 w-5" /> Nuevo
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <Th label="Apellido" ordering={ordering} field="apellido" onToggle={toggleOrdering} />
                <Th label="Nombres" ordering={ordering} field="nombres" onToggle={toggleOrdering} />
                <Th label="Carnet" ordering={ordering} field="carnet" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados.' : 'Aún no hay administradores.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{r.apellido}</td>
                    <td className="px-4 py-3">{r.nombres}</td>
                    <td className="px-4 py-3">{r.carnet}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 opacity-60" /> {r.email || <span className="opacity-50">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-4 w-4 opacity-60" /> {r.usuario}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4 opacity-60" /> {r.telefono || <span className="opacity-50">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/admins/${r.id}/edit`)}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                        >
                          <Edit className="h-4 w-4" /> Editar
                        </button>
                        <button
                          onClick={async () => {
                            const ok = confirm(`¿Eliminar a ${r.apellido}, ${r.nombres}?`)
                            if (!ok) return
                            await del.mutateAsync(r.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-red-50 text-red-600 border-red-200"
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

        {/* Paginación */}
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
  field: 'apellido' | 'nombres' | 'carnet'
  onToggle: (f: 'apellido' | 'nombres' | 'carnet') => void
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

