'use client';

import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

interface HeaderProps {
  onOpenSidebar?: () => void;
  onOpenCart?: () => void;
  cartCount?: number;
}

export default function Header({
  onOpenSidebar,
  onOpenCart,
  cartCount = 0,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 w-full">
        {/* Izquierda: Logotipo Y2K y Botón Categorías */}
        <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer text-left">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <span className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
              Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">STORE</span>
            </span>
          </Link>

          <button
            onClick={onOpenSidebar}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold transition-all hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer"
            aria-label="Abrir menú de categorías"
          >
            <svg className="w-5 h-5 text-cyan-500 dark:text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden md:inline">Categorías</span>
          </button>
        </div>

        {/* Derecha: ThemeToggle, Mi Cuenta y Carrito */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <ThemeToggle />

          <Link
            href="/cuenta"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 text-xs font-semibold transition-all hover:border-cyan-500/40 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
          >
            <svg className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden md:inline">Mi Cuenta</span>
          </Link>

          <button
            type="button"
            onClick={onOpenCart}
            className="relative p-2 sm:p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition-all group hover:border-cyan-500/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-pointer"
            aria-label="Abrir carrito de compras"
          >
            <svg className="w-5 h-5 text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(217,70,239,0.8)] animate-pulse">
                {cartCount}
              </span>
            ) : (
              <span className="absolute -top-1.5 -right-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-300 dark:border-slate-700">
                0
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
