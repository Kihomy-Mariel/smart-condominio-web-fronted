// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider } from './context/AuthContext'
import { AppRouter } from './app/routes/AppRouter'
import '@/index.css'

// configura React Query (caché y comportamiento por defecto)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,           // 30s: datos “frescos” (no refetch inmediato)
      gcTime: 1000 * 60 * 5,          // 5 min en caché
      refetchOnWindowFocus: false,    // no refetch al volver a la pestaña
      retry: 1,                       // 1 reintento ante fallo
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>

      {/* útil en desarrollo; quítalo en producción si quieres */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
)
