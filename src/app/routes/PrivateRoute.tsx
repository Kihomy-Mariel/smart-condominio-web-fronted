import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Loader } from '../components/UI/Loader'

export default function PrivateRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Loader label="Verificando sesión..." />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
