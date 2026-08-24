'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { useRouter } from 'next/navigation';
import type { Schema } from '@/amplify/data/resource';
import { useCart } from '@/context/CartContext';

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

interface StockIssue {
  productId: string;
  name: string;
  type: 'NOT_FOUND' | 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';
  message: string;
  availableStock: number;
  requestedQty: number;
}

function CartItemImage({ imagePath, alt }: { imagePath?: string | null; alt: string }) {
  if (!imagePath) {
    return (
      <div className="w-14 h-14 rounded-lg bg-gray-900 flex items-center justify-center text-[10px] text-gray-500 flex-shrink-0 border border-slate-800 font-mono">
        NO_SIGNAL
      </div>
    );
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    return (
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-900 border border-slate-800 flex-shrink-0 flex items-center justify-center">
        <img
          src={imagePath}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-900 border border-slate-800 flex-shrink-0 flex items-center justify-center">
      <StorageImage
        path={imagePath}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover"
        fallbackSrc="/favicon.ico"
      />
    </div>
  );
}

export default function CartDrawer() {
  const {
    cart,
    setCart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    clearCart,
    formattedCartTotal,
  } = useCart();

  const router = useRouter();
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [stockIssues, setStockIssues] = useState<Record<string, StockIssue>>({});

  // Función asíncrona principal: Valida el inventario en tiempo real
  const validarStock = useCallback(async (): Promise<boolean> => {
    if (cart.length === 0) {
      setStockIssues({});
      return true;
    }

    setIsValidating(true);

    // 1. Agrupar las cantidades solicitadas por cada ID único
    const requestedMap: Record<string, { qty: number; sampleItem: Schema['Product']['type'] }> = {};
    for (const item of cart) {
      if (item?.id) {
        if (!requestedMap[item.id]) {
          requestedMap[item.id] = { qty: 0, sampleItem: item };
        }
        requestedMap[item.id].qty += 1;
      }
    }

    const uniqueIds = Object.keys(requestedMap);
    const issuesFound: Record<string, StockIssue> = {};

    try {
      // 2. Consultar el estado actual de cada producto en Amplify Data con authMode público
      const results = await Promise.all(
        uniqueIds.map((id) =>
          client.models.Product.get({ id }, { authMode: 'identityPool' })
            .then((res) => ({ id, data: res.data, error: null }))
            .catch((err) => ({ id, data: null, error: err }))
        )
      );

      // 3. Evaluar reglas de disponibilidad y stock
      for (const res of results) {
        const { id, data } = res;
        const requestedQty = requestedMap[id].qty;
        const fallbackName = requestedMap[id].sampleItem?.name || 'Producto';

        if (!data) {
          issuesFound[id] = {
            productId: id,
            name: fallbackName,
            type: 'NOT_FOUND',
            message: 'El producto fue eliminado o ya no existe en el catálogo.',
            availableStock: 0,
            requestedQty,
          };
        } else if (data.isAvailable === false) {
          issuesFound[id] = {
            productId: id,
            name: data.name || fallbackName,
            type: 'UNAVAILABLE',
            message: 'Este producto fue marcado como no disponible.',
            availableStock: 0,
            requestedQty,
          };
        } else if ((data.stock ?? 0) <= 0) {
          issuesFound[id] = {
            productId: id,
            name: data.name || fallbackName,
            type: 'OUT_OF_STOCK',
            message: 'El producto se encuentra actualmente agotado.',
            availableStock: 0,
            requestedQty,
          };
        } else if ((data.stock ?? 0) < requestedQty) {
          issuesFound[id] = {
            productId: id,
            name: data.name || fallbackName,
            type: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente: solicitas ${requestedQty}, pero solo quedan ${data.stock} disp.`,
            availableStock: data.stock ?? 0,
            requestedQty,
          };
        }
      }

      setStockIssues(issuesFound);
      setIsValidating(false);
      return Object.keys(issuesFound).length === 0;
    } catch (error) {
      console.error('Error durante la validación de stock:', error);
      setIsValidating(false);
      return false;
    }
  }, [cart]);

  // Ejecutar validación de inventario cada vez que se abra el carrito
  useEffect(() => {
    if (isCartOpen && cart.length > 0) {
      validarStock();
    } else if (cart.length === 0) {
      setStockIssues({});
    }
  }, [isCartOpen, cart.length, validarStock]);

  // Función para auto-remover o ajustar productos con problemas de stock
  const handleAutoFixStock = async () => {
    setIsValidating(true);
    try {
      // Volver a consultar el stock actual
      const uniqueIds = Array.from(new Set(cart.map((item) => item?.id).filter(Boolean)));
      const results = await Promise.all(
        uniqueIds.map((id) =>
          client.models.Product.get({ id }, { authMode: 'identityPool' })
            .then((res) => ({ id, data: res.data }))
            .catch(() => ({ id, data: null }))
        )
      );

      const stockMap = new Map<string, { data: Schema['Product']['type'] | null; remainingStock: number }>();
      for (const res of results) {
        if (res.data && res.data.isAvailable !== false && (res.data.stock ?? 0) > 0) {
          stockMap.set(res.id, { data: res.data, remainingStock: res.data.stock ?? 0 });
        }
      }

      const updatedCart: Schema['Product']['type'][] = [];

      for (const item of cart) {
        if (!item?.id) continue;
        const entry = stockMap.get(item.id);
        if (entry && entry.remainingStock > 0) {
          updatedCart.push(entry.data || item);
          entry.remainingStock -= 1;
        }
      }

      setCart(updatedCart);
      setStockIssues({});
    } catch (err) {
      console.error('Error al auto-ajustar carrito:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // Manejador del botón "Proceder al Pago" - Redirección a Checkout Oficial
  const handleProceedToCheckout = async () => {
    const isValid = await validarStock();

    if (!isValid) {
      return;
    }

    // Si todo el stock es válido, cerramos el drawer y redirigimos a la vista oficial de Checkout
    setIsCartOpen(false);
    router.push('/checkout');
  };

  const hasIssues = Object.keys(stockIssues).length > 0;
  const issuesList = Object.values(stockIssues);

  return (
    <>
      {/* Backdrop overlay */}
      {isCartOpen && (
        <div
          onClick={() => setIsCartOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 transition-opacity duration-300"
        />
      )}

      {/* Panel del Carrito de Compras (Slide-over desde la Derecha) */}
      <aside
        className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header del Carrito */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
              Mi Carrito
              <span className="text-xs font-mono font-normal text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800/50">
                {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón para refrescar/revalidar stock */}
            <button
              onClick={() => validarStock()}
              disabled={isValidating || cart.length === 0}
              className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              title="Revalidar disponibilidad de stock"
              aria-label="Revalidar stock"
            >
              <svg
                className={`w-4 h-4 ${isValidating ? 'animate-spin text-cyan-500' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={() => setIsCartOpen(false)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Cerrar carrito"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Indicador de Validación de Inventario en Progreso */}
        {isValidating && (
          <div className="bg-cyan-50 dark:bg-cyan-950/60 border-b border-cyan-200 dark:border-cyan-800/50 px-4 py-2 flex items-center gap-2 text-xs text-cyan-700 dark:text-cyan-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Verificando stock en tiempo real...</span>
          </div>
        )}

        {/* Alerta Visual de Problemas de Stock */}
        {hasIssues && !isValidating && (
          <div className="bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800/80 p-4 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200">
                  ¡Atención con el inventario!
                </h4>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                  Algunos productos de tu carrito ya no están disponibles o superan el stock actual:
                </p>
                <ul className="mt-1 space-y-1 text-[11px] text-rose-700 dark:text-rose-200/90 list-disc list-inside">
                  {issuesList.map((issue) => (
                    <li key={issue.productId} className="truncate">
                      <span className="font-semibold">{issue.name}:</span> {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={handleAutoFixStock}
              className="w-full py-1.5 px-3 rounded-lg bg-rose-600 dark:bg-rose-900/80 hover:bg-rose-700 dark:hover:bg-rose-800 text-white text-xs font-bold uppercase tracking-wider transition-all border border-rose-500 dark:border-rose-700/60 shadow flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Ajustar Carrito Automáticamente</span>
            </button>
          </div>
        )}

        {/* Lista de productos en el Carrito */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-3xl shadow-inner">
                🛒
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Tu carrito está vacío</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Agrega prendas o artículos desde el catálogo o la vista de detalles para verlos aquí.
                </p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-cyan-600 dark:text-cyan-400 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors"
              >
                Explorar Catálogo
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-900">
                <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                  Productos seleccionados
                </span>
                <button
                  onClick={clearCart}
                  className="text-[11px] text-red-500 dark:text-red-400 hover:underline"
                >
                  Vaciar carrito
                </button>
              </div>

              {cart.map((item, idx) => {
                const effectivePrice = item?.isOnSale && item?.salePrice != null ? Number(item.salePrice) : Number(item?.price ?? 0);
                const itemPrice = effectivePrice.toLocaleString('es-CL');
                const issue = item?.id ? stockIssues[item.id] : undefined;

                return (
                  <div
                    key={`${item?.id}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
                      issue
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                        : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <CartItemImage imagePath={item?.imageUrls?.[0] || item?.imageUrl} alt={item?.name || 'Producto'} />
                      {issue && (
                        <span className="absolute -top-1.5 -left-1.5 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                          ⚠️
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item?.name || 'Producto sin nombre'}</p>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item?.category || 'Sin categoría'}{item?.gender ? ` • ${item.gender}` : ''}
                      </p>

                      {issue ? (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800/60 inline-block">
                            {issue.type === 'OUT_OF_STOCK'
                              ? 'Agotado'
                              : issue.type === 'UNAVAILABLE'
                              ? 'No disponible'
                              : issue.type === 'INSUFFICIENT_STOCK'
                              ? `Quedan ${issue.availableStock} disp.`
                              : 'No encontrado'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <p className="text-sm font-extrabold text-cyan-600 dark:text-cyan-400">${itemPrice}</p>
                          {item?.isOnSale && item?.salePrice != null && (
                            <span className="text-[10px] line-through text-slate-400 font-mono">
                              ${Number(item?.price ?? 0).toLocaleString('es-CL')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => removeFromCart(idx)}
                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
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
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-4 flex-shrink-0">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Subtotal ({cart.length} {cart.length === 1 ? 'artículo' : 'artículos'})</span>
                <span>${formattedCartTotal}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Envío</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Por calcular</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white">
                <span>Total a Pagar</span>
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 dark:from-cyan-400 dark:to-emerald-400">
                  ${formattedCartTotal}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleProceedToCheckout}
              disabled={hasIssues || isValidating}
              className={`w-full py-3.5 px-4 rounded-xl text-white text-sm font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                hasIssues || isValidating
                  ? 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700/50'
                  : 'bg-gradient-to-r from-cyan-600 via-fuchsia-600 to-purple-600 hover:from-cyan-500 hover:via-fuchsia-500 hover:to-purple-500 shadow-[0_0_20px_rgba(217,70,239,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-[0.98]'
              }`}
            >
              {isValidating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Validando inventario...</span>
                </>
              ) : hasIssues ? (
                <>
                  <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Ajusta el inventario para pagar</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Proceder al Pago</span>
                </>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
