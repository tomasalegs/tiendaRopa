'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();

  // No mostrar el footer público dentro del panel de administración
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-slate-900 dark:bg-slate-950 text-slate-300 border-t border-slate-800 transition-colors duration-200 mt-auto">
      {/* Contenido Principal del Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          
          {/* Columna 1: Brand & Bio */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 group inline-block">
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-pulse" />
              <span className="text-xl font-black tracking-widest text-white group-hover:text-cyan-400 transition-colors">
                Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">STORE</span>
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Tu tienda de moda urbana, streetwear y ropa vintage estética Y2K. Envíos a todo Chile y retiro presencial en Valparaíso.
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SOPORTE 24/7 EN LÍNEA</span>
            </div>
          </div>

          {/* Columna 2: Te ayudamos (Requerido por el usuario) */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-white border-b border-slate-800 pb-2">
              Te ayudamos
            </h3>
            <ul className="space-y-2.5 text-xs font-sans">
              <li>
                <Link
                  href="/contacto"
                  className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
                >
                  <span>✉️</span>
                  <span>Contáctanos</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/ayuda"
                  className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
                >
                  <span>❓</span>
                  <span>Centro de ayuda</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/estado-pedido"
                  className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5 font-semibold text-cyan-400/90"
                >
                  <span>📦</span>
                  <span>Estado del pedido</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Navegación & Catálogo */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-white border-b border-slate-800 pb-2">
              Catálogo & Drops
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-400 font-sans">
              <li>
                <Link href="/#catalogo" className="hover:text-cyan-400 transition-colors">
                  Ropa Streetwear
                </Link>
              </li>
              <li>
                <Link href="/#catalogo" className="hover:text-cyan-400 transition-colors">
                  Zapatillas & Calzado
                </Link>
              </li>
              <li>
                <Link href="/#catalogo" className="hover:text-cyan-400 transition-colors">
                  Accesorios & Carteras
                </Link>
              </li>
              <li>
                <Link href="/cuenta" className="hover:text-cyan-400 transition-colors">
                  Mi Bóveda (Mi Cuenta)
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 4: Retiro & Métodos de Pago */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-white border-b border-slate-800 pb-2">
              Entrega & Seguridad
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <span>🏢</span>
                <span>Retiro en Tienda (Valparaíso)</span>
              </p>
              <p className="flex items-center gap-2">
                <span>🚚</span>
                <span>Despacho a todo Chile</span>
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5">
                <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                  WEBPAY+
                </span>
                <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                  DEBITO
                </span>
                <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                  CREDITO
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Franja Inferior (Legales & Redes Sociales) */}
      <div className="border-t border-slate-800/80 bg-slate-950 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* LADO IZQUIERDO: Redes Sociales (Facebook, Instagram, TikTok) */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">Síguenos:</span>
            
            {/* Facebook SVG */}
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
              aria-label="Facebook"
              title="Facebook Y2K Store"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>

            {/* Instagram SVG */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-fuchsia-400 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
              aria-label="Instagram"
              title="Instagram Y2K Store"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>

            {/* TikTok SVG */}
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
              aria-label="TikTok"
              title="TikTok Y2K Store"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.67 2.58-4.9 1.5-1.27 3.52-1.87 5.48-1.62v4.21c-.88-.13-1.8.07-2.52.57-.77.53-1.26 1.43-1.31 2.37-.08.97.35 1.94 1.09 2.56.76.64 1.79.91 2.76.73.99-.16 1.87-.84 2.27-1.75.32-.73.41-1.54.39-2.33V.02z" />
              </svg>
            </a>
          </div>

          {/* LADO DERECHO: Enlaces Legales & Copyright */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-6 gap-y-2 text-xs text-slate-400 font-sans">
            <Link href="/terminos" className="hover:text-slate-200 transition-colors">
              Términos y condiciones
            </Link>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <Link href="/privacidad" className="hover:text-slate-200 transition-colors">
              Política de privacidad
            </Link>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <span className="text-slate-500 font-mono text-[11px]">
              © {new Date().getFullYear()} Y2K Store
            </span>
          </div>

        </div>
      </div>
    </footer>
  );
}
