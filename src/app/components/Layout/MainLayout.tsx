// MainLayout.tsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2, Home, Users, Bell, Settings, Menu, LogOut, ShieldHalf, ShieldQuestion, CarFront, PawPrint, Calendar,User2,Megaphone, BarChart3
} from 'lucide-react';

type Item = { to: string; label: string; icon: React.ReactNode };

const MENU: Item[] = [
  { to: '/',              label: 'Resumen General', icon: <Home className="h-4 w-4" /> },
  { to: '/admins',        label: 'Administradores', icon: <Users className="h-4 w-4" /> },
  { to: '/copropietarios',label: 'Copropietarios',  icon: <Users className="h-4 w-4" /> },
  { to: '/residentes',       label: 'Residentes',        icon: <User2 className="h-4 w-4" /> },
  { to: '/casas',         label: 'Casas',           icon: <Building2 className="h-4 w-4" /> },
  { to: '/vehiculos',     label: 'Vehículos',       icon: <CarFront className="h-4 w-4" /> },
  { to: '/guardias',      label: 'Guardias',        icon: <ShieldHalf className="h-4 w-4" /> },
  { to: '/visitantes',    label: 'Visitantes',      icon: <ShieldQuestion className="h-4 w-4" /> },
  { to: '/mascotas',      label: 'Mascotas',        icon: <PawPrint className="h-4 w-4" /> },
  { to: '/espacios-comunes', label: 'Espacios comunes', icon: <Building2 className="h-4 w-4" /> },
  { to: '/avisos',           label: 'Avisos',           icon: <Megaphone className="h-4 w-4" /> },
  { to: '/solicitudes',      label: 'Solicitudes',      icon: <Calendar className="h-4 w-4" /> },
  { to: '/reportes/uso-areas', label: 'Reportes de uso', icon: <BarChart3 className="h-4 w-4" /> },
  
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // sidebar móvil

  const doLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex h-14 items-center px-3 sm:px-4">
          {/* Mobile: open sidebar */}
          <button
            className="mr-2 rounded-md p-2 hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-sm sm:text-base font-semibold">Condominio Admin</span>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button className="rounded-md p-2 hover:bg-muted" aria-label="Notificaciones">
              <Bell className="h-5 w-5" />
            </button>
            <button className="rounded-md p-2 hover:bg-muted" aria-label="Ajustes">
              <Settings className="h-5 w-5" />
            </button>

            {/* User */}
            <div className="hidden sm:flex items-center text-sm text-muted-foreground px-2">
              {user?.usuario ?? 'user'}
            </div>

            {/* Logout directo */}
            <button
              onClick={doLogout}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Layout body */}
      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block w-64 shrink-0 border-r bg-sidebar/60 backdrop-blur supports-[backdrop-filter]:bg-sidebar/50">
          <nav className="p-3">
            {MENU.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
                   hover:bg-muted transition-colors ${isActive ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`
                }
              >
                <span className="text-muted-foreground">{it.icon}</span>
                {it.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Drawer Sidebar (mobile) */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 border-r bg-sidebar p-3">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">Condominio Admin</span>
              </div>
              <nav className="space-y-1">
                {MENU.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
                       hover:bg-muted ${isActive ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`
                    }
                  >
                    <span className="text-muted-foreground">{it.icon}</span>
                    {it.label}
                  </NavLink>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}



