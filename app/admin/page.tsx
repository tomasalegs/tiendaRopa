'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'userPool' });

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [products, setProducts] = useState<Schema['Product']['type'][]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [orders, setOrders] = useState<Schema['Order']['type'][]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);

  // Guardián de seguridad: Solo 'Super_Admin' y 'Admin_Tienda' pueden acceder al Dashboard
  useEffect(() => {
    let isMounted = true;
    async function verifyDashboardClearance() {
      try {
        const session = await fetchAuthSession();
        const groups =
          (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) ||
          (session.tokens?.idToken?.payload?.['cognito:groups'] as string[]) ||
          [];

        if (!groups.includes('Super_Admin') && !groups.includes('Admin_Tienda')) {
          router.replace('/admin/escaner');
          return;
        }

        if (isMounted) {
          setIsAuthorized(true);
        }
      } catch (err) {
        console.error('Error verificando privilegios en Dashboard:', err);
        router.replace('/admin/escaner');
      }
    }

    verifyDashboardClearance();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Cargar Inventario
  async function fetchProducts() {
    try {
      const { data: items } = await client.models.Product.list();
      if (items) {
        setProducts(items.filter(Boolean) as Schema['Product']['type'][]);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  // Cargar Pedidos en tiempo real
  useEffect(() => {
    const sub = client.models.Order.observeQuery().subscribe({
      next: ({ items }) => {
        const sorted = [...(items || [])].filter(Boolean).sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setOrders(sorted as Schema['Order']['type'][]);
        setLoadingOrders(false);
      },
      error: (err) => {
        console.error('Error al observar pedidos:', err);
        setLoadingOrders(false);
      },
    });

    return () => sub.unsubscribe();
  }, []);

  // Métricas analíticas
  const metrics = useMemo(() => {
    const totalSales = orders
      .filter((o) => o?.status === 'PAGADO')
      .reduce((acc, curr) => acc + (Number(curr?.totalAmount) || 0), 0);

    const pendingOrdersList = orders.filter((o) => o?.status === 'PENDIENTE');
    const lowStockList = products.filter((p) => (p?.stock ?? 0) <= 2);

    const inventoryValue = products.reduce((acc, curr) => {
      const pPrice = Number(curr?.price) || 0;
      const pStock = Number(curr?.stock) || 0;
      return acc + pPrice * pStock;
    }, 0);

    const totalUnits = products.reduce((acc, curr) => acc + (Number(curr?.stock) || 0), 0);

    return {
      totalSales,
      pendingOrders: pendingOrdersList,
      pendingCount: pendingOrdersList.length,
      lowStockProducts: lowStockList,
      lowStockCount: lowStockList.length,
      inventoryValue,
      totalUnits,
    };
  }, [orders, products]);

  async function handleMarcarComoPagado(orderId: string) {
    if (!orderId) return;
    setActionLoadingOrderId(orderId);

    try {
      await client.models.Order.update({
        id: orderId,
        status: 'PAGADO',
      });
    } catch (err) {
      console.error('Error al marcar pedido como pagado:', err);
      alert('Hubo un error al actualizar el estado del pedido.');
    } finally {
      setActionLoadingOrderId(null);
    }
  }

  function parseCartItems(cartItemsJson: any): any[] {
    if (!cartItemsJson) return [];
    if (Array.isArray(cartItemsJson)) return cartItemsJson;
    if (typeof cartItemsJson === 'string') {
      try {
        const parsed = JSON.parse(cartItemsJson);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  if (!isAuthorized) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <p className="font-mono text-xs text-cyan-600 dark:text-cyan-400 tracking-wider animate-pulse">
          VERIFICANDO PRIVILEGIOS DE ACCESO...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-8 font-sans text-slate-900 dark:text-slate-100">
      <div className="mb-8 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
          <span>Dashboard Analítico</span>
        </h1>
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
          Métricas globales del sistema, alertas en tiempo real y accesos rápidos.
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Tarjetas de Métricas Clave (Grid de 4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Ventas Totales */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 rounded-2xl p-5 shadow-sm dark:shadow-[0_0_25px_rgba(16,185,129,0.1)] relative overflow-hidden group hover:border-emerald-500/60 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold">Ventas Totales</span>
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                ${metrics.totalSales.toLocaleString('es-CL')}
              </h3>
              <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400/90 flex items-center gap-1">
                <span>✓</span> Solo pedidos confirmados y pagados
              </p>
            </div>
          </div>

          {/* Card 2: Pedidos Pendientes */}
          <Link
            href="/admin/pedidos"
            className="bg-gradient-to-br from-amber-50 via-white to-amber-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-amber-950/30 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-5 shadow-sm dark:shadow-[0_0_25px_rgba(245,158,11,0.1)] relative overflow-hidden group hover:border-amber-500/60 transition-all cursor-pointer block"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">Por Confirmar</span>
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                  {metrics.pendingCount}
                </h3>
                <span className="text-xs font-mono text-amber-700 dark:text-amber-400/90">pedidos</span>
              </div>
              <p className="text-[11px] font-mono text-amber-700 dark:text-amber-400/90 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block"></span> Requieren revisión de comprobante →
              </p>
            </div>
          </Link>

          {/* Card 3: Stock Crítico */}
          <Link
            href="/admin/inventario"
            className="bg-gradient-to-br from-rose-50 via-white to-rose-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-rose-950/30 border border-rose-300 dark:border-rose-500/30 rounded-2xl p-5 shadow-sm dark:shadow-[0_0_25px_rgba(244,63,94,0.1)] relative overflow-hidden group hover:border-rose-500/60 transition-all cursor-pointer block"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-rose-700 dark:text-rose-400 font-bold">Stock Crítico</span>
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                  {metrics.lowStockCount}
                </h3>
                <span className="text-xs font-mono text-rose-700 dark:text-rose-400/90">productos</span>
              </div>
              <p className="text-[11px] font-mono text-rose-700 dark:text-rose-400/90">
                Con ≤ 2 unidades disponibles →
              </p>
            </div>
          </Link>

          {/* Card 4: Valorización de Inventario */}
          <div className="bg-gradient-to-br from-cyan-50 via-white to-cyan-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-cyan-950/30 border border-cyan-300 dark:border-cyan-500/30 rounded-2xl p-5 shadow-sm dark:shadow-[0_0_25px_rgba(6,182,212,0.1)] relative overflow-hidden group hover:border-cyan-500/60 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-700 dark:text-cyan-400 font-bold">Valor Inventario</span>
              <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                ${metrics.inventoryValue.toLocaleString('es-CL')}
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {metrics.totalUnits} prendas físicas en total
              </p>
            </div>
          </div>
        </div>

        {/* Sección de Accesos Rápidos del Centro de Control */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/inventario"
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 transition-all group flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2.5 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800/50">📦</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">Gestión de Inventario</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Agregar o editar prendas</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">→</span>
          </Link>

          <Link
            href="/admin/pedidos"
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-fuchsia-500/50 transition-all group flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2.5 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-950/60 border border-fuchsia-300 dark:border-fuchsia-800/50">📋</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors">Control de Pedidos</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Validar transferencias</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors">→</span>
          </Link>

          <Link
            href="/admin/usuarios"
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 transition-all group flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800/50">👥</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Usuarios & Roles</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Privilegios y grupos RBAC</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">→</span>
          </Link>

          <Link
            href="/admin/escaner"
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all group flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/50">📟</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Escáner Logístico</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Entrega con PIN / ID</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">→</span>
          </Link>
        </div>

        {/* Dos Paneles: Pedidos Pendientes y Stock Crítico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel A: Pedidos Pendientes */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Pedidos Pendientes ({metrics.pendingCount})
                </h3>
              </div>
              {metrics.pendingCount > 0 && (
                <Link
                  href="/admin/pedidos"
                  className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold hover:underline cursor-pointer"
                >
                  Gestionar todos →
                </Link>
              )}
            </div>

            {loadingOrders ? (
              <p className="text-slate-500 text-xs py-8 text-center animate-pulse">Cargando pedidos...</p>
            ) : metrics.pendingCount === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl mx-auto text-emerald-600 dark:text-emerald-400">
                  ✓
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-300">¡No hay pedidos pendientes por revisar!</p>
                <p className="text-[11px] text-slate-500">Los nuevos pedidos por transferencia bancaria aparecerán aquí.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {metrics.pendingOrders.slice(0, 5).map((order) => {
                  const items = parseCartItems(order.cartItems);
                  const formattedDate = order.createdAt
                    ? new Date(order.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                    : 'Hoy';

                  return (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-amber-300 dark:border-amber-500/20 hover:border-amber-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">{order.customerName}</span>
                          <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded">
                            {formattedDate}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {items.length} {items.length === 1 ? 'producto' : 'productos'} • Tel: {order.customerPhone}
                        </p>
                        <p className="font-mono text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-400 dark:to-emerald-400">
                          ${Number(order.totalAmount ?? 0).toLocaleString('es-CL')} CLP
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href="/admin/pedidos"
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-transparent"
                        >
                          Ver
                        </Link>
                        <button
                          onClick={() => handleMarcarComoPagado(order.id)}
                          disabled={actionLoadingOrderId === order.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)] disabled:opacity-50"
                        >
                          {actionLoadingOrderId === order.id ? '...' : 'Aprobar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel B: Alerta de Productos con Stock Crítico (≤ 2) */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Stock Crítico / Por Agotarse ({metrics.lowStockCount})
                </h3>
              </div>
              <Link
                href="/admin/inventario"
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold hover:underline cursor-pointer"
              >
                Ver inventario →
              </Link>
            </div>

            {loadingProducts ? (
              <p className="text-slate-500 text-xs py-8 text-center animate-pulse">Cargando inventario...</p>
            ) : metrics.lowStockCount === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl mx-auto text-cyan-600 dark:text-cyan-400">
                  📦
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-300">¡Inventario en estado óptimo!</p>
                <p className="text-[11px] text-slate-500">Todos los productos tienen 3 o más unidades disponibles.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {metrics.lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-rose-300 dark:border-rose-500/20 hover:border-rose-500/50 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{p.name || 'Sin nombre'}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {p.category} {p.size ? `• Talla: ${p.size}` : ''}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">
                        Precio: ${Number(p.price ?? 0).toLocaleString('es-CL')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs ${
                          (p.stock ?? 0) <= 0
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 animate-pulse'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        }`}
                      >
                        {p.stock ?? 0} disp.
                      </span>

                      <Link
                        href="/admin/inventario"
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition border border-slate-200 dark:border-transparent"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}