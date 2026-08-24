'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'userPool' });

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Schema['Order']['type'][]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Schema['Order']['type'] | null>(null);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);
  const [logisticsFilter, setLogisticsFilter] = useState<'ALL' | 'PREPARANDO' | 'LISTO_PARA_RETIRO' | 'EN_TRANSITO' | 'ENTREGADO' | 'ANULADO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDIENTE' | 'PAGADO' | 'CANCELADO'>('ALL');
  const [busqueda, setBusqueda] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Helper para verificar si un pedido está anulado/cancelado
  const isOrderAnulado = (order: Schema['Order']['type']) => {
    if (!order) return false;
    return order.status === 'CANCELADO' || order.logisticsStatus === 'ANULADO' || order.logisticsStatus === 'CANCELADO';
  };

  // Reordenar pedidos: 'PREPARANDO' activo primero, luego por fecha desc, anulados al final
  const sortOrders = useCallback((items: Schema['Order']['type'][]) => {
    return [...(items || [])].filter(Boolean).sort((a, b) => {
      const aIsAnulado = isOrderAnulado(a) ? 1 : 0;
      const bIsAnulado = isOrderAnulado(b) ? 1 : 0;
      if (aIsAnulado !== bIsAnulado) return aIsAnulado - bIsAnulado;

      const aIsPrep = (a.logisticsStatus || 'PREPARANDO') === 'PREPARANDO' ? 1 : 0;
      const bIsPrep = (b.logisticsStatus || 'PREPARANDO') === 'PREPARANDO' ? 1 : 0;
      if (bIsPrep !== aIsPrep) {
        return bIsPrep - aIsPrep;
      }
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, []);

  // Cargar Pedidos en tiempo real vía observeQuery
  useEffect(() => {
    const sub = client.models.Order.observeQuery().subscribe({
      next: ({ items }) => {
        const sorted = sortOrders(items as Schema['Order']['type'][]);
        setOrders(sorted);
        setLoadingOrders(false);

        // Actualizar reactivamente el modal si está abierto
        setSelectedOrderDetails((curr) => {
          if (!curr) return null;
          const updated = items.find((it) => it.id === curr.id);
          return updated ? (updated as Schema['Order']['type']) : curr;
        });
      },
      error: (err) => {
        console.error('Error al observar pedidos:', err);
        setLoadingOrders(false);
      },
    });

    return () => sub.unsubscribe();
  }, [sortOrders]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  async function handleCambiarEstadoLogistico(orderId: string, nuevoEstado: string) {
    if (!orderId) return;

    const current = orders.find((o) => o.id === orderId);
    if (current && isOrderAnulado(current)) {
      alert('No se puede cambiar el estado logístico de un pedido anulado.');
      return;
    }

    setActionLoadingOrderId(orderId);

    try {
      await client.models.Order.update({
        id: orderId,
        logisticsStatus: nuevoEstado,
      });

      setOrders((prev) =>
        sortOrders(
          prev.map((o) => (o.id === orderId ? { ...o, logisticsStatus: nuevoEstado } : o))
        )
      );

      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails((prev) => (prev ? { ...prev, logisticsStatus: nuevoEstado } : null));
      }
    } catch (err) {
      console.error('Error al actualizar estado logístico:', err);
      alert('Hubo un error al actualizar el estado logístico.');
    } finally {
      setActionLoadingOrderId(null);
    }
  }

  async function handleMarcarComoPagado(orderId: string) {
    if (!orderId) return;
    setActionLoadingOrderId(orderId);

    try {
      await client.models.Order.update({
        id: orderId,
        status: 'PAGADO',
      });

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'PAGADO' } : o))
      );

      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails((prev) => (prev ? { ...prev, status: 'PAGADO' } : null));
      }
    } catch (err) {
      console.error('Error al marcar pedido como pagado:', err);
      alert('Hubo un error al actualizar el estado del pedido.');
    } finally {
      setActionLoadingOrderId(null);
    }
  }

  async function handleCancelarYDevolverStock(order: Schema['Order']['type']) {
    if (!order || !order.id) return;

    const displayId = order.shortId || `#${order.id.slice(0, 8)}`;
    const formattedPrice = Number(order.totalAmount).toLocaleString('es-CL');
    const confirmMessage = `¿Estás seguro de anular este pedido y restaurar el inventario?\n\n• Código: ${displayId}\n• Cliente: ${order.customerName}\n• Total: $${formattedPrice}\n\nSe actualizará el pago a CANCELADO y la logística a ANULADO, reingresando los productos al catálogo.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActionLoadingOrderId(order.id);

    try {
      // 1. Sincronización Simultánea: status 'CANCELADO' y logisticsStatus 'ANULADO'
      await client.models.Order.update({
        id: order.id,
        status: 'CANCELADO',
        logisticsStatus: 'ANULADO',
      });

      // 2. Restaurar inventario de los productos
      let itemsList: Array<{ id: string; name?: string; price?: number }> = [];
      if (order.cartItems) {
        if (typeof order.cartItems === 'string') {
          try {
            itemsList = JSON.parse(order.cartItems);
          } catch (pErr) {
            console.error('Error al parsear cartItems:', pErr);
          }
        } else if (Array.isArray(order.cartItems)) {
          itemsList = order.cartItems as any[];
        }
      }

      const returnMap: Record<string, number> = {};
      for (const item of itemsList) {
        if (item?.id && item.id !== 'item-demo-y2k') {
          returnMap[item.id] = (returnMap[item.id] || 0) + 1;
        }
      }

      for (const [productId, qtyToReturn] of Object.entries(returnMap)) {
        try {
          const { data: prod } = await client.models.Product.get({ id: productId });
          if (prod) {
            const currentStock = prod.stock ?? 0;
            const newStock = currentStock + qtyToReturn;

            await client.models.Product.update({
              id: productId,
              stock: newStock,
              isAvailable: true,
            });
          }
        } catch (prodErr) {
          console.error(`Error al restaurar stock para producto ${productId}:`, prodErr);
        }
      }

      // 3. Actualización reactiva inmediata
      setOrders((prev) =>
        sortOrders(
          prev.map((o) =>
            o.id === order.id ? { ...o, status: 'CANCELADO', logisticsStatus: 'ANULADO' } : o
          )
        )
      );

      if (selectedOrderDetails?.id === order.id) {
        setSelectedOrderDetails((prev) =>
          prev ? { ...prev, status: 'CANCELADO', logisticsStatus: 'ANULADO' } : null
        );
      }
    } catch (err) {
      console.error('Error al anular pedido y devolver stock:', err);
      alert('Hubo un error al anular el pedido.');
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

  // Contadores para filtros
  const preparandoCount = orders.filter((o) => !isOrderAnulado(o) && (o?.logisticsStatus || 'PREPARANDO') === 'PREPARANDO').length;
  const listosCount = orders.filter((o) => !isOrderAnulado(o) && o?.logisticsStatus === 'LISTO_PARA_RETIRO').length;
  const transitoCount = orders.filter((o) => !isOrderAnulado(o) && o?.logisticsStatus === 'EN_TRANSITO').length;
  const entregadoCount = orders.filter((o) => !isOrderAnulado(o) && o?.logisticsStatus === 'ENTREGADO').length;
  const anuladosCount = orders.filter((o) => isOrderAnulado(o)).length;

  const filteredOrders = orders.filter((o) => {
    if (!o) return false;
    const isAnulado = isOrderAnulado(o);

    let matchLogistics = true;
    if (logisticsFilter === 'ANULADO') {
      matchLogistics = isAnulado;
    } else if (logisticsFilter !== 'ALL') {
      matchLogistics = !isAnulado && (o.logisticsStatus || 'PREPARANDO') === logisticsFilter;
    }

    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const q = busqueda.toLowerCase().trim();
    const matchSearch =
      !q ||
      (o.shortId || '').toLowerCase().includes(q) ||
      (o.id || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.customerEmail || '').toLowerCase().includes(q) ||
      (o.customerPhone || '').toLowerCase().includes(q) ||
      (o.pickupCode || '').toLowerCase().includes(q);
    return matchLogistics && matchStatus && matchSearch;
  });

  return (
    <div className="w-full p-4 sm:p-8 font-sans text-slate-900 dark:text-slate-100">
      {/* Header Cyber-Y2K */}
      <div className="mb-8 pb-4 border-b border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <span>Gestión de Pedidos</span>
          </h1>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
            Control de órdenes en tiempo real, validación de retiros y despacho logístico.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-3 py-1.5 rounded-xl border border-cyan-200 dark:border-cyan-800/60 shadow-sm dark:shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            TOTAL: {orders.length} ÓRDENES
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
          {/* Contenedor de Botones de Filtro (con scroll x) */}
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 scrollbar-hide">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 shrink-0">Logística:</span>

            <button
              onClick={() => setLogisticsFilter('ALL')}
              className={
                logisticsFilter === 'ALL'
                  ? '!px-3 !py-1.5 rounded-full !text-[11px] font-bold whitespace-nowrap !bg-slate-200 dark:!bg-slate-800 !text-slate-800 dark:!text-slate-100 shrink-0 cursor-pointer'
                  : '!px-3 !py-1.5 rounded-full !text-[11px] font-medium whitespace-nowrap bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer'
              }
            >
              Todos ({orders.length})
            </button>

            <button
              onClick={() => setLogisticsFilter('PREPARANDO')}
              className={
                logisticsFilter === 'PREPARANDO'
                  ? '!px-3 !py-1.5 rounded-full !text-[11px] font-bold whitespace-nowrap !bg-amber-200 dark:!bg-amber-950 !text-amber-900 dark:!text-amber-300 shrink-0 cursor-pointer flex items-center gap-1.5'
                  : '!px-3 !py-1.5 rounded-full !text-[11px] font-medium whitespace-nowrap bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer flex items-center gap-1.5'
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Preparando ({preparandoCount})
            </button>

            <button
              onClick={() => setLogisticsFilter('LISTO_PARA_RETIRO')}
              className={
                logisticsFilter === 'LISTO_PARA_RETIRO'
                  ? '!px-3 !py-1.5 rounded-full !text-[11px] font-bold whitespace-nowrap !bg-sky-200 dark:!bg-sky-950 !text-sky-900 dark:!text-sky-300 shrink-0 cursor-pointer flex items-center gap-1.5'
                  : '!px-3 !py-1.5 rounded-full !text-[11px] font-medium whitespace-nowrap bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer flex items-center gap-1.5'
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              Listo Retiro ({listosCount})
            </button>

            <button
              onClick={() => setLogisticsFilter('EN_TRANSITO')}
              className={
                logisticsFilter === 'EN_TRANSITO'
                  ? '!px-3 !py-1.5 rounded-full !text-[11px] font-bold whitespace-nowrap !bg-fuchsia-200 dark:!bg-fuchsia-950 !text-fuchsia-900 dark:!text-fuchsia-300 shrink-0 cursor-pointer flex items-center gap-1.5'
                  : '!px-3 !py-1.5 rounded-full !text-[11px] font-medium whitespace-nowrap bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer flex items-center gap-1.5'
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span>
              En Tránsito ({transitoCount})
            </button>

            <button
              onClick={() => setLogisticsFilter('ENTREGADO')}
              className={
                logisticsFilter === 'ENTREGADO'
                  ? '!px-3 !py-1.5 rounded-full !text-[11px] font-bold whitespace-nowrap !bg-emerald-200 dark:!bg-emerald-950 !text-emerald-900 dark:!text-emerald-300 shrink-0 cursor-pointer flex items-center gap-1.5'
                  : '!px-3 !py-1.5 rounded-full !text-[11px] font-medium whitespace-nowrap bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer flex items-center gap-1.5'
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Entregado ({entregadoCount})
            </button>

            <button
              onClick={() => setLogisticsFilter('ANULADO')}
              className={
                logisticsFilter === 'ANULADO'
                  ? '!px-3 !py-1.5 rounded-full !text-[11px] font-bold whitespace-nowrap !bg-red-200 dark:!bg-red-950 !text-red-900 dark:!text-red-300 shrink-0 cursor-pointer flex items-center gap-1.5'
                  : '!px-3 !py-1.5 rounded-full !text-[11px] font-medium whitespace-nowrap bg-transparent border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer flex items-center gap-1.5'
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Anulados ({anuladosCount})
            </button>
          </div>

          {/* Contenedor del Buscador */}
          <div className="w-full lg:w-72 shrink-0">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar Y2K-..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none transition font-mono"
            />
          </div>
        </div>

        {/* TABLA DE PEDIDOS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          {loadingOrders ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-mono animate-pulse">Sincronizando base de pedidos en vivo...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-xs space-y-2">
              <div className="text-3xl">📦</div>
              <p className="font-bold text-sm text-slate-800 dark:text-white">No se encontraron pedidos.</p>
              <p className="text-slate-500 dark:text-slate-400 font-mono">Ajusta los filtros o limpia la barra de búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                    <th className="p-4">Código Orden</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Método Entrega</th>
                    <th className="p-4">PIN Secreto</th>
                    <th className="p-4">Estado Logístico</th>
                    <th className="p-4">Total / Pago</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono text-slate-800 dark:text-slate-200">
                  {filteredOrders.map((order) => {
                    const isPickup = order.deliveryMethod === 'RETIRO_PRESENCIAL';
                    const isAnulado = isOrderAnulado(order);
                    const displayCode = order.shortId || `#${order.id ? order.id.slice(0, 8) : '---'}`;
                    const logistics = order.logisticsStatus || 'PREPARANDO';

                    return (
                      <tr
                        key={order.id}
                        className={`transition-colors group ${
                          isAnulado
                            ? 'bg-red-50/60 dark:bg-red-950/15 opacity-75 hover:bg-red-100/80 dark:hover:bg-red-950/25'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* 1. Código Corto / ID Orden */}
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(order.shortId || order.id, order.id)}
                            className={`text-left font-extrabold flex items-center gap-1.5 cursor-pointer text-sm ${
                              isAnulado ? 'text-slate-400 line-through' : 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300'
                            }`}
                            title={`Click para copiar. UUID: ${order.id}`}
                          >
                            <span>{displayCode}</span>
                            <span className="text-[10px] text-slate-400">
                              {copiedId === order.id ? '✓' : '📋'}
                            </span>
                          </button>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString('es-CL', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </td>

                        {/* 2. Cliente (Nombre y Email) */}
                        <td className="p-4">
                          <div className="font-bold text-slate-800 dark:text-white font-sans text-xs">
                            {order.customerName || 'Cliente Anónimo'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {order.customerEmail || 'Sin email'}
                          </div>
                          {order.customerPhone && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              📞 {order.customerPhone}
                            </div>
                          )}
                        </td>

                        {/* 3. Método de Entrega (Retiro / Envío) */}
                        <td className="p-4">
                          {isPickup ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[10px] font-bold shadow-sm">
                              <span>🏢</span>
                              <span>Retiro en Tienda</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-950/80 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800 text-[10px] font-bold shadow-sm">
                              <span>🚚</span>
                              <span>Envío Región</span>
                            </span>
                          )}
                        </td>

                        {/* 4. PIN Secreto (Solo mostrar si es Retiro) */}
                        <td className="p-4">
                          {isPickup && order.pickupCode ? (
                            <span
                              className={`inline-block font-mono font-black px-3 py-1 rounded-lg border tracking-widest text-xs ${
                                isAnulado
                                  ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 line-through'
                                  : 'bg-cyan-50 dark:bg-cyan-950/90 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/60 shadow-sm'
                              }`}
                            >
                              {order.pickupCode}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* 5. Estado Logístico (Badges con caso especial ANULADO) */}
                        <td className="p-4">
                          {isAnulado ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-800/80 font-bold text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              <span>ANULADO</span>
                            </span>
                          ) : logistics === 'PREPARANDO' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500 font-bold text-[10px] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>PREPARANDO</span>
                            </span>
                          ) : logistics === 'LISTO_PARA_RETIRO' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500 font-bold text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                              <span>LISTO PARA RETIRO</span>
                            </span>
                          ) : logistics === 'EN_TRANSITO' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-fuchsia-50 dark:bg-fuchsia-950 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-500 font-bold text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span>
                              <span>EN TRÁNSITO</span>
                            </span>
                          ) : logistics === 'ENTREGADO' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500 font-bold text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>ENTREGADO</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-800/80 font-bold text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              <span>ANULADO</span>
                            </span>
                          )}
                        </td>

                        {/* Total y Estado de Pago */}
                        <td className="p-4">
                          <div className="font-extrabold text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-cyan-400 dark:to-emerald-400 text-xs">
                            ${Number(order.totalAmount ?? 0).toLocaleString('es-CL')} CLP
                          </div>
                          <div className="mt-0.5">
                            {order.status === 'PAGADO' && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">✓ Pagado</span>
                            )}
                            {order.status === 'PENDIENTE' && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">⏳ Pendiente</span>
                            )}
                            {order.status === 'CANCELADO' && (
                              <span className="text-[10px] text-red-600 dark:text-red-500 font-bold">✕ Cancelado</span>
                            )}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="p-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(order)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-cyan-300 hover:text-slate-900 dark:hover:text-white font-bold text-[11px] transition cursor-pointer border border-slate-200 dark:border-slate-700"
                          >
                            Detalles
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL DE DETALLE Y GESTIÓN DE ESTADOS */}
        {selectedOrderDetails && (() => {
          const isModalAnulado = isOrderAnulado(selectedOrderDetails);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 border-2 border-cyan-500/50 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl dark:shadow-[0_0_50px_rgba(6,182,212,0.25)] space-y-6 relative max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-100">
                {/* Header Modal */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950 px-3 py-1 rounded-xl border border-cyan-200 dark:border-cyan-800">
                        {selectedOrderDetails.shortId || `#${selectedOrderDetails.id?.slice(0, 8)}`}
                      </span>
                      {isModalAnulado ? (
                        <span className="text-[10px] bg-red-50 dark:bg-red-950/80 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2.5 py-0.5 rounded-full font-bold">
                          ORDEN ANULADA
                        </span>
                      ) : selectedOrderDetails.status === 'PAGADO' ? (
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
                          PAGO CONFIRMADO
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                          PAGO PENDIENTE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5 break-all">
                      UUID: {selectedOrderDetails.id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderDetails(null)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    aria-label="Cerrar modal"
                  >
                    ✕
                  </button>
                </div>

                {/* ALERTA SI LA ORDEN ESTÁ ANULADA */}
                {isModalAnulado && (
                  <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/90 text-red-700 dark:text-red-300 text-xs font-mono space-y-1">
                    <div className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400">
                      <span>🚫</span>
                      <span>ORDEN ANULADA</span>
                    </div>
                    <p className="text-red-600/90 dark:text-red-300/90">
                      El pago fue cancelado y el stock devuelto. Las acciones de cambio de estado logístico y despacho han sido bloqueadas por seguridad.
                    </p>
                  </div>
                )}

                {/* DATOS DEL CLIENTE Y DESPACHO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold block">
                      Datos del Cliente
                    </span>
                    <p className="text-slate-900 dark:text-white font-bold text-sm">{selectedOrderDetails.customerName}</p>
                    <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">📧 {selectedOrderDetails.customerEmail}</p>
                    <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">📞 {selectedOrderDetails.customerPhone}</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 font-bold block">
                      Logística & Entrega
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-white font-bold">
                        {selectedOrderDetails.deliveryMethod === 'RETIRO_PRESENCIAL'
                          ? '🏢 Retiro Presencial en Valparaíso'
                          : '🚚 Envío a Regiones'}
                      </span>
                    </div>
                    {selectedOrderDetails.pickupCode && (
                      <div className="pt-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">PIN Secreto de Retiro:</span>
                        <span className={`font-mono font-black text-lg tracking-widest ${isModalAnulado ? 'text-slate-400 line-through' : 'text-cyan-600 dark:text-cyan-300'}`}>
                          {selectedOrderDetails.pickupCode}
                        </span>
                      </div>
                    )}
                    {selectedOrderDetails.shippingAddress && (
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] font-mono">
                        📍 {selectedOrderDetails.shippingAddress}
                      </p>
                    )}
                  </div>
                </div>

                {/* CONTROL DE ESTADO LOGÍSTICO (BLOQUEADO SI ESTÁ ANULADO) */}
                <div className="bg-slate-50 dark:bg-slate-950/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold block">
                      Cambiar Estado Logístico
                    </span>
                    {isModalAnulado && (
                      <span className="text-[10px] font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/80 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                        🔒 ACCIONES DESACTIVADAS
                      </span>
                    )}
                  </div>

                  {isModalAnulado ? (
                    <div className="p-3.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800/80 text-center">
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 italic">
                        No es posible reactivar la logística de un pedido anulado.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['PREPARANDO', 'LISTO_PARA_RETIRO', 'EN_TRANSITO', 'ENTREGADO'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={actionLoadingOrderId === selectedOrderDetails.id}
                          onClick={() => handleCambiarEstadoLogistico(selectedOrderDetails.id, st)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                            (selectedOrderDetails.logisticsStatus || 'PREPARANDO') === st
                              ? st === 'PREPARANDO'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-500 shadow-sm'
                                : st === 'LISTO_PARA_RETIRO'
                                ? 'bg-sky-100 dark:bg-sky-950 text-sky-900 dark:text-sky-300 border-sky-400 dark:border-sky-500 shadow-sm'
                                : st === 'EN_TRANSITO'
                                ? 'bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-900 dark:text-fuchsia-300 border-fuchsia-400 dark:border-fuchsia-500 shadow-sm'
                                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500 shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* PRODUCTOS COMPRADOS */}
                <div className="space-y-2 text-xs">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">
                    Productos en la Orden ({parseCartItems(selectedOrderDetails.cartItems).length})
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
                    {parseCartItems(selectedOrderDetails.cartItems).map((item: any, idx: number) => (
                      <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                        <div>
                          <p className={`font-bold text-xs ${isModalAnulado ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                            {item.name || 'Producto'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {item.category || ''} {item.size ? `• Talla: ${item.size}` : ''}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${Number(item.price || 0).toLocaleString('es-CL')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FOOTER MODAL: TOTAL Y ACCIONES DE PAGO */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">Total de la Orden:</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-cyan-600 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-cyan-400 dark:to-emerald-400">
                      ${Number(selectedOrderDetails.totalAmount || 0).toLocaleString('es-CL')} CLP
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    {!isModalAnulado && selectedOrderDetails.status === 'PENDIENTE' && (
                      <button
                        type="button"
                        onClick={() => handleMarcarComoPagado(selectedOrderDetails.id)}
                        disabled={actionLoadingOrderId === selectedOrderDetails.id}
                        className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-md disabled:opacity-50"
                      >
                        {actionLoadingOrderId === selectedOrderDetails.id ? 'Aprobando...' : '✓ Confirmar Pago'}
                      </button>
                    )}

                    {!isModalAnulado && (
                      <button
                        type="button"
                        onClick={() => handleCancelarYDevolverStock(selectedOrderDetails)}
                        disabled={actionLoadingOrderId === selectedOrderDetails.id}
                        className="px-4 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-900 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-white border border-red-300 dark:border-red-800 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        Anular Pedido y Restituir Stock
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
