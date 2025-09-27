import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ChangeEvent, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import pattern from '@/assets/pattern.png'
import {
  Building2, Shield, Users, Smartphone,
  Eye, EyeOff, Lock, User as UserIcon, RefreshCw,
} from 'lucide-react'

const LAST_USER_KEY = 'auth.lastUser'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capsOn, setCapsOn] = useState(false)
  const [touched, setTouched] = useState<{ u?: boolean; p?: boolean }>({})

  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const last = localStorage.getItem(LAST_USER_KEY)
    if (last) {
      setUsuario(last)
      setTimeout(() => passRef.current?.focus(), 0)
    } else {
      setTimeout(() => userRef.current?.focus(), 0)
    }
  }, [])

  const errors = useMemo(() => {
    const e: { u?: string; p?: string } = {}
    if (touched.u && usuario.trim().length < 2) e.u = 'Ingresa tu usuario'
    if (touched.p && password.length < 6) e.p = 'La contraseña debe tener al menos 6 caracteres'
    return e
  }, [usuario, password, touched])

  const onPasswordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setTouched({ u: true, p: true })
    setError(null)
    if (usuario.trim().length < 2 || password.length < 6) {
      liveRef.current?.focus() // lector de pantalla anuncia el error
      return
    }

    setLoading(true)
    try {
      await login(usuario, password)
      if (remember) localStorage.setItem(LAST_USER_KEY, usuario)
      else localStorage.removeItem(LAST_USER_KEY)
      navigate('/', { replace: true })
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401) setError('Usuario o contraseña incorrectos')
      else if (status === 429) setError('Demasiados intentos. Intenta en un momento.')
      else setError(err?.response?.data?.detail || 'No se pudo iniciar sesión')
      liveRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const onUsuario = (e: ChangeEvent<HTMLInputElement>) => {
    setUsuario(e.target.value)
    if (!touched.u) setTouched(t => ({ ...t, u: true }))
  }
  const onPassword = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    if (!touched.p) setTouched(t => ({ ...t, p: true }))
  }

  const canSubmit = usuario.trim() !== '' && password !== '' && !loading

  return (
    <main
      className="min-h-screen relative"
      style={{
        backgroundImage: `radial-gradient(1200px 600px at 20% -10%, color-mix(in oklch, var(--card) 70%, transparent), transparent),
                          url(${pattern})`,
        backgroundSize: 'auto, 560px',
        backgroundRepeat: 'no-repeat, repeat',
        backgroundAttachment: 'fixed, fixed',
      }}
    >
      {/* suavizar patrón y crear profundidad */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-[0.5px]" />

      {/* link para saltar directo al formulario (a11y) */}
      <a
        href="#login-card"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-3 focus:py-2 focus:rounded-md"
      >
        Ir al formulario de inicio de sesión
      </a>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Branding (desktop) */}
          <section className="hidden lg:block">
            <header className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-primary rounded-2xl shadow-sm shrink-0">
                <Building2 className="h-9 w-9 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-tight text-foreground">
                  Smart Condominium
                </h1>
                <p className="text-[clamp(14px,1.6vw,16px)] text-muted-foreground">
                  Gestión Inteligente con IA
                </p>
              </div>
            </header>

            <ul className="space-y-6">
              <Feature
                icon={<Shield className="h-5 w-5 text-accent" />}
                title="Seguridad Avanzada"
                desc="Visión artificial y control de acceso inteligente."
              />
              <Feature
                icon={<Users className="h-5 w-5 text-accent" />}
                title="Gestión Integral"
                desc="Residentes, personal y administradores en un solo lugar."
              />
              <Feature
                icon={<Smartphone className="h-5 w-5 text-accent" />}
                title="Multi-Plataforma"
                desc="Acceso web y móvil con alta disponibilidad."
              />
            </ul>

            <Stats />
          </section>

          {/* Login Card */}
          <section className="w-full">
            {/* encabezado compacto en mobile */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-primary rounded-2xl">
                <Building2 className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground leading-tight">Smart Condominium</h2>
                <p className="text-sm text-muted-foreground -mt-0.5">Gestión Inteligente con IA</p>
              </div>
            </div>

            <div
              id="login-card"
              className="outline-none w-full rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-md"
              tabIndex={-1}
            >
              <header className="px-6 sm:px-8 pt-7 pb-3 text-center">
                <h3 className="text-[26px] font-extrabold tracking-tight">Iniciar Sesión</h3>
                <p className="text-sm text-muted-foreground mt-1">Accede a tu cuenta administrativa</p>
              </header>

              {/* live region para anunciar errores/estado a lectores de pantalla */}
              <p ref={liveRef} tabIndex={-1} aria-live="polite" className="sr-only" />

              <form onSubmit={onSubmit} className="px-6 sm:px-8 pb-7 space-y-4" aria-busy={loading}>
                <Field
                  id="usuario"
                  label="Usuario"
                  value={usuario}
                  onChange={onUsuario}
                  leftIcon={<UserIcon className="h-4 w-4 text-muted-foreground" />}
                  error={errors.u}
                  inputProps={{
                    ref: userRef,
                    placeholder: 'tu usuario',
                    autoComplete: 'username',
                  }}
                />

                <Field
                  id="password"
                  label="Contraseña"
                  value={password}
                  onChange={onPassword}
                  leftIcon={<Lock className="h-4 w-4 text-muted-foreground" />}
                  rightIconButton={{
                    label: showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña',
                    pressed: showPassword,
                    onClick: () => setShowPassword(s => !s),
                    icon: showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
                  }}
                  error={errors.p}
                  hint={!errors.p && capsOn ? 'Mayúsculas activadas (Caps Lock)' : undefined}
                  onKeyUp={onPasswordKey}
                  inputProps={{
                    ref: passRef,
                    type: showPassword ? 'text' : 'password',
                    placeholder: '••••••••',
                    autoComplete: 'current-password',
                  }}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="rounded border-border accent-[oklch(0.55_0.22_25)]"
                    />
                    <span className="text-muted-foreground">Recordarme</span>
                  </label>
                  {/* Lugar para “¿Olvidaste tu contraseña?” si lo habilitas luego */}
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground h-11 font-semibold tracking-[0.01em] transition-all duration-200 hover:brightness-[1.05] active:scale-[0.99] disabled:opacity-60 will-change-transform"
                >
                  {loading && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {loading ? 'Iniciando sesión…' : 'Iniciar Sesión'}
                </button>

                <p className="text-center text-xs text-muted-foreground mt-2">
                  ¿Problemas para ingresar? <span className="text-primary font-medium">Contacta al administrador</span>
                </p>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

/* ---------- Subcomponentes UI (pequeños y reutilizables) ---------- */

function Feature({
  icon, title, desc,
}: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-4">
      <div className="p-2.5 bg-accent/15 rounded-xl">{icon}</div>
      <div>
        <h3 className="font-semibold text-foreground text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </li>
  )
}

function Stats() {
  return (
    <div className="mt-12 grid grid-cols-3 gap-6">
      {[
        ['500+', 'Condominios'],
        ['50K+', 'Residentes'],
        ['99.9%', 'Uptime'],
      ].map(([n, l]) => (
        <div key={l} className="text-center">
          <div className="text-3xl font-extrabold text-primary leading-none">{n}</div>
          <div className="text-xs text-muted-foreground mt-1">{l}</div>
        </div>
      ))}
    </div>
  )
}

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  leftIcon?: React.ReactNode
  rightIconButton?: {
    label: string
    pressed?: boolean
    icon: React.ReactNode
    onClick: () => void
  }
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }
  error?: string
  hint?: string
  onKeyUp?: (e: KeyboardEvent<HTMLInputElement>) => void
}

function Field({
  id, label, value, onChange, leftIcon, rightIconButton, inputProps, error, hint, onKeyUp,
}: FieldProps) {
  const describedBy = [
    error ? `${id}-error` : null,
    hint ? `${id}-hint` : null,
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="relative">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{leftIcon}</span>}
        <input
          id={id}
          value={value}
          onChange={onChange}
          onKeyUp={onKeyUp}
          className={`w-full h-11 rounded-lg border bg-input outline-none focus:ring-2 focus:ring-ring transition-[box-shadow] ${leftIcon ? 'pl-10' : 'pl-3'} ${rightIconButton ? 'pr-11' : 'pr-3'} ${error ? 'border-destructive/50' : 'border-border/80'}`}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {rightIconButton && (
          <button
            type="button"
            onClick={rightIconButton.onClick}
            aria-label={rightIconButton.label}
            aria-pressed={rightIconButton.pressed}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {rightIconButton.icon}
          </button>
        )}
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-destructive" role="alert">{error}</p>}
      {!error && hint && <p id={`${id}-hint`} className="text-xs text-primary" role="status">{hint}</p>}
    </div>
  )
}
