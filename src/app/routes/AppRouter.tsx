// src/router/AppRouter.tsx
import { Routes, Route } from 'react-router-dom'
import PrivateRoute from './PrivateRoute'
import PublicRoute from './PublicRoute'
import MainLayout from '../components/Layout/MainLayout'

import { LoginPage } from '../pages/Auth/LoginPage'
import HomePage from '../pages/Dashboard/HomePage'

// Admins
import AdminsListPage from '../pages/Admins/AdminsListPage'
import AdminFormPage from '../pages/Admins/AdminFormPage'

// Otros módulos
import CopropietariosListPage from '../pages/copropietarios/CopropietariosListPage'
import GuardiaListPage from '../pages/guardias/GuardiaListPage'
import VisitanteListPage from '../pages/visitantes/VisitanteListPage'
import CasasListPage from '../pages/casas/CasasListPage'
import VehiculosListPage from '../pages/vehiculos/VehiculosListPage'
import MascotasListPage from '../pages/mascotas/MascotasListPage'
import EspaciosComunesListPage from '../pages/espacioscomunes/EspaciosComunesListPage'
import SolicitudesListPage from '../pages/solicitudes/SolicitudesListPage'
import NotFoundPage from '../pages/NotFoundPage'

export function AppRouter() {
  return (
    <Routes>
      {/* Públicas */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Privadas */}
      <Route element={<PrivateRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />

          {/* Admins */}
          <Route path="admins" element={<AdminsListPage />} />
          <Route path="admins/new" element={<AdminFormPage mode="create" />} />
          <Route path="admins/:id/edit" element={<AdminFormPage mode="edit" />} />

          {/* Casas (nuevo) */}
          <Route path="casas" element={<CasasListPage />} />
          <Route path="vehiculos" element={<VehiculosListPage />} />
          {/* Otros */}
          <Route path="copropietarios" element={<CopropietariosListPage />} />
          <Route path="guardias" element={<GuardiaListPage />} />
          <Route path="visitantes" element={<VisitanteListPage />} />
          <Route path="mascotas" element={<MascotasListPage />} />
          <Route path="espacios-comunes" element={<EspaciosComunesListPage />} />
          <Route path="solicitudes" element={<SolicitudesListPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRouter

