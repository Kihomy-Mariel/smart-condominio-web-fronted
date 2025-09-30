import { useEffect, useRef, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'

import {
  createResidente,
  updateResidente,
  type Residente,
  type CreateResidenteInput,
  type UpdateResidenteInput,
} from '@/services/residentes.service'

import { listCopropietarios } from '@/services/copropietarios.service'

type CopropietarioLite = {
  id: number
  nombre: string
  apellido: string
  carnet: string
  correo: string
  usuario?: string
}

const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres'),
  carnet: z.string().min(3, 'Mínimo 3 caracteres'),
  correo: z.string().email('Correo inválido'),
  celular: z.string().min(6, 'Mínimo 6 dígitos'),
  copropietario: z.number().int('Debe ser entero').positive('Selecciona un copropietario'),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: Residente
  onClose: () => void
  onSaved: () => void
}

function coproLabel(c?: CopropietarioLite) {
  if (!c) return ''
  const nom = (c.nombre ?? '').trim()
  const ape = (c.apellido ?? '').trim()
  const full = [nom, ape].filter(Boolean).join(' ')
  return full || `Copropietario ${c.id}`
}

export function ResidenteFormDialog({ mode, record, onClose, onSaved }: Props) {
  // catálogo de copropietarios
  const coprosQ = useQuery<{ total: number; results: CopropietarioLite[] }, Error>({
    queryKey: ['copropietarios_all_for_form_residente'],
    queryFn: () => listCopropietarios({ page: 1, page_size: 1000, ordering: 'apellido' }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const copros = coprosQ.data?.results ?? []
  const [search, setSearch] = useState('')

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
          nombre: record.nombre,
          apellido: record.apellido,
          carnet: record.carnet,
          correo: record.correo,
          celular: record.celular,
          copropietario: record.copropietario,
        }
      : {
          nombre: '',
          apellido: '',
          carnet: '',
          correo: '',
          celular: '',
          copropietario: 0,
        },
  })

  const selectedCoproId = watch('copropietario')
  const selectedCopro = copros.find(c => c.id === selectedCoproId)

  // Rehidratar al cambiar record
  useEffect(() => {
    if (record) {
      reset({
        nombre: record.nombre,
        apellido: record.apellido,
        carnet: record.carnet,
        correo: record.correo,
        celular: record.celular,
        copropietario: record.copropietario,
      })
    } else {
      reset({
        nombre: '',
        apellido: '',
        carnet: '',
        correo: '',
        celular: '',
        copropietario: 0,
      })
    }
  }, [record, reset])

  // Auto-focus
  useEffect(() => {
    setFocus('nombre')
  }, [setFocus])

  const createMut = useMutation({
    mutationFn: (input: CreateResidenteInput) =>
      createResidente({
        ...input,
        nombre: input.nombre.trim(),
        apellido: input.apellido.trim(),
        carnet: input.carnet.trim(),
        correo: input.correo.trim(),
        celular: input.celular.trim(),
      }),
    onSuccess: onSaved,
  })

  const updateMut = useMutation({
    mutationFn: (input: UpdateResidenteInput) =>
      updateResidente(record!.id, {
        ...input,
        nombre: input.nombre?.trim(),
        apellido: input.apellido?.trim(),
        carnet: input.carnet?.trim(),
        correo: input.correo?.trim(),
        celular: input.celular?.trim(),
      }),
    onSuccess: onSaved,
  })

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const payloadBase = {
      nombre: values.nombre.trim(),
      apellido: values.apellido.trim(),
      carnet: values.carnet.trim(),
      correo: values.correo.trim(),
      celular: values.celular.trim(),
      copropietario: values.copropietario,
    }

    if (mode === 'create') {
      await createMut.mutateAsync(payloadBase)
    } else {
      const payload: UpdateResidenteInput = payloadBase
      await updateMut.mutateAsync(payload)
    }
  }

  const pending = isSubmitting || createMut.isPending || updateMut.isPending

  // ===== UX: cerrar con ESC y clic en backdrop =====
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const clickedOutside = e.target instanceof Node && !cardRef.current.contains(e.target)
    if (clickedOutside) onClose()
  }

  // filtro de copropietarios
  const filteredCopros = copros.filter(c =>
    coproLabel(c).toLowerCase().includes(search.toLowerCase()) ||
    (c.carnet ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.correo ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      onMouseDown={onBackdropMouseDown}
      className="fixed inset-0 z-50 bg-black/40 p-3 overflow-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="residente-dialog-title"
    >
      <div
        ref={cardRef}
        className="mx-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 id="residente-dialog-title" className="text-base font-semibold">
            {mode === 'create' ? 'Nuevo residente' : `Editar: ${record?.nombre} ${record?.apellido}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Contenido con scroll interno */}
        <div className="max-h-[80vh] overflow-y-auto px-4 py-3">
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FormValues>)}
          >
            <div>
              <label className="text-sm">Nombre</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
            </div>

            <div>
              <label className="text-sm">Apellido</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('apellido')} />
              {errors.apellido && <p className="text-xs text-red-600 mt-1">{errors.apellido.message}</p>}
            </div>

            <div>
              <label className="text-sm">Carnet</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('carnet')} />
              {errors.carnet && <p className="text-xs text-red-600 mt-1">{errors.carnet.message}</p>}
            </div>

            <div>
              <label className="text-sm">Correo</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('correo')} />
              {errors.correo && <p className="text-xs text-red-600 mt-1">{errors.correo.message}</p>}
            </div>

            <div>
              <label className="text-sm">Celular</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('celular')} />
              {errors.celular && <p className="text-xs text-red-600 mt-1">{errors.celular.message}</p>}
            </div>

            {/* Copropietario con buscador */}
            <div className="md:col-span-2 relative z-10">
              <label className="text-sm">Copropietario</label>
              <input
                type="text"
                placeholder="Buscar copropietario por nombre/carnet/correo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg bg-white shadow">
                {filteredCopros.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No hay resultados</div>
                ) : (
                  filteredCopros.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setValue('copropietario', c.id, { shouldValidate: true, shouldDirty: true })
                        setSearch(coproLabel(c))
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${
                        selectedCoproId === c.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      {coproLabel(c)} — <span className="text-slate-500">{c.carnet}</span>
                    </div>
                  ))
                )}
              </div>
              {errors.copropietario && <p className="text-xs text-red-600 mt-1">{errors.copropietario.message}</p>}
              {selectedCopro && (
                <p className="text-xs text-slate-500 mt-1">Seleccionado: {coproLabel(selectedCopro)}</p>
              )}
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

