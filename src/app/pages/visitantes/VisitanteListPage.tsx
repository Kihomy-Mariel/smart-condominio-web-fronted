// pages/visitantes/VisitantesListPage.tsx
import { useEffect, useMemo, useState, useRef } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  Calendar,
  Users,
  Image as ImageIcon,
  Search,
  ShieldQuestion,
  SortAsc,
  SortDesc,
  User2,
  CarFront,
  X,
} from 'lucide-react'
import {
  listVisitantes,
  listVisitantesPorFecha,
  type Visitante,
  b64ToImgSrc
} from '@/services/visitantes.service'
import { listCopropietarios, type Copropietario } from '@/services/copropietarios.service'

type Ordering =
  | 'created_at' | '-created_at'
  | 'nombre'     | '-nombre'
  | 'placa'      | '-placa'
  | 'estado'     | '-estado'

export default function VisitantesListPage() {
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [copName, setCopName] = useState('')
  const [copNameDebounced, setCopNameDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState<Ordering>('created_at')
  const [fecha, setFecha] = useState<string>('') // YYYY-MM-DD

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    const t = setTimeout(() => setCopNameDebounced(copName.trim()), 300)
    return () => clearTimeout(t)
  }, [copName])

  const queryKey = ['visitantes_all', { fecha }]
  const { data, isLoading, isFetching } = useQuery<{ total: number; results: Visitante[] }, Error>({
    queryKey,
    queryFn: async () => fecha
      ? listVisitantesPorFecha(fecha, { page: 1, page_size: 1000 })
      : listVisitantes({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const copQuery = useQuery<{ total: number; results: Copropietario[] }, Error>({
    queryKey: ['copropietarios_min'],
    queryFn: () => listCopropietarios({ page: 1, page_size: 1000, ordering: 'apellido' }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  const copMap: Record<number, string> = useMemo(() => {
    const m: Record<number, string> = {}
    for (const c of (copQuery.data?.results ?? [])) {
      m[c.id] = `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim() || c.usuario || String(c.id)
    }
    return m
  }, [copQuery.data])

  const all = data?.results ?? []

  const filtered: Visitante[] = useMemo(() => {
    const list = all.filter(r => {
      if (qDebounced) {
        const needle = qDebounced.toLowerCase()
        const hay = (v?: string | null) => (v ?? '').toLowerCase()
        const matchQ =
          hay(r.nombre).includes(needle) ||
          hay(r.placa).includes(needle) ||
          hay(r.estado_texto).includes(needle) ||
          hay(r.fechaIngreso).includes(needle) ||
          hay(r.horaIngreso).includes(needle)
        if (!matchQ) return false
      }
      if (copNameDebounced) {
        const copFull = (copMap[r.copropietario] || '').toLowerCase()
        if (!copFull.includes(copNameDebounced.toLowerCase())) return false
      }
      return true
    })
    return list
  }, [all, qDebounced, copNameDebounced, copMap])

  const sorted: Visitante[] = useMemo(() => {
    const dir = ordering.startsWith('-') ? -1 : 1
    toString
    const field = (ordering.replace('-', '') as 'created_at' | 'nombre' | 'placa' | 'estado')
    const cmp = (a: Visitante, b: Visitante) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (field === 'estado') {
        va = a.estado
        vb = b.estado
      } else {
        va = String((a as any)[field] ?? '').toLowerCase()
        vb = String((b as any)[field] ?? '').toLowerCase()
      }
      if (va < vb) return -1 * dir
      if (va > vb) return  1 * dir
      return 0
    }
    return [...filtered].sort(cmp)
  }, [filtered, ordering])

  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  function toggleOrdering(field: 'created_at' | 'nombre' | 'placa' | 'estado') {
    setOrdering(prev => (prev === field ? (`-${field}` as Ordering) : (field as Ordering)))
  }

  useEffect(() => { setPage(1) }, [qDebounced, pageSize, ordering, fecha, copNameDebounced])

  const [openPreview, setOpenPreview] = useState<null | Visitante>(null)

  // ===== UX modal fotos: cerrar con ESC y clic en backdrop (como GuardiaFormDialog) =====
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openPreview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPreview(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openPreview])

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const clickedOutside = e.target instanceof Node && !cardRef.current.contains(e.target)
    if (clickedOutside) setOpenPreview(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <ShieldQuestion className="h-6 w-6" /> Visitantes
        </h1>

        {/* Controles: SIEMPRE en fila, con scroll horizontal si no entra */}
        <div className="relative -mx-4 md:mx-0">
          <div
            className="mx-4 flex items-center gap-2 md:gap-3 overflow-x-auto whitespace-nowrap pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* Buscador general */}
            <div className="relative shrink-0 w-[260px]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, placa, estado…"
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

            {/* Filtro por fecha */}
            <div className="shrink-0 inline-flex items-center gap-2 rounded-xl border px-2 py-1.5">
              <Calendar className="h-5 w-5 opacity-70" />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-md border px-2 py-1"
                aria-label="Filtrar por fecha de ingreso"
              />
              {fecha && (
                <button
                  onClick={() => setFecha('')}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Filtro por copropietario */}
            <div className="relative shrink-0 w-[260px]">
              <input
                value={copName}
                onChange={(e) => setCopName(e.target.value)}
                placeholder="Copropietario (nombre/apellido)"
                className="w-full rounded-xl border border-slate-300 bg-transparent px-10 py-2 outline-none focus:ring"
              />
              <Users className="absolute left-3 top-2.5 h-5 w-5 opacity-70" />
              {!!copName && (
                <button
                  onClick={() => setCopName('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  aria-label="Limpiar filtro copropietario"
                >✕</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <Th label="Creado" ordering={ordering} field="created_at" onToggle={toggleOrdering} />
                <Th label="Nombre" ordering={ordering} field="nombre" onToggle={toggleOrdering} />
                <Th label="Placa" ordering={ordering} field="placa" onToggle={toggleOrdering} />
                <Th label="Estado" ordering={ordering} field="estado" onToggle={toggleOrdering} />
                <th className="px-4 py-3">Ingreso</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3">Copropietario</th>
                <th className="px-4 py-3">Fotos</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(8).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    {qDebounced || fecha || copNameDebounced
                      ? 'No hay resultados para los filtros aplicados.'
                      : 'Aún no hay visitantes.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <User2 className="h-4 w-4 opacity-60" /> {r.nombre}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <CarFront className="h-4 w-4 opacity-60" /> {r.placa || <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EstadoBadge estado={r.estado} texto={r.estado_texto} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs text-slate-600">
                        {r.fechaIngreso} <span className="opacity-70">{r.horaIngreso}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.fechaSalida ? (
                        <div className="text-xs text-slate-600">
                          {r.fechaSalida} <span className="opacity-70">{r.horaSalida}</span>
                        </div>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">{copMap[r.copropietario] ?? r.copropietario}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PhotosButton
                        hasPhotos={!!(r.foto1_b64 || r.foto2_b64)}
                        onClick={() => setOpenPreview(r)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / paginación */}
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

      {/* Modal de fotos grandes — patrón sticky + scroll interno */}
      {openPreview && (
        <div
          onMouseDown={onBackdropMouseDown}
          className="fixed inset-0 z-50 bg-black/60 p-3 overflow-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fotos-dialog-title"
        >
          <div
            ref={cardRef}
            className="mx-auto w-full sm:w-auto sm:max-w-[1000px] rounded-none sm:rounded-2xl bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header sticky */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b px-3 sm:px-4 py-3 bg-white rounded-t-2xl">
              <h3 id="fotos-dialog-title" className="text-base sm:text-lg font-semibold">
                Fotos de {openPreview.nombre}
              </h3>
              <button
                onClick={() => setOpenPreview(null)}
                className="rounded-md p-2 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenido con scroll interno (altura controlada) */}
            <div className="max-h-[85vh] overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <BigImage src={b64ToImgSrc(openPreview.foto1_b64)} alt={`foto1-${openPreview.id}`} />
                <BigImage src={b64ToImgSrc(openPreview.foto2_b64)} alt={`foto2-${openPreview.id}`} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({
  label,
  ordering,
  field,
  onToggle
}: {
  label: string
  ordering: string
  field: 'created_at' | 'nombre' | 'placa' | 'estado'
  onToggle: (f: 'created_at' | 'nombre' | 'placa' | 'estado') => void
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

function EstadoBadge({ estado, texto }: { estado: number; texto: string }) {
  const map: Record<number, { label: string; cls: string }> = {
    0: { label: texto || 'pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    1: { label: texto || 'ingreso',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    2: { label: texto || 'salio',     cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  }
  const v = map[estado] ?? map[0]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${v.cls}`}>
      {v.label}
    </span>
  )
}

function BigImage({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex items-center justify-center rounded-xl border text-slate-400 min-h-[180px] sm:min-h-[220px]">
        <ImageIcon className="h-6 w-6" />
      </div>
    )
  }
  return (
    <div className="relative flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        className="max-h-[70vh] sm:max-h-[78vh] max-w-full w-auto h-auto object-contain rounded-xl border"
        loading="lazy"
      />
    </div>
  )
}

function PhotosButton({
  hasPhotos,
  onClick,
}: {
  hasPhotos: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!hasPhotos}
      title={hasPhotos ? 'Ver fotos' : 'Sin fotos'}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        "transition-colors whitespace-nowrap",
        hasPhotos
          ? "hover:bg-slate-50 active:brightness-95 shadow-sm"
          : "opacity-60 cursor-not-allowed"
      ].join(' ')}
    >
      <ImageIcon className="h-4 w-4 opacity-70" />
      <span>{hasPhotos ? 'Ver fotos' : 'No disponible'}</span>
    </button>
  )
}



