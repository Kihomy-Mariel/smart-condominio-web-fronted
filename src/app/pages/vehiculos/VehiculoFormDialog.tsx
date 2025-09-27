// src/app/pages/vehiculos/VehiculoFormDialog.tsx
import { useEffect, useRef, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  createVehiculo,
  updateVehiculo,
  type Vehiculo,
  type CreateVehiculoInput,
  type UpdateVehiculoInput,
} from '@/services/vehiculos.service'
import { listCasas } from '@/services/casas.service'

// ===== Helpers de Casa (para etiqueta de dirección) =====
type CasaLite = {
  id: number
  direccion?: string | null
  bloque?: string | number | null
  numero?: string | number | null
}
function casaLabel(c?: CasaLite) {
  if (!c) return ''
  const dir = (c.direccion ?? '').toString().trim()
  if (dir) return dir
  const parts = [c.bloque, c.numero].map(v => (v ?? '').toString().trim()).filter(Boolean)
  if (parts.length) return parts.join(' - ')
  return `Casa ${c.id}`
}

// ===== Zod schema =====
const placaRegex = /^[A-Z0-9\-.\s]{4,20}$/
const schema = z.object({
  placa: z
    .string()
    .min(4, 'Mínimo 4 caracteres')
    .max(20, 'Máximo 20 caracteres')
    .regex(placaRegex, 'Solo letras, números, guiones o puntos'),
  marca: z.string().max(100, 'Máximo 100').optional(),
  color: z.string().max(50, 'Máximo 50').optional(),
  descripcion: z.string().max(255, 'Máximo 255').optional(),
  // ahora casa es un number seleccionado desde el buscador
  casa: z.number().int().positive('Selecciona una casa'),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: Vehiculo
  onClose: () => void
  onSaved: () => void
}

export function VehiculoFormDialog({ mode, record, onClose, onSaved }: Props) {
  // ==== Cargar catálogo de casas para el buscador ====
  const casasQ = useQuery<{ total: number; results: CasaLite[] }, Error>({
    queryKey: ['casas_all_for_vehiculo_form'],
    queryFn: () => listCasas({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const casas = casasQ.data?.results ?? []
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
          placa: record.placa,
          marca: record.marca ?? undefined,
          color: record.color ?? undefined,
          descripcion: record.descripcion ?? undefined,
          casa: record.casa, // number
        }
      : {
          placa: '',
          marca: undefined,
          color: undefined,
          descripcion: undefined,
          casa: 0,
        },
  })

  const selectedCasaId = watch('casa')
  const selectedCasa = casas.find(c => c.id === selectedCasaId)

  // Rehidratar cuando cambia record
  useEffect(() => {
    if (record) {
      reset({
        placa: record.placa,
        marca: record.marca ?? undefined,
        color: record.color ?? undefined,
        descripcion: record.descripcion ?? undefined,
        casa: record.casa,
      })
      // precargar buscador con etiqueta de la casa
      const c = casas.find(cc => cc.id === record.casa)
      if (c) setSearch(casaLabel(c))
    } else {
      reset({
        placa: '',
        marca: undefined,
        color: undefined,
        descripcion: undefined,
        casa: 0,
      })
      setSearch('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, reset])

  // Autofocus
  useEffect(() => {
    setFocus('placa')
  }, [setFocus])

  // Mutations
  const createMut = useMutation({
    mutationFn: (input: CreateVehiculoInput) =>
      createVehiculo({ ...input, placa: input.placa.trim().toUpperCase() }),
    onSuccess: onSaved,
  })

  const updateMut = useMutation({
    mutationFn: (input: UpdateVehiculoInput) =>
      updateVehiculo(record!.id, {
        ...input,
        ...(input.placa ? { placa: input.placa.trim().toUpperCase() } : {}),
      }),
    onSuccess: onSaved,
  })

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const payload = {
      placa: values.placa.trim().toUpperCase(),
      marca: values.marca,
      color: values.color,
      descripcion: values.descripcion,
      casa: values.casa, // number
    }
    if (mode === 'create') {
      await createMut.mutateAsync(payload)
    } else {
      await updateMut.mutateAsync(payload)
    }
  }

  const pending = isSubmitting || createMut.isPending || updateMut.isPending

  // ===== UX: cerrar con ESC y clic fuera =====
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

  // Filtrado local de casas
  const filteredCasas = casas.filter(c =>
    casaLabel(c).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      onMouseDown={onBackdropMouseDown}
      className="fixed inset-0 z-50 bg-black/40 p-3 overflow-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehiculo-dialog-title"
    >
      <div
        ref={cardRef}
        className="mx-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 id="vehiculo-dialog-title" className="text-base font-semibold">
            {mode === 'create' ? 'Nuevo vehículo' : `Editar: ${record?.placa}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="max-h-[80vh] overflow-y-auto px-4 py-3">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm">Placa <span className="text-red-600">*</span></label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 uppercase"
                placeholder="ABC-123"
                {...register('placa')}
              />
              {errors.placa && <p className="text-xs text-red-600 mt-1">{errors.placa.message}</p>}
            </div>

            <div>
              <label className="text-sm">Marca</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                placeholder="Toyota, Chevrolet…"
                {...register('marca')}
              />
              {errors.marca && <p className="text-xs text-red-600 mt-1">{errors.marca.message}</p>}
            </div>

            <div>
              <label className="text-sm">Color</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                placeholder="Rojo, Negro…"
                {...register('color')}
              />
              {errors.color && <p className="text-xs text-red-600 mt-1">{errors.color.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm">Descripción</label>
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2"
                rows={3}
                placeholder="Notas del vehículo (máx. 255)"
                {...register('descripcion')}
              />
              {errors.descripcion && <p className="text-xs text-red-600 mt-1">{errors.descripcion.message}</p>}
            </div>

            {/* Casa buscador (como en Mascota) */}
            <div className="md:col-span-2 relative z-10">
              <label className="text-sm">Casa</label>
              <input
                type="text"
                placeholder="Buscar casa por dirección/bloque/número…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg bg-white shadow">
                {casasQ.isLoading ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Cargando casas…</div>
                ) : filteredCasas.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No hay resultados</div>
                ) : (
                  filteredCasas.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setValue('casa', c.id, { shouldValidate: true, shouldDirty: true })
                        setSearch(casaLabel(c))
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${
                        selectedCasaId === c.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      {casaLabel(c)}
                    </div>
                  ))
                )}
              </div>
              {errors.casa && <p className="text-xs text-red-600 mt-1">{errors.casa.message}</p>}
              {selectedCasa && (
                <p className="text-xs text-slate-500 mt-1">Seleccionado: {casaLabel(selectedCasa)}</p>
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

            {(createMut.isError || updateMut.isError) && (
              <div className="md:col-span-2 mt-2">
                <ServerError error={createMut.error ?? updateMut.error} />
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

function ServerError({ error }: { error: unknown }) {
  const anyErr = error as any
  const data = anyErr?.response?.data
  if (!data || typeof data !== 'object') {
    return <p className="text-sm text-red-600">Ocurrió un error. Intenta de nuevo.</p>
  }
  return (
    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-2">
      {Object.entries(data as Record<string, any>).map(([k, v]) => (
        <div key={k} className="mt-1">
          <span className="font-semibold">{k}:</span>{' '}
          <span>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
        </div>
      ))}
    </div>
  )
}



