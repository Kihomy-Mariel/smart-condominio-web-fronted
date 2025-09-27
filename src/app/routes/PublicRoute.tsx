import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Loader } from '../components/UI/Loader'

export default function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Loader label="Cargando..." />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
