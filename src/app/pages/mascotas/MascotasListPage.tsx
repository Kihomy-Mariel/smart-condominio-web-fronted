// src/app/pages/mascotas/MascotasListPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  listMascotas,
  deleteMascota,
  type Mascota,
} from '@/services/mascotas.service'
import { Plus, Search, Edit, Trash2, SortAsc, SortDesc, Image as ImageIcon, Home } from 'lucide-react'
import { MascotaFormDialog } from './MascotaFormDialog'

// 👇 importa tus casas
import { listCasas } from '@/services/casas.service'
// Si no tienes el tipo exportado, este Lite evita romper TS:
type CasaLite = {
  id: number
  direccion?: string | null
  numero?: string | number | null
  bloque?: string | number | null
}

// Campos ordenables localmente
type Ordering = 'nombre' | '-nombre' | 'raza' | '-raza' | 'color' | '-color' | 'casa' | '-casa'

// Util para mostrar base64 como <img src="data:...">
function b64ToImgSrc(b64?: string | null) {
  if (!b64) return ''
  const t = (b64 || '').trim()
  if (t.startsWith('data:')) return t
  return `data:image/jpeg;base64,${t}`
}

// Construye la etiqueta visible para una casa
function casaLabel(c?: CasaLite, fallback?: string) {
  if (!c) return fallback ?? ''
  const dir = (c.direccion ?? '').toString().trim()
  if (dir) return dir
  const parts = [c.bloque, c.numero].map(v => (v ?? '').toString().trim()).filter(Boolean)
  if (parts.length) return parts.join(' - ')
  return `Casa ${c.id}`
}

export default function MascotasListPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('nombre')
  const [openForm, setOpenForm] = useState<null | { mode: 'create' } | { mode: 'edit'; record: Mascota }>(null)

  // Debounce buscador
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Mascotas
  const { data, isLoading, isFetching } = useQuery<
    { total: number; results: Mascota[] },
    Error
  >({
    queryKey: ['mascotas_all'],
    queryFn: () => listMascotas({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  // 👇 Casas (catálogo para mostrar dirección)
  const casasQ = useQuery<{ total: number; results: CasaLite[] }, Error>({
    queryKey: ['casas_all_for_mascotas'],
    queryFn: () => listCasas({ page: 1, page_size: 1000 }), // trae un buen lote
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  // Mapa id -> casa
  const casaById = useMemo(() => {
    const list = casasQ.data?.results ?? []
    const m = new Map<number, CasaLite>()
    for (const c of list) m.set(c.id, c)
    return m
  }, [casasQ.data])

  const del = useMutation({
    mutationFn: (id: number) => deleteMascota(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mascotas_all'] }),
  })

  const all = data?.results ?? []

  // --- Filtro local (incluye dirección de casa) ---
  const filtered: Mascota[] = useMemo(() => {
    if (!qDebounced) return all
    const needle = qDebounced.toLowerCase()
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return all.filter(r => {
      const casaTxt = casaLabel(casaById.get(r.casa), String(r.casa))
      return (
        hay(r.nombre).includes(needle) ||
        hay(r.raza).includes(needle) ||
        hay(r.color).includes(needle) ||
        casaTxt.toLowerCase().includes(needle)
      )
    })
  }, [all, qDebounced, casaById])

  // --- Orden local (por texto de la casa) ---
  const sorted: Mascota[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    const field = (ordering.replace('-', '') as 'nombre' | 'raza' | 'color' | 'casa')
    const cmp = (a: Mascota, b: Mascota) => {
      const va = field === 'casa'
        ? casaLabel(casaById.get(a.casa), String(a.casa)).toLowerCase()
        : String((a as any)[field] ?? '').toLowerCase()
      const vb = field === 'casa'
        ? casaLabel(casaById.get(b.casa), String(b.casa)).toLowerCase()
        : String((b as any)[field] ?? '').toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return  1 * dir
      return 0
    }
    return [...filtered].sort(cmp)
  }, [filtered, ordering, casaById])

  // --- Paginación local ---
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'nombre' | 'raza' | 'color' | 'casa') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  // Reiniciar a página 1 ante cambios
  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Mascotas</h1>
        <div className="flex gap-2">
          <div className="relative w-72">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, raza, color o dirección…"
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
                <th className="px-4 py-3">Foto</th>
                <Th label="Nombre" ordering={ordering} field="nombre" onToggle={toggleOrdering} />
                <Th label="Raza" ordering={ordering} field="raza" onToggle={toggleOrdering} />
                <Th label="Color" ordering={ordering} field="color" onToggle={toggleOrdering} />
                <Th label="Casa" ordering={ordering} field="casa" onToggle={toggleOrdering} />
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-10 w-10 rounded bg-slate-200" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-8 bg-slate-200 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced ? 'No hay resultados para tu búsqueda.' : 'Aún no hay mascotas.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => {
                  const casa = casaById.get(r.casa)
                  const label = casaLabel(casa, String(r.casa))
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3">
                        {r.foto ? (
                          <img
                            src={b64ToImgSrc(r.foto)}
                            alt={r.nombre}
                            className="h-10 w-10 rounded object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-10 grid place-items-center rounded border text-slate-400">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{r.nombre}</td>
                      <td className="px-4 py-3">{r.raza ?? '—'}</td>
                      <td className="px-4 py-3">{r.color ?? '—'}</td>
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
                              const ok = confirm(`¿Eliminar a "${r.nombre}"?`)
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
        <MascotaFormDialog
          mode={openForm.mode}
          record={openForm.mode === 'edit' ? openForm.record : undefined}
          onClose={() => setOpenForm(null)}
          onSaved={() => {
            setOpenForm(null)
            qc.invalidateQueries({ queryKey: ['mascotas_all'] })
          }}
        />
      )}
    </div>
  )
}

function Th({ label, ordering, field, onToggle }: {
  label: string
  ordering: string
  field: 'nombre' | 'raza' | 'color' | 'casa'
  onToggle: (f: 'nombre' | 'raza' | 'color' | 'casa') => void
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
