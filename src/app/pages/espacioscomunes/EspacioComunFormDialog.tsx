import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createEspacioComun,
  updateEspacioComun,
  type EspacioComun,
  type CreateEspacioComunInput,
  type UpdateEspacioComunInput,
  type EstadoEspacio,
} from '@/services/espacioscomunes.service'
import { useMutation } from '@tanstack/react-query'
import { Image as ImageIcon } from 'lucide-react'

const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  descripcion: z.string().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO'] as [EstadoEspacio, EstadoEspacio]),
  // foto opcional; guardamos base64 SIN prefijo data:
  foto: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: EspacioComun
  onClose: () => void
  onSaved: () => void
}

function b64ToImgSrc(b64?: string | null) {
  if (!b64) return ''
  const t = (b64 || '').trim()
  if (t.startsWith('data:')) return t
  return `data:image/jpeg;base64,${t}`
}

export default function EspacioComunFormDialog({ mode, record, onClose, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string>(record?.foto ? b64ToImgSrc(record.foto) : '')
  const [fileName, setFileName] = useState<string>('')
  const [formError, setFormError] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setFocus,
    setValue,
  } = useForm<FormValues>({
    // Workaround por posibles desajustes de versiones RHF/Zod (evita submits “tragados”)
    resolver: zodResolver(schema) as any,
    defaultValues: record
      ? {
          nombre: record.nombre,
          descripcion: record.descripcion ?? '',
          estado: record.estado,
          foto: record.foto ?? '',
        }
      : { nombre: '', descripcion: '', estado: 'ACTIVO', foto: '' },
  })

  useEffect(() => {
    if (record) {
      reset({
        nombre: record.nombre,
        descripcion: record.descripcion ?? '',
        estado: record.estado,
        foto: record.foto ?? '',
      })
      setPreview(record.foto ? b64ToImgSrc(record.foto) : '')
      setFileName('')
    } else {
      reset({ nombre: '', descripcion: '', estado: 'ACTIVO', foto: '' })
      setPreview('')
      setFileName('')
    }
    setFormError('')
  }, [record, reset])

  useEffect(() => {
    setFocus('nombre')
  }, [setFocus])

  // Subir archivo -> convertir a base64 (sin prefijo data:)
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setFormError('La imagen supera 2MB; considera comprimirla.')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const i = dataUrl.indexOf(',')
      const base64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
      setValue('foto', base64, { shouldValidate: true, shouldDirty: true })
      setPreview(b64ToImgSrc(base64))
      setFormError('')
    }
    reader.onerror = () => setFormError('No se pudo leer la imagen.')
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    setValue('foto', '', { shouldValidate: true, shouldDirty: true })
    setPreview('')
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const createMut = useMutation({
    mutationFn: (input: CreateEspacioComunInput) => createEspacioComun(input),
    onSuccess: onSaved,
    onError: (e: any) => {
      const d = e?.response?.data
      const msg =
        (typeof d === 'string' && d) ||
        d?.detail ||
        d?.non_field_errors?.join?.(', ') ||
        e?.message ||
        'Error al crear el espacio común.'
      setFormError(String(msg))
    },
  })

  const updateMut = useMutation({
    mutationFn: (input: UpdateEspacioComunInput) => updateEspacioComun(record!.id, input),
    onSuccess: onSaved,
    onError: (e: any) => {
      const d = e?.response?.data
      const msg =
        (typeof d === 'string' && d) ||
        d?.detail ||
        d?.non_field_errors?.join?.(', ') ||
        e?.message ||
        'Error al actualizar el espacio común.'
      setFormError(String(msg))
    },
  })

  const onSubmit = async (values: FormValues) => {
    setFormError('')
    const payload: CreateEspacioComunInput | UpdateEspacioComunInput = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      estado: values.estado,
      foto: values.foto?.trim() || undefined, // base64 sin prefijo
    }
    try {
      if (mode === 'create') {
        await createMut.mutateAsync(payload as CreateEspacioComunInput)
      } else {
        await updateMut.mutateAsync(payload as UpdateEspacioComunInput)
      }
    } catch (e) {
      // el onError ya setea formError; este catch evita romper la promesa de RHF
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
      aria-labelledby="espaciocomun-dialog-title"
    >
      <div
        ref={cardRef}
        className="mx-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 id="espaciocomun-dialog-title" className="text-base font-semibold">
            {mode === 'create' ? 'Nuevo espacio común' : `Editar: ${record?.nombre}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="max-h-[80vh] overflow-y-auto px-4 py-3">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit(onSubmit) as any} noValidate>
            <div className="md:col-span-2">
              <label className="text-sm">Nombre</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('nombre')}
                required
              />
              {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm">Descripción</label>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <p className="text-xs text-red-600 mt-1">{errors.descripcion.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm">Estado</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2" {...register('estado')}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </div>

            {/* Foto: selector + preview + quitar */}
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

                {/* Preview */}
                <div className="h-36 rounded-xl border flex items-center justify-center overflow-hidden">
                  {preview ? (
                    <img src={preview} alt="Vista previa" className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-slate-400 flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" /> Sin imagen
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="md:col-span-2 mt-2 flex items-center justify-between gap-2">
              {/* Error global del formulario / backend */}
              <div className="text-sm text-red-600 min-h-[1.25rem]">
                {formError || ''}
              </div>

              <div className="flex items-center gap-2">
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
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}