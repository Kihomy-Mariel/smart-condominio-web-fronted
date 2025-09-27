// src/pages/admins/AdminFormPage.tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createAdmin,
  updateAdmin,
  getAdmin,
  type Admin,
  type CreateAdminInput,
  type UpdateAdminInput,
} from '@/services/admins.service'

const schema = z.object({
  nombres: z.string().min(2, 'Mínimo 2 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres'),
  carnet: z.string().min(5, 'Carnet inválido'),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  password: z.string().optional(),
})

type Props = {
  mode: 'create' | 'edit'
}

export default function AdminFormPage({ mode }: Props) {
  const navigate = useNavigate()
  const params = useParams()
  const id = mode === 'edit' ? Number(params.id) : undefined

  // Query cuando editamos
  const { data: record, isLoading: loadingRecord, isError } = useQuery<Admin>({
    queryKey: ['admin', id],
    queryFn: () => getAdmin(id!),
    enabled: mode === 'edit' && !!id,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombres: '',
      apellido: '',
      carnet: '',
      telefono: '',
      direccion: '',
      email: '',
      password: '',
    },
  })

  useEffect(() => {
    if (mode === 'edit' && record) {
      reset({
        nombres: record.nombres,
        apellido: record.apellido,
        carnet: record.carnet,
        telefono: record.telefono ?? '',
        direccion: record.direccion ?? '',
        email: record.email ?? '',
        password: '',
      })
    }
  }, [mode, record, reset])

  const createMut = useMutation({
    mutationFn: (input: CreateAdminInput) => createAdmin(input),
    onSuccess: () => navigate('/admins', { replace: true }),
  })

  const updateMut = useMutation({
    mutationFn: (input: UpdateAdminInput) => updateAdmin(id!, input),
    onSuccess: () => navigate('/admins', { replace: true }),
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    if (mode === 'create') {
      const payload: CreateAdminInput = {
        nombres: values.nombres.trim(),
        apellido: values.apellido.trim(),
        carnet: values.carnet.trim(),
        telefono: values.telefono?.trim() || '',
        direccion: values.direccion?.trim() || '',
        email: values.email?.trim() || '',
        password: values.password?.trim() || undefined,
      }
      await createMut.mutateAsync(payload)
    } else {
      const payload: UpdateAdminInput = {
        nombres: values.nombres.trim(),
        apellido: values.apellido.trim(),
        carnet: values.carnet.trim(),
        telefono: values.telefono?.trim() || '',
        direccion: values.direccion?.trim() || '',
        email: values.email?.trim() || '',
      }
      if (values.password && values.password.trim()) {
        payload.password = values.password.trim()
      }
      await updateMut.mutateAsync(payload)
    }
  }

  const submitting = isSubmitting || createMut.isPending || updateMut.isPending

  if (mode === 'edit' && loadingRecord) {
    return <div className="p-6 text-slate-500">Cargando administrador…</div>
  }
  if (mode === 'edit' && isError) {
    return (
      <div className="p-6 text-red-600">
        Error cargando administrador.
        <button onClick={() => navigate('/admins')} className="ml-2 underline">
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {mode === 'create'
            ? 'Nuevo administrador'
            : `Editar: ${record?.apellido ?? ''}, ${record?.nombres ?? ''}`}
        </h1>
        <button
          onClick={() => navigate('/admins')}
          className="rounded-lg border px-3 py-1.5 hover:bg-slate-50"
        >
          Volver
        </button>
      </div>

      <form
        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div>
          <label className="text-sm">Nombres</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('nombres')} />
          {errors.nombres && <p className="text-sm text-red-600 mt-1">{errors.nombres.message}</p>}
        </div>
        <div>
          <label className="text-sm">Apellido</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('apellido')} />
          {errors.apellido && <p className="text-sm text-red-600 mt-1">{errors.apellido.message}</p>}
        </div>

        <div>
          <label className="text-sm">Carnet</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('carnet')} />
          {errors.carnet && <p className="text-sm text-red-600 mt-1">{errors.carnet.message}</p>}
        </div>
        <div>
          <label className="text-sm">Teléfono</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('telefono')} />
          {errors.telefono && <p className="text-sm text-red-600 mt-1">{errors.telefono.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="text-sm">Dirección</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('direccion')} />
          {errors.direccion && <p className="text-sm text-red-600 mt-1">{errors.direccion.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="text-sm">Correo</label>
          <input type="email" className="mt-1 w-full rounded-xl border px-3 py-2" {...register('email')} />
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message as string}</p>}
        </div>

        {mode === 'edit' && record && (
          <div className="md:col-span-2 text-sm text-slate-600">
            Usuario (auto): <span className="font-mono">{record.usuario}</span>
          </div>
        )}

        <div className="md:col-span-2">
          <label className="text-sm">Contraseña (opcional)</label>
          <input type="password" className="mt-1 w-full rounded-xl border px-3 py-2" {...register('password')} />
          <p className="text-xs text-slate-500 mt-1">
            En creación: si lo dejas vacío, se usará el carnet. En edición: si lo dejas vacío, no cambia.
          </p>
        </div>

        <div className="md:col-span-2 mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/admins')}
            className="rounded-xl border px-4 py-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {mode === 'create' ? 'Crear' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
