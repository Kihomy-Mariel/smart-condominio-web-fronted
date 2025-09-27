import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './app/pages/Auth/LoginPage'

// Si ya tienes páginas privadas, impórtalas acá
// import AdminListPage from './pages/admins/AdminListPage'
// import AdminFormPage from './pages/admins/AdminFormPage'

export default function App() {
  return (
    <Routes>
      {/* Página por defecto: Login */}
      <Route path="/" element={<LoginPage />} />

      {/* Ejemplos de rutas privadas (cuando ya tengas protección) */}
      {/* <Route path="/admins" element={<AdminListPage />} />
      <Route path="/admins/nuevo" element={<AdminFormPage mode="create" />} />
      <Route path="/admins/:id/editar" element={<AdminFormPage mode="edit" />} /> */}

      {/* cualquier ruta desconocida redirige al login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
