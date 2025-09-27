// src/app/pages/mascotas/MascotaFormDialog.tsx
import { useEffect, useRef, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  createMascota,
  updateMascota,
  looksLikeBase64,
  type Mascota,
  type CreateMascotaInput,
  type UpdateMascotaInput,
} from '@/services/mascotas.service'
import { listCasas } from '@/services/casas.service'

type CasaLite = {
  id: number
  direccion?: string | null
  numero?: string | number | null
  bloque?: string | number | null
}

const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  raza: z.string().optional(),
  color: z.string().optional(),
  casa: z.number().int('Debe ser entero').positive('Selecciona una casa'),
  foto: z.string().optional().refine((v) => v == null || v === '' || looksLikeBase64(v), {
    message: 'La foto debe ser base64 válida',
  }),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: Mascota
  onClose: () => void
  onSaved: () => void
}

function b64ToImgSrc(b64?: string | null) {
  if (!b64) return ''
  const t = (b64 || '').trim()
  if (t.startsWith('data:')) return t
  return `data:image/jpeg;base64,${t}`
}

function casaLabel(c?: CasaLite) {
  if (!c) return ''
  const dir = (c.direccion ?? '').toString().trim()
  if (dir) return dir
  const parts = [c.bloque, c.numero].map(v => (v ?? '').toString().trim()).filter(Boolean)
  if (parts.length) return parts.join(' - ')
  return `Casa ${c.id}`
}

export function MascotaFormDialog({ mode, record, onClose, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string>(record?.foto ? b64ToImgSrc(record.foto) : '')
  const [fileName, setFileName] = useState<string>('')

  // catálogo de casas
  const casasQ = useQuery<{ total: number; results: CasaLite[] }, Error>({
    queryKey: ['casas_all_for_form'],
    queryFn: () => listCasas({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const casas = casasQ.data?.results ?? []
  const [search, setSearch] = useState('')
  const filteredCasas = casas.filter(c =>
    casaLabel(c).toLowerCase().includes(search.toLowerCase())
  )

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
          raza: record.raza ?? '',
          color: record.color ?? '',
          casa: record.casa,
          foto: record.foto ?? '',
        }
      : { nombre: '', raza: '', color: '', casa: 0, foto: '' },
  })

  const selectedCasaId = watch('casa')
  const selectedCasa = casas.find(c => c.id === selectedCasaId)

  // Rehidratar al cambiar record
  useEffect(() => {
    if (record) {
      reset({
        nombre: record.nombre,
        raza: record.raza ?? '',
        color: record.color ?? '',
        casa: record.casa,
        foto: record.foto ?? '',
      })
      setPreview(record.foto ? b64ToImgSrc(record.foto) : '')
      setFileName('')
    } else {
      reset({ nombre: '', raza: '', color: '', casa: 0, foto: '' })
      setPreview('')
      setFileName('')
    }
  }, [record, reset])

  // Auto-focus
  useEffect(() => {
    setFocus('nombre')
  }, [setFocus])

  // Subir archivo -> convertir a base64
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const i = dataUrl.indexOf(',')
      const base64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
      setValue('foto', base64, { shouldValidate: true, shouldDirty: true })
      setPreview(b64ToImgSrc(base64))
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    setValue('foto', '', { shouldValidate: true, shouldDirty: true })
    setPreview('')
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const createMut = useMutation({
    mutationFn: (input: CreateMascotaInput) =>
      createMascota({ ...input, nombre: input.nombre.trim() }),
    onSuccess: onSaved,
  })

  const updateMut = useMutation({
    mutationFn: (input: UpdateMascotaInput) => updateMascota(record!.id, input),
    onSuccess: onSaved,
  })

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const payloadBase = {
      nombre: values.nombre.trim(),
      raza: values.raza && values.raza.trim() !== '' ? values.raza : undefined,
      color: values.color && values.color.trim() !== '' ? values.color : undefined,
      casa: values.casa,
      foto: values.foto?.trim() ? values.foto.trim() : undefined,
    }

    if (mode === 'create') {
      await createMut.mutateAsync(payloadBase)
    } else {
      const payload: UpdateMascotaInput = payloadBase
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

  return (
    <div
      onMouseDown={onBackdropMouseDown}
      className="fixed inset-0 z-50 bg-black/40 p-3 overflow-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mascota-dialog-title"
    >
      <div
        ref={cardRef}
        className="mx-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 id="mascota-dialog-title" className="text-base font-semibold">
            {mode === 'create' ? 'Nueva mascota' : `Editar: ${record?.nombre}`}
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
            <div className="md:col-span-2">
              <label className="text-sm">Nombre</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('nombre')}
              />
              {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
            </div>

            <div>
              <label className="text-sm">Raza (opcional)</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('raza')} />
            </div>

            <div>
              <label className="text-sm">Color (opcional)</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" {...register('color')} />
            </div>

            {/* Foto uploader */}
            <div className="md:col-span-2">
              <label className="text-sm">Foto</label>
              <div className="mt-1 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center rounded-xl border px-4 py-2 hover:bg-slate-50"
                  >
                    Seleccionar imagen
                  </button>
                  <span className="text-sm text-slate-600">
                    {fileName ? fileName : preview ? 'Imagen cargada' : 'JPG o PNG, máx ~2MB'}
                  </span>
                  {preview && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="inline-flex items-center rounded-xl border px-3 py-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {preview && (
                  <img src={preview} alt="Vista previa" className="h-28 w-28 object-cover rounded border" />
                )}
              </div>
            </div>

            {/* Casa buscador */}
            <div className="md:col-span-2 relative z-10">
              <label className="text-sm">Casa</label>
              <input
                type="text"
                placeholder="Buscar casa…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg bg-white shadow">
                {filteredCasas.length === 0 ? (
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
          </form>
        </div>
      </div>
    </div>
  )
}










