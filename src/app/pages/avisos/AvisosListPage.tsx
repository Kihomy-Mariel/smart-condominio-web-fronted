import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Search, Edit, Trash2, SortAsc, SortDesc, Megaphone, User2, CalendarDays } from 'lucide-react'
import { listAvisos, deleteAviso, type Aviso } from '@/services/avisos.service'
import { api } from '@/services/api'
import { AvisoFormDialog } from './AvisoFormDialog' // ← export con nombre, mismo folder

// ---- Admins (Lite). Si ya tienes un service real, reemplaza por tu import ----
type AdminLite = { id: number; usuario?: string; nombre?: string; apellido?: string; email?: string }
async function listAdministradoresLite(): Promise<{ total: number; results: AdminLite[] }> {
  const { data } = await api.get('/administradores/', { params: { page: 1, page_size: 1000 } })
  const results = Array.isArray(data) ? data : (data?.results ?? [])
  return { total: results.length, results: results as AdminLite[] }
}
function adminLabel(a?: AdminLite, fallback?: string) {
  if (!a) return fallback ?? ''
  const nombre = [a.nombre, a.apellido].filter(Boolean).join(' ').trim()
  return nombre || a.usuario || a.email || fallback || `Admin ${a.id}`
}
// ------------------------------------------------------------------------------

type Ordering = 'fecha' | '-fecha' | 'titulo' | '-titulo' | 'administrador' | '-administrador'

export default function AvisosListPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('-fecha')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: Aviso }>(null)

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const avisosQ = useQuery<{ total: number; results: Aviso[] }, Error>({
    queryKey: ['avisos_all'],
    queryFn: () => listAvisos({ page: 1, page_size: 1000, ordering: '-fecha' }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const adminsQ = useQuery<{ total: number; results: AdminLite[] }, Error>({
    queryKey: ['admins_all_for_avisos'],
    queryFn: () => listAdministradoresLite(),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const adminById = useMemo(() => {
    const m = new Map<number, AdminLite>()
    for (const a of adminsQ.data?.results ?? []) m.set(a.id, a)
    return m
  }, [adminsQ.data])

  const del = useMutation({
    mutationFn: (id: number) => deleteAviso(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos_all'] }),
  })

  const all = avisosQ.data?.results ?? []

  // Filtro local
  const filtered = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter(a => {
      const adminTxt = adminLabel(adminById.get(a.administrador), String(a.administrador)).toLowerCase()
      return (
        hay(a.titulo).includes(needle) ||
        hay(a.detalle).includes(needle) ||
        hay(a.fecha).includes(needle) ||
        adminTxt.includes(needle)
      )
    })
  }, [all, qDebounced, adminById])

  // Orden local
  const sorted = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = ordering.replace('-', '') as 'fecha' | 'titulo' | 'administrador'
    const cmp = (a: Aviso, b: Aviso) => {
      const va =
        field === 'administrador'
          ? adminLabel(adminById.get(a.administrador), String(a.administrador)).toLowerCase()
          : String((a as any)[field] ?? '').toLowerCase()
      const vb =
        field === 'administrador'
          ? adminLabel(adminById.get(b.administrador), String(b.administrador)).toLowerCase()
          : String((b as any)[field] ?? '').toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    }
    return [...filtered].sort(cmp)
  }, [filtered, ordering, adminById])

  // Paginación local
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'fecha' | 'titulo' | 'administrador') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Avisos
        </h1>
        <div className="flex gap-2">
          <div className="relative w-72">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, detalle, fecha o admin…"
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
            <Megaphone className="h-5 w-5" /> Nuevo
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <Th label="Fecha" ordering={ordering} field="fecha" onToggle={toggleOrdering} />
                <Th label="Título" ordering={ordering} field="titulo" onToggle={toggleOrdering} />
                <Th label="Administrador" ordering={ordering} field="administrador" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {avisosQ.isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                    ))}
                    <td className="px-4 py-3 text-right"><div className="h-8 bg-slate-200 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados para tu búsqueda.' : 'Aún no hay avisos.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((a) => {
                  const admin = adminById.get(a.administrador)
                  return (
                    <tr key={a.id} className="border-t align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-4 w-4 opacity-60" /> {a.fecha}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{a.titulo}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <User2 className="h-4 w-4 opacity-60" /> {adminLabel(admin, String(a.administrador))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[520px]">
                        <div className="line-clamp-3">{a.detalle}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setOpenForm({ mode: 'edit', record: a })}
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" /> Editar
                          </button>
                          <button
                            onClick={async () => {
                              const ok = confirm(`¿Eliminar el aviso "${a.titulo}" del ${a.fecha}?`)
                              if (!ok) return
                              await del.mutateAsync(a.id)
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
            {avisosQ.isFetching ? 'Actualizando…' : `Total: ${total}`}
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
        <AvisoFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['avisos_all'] })
          }}
        />
      )}
    </div>
  )
}

function Th({ label, ordering, field, onToggle }: {
  label: string
  ordering: string
  field: 'fecha' | 'titulo' | 'administrador'
  onToggle: (f: 'fecha' | 'titulo' | 'administrador') => void
}) {
  const active = ordering === field || ordering === `-${field}`
  const desc = ordering === `-${field}`
  return (
    <th className="px-4 py-3 whitespace-nowrap">
      <button onClick={() => onToggle(field)} className="inline-flex items-center gap-1">
        {label} {active ? (desc ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />) : null}
      </button>
    </th>
  )
}
