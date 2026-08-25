'use client';

import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

interface AdminHeaderProps {
  displayName?: string;
  avatarUrl?: string;
  userRole?: string;
  signOut?: () => void;
  onToggleSidebar?: () => void;
}

export default function AdminHeader({
  displayName = 'Admin',
  avatarUrl = '',
  userRole = '',
  signOut,
  onToggleSidebar,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 w-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 px-4 sm:px-8 py-3 flex items-center justify-between gap-2 shadow-sm">
      {/* Botón Toggle del Sidebar */}
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-300 dark:border-slate-800 hover:border-cyan-500/40 transition-all duration-300 ease-in-out cursor-pointer flex items-center justify-center shadow-sm"
          title="Abrir / Colapsar menú lateral"
          aria-label="Abrir / Colapsar menú lateral"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Bloque de Información del Usuario, Theme Toggle y Avatar */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 flex-shrink-0 ml-auto">
        <ThemeToggle />

        {/* Avatar y Nombre del Administrador (Enlace a Mi Cuenta / Bóveda) */}
        <Link
          href="/cuenta"
          className="flex items-center gap-2 cursor-pointer group p-1 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
          title="Ir a Mi Cuenta / Bóveda"
        >
          {/* Avatar */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-cyan-500 bg-slate-100 dark:bg-slate-900 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)] flex-shrink-0 group-hover:scale-105 group-hover:border-cyan-400 transition-all">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-black font-mono text-cyan-600 dark:text-cyan-300 select-none">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Nombre de Usuario (Oculto en móvil) */}
          <span className="hidden md:flex text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 group-hover:bg-slate-200 dark:group-hover:bg-slate-800 border border-slate-300 dark:border-slate-800 group-hover:border-cyan-500/50 px-3 py-1.5 rounded-lg items-center gap-1.5 shadow-sm h-fit transition-colors">
            <span className="text-slate-400">👤</span>
            <span className="font-bold text-slate-900 dark:text-white">{displayName}</span>
          </span>
        </Link>

        {/* Badge de Rol (Oculto en ultra pequeños) */}
        {userRole && (
          <span
            className={`hidden sm:flex text-xs font-mono font-bold px-3 py-1.5 rounded-lg border items-center gap-1.5 h-fit ${
              userRole === 'Super_Admin'
                ? 'bg-fuchsia-100 dark:bg-fuchsia-950/80 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-700/60 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
                : userRole === 'Admin_Tienda'
                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700/60 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/60 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
            }`}
          >
            <span>{userRole === 'Super_Admin' ? '👑' : userRole === 'Admin_Tienda' ? '⚡' : '📦'}</span>
            <span>{userRole.replace('_', ' ')}</span>
          </span>
        )}

        {/* Cerrar Sesión (Texto oculto en celular) */}
        {signOut && (
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 !px-3 !py-1.5 !text-[11px] sm:!text-xs font-mono font-bold rounded-lg border bg-rose-100 dark:!bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-900/50 hover:bg-rose-200 dark:hover:!bg-rose-900/60 transition-colors !h-fit whitespace-nowrap cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden md:inline">Cerrar Sesión</span>
          </button>
        )}
      </div>
    </header>
  );
}
