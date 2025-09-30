// pages/solicitudes/SolicitudFormDialog.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createSolicitud,
  updateSolicitud,
  verificarDisponibilidad,
  type Solicitud,
  type CreateSolicitudInput,
  type UpdateSolicitudInput,
  type EstadoSolicitud,
} from '@/services/solicitudes.service'
import { listCopropietarios, type Copropietario } from '@/services/copropietarios.service'
import { listEspaciosComunes } from '@/services/espacioscomunes.service'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import { Calendar, Clock, Image as ImageIcon, ShieldQuestion, CheckCircle2, AlertTriangle, UploadCloud, XCircle } from 'lucide-react'

// --------- Zod schema (inferencia) ---------
const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/
const schema = z
  .object({
    fecha: z.string().min(10, 'Fecha requerida (YYYY-MM-DD)'),
    horaInicio: z.string().regex(timeRe, 'Hora inválida (HH:MM)'),
    horaFin: z.string().regex(timeRe, 'Hora inválida (HH:MM)'),
    areacomun: z.coerce.number().int().min(1, 'Área común requerida'),
    copropietario: z.coerce.number().int().min(1, 'Copropietario requerido'),
    estado: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA']).optional(),
    fotoComprobante: z.string().nullable().optional(),
  })
  .refine((v) => v.horaInicio < v.horaFin, {
    message: 'horaFin debe ser mayor que horaInicio',
    path: ['horaFin'],
  })

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'create' | 'edit'
  record?: Solicitud
  onClose: () => void
  onSaved: () => void
}

export function SolicitudFormDialog({ mode, record, onClose, onSaved }: Props) {
  const isEdit = mode === 'edit'
  const disabledCls = isEdit ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''

  // ------- RHF -------
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setFocus,
    watch,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: record
      ? {
          fecha: record.fecha,
          horaInicio: record.horaInicio.slice(0, 5),
          horaFin: record.horaFin.slice(0, 5),
          areacomun: record.areacomun ?? 0,
          copropietario: record.copropietario ?? 0,
          estado: record.estado ?? 'PENDIENTE',
          fotoComprobante: record.fotoComprobante ?? null,
        }
      : {
          fecha: '',
          horaInicio: '',
          horaFin: '',
          areacomun: 0,
          copropietario: 0,
          estado: 'PENDIENTE',
          fotoComprobante: null,
        },
  })

  // Rehidratar cuando cambia record
  useEffect(() => {
    if (record) {
      reset({
        fecha: record.fecha,
        horaInicio: record.horaInicio.slice(0, 5),
        horaFin: record.horaFin.slice(0, 5),
        areacomun: record.areacomun ?? 0,
        copropietario: record.copropietario ?? 0,
        estado: record.estado ?? 'PENDIENTE',
        fotoComprobante: record.fotoComprobante ?? null,
      })
    } else {
      reset({
        fecha: '',
        horaInicio: '',
        horaFin: '',
        areacomun: 0,
        copropietario: 0,
        estado: 'PENDIENTE',
        fotoComprobante: null,
      })
    }
  }, [record, reset])

  // Autofocus
  useEffect(() => {
    setFocus(isEdit ? 'estado' : 'fecha')
  }, [setFocus, isEdit])

  // ------- Cargar combos -------
  const copQ = useQuery({
    queryKey: ['copropietarios_combo'],
    queryFn: () => listCopropietarios({ page: 1, page_size: 1000, ordering: 'apellido' }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
  const espQ = useQuery({
    queryKey: ['espacios_combo'],
    queryFn: () => listEspaciosComunes({ page: 1, page_size: 1000, ordering: 'nombre' }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  const copList = copQ.data?.results ?? []
  const espList = (espQ.data as any)?.results ?? []

  // ------- Imagen -------
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(record?.fotoComprobante ?? null)
  const [imgError, setImgError] = useState<string>('')
  const [fileInfo, setFileInfo] = useState<{ name: string; sizeKB: number } | null>(null)

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (isEdit) return
    setImgError('')
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setImgError('Formato no permitido. Usa PNG, JPG o WebP.')
      e.target.value = ''
      return
    }
    const maxMB = 2
    if (file.size > maxMB * 1024 * 1024) {
      setImgError(`La imagen supera ${maxMB}MB.`)
      e.target.value = ''
      return
    }
    const b64 = await fileToBase64(file)
    setValue('fotoComprobante', b64)
    setPreview(b64)
    setFileInfo({ name: file.name, sizeKB: Math.round(file.size / 1024) })
  }

  function clearFile() {
    if (isEdit) return
    setValue('fotoComprobante', null)
    setPreview(null)
    setFileInfo(null)
    setImgError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ------- Verificación de choques -------
  const fecha = watch('fecha')
  const horaInicio = watch('horaInicio')
  const horaFin = watch('horaFin')
  const areacomun = watch('areacomun')

  const [verif, setVerif] = useState<{ ok: boolean; checking: boolean; msg?: string; conflictos?: any[] }>({
    ok: true,
    checking: false,
  })

  // En edición NO verificamos
  useEffect(() => {
    if (isEdit) {
      setVerif({ ok: true, checking: false, conflictos: [] })
      return
    }
    const t = setTimeout(async () => {
      if (!fecha || !horaInicio || !horaFin || !areacomun) return
      if (!timeRe.test(horaInicio) || !timeRe.test(horaFin) || horaInicio >= horaFin) {
        setVerif({ ok: false, checking: false, msg: 'Horario inválido', conflictos: [] })
        return
      }
      setVerif((s) => ({ ...s, checking: true }))
      try {
        const r = await verificarDisponibilidad({ areacomun_id: areacomun, fecha, horaInicio, horaFin })
        setVerif({ ok: r.disponible, checking: false, conflictos: r.conflictos })
      } catch (e: any) {
        setVerif({ ok: false, checking: false, msg: e?.message ?? 'Error al verificar', conflictos: [] })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [fecha, horaInicio, horaFin, areacomun, isEdit])

  async function onVerificarManual() {
    if (isEdit) return
    if (!fecha || !horaInicio || !horaFin || !areacomun) {
      setVerif({ ok: false, checking: false, msg: 'Completa área, fecha y horario.', conflictos: [] })
      return
    }
    setVerif({ ok: true, checking: true })
    try {
      const r = await verificarDisponibilidad({ areacomun_id: areacomun, fecha, horaInicio, horaFin })
      setVerif({ ok: r.disponible, checking: false, conflictos: r.conflictos })
    } catch (e: any) {
      setVerif({ ok: false, checking: false, msg: e?.message ?? 'Error al verificar', conflictos: [] })
    }
  }

  // ------- Mutaciones -------
  const createMut = useMutation({
    mutationFn: (input: CreateSolicitudInput) => createSolicitud(input),
    onSuccess: onSaved,
  })
  const updateMut = useMutation({
    mutationFn: (input: UpdateSolicitudInput) => updateSolicitud(record!.id, input),
    onSuccess: onSaved,
  })

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!isEdit && !verif.ok) return

    if (isEdit) {
      const payload: UpdateSolicitudInput = { estado: values.estado ?? 'PENDIENTE' }
      await updateMut.mutateAsync(payload)
    } else {
      const payload: CreateSolicitudInput = {
        fecha: values.fecha,
        horaInicio: values.horaInicio,
        horaFin: values.horaFin,
        areacomun: values.areacomun,
        copropietario: values.copropietario,
        estado: values.estado ?? 'PENDIENTE',
        fotoComprobante: values.fotoComprobante ?? null,
      }
      await createMut.mutateAsync(payload)
    }
  }

  const pending = isSubmitting || createMut.isPending || updateMut.isPending

  // ===== UX: cerrar con ESC y clic en backdrop =====
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

  // ---- Badge de verificación (solo create) ----
  const verifBadge = useMemo(() => {
    if (isEdit) return null
    if (verif.checking) {
      return (
        <span className="inline-flex items-center gap-1 text-sm text-slate-600">
          <ShieldQuestion className="h-4 w-4 animate-pulse" /> Verificando…
        </span>
      )
    }
    if (verif.ok) {
      return (
        <span className="inline-flex items-center gap-1 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Disponible
        </span>
      )
    }
    const n = verif.conflictos?.length ?? 0
    return (
        <span className="inline-flex items-center gap-1 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> No disponible{n ? ` (${n})` : ''}
        </span>
    )
  }, [verif, isEdit])

  return (
    <div onMouseDown={onBackdropMouseDown} className="fixed inset-0 z-50 bg-black/40 p-3 overflow-auto" role="dialog" aria-modal="true" aria-labelledby="solicitud-dialog-title">
      <div ref={cardRef} className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white rounded-t-2xl">
          <h2 id="solicitud-dialog-title" className="text-base font-semibold">
            {mode === 'create' ? 'Nueva solicitud' : `Editar solicitud #${record?.id}`}
          </h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 hover:bg-slate-100" aria-label="Cerrar">✕</button>
        </div>

        {/* Body */}
        <div className="max-h-[80vh] overflow-y-auto px-4 py-3">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit(onSubmit) as any}>
            {/* Fecha */}
            <div>
              <label className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 opacity-60" /> Fecha</label>
              <input type="date" className={`mt-1 w-full rounded-xl border px-3 py-2 ${disabledCls}`} {...register('fecha')} disabled={isEdit} readOnly={isEdit} aria-disabled={isEdit} />
              {!isEdit && errors.fecha && <p className="text-xs text-red-600 mt-1">{errors.fecha.message}</p>}
            </div>

            {/* Hora inicio */}
            <div>
              <label className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 opacity-60" /> Hora inicio</label>
              <input type="time" className={`mt-1 w-full rounded-xl border px-3 py-2 ${disabledCls}`} {...register('horaInicio')} disabled={isEdit} readOnly={isEdit} aria-disabled={isEdit} />
              {!isEdit && errors.horaInicio && <p className="text-xs text-red-600 mt-1">{errors.horaInicio.message}</p>}
            </div>

            {/* Hora fin */}
            <div>
              <label className="text-sm">Hora fin</label>
              <input type="time" className={`mt-1 w-full rounded-xl border px-3 py-2 ${disabledCls}`} {...register('horaFin')} disabled={isEdit} readOnly={isEdit} aria-disabled={isEdit} />
              {!isEdit && errors.horaFin && <p className="text-xs text-red-600 mt-1">{errors.horaFin.message}</p>}
            </div>

            {/* Área común */}
            <div>
              <label className="text-sm">Área común</label>
              <select className={`mt-1 w-full rounded-xl border px-3 py-2 ${disabledCls}`} {...register('areacomun')} disabled={isEdit} aria-disabled={isEdit}>
                <option value={0}>— Seleccionar —</option>
                {espList.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.nombre ?? `#${e.id}`}</option>
                ))}
              </select>
              {!isEdit && errors.areacomun && <p className="text-xs text-red-600 mt-1">{String(errors.areacomun.message)}</p>}
            </div>

            {/* Copropietario */}
            <div>
              <label className="text-sm">Copropietario</label>
              <select className={`mt-1 w-full rounded-xl border px-3 py-2 ${disabledCls}`} {...register('copropietario')} disabled={isEdit} aria-disabled={isEdit}>
                <option value={0}>— Seleccionar —</option>
                {copList.map((c: Copropietario) => (
                  <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}</option>
                ))}
              </select>
              {!isEdit && errors.copropietario && <p className="text-xs text-red-600 mt-1">{String(errors.copropietario.message)}</p>}
            </div>

            {/* Estado (único editable) */}
            <div>
              <label className="text-sm">Estado</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2" {...register('estado')}>
                {(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'] as EstadoSolicitud[]).map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            {/* Foto comprobante */}
            <div className="md:col-span-2">
              <label className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4 opacity-60" /> Comprobante (opcional)</label>
              <div className="mt-1 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" disabled={isEdit} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-slate-50 disabled:opacity-50 ${isEdit ? 'pointer-events-none' : ''}`} disabled={isEdit}>
                    <UploadCloud className="h-4 w-4" />
                    {preview ? 'Cambiar imagen' : 'Seleccionar imagen'}
                  </button>
                  <span className="text-sm text-slate-600">
                    {fileInfo ? `${fileInfo.name} · ${fileInfo.sizeKB} KB` : preview ? 'Imagen cargada' : 'PNG, JPG o WebP · máx 2MB'}
                  </span>
                  {preview && (
                    <button type="button" onClick={clearFile} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50 ${isEdit ? 'pointer-events-none' : ''}`} disabled={isEdit}>
                      <XCircle className="h-4 w-4" />
                      Quitar
                    </button>
                  )}
                </div>

                {imgError && !isEdit && <p className="text-sm text-red-600">{imgError}</p>}

                <div className={`h-24 rounded-xl border flex items-center justify-center overflow-hidden ${isEdit ? 'bg-slate-100' : 'bg-slate-50'}`}>
                  {preview ? <img src={preview} alt="Comprobante" className="h-full w-full object-contain" /> : <div className="text-slate-400 text-sm">No seleccionada</div>}
                </div>
              </div>
              <input type="hidden" {...register('fotoComprobante')} />
            </div>

            {/* Verificación / Acciones (solo create) */}
            {!isEdit && (
              <div className="md:col-span-2 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3" aria-live="polite">
                  {verifBadge}
                  {!verif.ok && verif.msg && <span className="text-sm text-red-700">{verif.msg}</span>}
                </div>
                <button type="button" onClick={onVerificarManual} className="rounded-xl border px-3 py-1.5 hover:bg-slate-50 inline-flex items-center gap-2">
                  <ShieldQuestion className="h-4 w-4" /> Verificar
                </button>
              </div>
            )}

            {!isEdit && !verif.ok && !!verif.conflictos?.length && (
              <div className="md:col-span-2">
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <div className="flex items-start gap-2 text-red-800">
                    <AlertTriangle className="h-5 w-5 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">
                        No disponible: {verif.conflictos.length} {verif.conflictos.length === 1 ? 'conflicto' : 'conflictos'} encontrados.
                      </p>
                      {verif.conflictos[0] && (
                        <p className="mt-0.5">
                          Ejemplo: #{verif.conflictos[0].id} — {verif.conflictos[0].horaInicio}–{verif.conflictos[0].horaFin}
                          {verif.conflictos[0].copropietario_id ? ` (copropietario #${verif.conflictos[0].copropietario_id})` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isEdit && !!verif.conflictos?.length && (
              <div className="md:col-span-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <p className="font-medium mb-1">Conflictos:</p>
                  <ul className="list-disc ml-5">
                    {verif.conflictos.map((c: any) => (
                      <li key={c.id}>
                        #{c.id} — {c.horaInicio}–{c.horaFin}
                        {c.copropietario_id ? ` (copropietario #${c.copropietario_id})` : ''}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-slate-600">Regla de choque: inicio &lt; fin existente y fin &gt; inicio existente.</p>
                </div>
              </div>
            )}

            {/* Footer acciones */}
            <div className="md:col-span-2 mt-2 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2">Cancelar</button>
              <button
                type="submit"
                disabled={pending || (!isEdit && !verif.ok)}
                className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
                title={!isEdit && !verif.ok ? 'Hay conflictos o verificación pendiente' : undefined}
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

// ------ helpers ------
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

