'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminSidebar({
  isSidebarOpen = true,
  isMobileOpen = false,
  onCloseMobile,
  userGroups = [],
  isSuperAdmin = false,
  isAdminTienda = false,
  isLogistics = false,
}: {
  isSidebarOpen?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  userGroups?: string[];
  isSuperAdmin?: boolean;
  isAdminTienda?: boolean;
  isLogistics?: boolean;
}) {
  const pathname = usePathname();

  // Deducción estricta de permisos RBAC
  const isSuper = isSuperAdmin || userGroups.includes('Super_Admin');
  const isTienda = isAdminTienda || userGroups.includes('Admin_Tienda');
  const isLog = isLogistics || userGroups.includes('Logistica_Operadores');

  // Matriz de Navegación con permisos de grano fino
  const allNavItems = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: '📊',
      exact: true,
      visible: isSuper || isTienda,
    },
    {
      name: 'Inventario',
      href: '/admin/inventario',
      icon: '📦',
      exact: false,
      visible: isSuper || isTienda,
    },
    {
      name: 'Gestión de Pedidos',
      href: '/admin/pedidos',
      icon: '📋',
      exact: false,
      visible: isSuper || isTienda || isLog,
    },
    {
      name: 'Gestión de Usuarios',
      href: '/admin/usuarios',
      icon: '👥',
      exact: false,
      visible: isSuper, // EXCLUSIVO para Super_Admin
    },
    {
      name: 'Marketing & Banners',
      href: '/admin/marketing',
      icon: '🎨',
      exact: false,
      visible: isSuper || isTienda,
    },
    {
      name: 'Escáner Logístico',
      href: '/admin/escaner',
      icon: '📟',
      exact: false,
      visible: isSuper || isTienda || isLog,
    },
  ];

  const navItems = allNavItems.filter((item) => item.visible);

  const isActive = (itemHref: string, exact: boolean) => {
    if (exact) {
      return pathname === itemHref;
    }
    return pathname === itemHref || pathname.startsWith(itemHref + '/');
  };

  return (
    <>
      {/* Backdrop oscuro para pantallas móviles */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ease-in-out"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Responsive: Drawer superpuesto en móviles, barra lateral fija en desktop */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-white/95 dark:bg-slate-950/98 md:static md:z-30 min-h-screen text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-cyan-500/50 flex flex-col justify-between shrink-0
          transition-all duration-300 ease-in-out shadow-[4px_0_30px_rgba(6,182,212,0.08)] dark:shadow-[4px_0_30px_rgba(6,182,212,0.15)]
          ${isMobileOpen ? 'translate-x-0 w-72 p-6' : '-translate-x-full md:translate-x-0'}
          ${isSidebarOpen ? 'md:w-64 md:p-6' : 'md:w-20 md:p-3'}
        `}
      >
        {/* Sección Superior: Logo, Status Badge y Botón Cerrar Móvil */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className={isSidebarOpen || isMobileOpen ? '' : 'flex flex-col items-center text-center w-full'}>
              <Link
                href="/admin"
                onClick={onCloseMobile}
                className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
                title="Ir al Dashboard de Administración"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)] animate-pulse shrink-0" />
                {(isSidebarOpen || isMobileOpen) && (
                  <span className="text-xl font-black tracking-widest text-slate-900 dark:text-white group-hover:text-cyan-500 transition-colors whitespace-nowrap">
                    Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500">ADMIN</span>
                  </span>
                )}
              </Link>

              {/* Badge Terminal SYS: ONLINE */}
              <div className="mt-3">
                {isSidebarOpen || isMobileOpen ? (
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-green-400 bg-emerald-50 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-green-500/50 inline-flex items-center gap-1.5 shadow-sm dark:shadow-[0_0_10px_rgba(34,197,94,0.25)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-green-400 animate-ping" />
                    <span>SYS: ONLINE</span>
                  </span>
                ) : (
                  <span
                    className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-green-950/80 border border-emerald-300 dark:border-green-500/50 flex items-center justify-center text-[10px] font-mono text-emerald-600 dark:text-green-400 shadow-sm mx-auto"
                    title="SYS: ONLINE"
                  >
                    ON
                  </span>
                )}
              </div>
            </div>

            {/* Botón Cerrar solo en Móvil */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 md:hidden transition-colors"
              aria-label="Cerrar menú lateral"
            >
              ✕
            </button>
          </div>

          {/* Separador Cyber-Glow */}
          <div className="h-px bg-gradient-to-r from-cyan-500/50 via-fuchsia-500/30 to-transparent" />

          {/* Enlaces de Navegación Verticales */}
          <nav className="space-y-2">
            {(isSidebarOpen || isMobileOpen) && (
              <p className="text-[10px] font-mono font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase px-3 mb-2">
                CENTRO DE CONTROL
              </p>
            )}

            {navItems.map((item) => {
              const active = isActive(item.href, item.exact);
              const showText = isSidebarOpen || isMobileOpen;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  title={item.name}
                  className={`flex items-center ${
                    showText ? 'gap-3 px-3.5 py-3' : 'justify-center p-3'
                  } min-h-[44px] rounded-xl transition-all duration-300 ease-in-out cursor-pointer text-xs sm:text-sm border-l-2 ${
                    active
                      ? showText
                        ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300 border-cyan-500 dark:border-cyan-400 font-bold shadow-sm dark:shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]'
                        : 'text-cyan-500 dark:text-cyan-400 border-cyan-500 dark:border-cyan-400 font-bold bg-transparent'
                      : 'text-slate-600 dark:text-gray-400 border-transparent hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-cyan-900/20 hover:border-cyan-500/60'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  {showText && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sección Inferior: Enlace de Retorno y Metadata */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 space-y-4">
          <Link
            href="/"
            onClick={onCloseMobile}
            title="Volver a la Tienda"
            className={`flex items-center ${
              isSidebarOpen || isMobileOpen ? 'gap-2 px-3 py-2.5' : 'justify-center p-2.5'
            } min-h-[44px] rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition-all duration-300 ease-in-out cursor-pointer shadow-sm group`}
          >
            <span className="group-hover:-translate-x-0.5 transition-transform text-sm">←</span>
            {(isSidebarOpen || isMobileOpen) && <span>Volver a la Tienda</span>}
          </Link>

          {isSidebarOpen || isMobileOpen ? (
            <div className="bg-slate-100 dark:bg-slate-900/70 rounded-xl p-3 border border-slate-200 dark:border-slate-800/80 text-[10px] font-mono text-slate-500 space-y-1">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>TERMINAL:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">SECURE_SSL</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>VERSION:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Y2K-v2.5</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600">v2.5</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
