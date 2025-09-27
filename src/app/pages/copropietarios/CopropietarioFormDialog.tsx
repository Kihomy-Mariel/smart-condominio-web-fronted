// pages/copropietarios/CopropietarioFormDialog.tsx
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCopropietario, updateCopropietario } from '@/services/copropietarios.service'
import type {
  Copropietario,
  CreateCopropietarioInput,
  UpdateCopropietarioInput
} from '@/services/copropietarios.service'
import { useMutation } from '@tanstack/react-query'

const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres'),
  carnet: z.string().min(5, 'Carnet inválido'),
  correo: z.string().email('Correo inválido'),
  new_password: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: Copropietario
  onClose: () => void
  onSaved: () => void
}

export function CopropietarioFormDialog({ mode, record, onClose, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setFocus,          // <- usaremos esto para el auto-focus
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: record
      ? {
          nombre: record.nombre,
          apellido: record.apellido,
          carnet: record.carnet,
          correo: record.correo,
          new_password: '',
        }
      : { nombre: '', apellido: '', carnet: '', correo: '', new_password: '' }
  })

  // Rehidratar al cambiar record
  useEffect(() => {
    if (record) {
      reset({
        nombre: record.nombre,
        apellido: record.apellido,
        carnet: record.carnet,
        correo: record.correo,
        new_password: '',
      })
    } else {
      reset({ nombre: '', apellido: '', carnet: '', correo: '', new_password: '' })
    }
  }, [record, reset])

  // Auto-focus en el campo nombre
  useEffect(() => {
    setFocus('nombre')
  }, [setFocus])

  const createMut = useMutation({
    mutationFn: (input: CreateCopropietarioInput) =>
      createCopropietario({ ...input, new_password: input.new_password?.trim() || undefined }),
    onSuccess: onSaved
  })

  const updateMut = useMutation({
    mutationFn: (input: UpdateCopropietarioInput) => updateCopropietario(record!.id, input),
    onSuccess: onSaved
  })

  async function onSubmit(values: FormValues) {
    if (mode === 'create') {
      await createMut.mutateAsync({
        nombre: values.nombre,
        apellido: values.apellido,
        carnet: values.carnet,
        correo: values.correo,
        new_password: values.new_password?.trim() || undefined,
      })
    } else {
      const payload: UpdateCopropietarioInput = {
        nombre: values.nombre,
        apellido: values.apellido,
        carnet: values.carnet,
        correo: values.correo,
      }
      if (values.new_password?.trim()) payload.new_password = values.new_password.trim()
      await updateMut.mutateAsync(payload)
    }
  }

  const pending = isSubmitting || createMut.isPending || updateMut.isPending

  // ===== UX: cerrar con ESC y clic en backdrop =====
  const cardRef = useRef<HTMLDivElement>(null)

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Cerrar al clickear el backdrop (no dentro de la card)
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
      aria-labelledby="copropietario-dialog-title"
    >
      <div
        ref={cardRef}
        className="mx-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()} // evita cierre al interactuar dentro
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 id="copropietario-dialog-title" className="text-base font-semibold">
            {mode === 'create' ? 'Nuevo copropietario' : `Editar: ${record?.apellido}, ${record?.nombre}`}
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
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm">Nombre</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('nombre')}
              />
              {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
            </div>

            <div>
              <label className="text-sm">Apellido</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('apellido')}
              />
              {errors.apellido && <p className="text-xs text-red-600 mt-1">{errors.apellido.message}</p>}
            </div>

            <div>
              <label className="text-sm">Carnet</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('carnet')}
              />
              {errors.carnet && <p className="text-xs text-red-600 mt-1">{errors.carnet.message}</p>}
            </div>

            <div>
              <label className="text-sm">Correo</label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('correo')}
              />
              {errors.correo && <p className="text-xs text-red-600 mt-1">{errors.correo.message}</p>}
            </div>

            {/* Usuario solo en edición */}
            {mode === 'edit' && (
              <div className="md:col-span-2 text-sm text-slate-600">
                Usuario generado (solo lectura):{' '}
                <span className="font-mono">{record?.usuario}</span>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="text-sm">Nueva contraseña (opcional)</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('new_password')}
              />
              <p className="text-xs text-slate-500 mt-1">
                Si lo dejas vacío: en creación el backend usará el carnet; en edición se mantiene la actual.
              </p>
            </div>

            {/* Footer acciones */}
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


