import { useEffect, useRef, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import { createAviso, updateAviso, type Aviso, type CreateAvisoInput, type UpdateAvisoInput } from '@/services/avisos.service'
import { CalendarDays, User2 } from 'lucide-react'

// ---- Admins (Lite). Reemplaza por tu service real si ya existe ----
type AdminLite = { id: number; usuario?: string; nombre?: string; apellido?: string; email?: string }
async function listAdministradoresLite() {
  const { api } = await import('@/services/api')
  const { data } = await api.get('/administradores/', { params: { page: 1, page_size: 1000 } })
  const results = Array.isArray(data) ? data : (data?.results ?? [])
  return { total: results.length, results: results as AdminLite[] }
}
function adminLabel(a?: AdminLite) {
  if (!a) return ''
  const nombre = [a.nombre, a.apellido].filter(Boolean).join(' ').trim()
  return nombre || a.usuario || a.email || `Admin ${a.id}`
}
// -------------------------------------------------------------------

const schema = z.object({
  titulo: z.string().min(3, 'Mínimo 3 caracteres'),
  detalle: z.string().min(3, 'Mínimo 3 caracteres'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  administrador: z.number().int('Debe ser entero').positive('Selecciona un administrador'),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: Aviso
  onClose: () => void
  onSaved: () => void
}

export function AvisoFormDialog({ mode, record, onClose, onSaved }: Props) {
  const adminsQ = useQuery<{ total: number; results: AdminLite[] }, Error>({
    queryKey: ['admins_all_for_form_aviso'],
    queryFn: () => listAdministradoresLite(),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const admins = adminsQ.data?.results ?? []

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: record
      ? {
          titulo: record.titulo,
          detalle: record.detalle,
          fecha: record.fecha,                // ya viene 'YYYY-MM-DD'
          administrador: record.administrador,
        }
      : {
          titulo: '',
          detalle: '',
          fecha: new Date().toISOString().slice(0, 10), // hoy
          administrador: 0,
        },
  })

  const selectedAdminId = watch('administrador')
  const [adminSearch, setAdminSearch] = useState('')
  const filteredAdmins = admins.filter(a =>
    adminLabel(a).toLowerCase().includes(adminSearch.toLowerCase()) ||
    (a.usuario ?? '').toLowerCase().includes(adminSearch.toLowerCase()) ||
    (a.email ?? '').toLowerCase().includes(adminSearch.toLowerCase())
  )

  useEffect(() => {
    if (record) {
      reset({
        titulo: record.titulo,
        detalle: record.detalle,
        fecha: record.fecha,
        administrador: record.administrador,
      })
    } else {
      reset({
        titulo: '',
        detalle: '',
        fecha: new Date().toISOString().slice(0, 10),
        administrador: 0,
      })
    }
  }, [record, reset])

  useEffect(() => { setFocus('titulo') }, [setFocus])

  // Si tu backend asigna admin automáticamente según el token, podrías ocultar el selector
  // y mandar administrador := id del admin logueado, obtenido de /auth/me.
  const createMut = useMutation({
    mutationFn: (input: CreateAvisoInput) =>
      createAviso({
        ...input,
        titulo: input.titulo.trim(),
        detalle: input.detalle.trim(),
      }),
    onSuccess: onSaved,
  })

  const updateMut = useMutation({
    mutationFn: (input: UpdateAvisoInput) =>
      updateAviso(record!.id, {
        ...input,
        titulo: input.titulo?.trim(),
        detalle: input.detalle?.trim(),
      }),
    onSuccess: onSaved,
  })

  const onSubmit: SubmitHandler<FormValues> = async (v) => {
    const payload = {
      titulo: v.titulo.trim(),
      detalle: v.detalle.trim(),
      fecha: v.fecha,                   // 'YYYY-MM-DD'
      administrador: v.administrador,
    }
    if (mode === 'create') await createMut.mutateAsync(payload)
    else await updateMut.mutateAsync(payload)
  }

  const pending = isSubmitting || createMut.isPending || updateMut.isPending

  // UX cerrar con ESC / backdrop
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const clickedOutside = e.target instanceof Node && !cardRef.current.contains(e.target)
    if (clickedOutside) onClose()
  }

  return (
    <div
      onMouseDown={onBackdropMouseDown}
      className="fixed inset-0 z-50 bg-black/40 p-3 overflow-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-dialog-title"
    >
      <div
        ref={cardRef}
        className="mx-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 id="aviso-dialog-title" className="text-base font-semibold">
            {mode === 'create' ? 'Nuevo aviso' : `Editar: ${record?.titulo}`}
          </h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 hover:bg-slate-100" aria-label="Cerrar">✕</button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-4 py-3">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="md:col-span-2">
              <label className="text-sm">Título</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('titulo')} />
              {errors.titulo && <p className="text-xs text-red-600 mt-1">{errors.titulo.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm">Detalle</label>
              <textarea rows={5} className="mt-1 w-full rounded-xl border px-3 py-2" {...register('detalle')} />
              {errors.detalle && <p className="text-xs text-red-600 mt-1">{errors.detalle.message}</p>}
            </div>

            <div>
              <label className="text-sm">Fecha</label>
              <div className="relative">
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border px-3 py-2 pr-10"
                  {...register('fecha')}
                />
                <CalendarDays className="pointer-events-none absolute right-3 top-3 h-4 w-4 opacity-60" />
              </div>
              {errors.fecha && <p className="text-xs text-red-600 mt-1">{errors.fecha.message}</p>}
            </div>

            {/* Administrador (selector con buscador) */}
            <div className="relative z-10">
              <label className="text-sm">Administrador</label>
              <input
                type="text"
                placeholder="Buscar admin por nombre/usuario/correo…"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg bg-white shadow">
                {filteredAdmins.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No hay resultados</div>
                ) : (
                  filteredAdmins.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        setValue('administrador', a.id, { shouldValidate: true, shouldDirty: true })
                        setAdminSearch(adminLabel(a))
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${
                        selectedAdminId === a.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <User2 className="h-4 w-4 opacity-60" /> {adminLabel(a)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {errors.administrador && <p className="text-xs text-red-600 mt-1">{errors.administrador.message}</p>}
            </div>

            {/* Footer */}
            <div className="md:col-span-2 mt-2 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {mode === 'create' ? 'Crear' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
