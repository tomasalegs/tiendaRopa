'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { generateClient } from 'aws-amplify/data';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

function PublicProductImage({ imagePath, alt }: { imagePath?: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!imagePath) {
      setUrl(null);
      setLoading(false);
      return;
    }

    getUrl({ path: imagePath })
      .then((res) => {
        if (isMounted) {
          setUrl(res.url.toString());
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error al obtener imagen:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [imagePath]);

  if (!imagePath) {
    return (
      <div className="w-full aspect-square bg-slate-800/80 flex flex-col items-center justify-center text-slate-500 rounded-t-xl">
        <svg className="w-12 h-12 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs uppercase tracking-wider font-mono text-slate-400">Sin imagen</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full aspect-square bg-slate-800 animate-pulse rounded-t-xl flex items-center justify-center">
        <span className="text-xs text-slate-500 font-mono">Cargando foto...</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-full aspect-square bg-slate-800 flex items-center justify-center text-red-400 text-xs rounded-t-xl">
        Error al cargar imagen
      </div>
    );
  }

  return (
    <div className="w-full aspect-square overflow-hidden rounded-t-xl bg-slate-950 relative">
      <img
        src={url}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    </div>
  );
}

function CartItemImage({ imagePath, alt }: { imagePath?: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!imagePath) {
      setUrl(null);
      setLoading(false);
      return;
    }

    getUrl({ path: imagePath })
      .then((res) => {
        if (isMounted) {
          setUrl(res.url.toString());
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [imagePath]);

  if (!imagePath || !url) {
    return (
      <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 flex-shrink-0 border border-slate-700">
        Sin foto
      </div>
    );
  }

  if (loading) {
    return <div className="w-14 h-14 rounded-lg bg-slate-800 animate-pulse flex-shrink-0" />;
  }

  return (
    <img
      src={url}
      alt={alt}
      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-slate-700"
    />
  );
}

export default function HomePage() {
  const [products, setProducts] = useState<Schema['Product']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedGender, setSelectedGender] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [expandedGender, setExpandedGender] = useState<string | null>(null);

  // Estados para el Carrito de Compras
  const [cart, setCart] = useState<Schema['Product']['type'][]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  useEffect(() => {
    const sub = client.models.Product.observeQuery({
      filter: {
        isAvailable: { eq: true },
      },
    }).subscribe({
      next: ({ items }) => {
        const availableItems = (items || []).filter(
          (p) => p !== null && p !== undefined && p.isAvailable !== false
        );
        setProducts(availableItems as Schema['Product']['type'][]);
        setLoading(false);
      },
      error: (err) => {
        console.error('Error al observar productos:', err);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, []);

  const categories = ['Ropa', 'Zapatillas', 'Carteras', 'Colonias', 'Accesorios', 'Gorros', 'Cosmética', 'Otro'];
  const gendersList = ['Hombre', 'Mujer', 'Unisex', 'Infantil'];

  // Funciones para manipular el Carrito
  const addToCart = (product: Schema['Product']['type']) => {
    if (!product) return;
    setCart((prev) => [...prev, product]);
    setAddedProductId(product.id);
    setTimeout(() => {
      setAddedProductId((prevId) => (prevId === product.id ? null : prevId));
    }, 1200);
  };

  const removeFromCart = (indexToRemove: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + Number(item?.price ?? 0), 0);
  const formattedCartTotal = cartTotal.toLocaleString('es-CL');

  // Lógica de Filtrado Combinado: Categoría + Género + Búsqueda por texto con resiliencia a nulos
  const filteredProducts = products.filter((p) => {
    if (!p) return false;
    const matchCategory = selectedCategory === 'Todas' || p?.category === selectedCategory;
    const matchGender = selectedGender === 'Todos' || p?.gender === selectedGender;
    const matchSearch =
      !searchQuery.trim() ||
      (p?.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false) ||
      (p?.category?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false) ||
      (p?.color?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false) ||
      (p?.brand?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ?? false);
    return matchCategory && matchGender && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black relative">
      {/* Backdrop overlay para Drawer Izquierdo o Carrito Derecho */}
      {(isSidebarOpen || isCartOpen) && (
        <div
          onClick={() => {
            setIsSidebarOpen(false);
            setIsCartOpen(false);
          }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 transition-opacity duration-300"
        />
      )}

      {/* Menú Lateral Desplegable (Off-Canvas Drawer Izquierdo) */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 max-w-[88vw] bg-slate-950 border-r border-slate-800 shadow-2xl z-50 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Encabezado Superior con "¡Hola, Tomás!" y botón X */}
          <div className="p-5 border-b border-slate-800/90 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-400 flex items-center justify-center font-bold text-white text-sm shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                T
              </div>
              <div>
                <p className="text-xs text-slate-400">Bienvenido</p>
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide">¡Hola, Tomás!</h2>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Cerrar menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cuerpo del menú con acordeón de Géneros y Subcategorías */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-900">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">Categorías por Género</span>
              <button
                onClick={() => {
                  setSelectedGender('Todos');
                  setSelectedCategory('Todas');
                  setExpandedGender(null);
                  setIsSidebarOpen(false);
                }}
                className="text-[11px] text-cyan-400 hover:underline font-semibold"
              >
                Ver todo el catálogo
              </button>
            </div>

            <div className="space-y-2">
              {gendersList.map((g) => {
                const isExpanded = expandedGender === g;
                const isGenderSelected = selectedGender === g;

                return (
                  <div key={g} className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden transition-all">
                    {/* Botón Principal del Género */}
                    <button
                      onClick={() => setExpandedGender(isExpanded ? null : g)}
                      className={`w-full text-left px-4 py-3.5 text-sm font-semibold flex items-center justify-between transition-colors ${
                        isGenderSelected
                          ? 'bg-purple-950/70 text-purple-200'
                          : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${isGenderSelected ? 'bg-purple-400 shadow-[0_0_6px_rgba(192,38,211,1)]' : 'bg-slate-600'}`}></span>
                        <span>{g}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-cyan-400' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Subcategorías desplegables */}
                    {isExpanded && (
                      <div className="bg-slate-950/80 border-t border-slate-800/60 p-2 space-y-1">
                        <button
                          onClick={() => {
                            setSelectedGender(g);
                            setSelectedCategory('Todas');
                            setIsSidebarOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-cyan-400 hover:bg-cyan-950/40 border border-cyan-900/40 flex items-center justify-between transition-colors"
                        >
                          <span>Ver todo en {g}</span>
                          <span className="text-cyan-400">→</span>
                        </button>

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
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                                isCatSelected
                                  ? 'bg-gradient-to-r from-purple-900/60 to-cyan-950 text-white font-bold border border-purple-500/40'
                                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                              }`}
                            >
                              <span>{cat}</span>
                              {isCatSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer del Drawer */}
          <div className="p-4 border-t border-slate-900 bg-slate-950 space-y-2 flex-shrink-0">
            <button
              onClick={() => {
                setSelectedGender('Todos');
                setSelectedCategory('Todas');
                setSearchQuery('');
                setExpandedGender(null);
                setIsSidebarOpen(false);
              }}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            >
              Limpiar todos los filtros
            </button>
            <Link
              href="/admin"
              onClick={() => setIsSidebarOpen(false)}
              className="w-full py-2 px-4 text-xs text-center font-medium text-slate-500 hover:text-cyan-400 flex items-center justify-center gap-1.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Acceso Administrador</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Panel del Carrito de Compras (Slide-over desde la Derecha) */}
      <aside
        className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-slate-950 border-l border-slate-800 shadow-2xl z-50 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header del Carrito */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              Mi Carrito
              <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/50">
                {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </h2>
          </div>

          <button
            onClick={() => setIsCartOpen(false)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Cerrar carrito"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lista de productos en el Carrito */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl shadow-inner">
                🛒
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Tu carrito está vacío</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Agrega prendas o artículos desde el catálogo para verlos aquí.
                </p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-cyan-400 border border-slate-700 rounded-lg transition-colors"
              >
                Explorar Catálogo
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">Productos seleccionados</span>
                <button
                  onClick={clearCart}
                  className="text-[11px] text-red-400 hover:underline"
                >
                  Vaciar carrito
                </button>
              </div>

              {cart.map((item, idx) => {
                const itemPrice = Number(item?.price ?? 0).toLocaleString('es-CL');
                return (
                  <div
                    key={`${item?.id}-${idx}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <CartItemImage imagePath={item?.imageUrl} alt={item?.name || 'Producto'} />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item?.name || 'Producto sin nombre'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item?.category || 'Sin categoría'}{item?.gender ? ` • ${item.gender}` : ''}
                      </p>
                      <p className="text-sm font-extrabold text-cyan-400 mt-1">${itemPrice}</p>
                    </div>

                    <button
                      onClick={() => removeFromCart(idx)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Eliminar artículo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer del Carrito con Total a Pagar y Botón de Pago */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-slate-800 bg-slate-950 space-y-4 flex-shrink-0">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal ({cart.length} {cart.length === 1 ? 'artículo' : 'artículos'})</span>
                <span>${formattedCartTotal}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Envío</span>
                <span className="text-emerald-400 font-medium">Por calcular</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-800 text-sm font-bold text-white">
                <span>Total a Pagar</span>
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                  ${formattedCartTotal}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-fuchsia-600 to-purple-600 hover:from-cyan-500 hover:via-fuchsia-500 hover:to-purple-500 text-white text-sm font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(217,70,239,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Proceder al Pago
            </button>
          </div>
        )}
      </aside>

      {/* Header / Navegación Superior */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/90 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Izquierda: Logo interactivo + Botón Hamburguesa "Menú" */}
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            <button
              onClick={() => {
                setSelectedGender('Todos');
                setSelectedCategory('Todas');
                setSearchQuery('');
                setIsSidebarOpen(false);
              }}
              className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none select-none"
              aria-label="Volver al inicio y restablecer tienda"
            >
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
              <span className="text-xl sm:text-2xl font-black tracking-widest text-white group-hover:text-cyan-400 transition-colors">
                Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">STORE</span>
              </span>
            </button>

            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold transition-all hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              aria-label="Abrir menú de categorías"
            >
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Menú</span>
            </button>
          </div>

          {/* Centro: Input de búsqueda ancho */}
          <div className="flex-1 max-w-2xl mx-2 hidden sm:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en Y2K Store..."
                className="w-full bg-slate-900 border border-slate-700 rounded-full py-2.5 pl-11 pr-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-inner"
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Derecha: Saludo, Mi Cuenta y Botón del Carrito con Insignia */}
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            {/* Saludo Tomás */}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs text-slate-400 font-medium">Bienvenido</span>
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide">¡Hola, Tomás!</span>
            </div>

            {/* Botón Mi Cuenta */}
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-all"
            >
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden md:inline">Mi Cuenta</span>
            </Link>

            {/* Botón del Carrito con badge dinámico */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all group hover:border-cyan-500/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
              aria-label="Abrir carrito de compras"
            >
              <svg className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cart.length > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(217,70,239,0.8)] animate-pulse">
                  {cart.length}
                </span>
              ) : (
                <span className="absolute -top-1.5 -right-1.5 bg-slate-800 text-slate-400 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-700">
                  0
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Barra de búsqueda móvil */}
        <div className="px-4 pb-3 sm:hidden">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en Y2K Store..."
              className="w-full bg-slate-900 border border-slate-700 rounded-full py-2 pl-10 pr-9 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden py-10 px-4 sm:px-6 lg:px-8 border-b border-slate-900 bg-gradient-to-b from-slate-900/40 to-transparent">
        <div className="max-w-7xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-1">
            ✨ Catálogo Exclusivo 2000s
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            VINTAGE & STREETWEAR VAULT
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            Explora las prendas, accesorios, calzado y fragancias seleccionadas de nuestra tienda Y2K.
          </p>

          {/* Indicadores de Filtros Activos */}
          {(selectedCategory !== 'Todas' || selectedGender !== 'Todos' || searchQuery.trim() !== '') && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs text-slate-400">
              <span className="font-mono">Filtros:</span>
              {selectedGender !== 'Todos' && (
                <span className="bg-purple-950 text-purple-300 border border-purple-800/60 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                  Género: {selectedGender}
                  <button onClick={() => setSelectedGender('Todos')} className="hover:text-white font-bold">×</button>
                </span>
              )}
              {selectedCategory !== 'Todas' && (
                <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                  Categoría: {selectedCategory}
                  <button onClick={() => setSelectedCategory('Todas')} className="hover:text-white font-bold">×</button>
                </span>
              )}
              {searchQuery.trim() !== '' && (
                <span className="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                  Búsqueda: &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="hover:text-white font-bold">×</button>
                </span>
              )}
              <button
                onClick={() => {
                  setSelectedGender('Todos');
                  setSelectedCategory('Todas');
                  setSearchQuery('');
                }}
                className="text-xs text-cyan-400 hover:underline font-semibold ml-2"
              >
                Restablecer todo
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Grid de Productos */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-900">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Mostrando {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
          </span>
          {cart.length > 0 && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="text-xs text-cyan-400 hover:underline font-semibold flex items-center gap-1.5"
            >
              <span>Ver Carrito ({cart.length})</span>
              <span>→</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 animate-pulse space-y-3">
                <div className="aspect-square bg-slate-800 rounded-lg"></div>
                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                <div className="h-8 bg-slate-800 rounded mt-4"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-semibold text-white">No se encontraron productos</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              No hay coincidencias para los filtros aplicados. Intenta buscar con otros términos o limpiar los filtros.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('Todas');
                setSelectedGender('Todos');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 rounded-lg transition border border-slate-700"
            >
              Ver Todo el Catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p, index) => {
              const formattedPrice = Number(p?.price ?? 0).toLocaleString('es-CL');
              const isVolumenCategory = p?.category === 'Colonias' || p?.category === 'Cosmética';
              const isAdded = addedProductId === p?.id;

              return (
                <div
                  key={p?.id || index}
                  className="bg-slate-900/80 rounded-xl border border-slate-800/90 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300 group flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Imagen */}
                    <PublicProductImage imagePath={p?.imageUrl} alt={p?.name || 'Producto'} />

                    {/* Contenido */}
                    <div className="p-4 space-y-2">
                      {/* Badges de Categoría y Género */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
                          {p?.category || 'Sin categoría'}
                        </span>
                        {p?.gender && (
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
                            {p.gender}
                          </span>
                        )}
                      </div>

                      {/* Nombre */}
                      <h2 className="font-bold text-base text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                        {p?.name || 'Producto sin nombre'}
                      </h2>

                      {/* Detalles: Talla/Volumen & Color */}
                      {(p?.size || p?.color) && (
                        <p className="text-xs text-slate-400">
                          {p?.size ? `${isVolumenCategory ? 'Volumen:' : 'Talla:'} ${p.size}` : ''}
                          {p?.size && p?.color ? ' • ' : ''}
                          {p?.color ? `Color: ${p.color}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer de la Card: Precio y Botón Agregar al Carrito */}
                  <div className="p-4 pt-0 mt-auto space-y-3">
                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-800/60">
                      <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Precio</span>
                      <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                        ${formattedPrice}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => addToCart(p)}
                      className={`w-full py-2.5 px-4 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                        isAdded
                          ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-[1.02]'
                          : 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(217,70,239,0.5)] active:scale-[0.98]'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>¡Agregado!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                          <span>Agregar al carrito</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/90 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Y2K Store. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
