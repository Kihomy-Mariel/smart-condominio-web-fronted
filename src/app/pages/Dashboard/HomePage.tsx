import { useMemo, useState, useDeferredValue, memo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// --- Ajusta estos imports a tu estructura real ---
// Admins
import * as Admins from '../../../services/admins.service'
import type { Admin as AdminUser } from '../../../services/admins.service'

// Guardias (si tu servicio se llama distinto, cámbialo aquí)
import * as Guardias from '../../../services/guardias.service'
// export type Guardia = { id:number; apellido?:string; nombres?:string; ci?:string; telefono?:string; usuario?:string; email?:string }
type Guardia = any

// Visitantes (si tu servicio se llama distinto, cámbialo aquí)
import * as Visitantes from '../../../services/visitantes.service'
// export type Visitante = { id:number; nombre?:string; apellido?:string; ci?:string; placa?:string; created_at?:string }
type Visitante = any

import { Search, Plus, Edit, Trash2, Mail, Phone, Shield, ShieldHalf, ShieldQuestion, Users } from 'lucide-react'

// Helpers
const isTruthy = <T,>(v: T | null | undefined | '' | 0 | false): v is T => !!v
const take = <T,>(xs: T[], n: number) => xs.slice(0, Math.max(0, n))

type AdminIndexed = AdminUser & { _haystack: string }

// Normaliza respuestas: array o { results, count }
function asList<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data?.results && Array.isArray(data.results)) return data.results as T[]
  return []
}
function asCount(data: any): number {
  if (Array.isArray(data)) return data.length
  if (typeof data?.count === 'number') return data.count
  if (Array.isArray(data?.results)) return data.results.length
  return 0
}

export default function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const qDeferred = useDeferredValue(q)

  // -------------------------------
  // Admins
  // -------------------------------
  const {
    data: adminsRaw,
    isLoading: adminsLoading,
    isFetching: adminsFetching,
    error: adminsError,
  } = useQuery({
    queryKey: ['admins', { page: 1, page_size: 1000 }],
    queryFn: async () => Admins.listAdmins({ page: 1, page_size: 1000 } as any),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const adminsList = asList<AdminUser>(adminsRaw)
  const adminsCount = asCount(adminsRaw)

  const items: AdminIndexed[] = useMemo(
    () =>
      adminsList.map((a) => ({
        ...(a as any),
        _haystack: [
          a.usuario,
          a.apellido,
          a.nombres,
          a.carnet,
          a.email,
          a.telefono,
          `${a.apellido || ''} ${a.nombres || ''}`,
        ]
          .filter(isTruthy)
          .join(' ')
          .toLowerCase(),
      })),
    [adminsList]
  )

  const filtered = useMemo(() => {
    const term = qDeferred.trim().toLowerCase()
    if (!term) return items
    return items.filter((a) => a._haystack.includes(term))
  }, [items, qDeferred])

  const removeMutation = useMutation({
    mutationFn: (id: number) => Admins.deleteAdmin(id) as any, // ajusta si tu fn se llama distinto
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ['admins'] })
      const prev = qc.getQueryData<AdminIndexed[]>(['admins'])
      qc.setQueryData<AdminIndexed[]>(['admins'], (old = []) => old.filter((x) => (x as any).id !== id))
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admins'], ctx.prev)
      alert('No se pudo eliminar')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admins'] })
      qc.invalidateQueries({ queryKey: ['admins', { page: 1, page_size: 1000 }] })
    },
  })

  const onDelete = useCallback(
    (id: number) => {
      const ok = window.confirm('¿Eliminar administrador? Esta acción no se puede deshacer.')
      if (ok) removeMutation.mutate(id)
    },
    [removeMutation],
  )

  // -------------------------------
  // Guardias (solo contamos + últimos 5)
  // -------------------------------
  const {
    data: guardiasRaw,
    isLoading: guardiasLoading,
  } = useQuery({
    queryKey: ['guardias', { page: 1, page_size: 50 }],
    queryFn: async () => Guardias.listGuardias?.({ page: 1, page_size: 50 } as any),
    enabled: Boolean(Guardias.listGuardias),
    staleTime: 60_000,
  })
  const guardiasList = asList<Guardia>(guardiasRaw)
  const guardiasCount = asCount(guardiasRaw)
  const guardiasRecent = take(guardiasList, 5)

  // -------------------------------
  // Visitantes (solo contamos + últimos 5)
  // -------------------------------
  const {
    data: visitantesRaw,
    isLoading: visitantesLoading,
  } = useQuery({
    queryKey: ['visitantes', { page: 1, page_size: 50 }],
    queryFn: async () => Visitantes.listVisitantes?.({ page: 1, page_size: 50 } as any),
    enabled: Boolean(Visitantes.listVisitantes),
    staleTime: 60_000,
  })
  const visitantesList = asList<Visitante>(visitantesRaw)
  const visitantesCount = asCount(visitantesRaw)
  const visitantesRecent = take(visitantesList, 5)

  const loadingAny = adminsLoading || guardiasLoading || visitantesLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-3xl font-bold">Panel General</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admins/new')}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground font-medium hover:brightness-110 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            Nuevo administrador
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          title="Administradores"
          value={adminsCount}
          loading={adminsLoading}
          onClick={() => navigate('/admins')}
        />
        <StatCard
          icon={<ShieldHalf className="h-5 w-5" />}
          title="Guardias"
          value={guardiasCount}
          loading={guardiasLoading}
          onClick={() => navigate('/guardias')}
        />
        <StatCard
          icon={<ShieldQuestion className="h-5 w-5" />}
          title="Visitantes"
          value={visitantesCount}
          loading={visitantesLoading}
          onClick={() => navigate('/visitantes')}
        />
      </div>

      {/* Últimos guardias y visitantes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentCard
          title="Últimos guardias"
          icon={<ShieldHalf className="h-4 w-4" />}
          emptyText="No hay guardias."
          rows={guardiasRecent.map((g: any) => ({
            id: g.id,
            title: [g.apellido, g.nombres].filter(isTruthy).join(', ') || `#${g.id}`,
            subtitle: g.usuario || g.email || g.telefono || '—',
          }))}
          loading={guardiasLoading && !guardiasRaw}
          onSeeAll={() => navigate('/guardias')}
        />

        <RecentCard
          title="Últimos visitantes"
          icon={<ShieldQuestion className="h-4 w-4" />}
          emptyText="No hay visitantes."
          rows={visitantesRecent.map((v: any) => ({
            id: v.id,
            title: [v.apellido, v.nombre].filter(isTruthy).join(', ') || v.nombre || `#${v.id}`,
            subtitle: v.placa || v.ci || v.created_at || '—',
          }))}
          loading={visitantesLoading && !visitantesRaw}
          onSeeAll={() => navigate('/visitantes')}
        />
      </div>

      {/* Card de Administradores (lista compacta con búsqueda) */}
      <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <h3 className="font-semibold">Administradores</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="h-10 w-64 max-w-[75vw] rounded-md border border-border bg-input pl-9 pr-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Buscar por nombre, usuario, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {adminsError && (
          <div className="m-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(adminsError as any)?.message || 'No se pudo cargar administradores'}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground [&>th]:px-5 [&>th]:py-3">
                <th>Nombre</th>
                <th className="hidden md:table-cell">Usuario</th>
                <th className="hidden lg:table-cell">Documento</th>
                <th className="hidden lg:table-cell">Contacto</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {adminsLoading ? (
                <RowsLoading />
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={5}>
                    {q ? 'No hay coincidencias con tu búsqueda.' : 'No hay administradores aún.'}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => <Row key={a.id} a={a} onDelete={onDelete} />)
              )}
            </tbody>
          </table>
          {adminsFetching && !adminsLoading && (
            <div className="px-5 py-2 text-xs text-muted-foreground">Actualizando…</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- UI helpers ----------

function StatCard({
  icon,
  title,
  value,
  loading,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  value: number
  loading?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-border bg-card/80 px-4 py-3 text-left shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <span className="text-xs text-muted-foreground group-hover:underline">Ver</span>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">
        {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted" /> : value}
      </div>
    </button>
  )
}

function RecentCard({
  title,
  icon,
  rows,
  emptyText,
  loading,
  onSeeAll,
}: {
  title: string
  icon: React.ReactNode
  rows: { id: number | string; title: string; subtitle?: string }[]
  emptyText: string
  loading?: boolean
  onSeeAll?: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card/80 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h4 className="font-semibold">{title}</h4>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-sm text-muted-foreground hover:underline">
            Ver todos
          </button>
        )}
      </div>
      <ul className="divide-y">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <li key={i} className="px-4 py-3">
              <div className="h-4 w-48 rounded bg-muted animate-pulse" />
              <div className="mt-2 h-3 w-32 rounded bg-muted animate-pulse" />
            </li>
          ))
        ) : rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">{emptyText}</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-muted-foreground">{r.subtitle || '—'}</div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

const Row = memo(function Row({
  a,
  onDelete,
}: {
  a: AdminUser
  onDelete: (id: number) => void
}) {
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/40">
      <td className="px-5 py-3">
        <div className="font-medium">
          {[a.apellido, a.nombres].filter(isTruthy).join(', ') || `#${a.id}`}
        </div>
      </td>
      <td className="px-5 py-3 hidden md:table-cell">{a.usuario}</td>
      <td className="px-5 py-3 hidden lg:table-cell">{(a as any).carnet || '—'}</td>
      <td className="px-5 py-3 hidden lg:table-cell">
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            {(a as any).email || '—'}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {(a as any).telefono || '—'}
          </span>
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/admins/${(a as any).id}/edit`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </Link>
          <button
            onClick={() => onDelete((a as any).id)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted text-destructive"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
})

function RowsLoading() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i} className="border-b border-border/50 last:border-0">
          <td className="px-5 py-3"><div className="h-4 w-40 rounded bg-muted animate-pulse" /></td>
          <td className="px-5 py-3 hidden md:table-cell"><div className="h-4 w-24 rounded bg-muted animate-pulse" /></td>
          <td className="px-5 py-3 hidden lg:table-cell"><div className="h-4 w-20 rounded bg-muted animate-pulse" /></td>
          <td className="px-5 py-3 hidden lg:table-cell"><div className="h-8 w-40 rounded bg-muted animate-pulse" /></td>
          <td className="px-5 py-3"><div className="ml-auto h-8 w-24 rounded bg-muted animate-pulse" /></td>
        </tr>
      ))}
    </>
  )
}
