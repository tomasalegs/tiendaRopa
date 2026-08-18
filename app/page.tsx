'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react/styles.css';
import type { Schema } from '@/amplify/data/resource';
import { useCart } from '@/context/CartContext';
import ThemeToggle from '@/components/ThemeToggle';

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

function PublicProductImage({ imagePath, alt }: { imagePath?: string | null; alt: string }) {
  if (!imagePath) {
    return (
      <div className="w-full aspect-square bg-gray-900 flex flex-col items-center justify-center text-xs text-gray-500 font-mono relative border-b border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
        {/* Marcadores de esquina Cyber-Y2K */}
        <div className="absolute top-2 left-2 text-[9px] font-mono text-cyan-500/40 select-none">◤</div>
        <div className="absolute top-2 right-2 text-[9px] font-mono text-cyan-500/40 select-none">◥</div>
        <div className="absolute bottom-2 left-2 text-[9px] font-mono text-cyan-500/40 select-none">◣</div>
        <div className="absolute bottom-2 right-2 text-[9px] font-mono text-cyan-500/40 select-none">◢</div>
        
        <svg className="w-10 h-10 mb-2 opacity-30 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs uppercase tracking-widest font-mono text-gray-500">NO_SIGNAL</span>
      </div>
    );
  }

  return (
    <div className="w-full aspect-square overflow-hidden bg-slate-950 relative flex items-center justify-center border-b border-cyan-500/20 group-hover:border-cyan-500/50 transition-colors">
      {/* Retículas y esquinas técnicas 'Tech Card' */}
      <div className="absolute top-2 left-2 z-10 text-[9px] font-mono text-cyan-400/60 select-none pointer-events-none drop-shadow">◤</div>
      <div className="absolute top-2 right-2 z-10 text-[9px] font-mono text-cyan-400/60 select-none pointer-events-none drop-shadow">◥</div>
      <div className="absolute bottom-2 left-2 z-10 text-[9px] font-mono text-cyan-400/60 select-none pointer-events-none drop-shadow">◣</div>
      <div className="absolute bottom-2 right-2 z-10 text-[9px] font-mono text-cyan-400/60 select-none pointer-events-none drop-shadow">◢</div>
      
      {/* Sombra de viñeta técnica */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/30 z-0 pointer-events-none" />

      <StorageImage
        path={imagePath}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 relative z-0"
        fallbackSrc="/favicon.ico"
      />
    </div>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const isSaleFilter = searchParams?.get('ofertas') === 'true';

  const [products, setProducts] = useState<Schema['Product']['type'][]>([]);
  const [banners, setBanners] = useState<Schema['MarketingBanner']['type'][]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedGender, setSelectedGender] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [expandedGender, setExpandedGender] = useState<string | null>(null);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  // Estado del usuario actual en Navbar (Dinámico)
  const [currentUser, setCurrentUser] = useState<{
    isLoggedIn: boolean;
    firstName: string;
    email: string;
    isAdmin: boolean;
  }>({
    isLoggedIn: false,
    firstName: '',
    email: '',
    isAdmin: false,
  });

  // Consumir el estado y las acciones del Carrito Global
  const { cart, setIsCartOpen, addToCart: addGlobalToCart } = useCart();

  // Detectar redirección con error de acceso denegado RBAC
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'access_denied') {
        setAccessDeniedMessage(
          'Tu cuenta no posee permisos para ingresar al Centro de Control de Administración (Roles requeridos: Super_Admin, Admin_Tienda o Logistica_Operadores).'
        );
      }
    }
  }, []);

  // 1. Obtener sesión y nombre dinámico del usuario
  useEffect(() => {
    let isMounted = true;

    async function checkUserSession() {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
        const isAdmin = groups.includes('Super_Admin') || groups.includes('Admin_Tienda');

        let firstName = '';
        let email = '';

        try {
          const attributes = await fetchUserAttributes();
          email = attributes.email || '';
          const fullName = attributes.name || '';
          firstName = fullName.trim() ? fullName.trim().split(' ')[0] : (email ? email.split('@')[0] : '');
        } catch {
          // Usuario no autenticado o sin atributos
        }

        if (isMounted) {
          setCurrentUser({
            isLoggedIn: !!session.tokens,
            firstName: firstName || 'Usuario',
            email,
            isAdmin,
          });
        }
      } catch {
        if (isMounted) {
          setCurrentUser({
            isLoggedIn: false,
            firstName: '',
            email: '',
            isAdmin: false,
          });
        }
      }
    }

    checkUserSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Cargar Catálogo de Productos y Banners con detección dinámica de AuthMode
  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const session = await fetchAuthSession();
        const isAuth = session.tokens !== undefined;
        const authMode = isAuth ? 'userPool' : 'identityPool';

        const filterObj: any = {
          isAvailable: { eq: true },
        };
        if (isSaleFilter) {
          filterObj.isOnSale = { eq: true };
        }

        const { data: items, errors } = await client.models.Product.list({
          authMode,
          filter: filterObj,
        });

        if (errors && errors.length > 0) {
          console.error('AppSync Errors:', errors);
        }

        if (isMounted && items) {
          const availableItems = items.filter(
            (p) => p !== null && p !== undefined && p.isAvailable !== false
          );
          setProducts(availableItems as Schema['Product']['type'][]);
        }

        // Cargar Banners Activos para el Carrusel
        try {
          const { data: bannerData } = await client.models.MarketingBanner.list({
            authMode,
            filter: {
              isActive: { eq: true },
            },
          });
          if (isMounted && bannerData) {
            const activeBanners = bannerData.filter(Boolean) as Schema['MarketingBanner']['type'][];
            setBanners(activeBanners);
          }
        } catch (bannerErr) {
          console.warn('Error al cargar banners:', bannerErr);
        }
      } catch (err) {
        console.error('Error al cargar catálogo dinámico:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProducts();

    let sub: any = null;
    async function subscribeCatalog() {
      try {
        const session = await fetchAuthSession();
        const isAuth = session.tokens !== undefined;
        const authMode = isAuth ? 'userPool' : 'identityPool';

        const filterObj: any = {
          isAvailable: { eq: true },
        };
        if (isSaleFilter) {
          filterObj.isOnSale = { eq: true };
        }

        sub = client.models.Product.observeQuery({
          authMode,
          filter: filterObj,
        }).subscribe({
          next: ({ items, isSynced }) => {
            if (!isMounted) return;
            const availableItems = (items || []).filter(
              (p) => p !== null && p !== undefined && p.isAvailable !== false
            );
            setProducts(availableItems as Schema['Product']['type'][]);
            if (isSynced) setLoading(false);
          },
          error: (err) => {
            console.error('AppSync ObserveQuery Error:', err);
            if (isMounted) setLoading(false);
          },
        });
      } catch (err) {
        console.warn('ObserveQuery no inicializado, usando carga directa:', err);
      }
    }

    subscribeCatalog();

    return () => {
      isMounted = false;
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [isSaleFilter]);

  // 3. Rotación Automática del Carrusel cada 5 segundos
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const categories = ['Ropa', 'Zapatillas', 'Carteras', 'Colonias', 'Accesorios', 'Gorros', 'Cosmética', 'Otro'];
  const gendersList = ['Hombre', 'Mujer', 'Unisex', 'Infantil'];

  // Función para agregar producto al Carrito Global con feedback visual
  const handleAddToCart = (product: Schema['Product']['type']) => {
    if (!product) return;
    addGlobalToCart(product);
    setAddedProductId(product.id);
    setTimeout(() => {
      setAddedProductId((prevId) => (prevId === product.id ? null : prevId));
    }, 1200);
  };

  // Lógica de Filtrado Combinado: Ofertas + Categoría + Género + Búsqueda por texto con resiliencia a nulos
  const filteredProducts = products.filter((p) => {
    if (!p) return false;
    const matchSale = !isSaleFilter || p?.isOnSale === true;
    const matchCategory = selectedCategory === 'Todas' || p?.category === selectedCategory;
    const matchGender = selectedGender === 'Todos' || p?.gender === selectedGender;
    const matchSearch =
      !searchQuery.trim() ||
      (p?.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false) ||
      (p?.category?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false) ||
      (p?.color?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false) ||
      (p?.brand?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false);
    return matchSale && matchCategory && matchGender && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black relative transition-colors duration-200">
      {/* Backdrop overlay para Drawer Izquierdo */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 transition-opacity duration-300"
        />
      )}

      {/* Menú Lateral Desplegable (Off-Canvas Drawer Izquierdo) */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 max-w-[88vw] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Encabezado Superior Dinámico con avatar y botón X */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800/90 bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-400 flex items-center justify-center font-bold text-white text-sm shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                {currentUser.isLoggedIn ? (currentUser.firstName[0]?.toUpperCase() || 'U') : '👤'}
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser.isLoggedIn ? 'Bienvenido' : 'Modo Visitante'}
                </p>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-wide">
                  {currentUser.isLoggedIn ? `¡Hola, ${currentUser.firstName}!` : 'Invitado'}
                </h2>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Cerrar menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cuerpo del menú con acordeón de Géneros y Subcategorías */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-900">
              <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono">Categorías por Género</span>
              <button
                onClick={() => {
                  setSelectedGender('Todos');
                  setSelectedCategory('Todas');
                  setExpandedGender(null);
                  setIsSidebarOpen(false);
                }}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
              >
                Ver todo el catálogo
              </button>
            </div>

            <div className="space-y-2">
              {gendersList.map((g) => {
                const isExpanded = expandedGender === g;
                const isGenderSelected = selectedGender === g;

                return (
                  <div key={g} className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 overflow-hidden transition-all">
                    {/* Botón Principal del Género */}
                    <button
                      onClick={() => setExpandedGender(isExpanded ? null : g)}
                      className={`w-full text-left px-4 py-3.5 text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        isGenderSelected
                          ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${isGenderSelected ? 'bg-purple-500 dark:bg-purple-400 shadow-[0_0_6px_rgba(192,38,211,1)]' : 'bg-slate-400 dark:bg-slate-600'}`}></span>
                        <span>{g}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Subcategorías desplegables en acordeón */}
                    {isExpanded && (
                      <div className="bg-slate-100/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800/60 p-2 grid grid-cols-2 gap-1.5 animate-fadeIn">
                        {categories.map((cat) => {
                          const isCatSelected = selectedGender === g && selectedCategory === cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => {
                                setSelectedGender(g);
                                setSelectedCategory(cat);
                                setIsSidebarOpen(false);
                              }}
                              className={`text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                isCatSelected
                                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/40'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Accesos Rápidos en Sidebar */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 font-mono text-xs">
              <Link
                href="/?ofertas=true"
                onClick={() => setIsSidebarOpen(false)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white border border-rose-200 dark:border-rose-800/60 transition"
              >
                <span>🔥 Ver Remates y Ofertas</span>
                <span className="text-rose-500 dark:text-rose-400">→</span>
              </Link>

              <Link
                href="/cuenta"
                onClick={() => setIsSidebarOpen(false)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition"
              >
                <span>📦 Mi Bóveda / Pedidos</span>
                <span className="text-cyan-600 dark:text-cyan-400">→</span>
              </Link>

              {currentUser.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/60 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/70 text-fuchsia-700 dark:text-fuchsia-300 hover:text-fuchsia-900 dark:hover:text-white border border-fuchsia-200 dark:border-fuchsia-800/60 transition"
                >
                  <span>👑 Panel de Control Admin</span>
                  <span className="text-fuchsia-500 dark:text-fuchsia-400">→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Banner de Notificación RBAC si intentó acceder al Admin sin permisos */}
      {accessDeniedMessage && (
        <div className="bg-rose-950/90 border-b border-rose-500/50 text-rose-200 px-4 py-3 text-xs sm:text-sm font-mono flex items-center justify-between gap-4 z-40 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2 max-w-5xl mx-auto">
            <span className="text-rose-400 text-base font-bold">🚫</span>
            <span>{accessDeniedMessage}</span>
          </div>
          <button
            onClick={() => setAccessDeniedMessage(null)}
            className="text-rose-400 hover:text-white text-base font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* NAVBAR SUPERIOR ESTILO CYBER-Y2K */}
      <header className="sticky top-0 z-30 w-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Izquierda: Logotipo Y2K y Botón Categorías */}
          <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
            <button
              onClick={() => {
                setSelectedCategory('Todas');
                setSelectedGender('Todos');
                setSearchQuery('');
              }}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
              <span className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">STORE</span>
              </span>
            </button>

            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold transition-all hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer"
              aria-label="Abrir menú de categorías"
            >
              <svg className="w-5 h-5 text-cyan-500 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Categorías</span>
            </button>
          </div>

          {/* Centro: Input de búsqueda ancho */}
          <div className="flex-1 max-w-2xl mx-2 hidden sm:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en Y2K Store por nombre, color, marca..."
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full py-2.5 pl-11 pr-10 text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-inner"
              />
              <svg
                className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs bg-slate-200 dark:bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Derecha: Saludo Dinámico, ThemeToggle, Mi Cuenta, Panel Admin y Carrito */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 flex-shrink-0">
            {/* Saludo Dinámico */}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {currentUser.isLoggedIn ? 'Bienvenido' : 'Modo'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                {currentUser.isLoggedIn ? `¡Hola, ${currentUser.firstName}!` : 'Invitado'}
              </span>
            </div>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Botón Mi Cuenta / Iniciar Sesión */}
            <Link
              href="/cuenta"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 text-xs font-semibold transition-all hover:border-cyan-500/40 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            >
              <svg className="w-4 h-4 text-cyan-500 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden md:inline">
                {currentUser.isLoggedIn ? 'Mi Cuenta' : 'Iniciar Sesión'}
              </span>
            </Link>

            {/* Botón Admin Panel (Solo visible si el usuario pertenece a Super_Admin o Admin_Tienda) */}
            {currentUser.isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-950/80 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300 hover:text-fuchsia-900 dark:hover:text-white border border-fuchsia-300 dark:border-fuchsia-700/60 text-xs font-semibold transition-all shadow-sm dark:shadow-[0_0_10px_rgba(217,70,239,0.2)]"
                title="Centro de Control de Administración"
              >
                <span>👑</span>
                <span className="hidden xl:inline">Admin</span>
              </Link>
            )}

            {/* Botón del Carrito con badge dinámico */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition-all group hover:border-cyan-500/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-pointer"
              aria-label="Abrir carrito de compras"
            >
              <svg className="w-5 h-5 text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cart.length > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(217,70,239,0.8)] animate-pulse">
                  {cart.length}
                </span>
              ) : (
                <span className="absolute -top-1.5 -right-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-300 dark:border-slate-700">
                  0
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Barra de búsqueda móvil */}
        <div className="px-4 pb-3 sm:hidden pt-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en Y2K Store..."
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full py-2 pl-10 pr-9 text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </header>

      {/* CARRUSEL DE MARKETING DINÁMICO (HERO SLIDER) */}
      <section className="relative overflow-hidden border-b border-cyan-500/20 bg-slate-950 min-h-[360px] sm:min-h-[440px] flex flex-col justify-between">
        {/* Fondo con Imagen o Patrón Cyber */}
        {banners.length > 0 && banners[currentSlide]?.imageUrl ? (
          <div className="absolute inset-0 z-0">
            <StorageImage
              path={banners[currentSlide].imageUrl!}
              alt={banners[currentSlide].title || 'Hero Banner'}
              className="w-full h-full object-cover object-center animate-fadeIn"
            />
            {/* Overlay Oscuro Cyber */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/90 backdrop-blur-[2px]" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/80 to-slate-950 z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
          </div>
        )}

        {/* Contenido Principal del Slide */}
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-14 text-center space-y-4 relative z-10 flex-1 flex flex-col justify-center items-center">
          {banners.length > 0 ? (
            <Link
              href={banners[currentSlide]?.actionUrl || '#'}
              key={banners[currentSlide]?.id || currentSlide}
              className={`space-y-4 animate-fadeIn max-w-3xl block transition-all duration-300 ${
                banners[currentSlide]?.actionUrl ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'
              }`}
            >
              {/* Badge Dinámico */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-950/70 text-fuchsia-300 text-xs font-mono tracking-widest uppercase shadow-[0_0_15px_rgba(217,70,239,0.35)]">
                <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping" />
                <span>{banners[currentSlide]?.badgeText || 'DESTACADO'}</span>
              </div>

              {/* Título */}
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase leading-tight drop-shadow group-hover:text-cyan-300 transition-colors">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400">
                  {banners[currentSlide]?.title || 'Y2K DROP COLLECTION'}
                </span>
              </h2>

              {/* Subtítulo */}
              {banners[currentSlide]?.subtitle && (
                <p className="text-xs sm:text-base text-slate-300 max-w-2xl mx-auto font-light leading-relaxed drop-shadow-sm">
                  {banners[currentSlide]?.subtitle}
                </p>
              )}

              {banners[currentSlide]?.actionUrl && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-3 py-1 rounded-full border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    <span>Ver Promoción</span>
                    <span>→</span>
                  </span>
                </div>
              )}
            </Link>
          ) : (
            /* Fallback por Defecto */
            <div className="space-y-4 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-mono tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>DROP COLLECTION // 2000s AESTHETICS</span>
              </div>

              <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase leading-tight">
                FUTURE NOSTALGIA <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-500">
                  Y2K STREETWEAR
                </span>
              </h2>

              <p className="text-xs sm:text-base text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
                Prendas únicas, zapatillas icónicas y accesorios retro-futuristas curados para la era digital. Despachos rápidos y retiros en tienda.
              </p>
            </div>
          )}

          {/* Quick Filters de Categorías */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            <button
              onClick={() => { setSelectedCategory('Todas'); setSelectedGender('Todos'); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all duration-300 cursor-pointer ${
                selectedCategory === 'Todas' && selectedGender === 'Todos'
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                  : 'bg-white dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all duration-300 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                    : 'bg-white dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Controles de Navegación del Carrusel (Flechas y Dots) */}
        {banners.length > 1 && (
          <div className="relative z-20 pb-4 max-w-6xl mx-auto w-full px-4 flex items-center justify-between">
            {/* Flecha Izquierda */}
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)}
              className="p-2 rounded-full bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              aria-label="Slide anterior"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Dots Indicadores */}
            <div className="flex items-center gap-2">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    currentSlide === idx
                      ? 'w-6 bg-gradient-to-r from-cyan-400 to-fuchsia-500 shadow-[0_0_10px_rgba(34,211,238,0.8)]'
                      : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-500'
                  }`}
                  aria-label={`Ir al slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Flecha Derecha */}
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % banners.length)}
              className="p-2 rounded-full bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              aria-label="Slide siguiente"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </section>

      {/* CATÁLOGO DE PRODUCTOS (GRID) */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-10 space-y-6">
        {/* Barra informativa de resultados */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800/80 font-mono text-xs">
          <div className="text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
            <span>Mostrando:</span>
            {isSaleFilter ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-rose-600 dark:text-rose-400 font-bold font-mono flex items-center gap-1.5 bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-600/50 px-2.5 py-1 rounded shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                  <span>🔥</span>
                  <span>PRODUCTOS EN REMATE / OFERTAS</span>
                </span>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-cyan-500/50 text-[11px] font-mono transition shadow-sm cursor-pointer"
                  title="Eliminar filtro de ofertas y volver al catálogo completo"
                >
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>Quitar Filtro</span>
                </Link>
              </div>
            ) : (
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                {selectedGender !== 'Todos' ? `${selectedGender} • ` : ''}
                {selectedCategory !== 'Todas' ? selectedCategory : 'Todos los productos'}
              </span>
            )}
            {isSaleFilter && selectedCategory !== 'Todas' && (
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                • {selectedCategory}
              </span>
            )}
            {searchQuery && (
              <span className="text-slate-500 italic">
                (Filtro: &quot;{searchQuery}&quot;)
              </span>
            )}
          </div>
          <span className="text-slate-500">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>

        {/* Listado / Grid */}
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-cyan-500 dark:border-cyan-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 tracking-wider animate-pulse">
              CONECTANDO AL CATÁLOGO DE PRODUCTOS...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3 shadow-sm">
            <div className="text-4xl">🛸</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No se encontraron productos</h3>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              No hay coincidencias para los filtros seleccionados. Prueba limpiando la búsqueda o seleccionando otra categoría.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedCategory('Todas');
                  setSelectedGender('Todos');
                  setSearchQuery('');
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow-sm"
              >
                Restablecer Filtros
              </button>
              {isSaleFilter && (
                <Link
                  href="/"
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-mono font-bold transition border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Volver a Todos los Productos
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const displayImage =
                product.imageUrl ||
                (product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : null);

              const isJustAdded = addedProductId === product.id;

              return (
                <div
                  key={product.id}
                  className="group rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/60 dark:hover:border-cyan-400/60 transition-all duration-300 ease-in-out flex flex-col justify-between overflow-hidden shadow-sm dark:shadow-none hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:-translate-y-1"
                >
                  <Link href={`/producto/${product.id}`} className="block relative">
                    <PublicProductImage imagePath={displayImage} alt={product.name} />

                    {/* Badges de Oferta / Talla / Stock */}
                    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 pointer-events-none">
                      {product.isOnSale && (
                        <span className="px-2 py-0.5 rounded bg-rose-600/90 dark:bg-rose-950/95 backdrop-blur-md text-[10px] font-mono font-black text-white dark:text-rose-300 border border-rose-400 dark:border-rose-600/70 shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse">
                          🔥 OFERTA
                        </span>
                      )}
                      {product.size && (
                        <span className="px-2 py-0.5 rounded bg-white/90 dark:bg-slate-950/80 backdrop-blur-md text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 shadow-sm">
                          TALLA: {product.size}
                        </span>
                      )}
                      {product.stock <= 2 && product.stock > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/90 text-[9px] font-mono font-bold text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-600/50 animate-pulse">
                          ¡ÚLTIMAS {product.stock}!
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Cuerpo de la tarjeta */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                        <span>{product.gender || 'Unisex'}</span>
                        <span>{product.category}</span>
                      </div>

                      <Link href={`/producto/${product.id}`} className="block group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                          {product.name}
                        </h3>
                      </Link>

                      {product.brand && (
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{product.brand}</p>
                      )}
                    </div>

                    {/* Botón de Ancho Completo Agregar al Carrito */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock <= 0}
                        className={`w-full mt-2 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300 ${
                          isJustAdded
                            ? 'bg-emerald-500 text-black scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                            : product.stock <= 0
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700 opacity-60'
                            : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <span className="font-black text-sm">✓</span>
                            <span>¡AGREGADO AL CARRITO!</span>
                          </>
                        ) : product.stock <= 0 ? (
                          <span>AGOTADO</span>
                        ) : (
                          <>
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                              />
                            </svg>
                            <span className="truncate">
                              AGREGAR AL CARRITO • ${Number(product.price).toLocaleString('es-CL')}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER CYBER-Y2K */}
      <footer className="w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 py-8 px-4 sm:px-8 mt-12 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Y2K CLOTHING SYSTEM // VALPARAÍSO, CHILE</span>
          </div>
          <div>
            <span>TODOS LOS DERECHOS RESERVADOS • 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-cyan-400 tracking-widest animate-pulse">CARGANDO Y2K STORE...</p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
