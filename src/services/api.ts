import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { storage } from './storage'

const baseURL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api'

// Token en memoria para requests (evita leer localStorage cada vez)
let accessToken: string | null = storage.getAccess()

export const setAccessToken = (t: string | null) => {
  accessToken = t
}

export const api = axios.create({ baseURL })

// ---- REQUEST INTERCEPTOR ----
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Asegura un objeto AxiosHeaders (no {} plano) para evitar el error de tipos
  if (!config.headers) {
    config.headers = new AxiosHeaders()
  } else if (!(config.headers instanceof AxiosHeaders)) {
    config.headers = new AxiosHeaders(config.headers)
  }

  if (accessToken) {
    (config.headers as AxiosHeaders).set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

// ---- RESPONSE INTERCEPTOR (refresh en 401) ----
let isRefreshing = false
let pending: Array<(token: string | null) => void> = []

const subscribe = (cb: (t: string | null) => void) => pending.push(cb)
const publish = (token: string | null) => {
  pending.forEach((cb) => cb(token))
  pending = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true

      if (!isRefreshing) {
        isRefreshing = true
        try {
          const refresh = storage.getRefresh()
          if (!refresh) throw new Error('No refresh token')

          const { data } = await axios.post(`${baseURL}/auth/refresh/`, { refresh })
          const newAccess: string = data.access

          storage.setAccess(newAccess)
          setAccessToken(newAccess)
          publish(newAccess)

          // Asegura AxiosHeaders en el reintento
          if (!original.headers) {
            original.headers = new AxiosHeaders()
          } else if (!(original.headers instanceof AxiosHeaders)) {
            original.headers = new AxiosHeaders(original.headers)
          }
          ;(original.headers as AxiosHeaders).set('Authorization', `Bearer ${newAccess}`)

          return api(original)
        } catch (e) {
          storage.clear()
          setAccessToken(null)
          publish(null)
          return Promise.reject(error)
        } finally {
          isRefreshing = false
        }
      }

      // Espera a que termine el refresh en curso
      return new Promise((resolve, reject) => {
        subscribe((token) => {
          if (token) {
            // Garantiza AxiosHeaders antes de setear
            if (!original.headers) {
              original.headers = new AxiosHeaders()
            } else if (!(original.headers instanceof AxiosHeaders)) {
              original.headers = new AxiosHeaders(original.headers)
            }
            ;(original.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`)
            resolve(api(original))
          } else {
            reject(error)
          }
        })
      })
    }

    return Promise.reject(error)
  }
)
