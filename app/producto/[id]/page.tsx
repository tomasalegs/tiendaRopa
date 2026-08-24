'use client';

import { useState, useEffect, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react/styles.css';
import type { Schema } from '@/amplify/data/resource';
import { useCart } from '@/context/CartContext';
import ThemeToggle from '@/components/ThemeToggle';

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

interface PageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function ProductDetailPage({ params: paramsProp }: PageProps) {
  const router = useRouter();
  const routeParams = useParams();

  // Consumir el estado y las acciones del Carrito Global
  const { cart, addToCart: addGlobalToCart, setIsCartOpen } = useCart();

  // Resolve ID from either next/navigation useParams() or Next.js page props
  let resolvedId = '';
  if (routeParams?.id) {
    resolvedId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  } else if (paramsProp) {
    if (typeof (paramsProp as any).then === 'function') {
      try {
        const unwrapped = use(paramsProp as Promise<{ id: string }>);
        resolvedId = unwrapped?.id || '';
      } catch {
        // Fallback if not inside Suspense/promise resolution
      }
    } else {
      resolvedId = (paramsProp as { id: string }).id || '';
    }
  }

  const [product, setProduct] = useState<Schema['Product']['type'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [addedToCart, setAddedToCart] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSelectedImage(null);

    async function loadProduct() {
      try {
        let res = await client.models.Product.get(
          { id: resolvedId },
          { authMode: 'apiKey' }
        );

        // Fallback defensivo en caso de error
        if (res.errors && res.errors.length > 0 && !res.data) {
          try {
            const fallbackRes = await client.models.Product.get(
              { id: resolvedId },
              { authMode: 'identityPool' }
            );
            if (fallbackRes.data) {
              res = fallbackRes;
            }
          } catch (fallbackErr) {
            console.error('GraphQL Error en fallback authMode product detail:', fallbackErr);
          }
        }

        if (!isMounted) return;

        if (res.errors && res.errors.length > 0) {
          console.error('Error AppSync 401:', res.errors);
          if (!res.data) {
            setError('Error al cargar el producto. Revisa la consola.');
            setLoading(false);
            return;
          }
        }

        if (!res.data) {
          setError('Producto no encontrado en nuestro catálogo.');
          setLoading(false);
          return;
        }

        setProduct(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error AppSync 401 / Excepción al obtener producto:', err);
        if (isMounted) {
          setError('Error al cargar el producto. Revisa la consola.');
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [resolvedId]);

  const handleAddToCart = () => {
    if (!product) return;
    addGlobalToCart(product, quantity);
    setAddedToCart(true);

    setTimeout(() => {
      setAddedToCart(false);
    }, 1800);
  };

  const isVolumenCategory = product?.category === 'Colonias' || product?.category === 'Cosmética';
  const formattedPrice = product?.price ? Number(product.price).toLocaleString('es-CL') : '0';
  const availableStock = product?.stock ?? 0;

  // Galería de imágenes: extraer de imageUrls o fallback a imageUrl
  const galleryImages: string[] = product
    ? (product.imageUrls && product.imageUrls.length > 0)
      ? (product.imageUrls.filter(Boolean) as string[])
      : product.imageUrl
      ? [product.imageUrl]
      : []
    : [];

  const activeImage = selectedImage || galleryImages[0] || null;

  const handlePrevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (galleryImages.length <= 1) return;
    const currentIndex = galleryImages.indexOf(activeImage || '');
    const prevIndex = currentIndex <= 0 ? galleryImages.length - 1 : currentIndex - 1;
    setSelectedImage(galleryImages[prevIndex]);
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (galleryImages.length <= 1) return;
    const currentIndex = galleryImages.indexOf(activeImage || '');
    const nextIndex = currentIndex >= galleryImages.length - 1 ? 0 : currentIndex + 1;
    setSelectedImage(galleryImages[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black transition-colors duration-200">
      {/* Header / Barra de Navegación */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-medium transition-all group hover:border-cyan-500/50 cursor-pointer shadow-sm"
              aria-label="Volver atrás"
            >
              <svg
                className="w-4 h-4 text-cyan-500 group-hover:-translate-x-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Volver atrás</span>
            </button>

            <Link href="/" className="flex items-center gap-2 group cursor-pointer focus:outline-none">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
              <span className="text-lg sm:text-xl font-black tracking-widest text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-fuchsia-500">STORE</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium hidden sm:inline"
            >
              Catálogo
            </Link>

            {/* Selector de Modo Claro/Oscuro */}
            <ThemeToggle />

            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 text-xs font-semibold transition-all shadow-sm"
            >
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:inline">Mi Cuenta</span>
            </Link>

            {/* Botón Abrir Carrito Global */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 rounded-lg bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition-all group hover:border-cyan-500/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-pointer shadow-sm"
              aria-label="Abrir carrito de compras"
            >
              <svg className="w-5 h-5 text-cyan-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading ? (
          /* Estado de Carga / Skeleton */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 animate-pulse">
            <div className="w-full aspect-square bg-slate-900/80 rounded-2xl border border-slate-800/80 flex items-center justify-center">
              <span className="text-sm font-mono text-slate-500">Cargando detalles del producto...</span>
            </div>
            <div className="space-y-6">
              <div className="h-6 bg-slate-800 rounded w-1/4"></div>
              <div className="h-10 bg-slate-800 rounded w-3/4"></div>
              <div className="h-12 bg-slate-800 rounded w-1/2"></div>
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="h-4 bg-slate-800 rounded w-full"></div>
                <div className="h-4 bg-slate-800 rounded w-5/6"></div>
              </div>
              <div className="h-14 bg-slate-800 rounded-xl w-full mt-6"></div>
            </div>
          </div>
        ) : error || !product ? (
          /* Estado de Error */
          <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50 max-w-xl mx-auto px-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{error || 'Producto no encontrado'}</h2>
            <p className="text-sm text-slate-400 mb-6">
              El producto que buscas ya no está disponible o el identificador es inválido.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg transition-all"
            >
              Volver al Catálogo
            </button>
          </div>
        ) : (
          /* Vista Detallada de 2 Columnas */
          <div className="space-y-8">
            {/* Migas de pan */}
            <nav className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <Link href="/" className="hover:text-cyan-400 transition-colors">
                Inicio
              </Link>
              <span>/</span>
              <span className="text-slate-300">{product.category || 'Categoría'}</span>
              <span>/</span>
              <span className="text-cyan-400 truncate max-w-[200px] sm:max-w-none">{product.name}</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Columna Izquierda: Galería de Imágenes (Grande + Miniaturas) con Estética Tech Card */}
              <div className="w-full space-y-4">
                {/* Contenedor Principal de Imagen con Proporción Fija, Fondo Transparente y Brillo Neón */}
                <div className="relative w-full aspect-square bg-transparent rounded-2xl border-2 border-cyan-500/40 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.2),inset_0_0_20px_rgba(6,182,212,0.05)] group flex items-center justify-center">
                  {/* Marcadores de esquina Cyber-Y2K */}
                  <div className="absolute top-2.5 left-2.5 z-20 text-[10px] font-mono text-cyan-400 select-none pointer-events-none drop-shadow">◤</div>
                  <div className="absolute top-2.5 right-2.5 z-20 text-[10px] font-mono text-cyan-400 select-none pointer-events-none drop-shadow">◥</div>
                  <div className="absolute bottom-2.5 left-2.5 z-20 text-[10px] font-mono text-cyan-400 select-none pointer-events-none drop-shadow">◣</div>
                  <div className="absolute bottom-2.5 right-2.5 z-20 text-[10px] font-mono text-cyan-400 select-none pointer-events-none drop-shadow">◢</div>

                  {/* Barra de Terminal Superior en Imagen */}
                  <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
                    {/* Badge de Disponibilidad sobre la Imagen */}
                    {availableStock > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-950/90 text-emerald-400 border border-emerald-500/50 backdrop-blur-md shadow-[0_0_10px_rgba(16,185,129,0.3)] pointer-events-auto">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        SYS:ACTV ({availableStock} UN)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-950/90 text-rose-400 border border-rose-800/80 backdrop-blur-md shadow-lg pointer-events-auto">
                        SYS:OUT_OF_STOCK
                      </span>
                    )}

                    {/* Serial de Hardware */}
                    <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 backdrop-blur-md pointer-events-auto">
                      REF-{product.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  {/* Renderizado de StorageImage Principal con object-contain p-4 y transición suave */}
                  {activeImage ? (
                    activeImage.startsWith('http://') || activeImage.startsWith('https://') || activeImage.startsWith('data:') ? (
                      <img
                        src={activeImage}
                        alt={product.name || 'Foto del producto'}
                        loading="eager"
                        className="w-full h-full object-contain p-4 mix-blend-normal rounded-2xl transition-opacity duration-300 z-0"
                      />
                    ) : (
                      <StorageImage
                        key={activeImage}
                        path={activeImage}
                        alt={product.name || 'Foto del producto'}
                        loading="eager"
                        className="w-full h-full object-contain p-4 mix-blend-normal rounded-2xl transition-opacity duration-300 z-0"
                        fallbackSrc="/favicon.ico"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900 rounded-2xl">
                      <svg className="w-20 h-20 mb-3 opacity-30 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-500">NO_SIGNAL</span>
                    </div>
                  )}

                  {/* Botones de Navegación del Carrusel Superpuestos (Izquierda / Derecha) */}
                  {galleryImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm border border-cyan-500/50 text-cyan-400 hover:text-white hover:bg-cyan-900/50 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-all flex items-center justify-center font-mono text-lg font-bold cursor-pointer select-none"
                        aria-label="Foto anterior"
                      >
                        &lt;
                      </button>

                      <button
                        type="button"
                        onClick={handleNextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm border border-cyan-500/50 text-cyan-400 hover:text-white hover:bg-cyan-900/50 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-all flex items-center justify-center font-mono text-lg font-bold cursor-pointer select-none"
                        aria-label="Siguiente foto"
                      >
                        &gt;
                      </button>
                    </>
                  )}
                </div>

                {/* Cuadrícula de Miniaturas (Thumbnails) para Múltiples Imágenes */}
                {galleryImages.length > 1 && (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {galleryImages.map((imgPath, idx) => {
                      const isCurrent = activeImage === imgPath;
                      return (
                        <button
                          key={`${imgPath}-${idx}`}
                          type="button"
                          onClick={() => setSelectedImage(imgPath)}
                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer bg-slate-100 dark:bg-slate-900 ${
                            isCurrent
                              ? 'border-slate-800 dark:border-cyan-400 shadow-sm opacity-100 ring-2 ring-cyan-500/30'
                              : 'border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
                          }`}
                          aria-label={`Ver foto ${idx + 1}`}
                        >
                          {imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:') ? (
                            <img
                              src={imgPath}
                              alt={`${product.name || 'Producto'} miniatura ${idx + 1}`}
                              loading="lazy"
                              className="w-full h-full object-contain p-1 mix-blend-normal"
                            />
                          ) : (
                            <StorageImage
                              path={imgPath}
                              alt={`${product.name || 'Producto'} miniatura ${idx + 1}`}
                              loading="lazy"
                              className="w-full h-full object-contain p-1 mix-blend-normal"
                              fallbackSrc="/favicon.ico"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Sub-información técnica de autenticidad / envío */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-cyan-500/20 flex items-center gap-3 shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.05)]">
                    <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">AUTÉNTICO // Y2K</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Curaduría de archivo</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-purple-500/20 flex items-center gap-3 shadow-sm dark:shadow-[0_0_10px_rgba(168,85,247,0.05)]">
                    <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">ENVÍO PRIORITARIO</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Todo Chile express</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Ficha Técnica, Especificaciones y Botón de Compra */}
              <div className="flex flex-col space-y-6">
                {/* Badges de Categoría, Género y Marca estilo Cyber Chip */}
                <div className="flex flex-wrap items-center gap-2">
                  {product.isOnSale && (
                    <span className={`text-xs font-mono font-black tracking-wider uppercase px-3 py-1 rounded-full border shadow-sm animate-pulse ${
                      product.promoType === 'remate'
                        ? 'bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-600/70 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        : 'bg-fuchsia-100 dark:bg-fuchsia-950/90 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-600/70 shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                    }`}>
                      {product.promoType === 'remate' ? '🔥 REMATE FINAL' : '🏷️ REBAJA ESPECIAL'}
                    </span>
                  )}
                  <span className="text-xs font-mono font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/90 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/50 shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                    CAT: {product.category || 'General'}
                  </span>
                  {product.gender && (
                    <span className="text-xs font-mono font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/90 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50 shadow-sm dark:shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                      GEN: {product.gender}
                    </span>
                  )}
                  {product.brand && (
                    <span className="text-xs font-mono font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/90 text-amber-700 dark:text-amber-300 border border-slate-300 dark:border-amber-800/50">
                      BRD: {product.brand}
                    </span>
                  )}
                </div>

                {/* Nombre del Producto y Serial de Terminal */}
                <div>
                  <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                    {product.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 font-mono text-xs text-slate-500">
                    <span className="text-cyan-600 dark:text-cyan-400/80">SYS://NODE_ID:</span>
                    <span className="text-slate-600 dark:text-slate-400 font-bold">{product.id}</span>
                  </div>
                </div>

                {/* Precio Grande con Estilo Monitor Neón */}
                <div className="p-5 rounded-2xl bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-slate-200 dark:border-cyan-500/30 shadow-md dark:shadow-[0_0_20px_rgba(6,182,212,0.1)] flex items-baseline justify-between">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1">
                      {product.isOnSale && product.salePrice ? 'PRECIO PROMOCIONAL' : 'VALOR UNITARIO'}
                    </span>
                    {product.isOnSale && product.salePrice ? (
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-3xl sm:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 dark:from-rose-400 dark:via-pink-400 dark:to-fuchsia-400 drop-shadow-sm dark:drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]">
                          ${Number(product.salePrice).toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-sans">CLP</span>
                        </span>
                        <span className="text-sm sm:text-base font-mono line-through text-slate-400">
                          ${formattedPrice} CLP
                        </span>
                      </div>
                    ) : (
                      <span className="text-3xl sm:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 dark:from-cyan-400 dark:via-teal-300 dark:to-emerald-400 drop-shadow-sm dark:drop-shadow-[0_0_12px_rgba(6,182,212,0.35)]">
                        ${formattedPrice} <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-sans">CLP</span>
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">ESTADO</span>
                    <span className={`text-xs font-mono font-bold ${availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {availableStock > 0 ? '✓ DISPONIBLE' : '✕ AGOTADO'}
                    </span>
                  </div>
                </div>

                {/* Ficha de Especificaciones Técnicas 'Tech Card' */}
                <div className="rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-cyan-500/20 p-5 space-y-4 shadow-md dark:shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-cyan-500/20 pb-2">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-cyan-700 dark:text-cyan-400 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                      ESPECIFICACIONES DEL PRODUCTO
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">SPEC_REV.02</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                    {/* Categoría */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">CATEGORÍA</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{product.category || 'No especificada'}</span>
                    </div>

                    {/* Género */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">GÉNERO</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{product.gender || 'Unisex'}</span>
                    </div>

                    {/* Talla / Volumen */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {isVolumenCategory ? 'VOLUMEN' : 'TALLA / SIZE'}
                      </span>
                      <span className="font-semibold text-cyan-700 dark:text-cyan-300">{product.size || 'Única / Estándar'}</span>
                    </div>

                    {/* Stock */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">STOCK DISPONIBLE</span>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono">{availableStock} unidades</span>
                    </div>

                    {/* Color */}
                    {product.color && (
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">COLOR</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{product.color}</span>
                      </div>
                    )}

                    {/* Marca */}
                    {product.brand && (
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">MARCA</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{product.brand}</span>
                      </div>
                    )}
                  </div>

                  {/* Descripción */}
                  {product.description && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block mb-1">DESCRIPCIÓN TÉCNICA</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">{product.description}</p>
                    </div>
                  )}
                </div>

                {/* Selector de Cantidad y Botón Agregar al Carrito */}
                <div className="space-y-4 pt-2">
                  {availableStock > 0 && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">CANTIDAD:</span>
                      <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-cyan-500/30 p-1">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-base font-bold transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                          disabled={quantity >= availableStock}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-base font-bold transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        (MÁX: {availableStock})
                      </span>
                    </div>
                  )}

                  {/* Botón Grande Agregar al Carrito */}
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={availableStock <= 0}
                    className={`w-full py-4 px-6 rounded-xl text-white font-mono font-extrabold uppercase tracking-wider text-sm sm:text-base transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      addedToCart
                        ? 'bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-[1.01]'
                        : availableStock > 0
                        ? 'bg-gradient-to-r from-cyan-600 via-fuchsia-600 to-cyan-600 bg-[length:200%_auto] hover:bg-right transition-[background-position] duration-500 shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:shadow-[0_0_30px_rgba(217,70,239,0.6)] active:scale-[0.99]'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {addedToCart ? (
                      <>
                        <svg className="w-6 h-6 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>¡Agregado al Carrito ({quantity})!</span>
                      </>
                    ) : availableStock > 0 ? (
                      <>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <span>Agregar al Carrito • ${(Number(product.price) * quantity).toLocaleString('es-CL')}</span>
                      </>
                    ) : (
                      <span>Producto Fuera de Stock</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/90 py-6 text-center text-xs text-slate-500 mt-auto transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Y2K Store. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
