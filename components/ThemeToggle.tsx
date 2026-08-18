'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-700/50 animate-pulse ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative p-2 sm:p-2.5 rounded-xl border transition-all duration-300 ease-in-out cursor-pointer flex items-center justify-center group overflow-hidden ${
        isDark
          ? 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-slate-700/80 hover:border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:shadow-[0_0_18px_rgba(245,158,11,0.3)]'
          : 'bg-white hover:bg-slate-100 text-cyan-600 border-slate-200 hover:border-cyan-400 shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.25)]'
      } ${className}`}
      title={isDark ? 'Cambiar a Modo Claro (Light)' : 'Cambiar a Modo Oscuro (Dark)'}
      aria-label={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
    >
      {/* Icono de Sol / Luna animado */}
      <div className="relative w-5 h-5 flex items-center justify-center">
        {/* Sol cuando está en modo oscuro (indica cambiar a claro) */}
        <svg
          className={`w-5 h-5 transition-all duration-500 transform ${
            isDark
              ? 'opacity-100 rotate-0 scale-100 text-amber-300'
              : 'opacity-0 -rotate-90 scale-50 absolute text-amber-400'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>

        {/* Luna cuando está en modo claro (indica cambiar a oscuro) */}
        <svg
          className={`w-5 h-5 transition-all duration-500 transform ${
            !isDark
              ? 'opacity-100 rotate-0 scale-100 text-cyan-600'
              : 'opacity-0 rotate-90 scale-50 absolute text-cyan-400'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </div>
    </button>
  );
}
