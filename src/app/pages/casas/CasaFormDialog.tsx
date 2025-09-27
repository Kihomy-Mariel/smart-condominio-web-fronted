// src/app/pages/casas/CasaFormDialog.tsx
import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller, type SubmitHandler, type ControllerRenderProps } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import {
  crearCasa,
  crearDepartamento,
  updateCasa,
  type Casa,
  type CreateCasaCasaInput,
  type CreateDepartamentoInput,
  type UpdateCasaInput,
  type CasaTipo,
} from '@/services/casas.service'

import {
  listCopropietarios,
  type Copropietario,
} from '@/services/copropietarios.service'

// ============ Schema: todos los inputs como string ============
const schema = z.object({
  numero: z.string().min(1, 'Número requerido'),
  tipo: z.enum(['CASA', 'DEPARTAMENTO']),
  piso: z.string().optional().or(z.literal('')),
  torre: z.string().optional().or(z.literal('')),
  bloque: z.string().optional().or(z.literal('')),
  direccion: z.string().optional().or(z.literal('')),
  area_m2: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => v === '' || !Number.isNaN(Number(v)), 'Número inválido'),
  copropietario: z
    .string()
    .min(1, 'Copropietario requerido')
    .regex(/^\d+$/, 'ID inválido'),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: Casa
  onClose: () => void
  onSaved: () => void
}

export default function CasaFormDialog({ mode, record, onClose, onSaved }: Props) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: record
      ? {
          numero: record.numero ?? '',
          tipo: record.tipo ?? 'CASA',
          piso: record.tipo === 'CASA' ? '' : String(record.piso ?? ''),
          torre: record.torre ?? '',
          bloque: record.bloque ?? '',
          direccion: record.direccion ?? '',
          area_m2:
            record.area_m2 === null || record.area_m2 === undefined
              ? ''
              : String(record.area_m2),
          copropietario: String(record.copropietario ?? ''),
        }
      : {
          numero: '',
          tipo: 'CASA',
          piso: '',
          torre: '',
          bloque: '',
          direccion: '',
          area_m2: '',
          copropietario: '',
        },
  })

  // Rehidratar al cambiar record
  useEffect(() => {
    if (record) {
      reset({
        numero: record.numero ?? '',
        tipo: record.tipo ?? 'CASA',
        piso: record.tipo === 'CASA' ? '' : String(record.piso ?? ''),
        torre: record.torre ?? '',
        bloque: record.bloque ?? '',
        direccion: record.direccion ?? '',
        area_m2:
          record.area_m2 === null || record.area_m2 === undefined
            ? ''
            : String(record.area_m2),
        copropietario: String(record.copropietario ?? ''),
      })
    } else {
      reset({
        numero: '',
        tipo: 'CASA',
        piso: '',
        torre: '',
        bloque: '',
        direccion: '',
        area_m2: '',
        copropietario: '',
      })
    }
  }, [record, reset])

  // Limpiar / deshabilitar según tipo
  const tipo = watch('tipo')

  // Piso siempre vacío en CASA
  useEffect(() => {
    if (tipo === 'CASA') setValue('piso', '', { shouldValidate: true })
  }, [tipo, setValue])

  // Torre solo para DEPARTAMENTO; Bloque solo para CASA
  useEffect(() => {
    if (tipo === 'CASA') {
      setValue('torre', '', { shouldValidate: true })
    } else {
      setValue('bloque', '', { shouldValidate: true })
    }
  }, [tipo, setValue])

  // ====== Sugerencia dinámica de código de ubicación ======
  const numeroVal = watch('numero')
  const bloqueVal = watch('bloque')
  const pisoVal   = watch('piso')
  const torreVal  = watch('torre')

  const onlyDigits = (s?: string) => (s ?? '').replace(/\D+/g, '')
  const two = (s?: string) => {
    const n = onlyDigits(s)
    if (!n) return '00'
    return n.length === 1 ? `0${n}` : n.slice(-2)
  }

  // CASA -> CAS-B{bloque}-N{numero}
  const codeCasa = `CAS-B${two(bloqueVal)}-N${two(numeroVal)}`
  // DEPTO -> DEP-T{torre}-P{piso}-N{numero}
  const codeDepto = `DEP-T${two(torreVal)}-P${two(pisoVal)}-N${two(numeroVal)}`
  const codeSugerido = tipo === 'CASA' ? codeCasa : codeDepto

  // Mutations
  const createCasaMut = useMutation({
    mutationFn: (input: CreateCasaCasaInput) => crearCasa(input),
    onSuccess: onSaved,
  })
  const createDeptoMut = useMutation({
    mutationFn: (input: CreateDepartamentoInput) => crearDepartamento(input),
    onSuccess: onSaved,
  })
  const updateMut = useMutation({
    mutationFn: (input: UpdateCasaInput) => updateCasa(record!.id, input),
    onSuccess: onSaved,
  })

  // Submit: convertir strings a números/null
  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const base = {
      numero: values.numero.trim(),
      torre: values.torre?.trim() || '',
      bloque: values.bloque?.trim() || '',
      direccion: values.direccion?.trim() || '',
      area_m2: values.area_m2 ? Number(values.area_m2) : undefined,
      copropietario: Number(values.copropietario),
    }

    if (mode === 'create') {
      if (values.tipo === 'CASA') {
        await createCasaMut.mutateAsync({ ...base })
      } else {
        const pisoNum = Number(values.piso)
        if (Number.isNaN(pisoNum)) {
          throw new Error('Piso es obligatorio para DEPARTAMENTO')
        }
        await createDeptoMut.mutateAsync({ ...base, piso: pisoNum })
      }
    } else {
      const payload: UpdateCasaInput = {
        numero: base.numero,
        torre: base.torre,
        bloque: base.bloque,
        direccion: base.direccion,
        area_m2: base.area_m2,
        copropietario: base.copropietario,
        tipo: values.tipo as CasaTipo,
        piso: values.tipo === 'CASA' ? null : (values.piso ? Number(values.piso) : null),
      }
      await updateMut.mutateAsync(payload)
    }
  }

  const pending =
    isSubmitting || createCasaMut.isPending || createDeptoMut.isPending || updateMut.isPending

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 overflow-auto">
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* Header compacto fijo */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 className="text-base font-semibold">
            {mode === 'create' ? 'Nueva unidad' : `Editar unidad #${record?.id} (${record?.tipo})`}
          </h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 hover:bg-slate-100">✕</button>
        </div>

        {/* Contenido con scroll interno */}
        <div className="max-h-[80vh] overflow-y-auto px-4 py-3">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm">Tipo</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2" {...register('tipo')}>
                <option value="CASA">CASA</option>
                <option value="DEPARTAMENTO">DEPARTAMENTO</option>
              </select>
              {errors.tipo && <p className="text-xs text-red-600 mt-1">{errors.tipo.message as string}</p>}
            </div>

            <div>
              <label className="text-sm">Número</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('numero')} />
              {errors.numero && <p className="text-xs text-red-600 mt-1">{errors.numero.message}</p>}
            </div>

            {/* Piso solo DEPARTAMENTO */}
            <div>
              <label className="text-sm">Piso</label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder={tipo === 'DEPARTAMENTO' ? 'Ej. 3' : 'No aplica a CASA'}
                disabled={tipo !== 'DEPARTAMENTO'}
                {...register('piso')}
              />
              {errors.piso && <p className="text-xs text-red-600 mt-1">{errors.piso.message as string}</p>}
            </div>

            {/* Torre solo DEPARTAMENTO */}
            <div>
              <label className="text-sm">Torre</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder={tipo === 'DEPARTAMENTO' ? 'Ej. Torre Norte' : 'No aplica a CASA'}
                disabled={tipo !== 'DEPARTAMENTO'}
                {...register('torre')}
              />
            </div>

            {/* Bloque solo CASA */}
            <div>
              <label className="text-sm">Bloque</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder={tipo === 'CASA' ? 'Ej. Manzana B' : 'No aplica a DEPARTAMENTO'}
                disabled={tipo !== 'DEPARTAMENTO' ? false : true}
                {...register('bloque')}
              />
            </div>

            {/* Ubicación (código) con ayuda y sugerencia dinámica */}
            <div className="md:col-span-2">
              <label className="text-sm">Ubicación (código)</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                placeholder="Ej.: CAS-B01-N02 (casa) o DEP-T02-P03-N04 (depto.)"
                {...register('direccion')}
              />
              <p className="text-xs text-slate-500 mt-1">
                Formatos:
                {' '}<span className="font-mono">CASA-BLOQUE-NUMERO</span> (ej. <span className="font-mono">CAS-B01-N02</span>).
                {' '}Para departamentos: <span className="font-mono">DEPARTAMENTO-PISO-TORRE-NUMERO</span> (ej. <span className="font-mono">DEP-T02-P03-N04</span>).
                {' '}Sugerido ahora: <span className="font-mono">{codeSugerido}</span>
              </p>
            </div>

            <div>
              <label className="text-sm">Área (m²)</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                placeholder="ej. 85.50"
                {...register('area_m2')}
              />
              {errors.area_m2 && <p className="text-xs text-red-600 mt-1">{errors.area_m2.message as string}</p>}
            </div>

            {/* Autocomplete de Copropietario */}
            <div>
              <Controller
                name="copropietario"
                control={control}
                render={({ field }) => (
                  <CopropietarioAutocomplete
                    field={field}
                    error={errors.copropietario?.message as string | undefined}
                  />
                )}
              />
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

/** =================== Autocomplete de Copropietarios =================== */
function CopropietarioAutocomplete({
  field,
  error,
}: {
  field: ControllerRenderProps<FormValues, 'copropietario'>
  error?: string
}) {
  const { data, isLoading } = useQuery<{ total: number; results: Copropietario[] }, Error>({
    queryKey: ['copropietarios_catalog'],
    queryFn: () => listCopropietarios({ page: 1, page_size: 2000, ordering: 'apellido' }),
    staleTime: 5 * 60_000,
  })

  const items = data?.results ?? []

  // Texto visible en el input y estado de "selección bloqueada"
  const [q, setQ] = useState('')
  const [locked, setLocked] = useState(false)

  const labelFor = (c: Copropietario) =>
    `${c.apellido}, ${c.nombre} — ${c.carnet ?? ''}`.trim()

  // Si el form ya tiene un valor, sincroniza el input (cuando carguen los items)
  useEffect(() => {
    const id = Number(field.value)
    if (!id) return
    const c = items.find(x => x.id === id)
    if (c) {
      setQ(labelFor(c))
      setLocked(true)
    }
  }, [field.value, items])

  // Búsqueda local
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (locked || !n) return items.slice(0, 50)
    const hay = (v?: string | null) => (v ?? '').toLowerCase()
    return items
      .filter(c =>
        hay(c.apellido).includes(n) ||
        hay(c.nombre).includes(n) ||
        hay(c.usuario).includes(n) ||
        hay((c as any).correo).includes(n) ||
        String(c.carnet ?? '').toLowerCase().includes(n)
      )
      .slice(0, 50)
  }, [items, q, locked])

  const selectOne = (c: Copropietario) => {
    field.onChange(String(c.id))
    setQ(labelFor(c))
    setLocked(true)
  }

  const clearSelection = () => {
    field.onChange('')
    setQ('')
    setLocked(false)
  }

  return (
    <div>
      <label className="text-sm">Copropietario</label>

      {/* Input con icono y botón limpiar */}
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
        <input
          value={q}
          onChange={(e) => {
            const val = e.target.value
            if (locked) {
              field.onChange('')
              setLocked(false)
            }
            setQ(val)
          }}
          placeholder="Buscar por apellido, nombre, carnet, email…"
          className="w-full rounded-xl border px-9 pr-9 py-2"
        />
        {q && (
          <button
            type="button"
            aria-label="Limpiar"
            onClick={clearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            ✕
          </button>
        )}
      </div>

      {/* Lista de resultados */}
      <div className="mt-2 max-h-48 overflow-auto rounded-xl border">
        {isLoading ? (
          <div className="p-3 text-sm text-slate-500">Cargando copropietarios…</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-sm text-slate-500">Sin resultados</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((c) => {
              const isSelected = String(c.id) === String(field.value)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectOne(c)}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="font-medium">{c.apellido}, {c.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {c.carnet ?? '—'} • {(c as any).correo ?? '—'} • {c.usuario}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}




