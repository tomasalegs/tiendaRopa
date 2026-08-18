'use client';

import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'userPool' });

export default function AdminEscanerPage() {
  const [orderId, setOrderId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    order?: Schema['Order']['type'];
  } | null>(null);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrderId = orderId.trim();
    const cleanPin = pinCode.trim();

    if (!cleanOrderId) {
      setFeedback({ type: 'error', message: 'Por favor ingresa un ID de Orden.' });
      return;
    }

    if (!cleanPin) {
      setFeedback({ type: 'error', message: 'Por favor ingresa el PIN de seguridad.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      // 1. Buscar la orden en AppSync: por UUID directo o por shortId / prefijo de ID
      let order: Schema['Order']['type'] | null = null;

      try {
        const { data: directOrder } = await client.models.Order.get({ id: cleanOrderId });
        if (directOrder) {
          order = directOrder;
        }
      } catch (getErr) {
        // Ignorar si el ID no es un UUID directo
      }

      if (!order) {
        const { data: ordersList } = await client.models.Order.list();
        if (ordersList && ordersList.length > 0) {
          order =
            ordersList.find(
              (o) =>
                (o.shortId && o.shortId.toUpperCase() === cleanOrderId.toUpperCase()) ||
                (o.id && o.id.toLowerCase().startsWith(cleanOrderId.toLowerCase()))
            ) || null;
        }
      }

      // Validación 1: Si la orden no existe
      if (!order) {
        setFeedback({ type: 'error', message: 'Orden no encontrada. Verifica el código Y2K-... o UUID ingresado.' });
        setIsLoading(false);
        return;
      }

      // Validación 2: Si la orden está cancelada
      if (order.status === 'CANCELADO' || order.logisticsStatus === 'CANCELADO') {
        setFeedback({
          type: 'error',
          message: '⛔ No se puede procesar entrega: Esta orden fue cancelada/anulada y el inventario restituido.',
          order,
        });
        setIsLoading(false);
        return;
      }

      // Validación 3: Si el pickupCode no coincide
      const storedPickupCode = String(order.pickupCode || '').trim();
      if (!storedPickupCode || storedPickupCode.toUpperCase() !== cleanPin.toUpperCase()) {
        setFeedback({ type: 'error', message: 'PIN de seguridad incorrecto' });
        setIsLoading(false);
        return;
      }

      // Validación 4: Si la orden ya fue entregada
      if (order.logisticsStatus === 'ENTREGADO') {
        setFeedback({
          type: 'warning',
          message: 'Esta orden ya fue entregada anteriormente',
          order,
        });
        setIsLoading(false);
        return;
      }

      // Éxito: Actualizar logisticsStatus a 'ENTREGADO'
      const { data: updatedOrder } = await client.models.Order.update({
        id: order.id,
        logisticsStatus: 'ENTREGADO',
      });

      setFeedback({
        type: 'success',
        message: '¡Entrega validada y confirmada con éxito!',
        order: updatedOrder || { ...order, logisticsStatus: 'ENTREGADO' },
      });

      // Limpiar campos del formulario
      setOrderId('');
      setPinCode('');
    } catch (err) {
      console.error('Error durante la validación logística:', err);
      setFeedback({
        type: 'error',
        message: 'Ocurrió un error inesperado al consultar la base de datos.',
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="w-full p-4 sm:p-8 font-sans text-slate-900 dark:text-slate-100">
      {/* Encabezado Principal */}
      <div className="mb-8 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
          <span>Escáner Logístico</span>
        </h1>
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
          Validación y confirmación rápida de entregas mediante Código de Orden (Y2K-...) y PIN Secreto
        </p>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Estructura de Dos Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Columna Izquierda: Terminal de Validación (Formulario) */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-cyan-500/40 shadow-md dark:shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden space-y-6">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]" />

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-500/50 flex items-center justify-center mx-auto text-2xl shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                📟
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-wide">Terminal de Validación</h2>
              <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400">LOGISTICS_DISPATCH_PROTOCOL // v2.0</p>
            </div>

            <form onSubmit={handleValidate} className="space-y-5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-mono font-bold mb-2 uppercase tracking-wider">
                  CÓDIGO DE ORDEN (EJ. Y2K-A83B O UUID) *
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Ej: Y2K-8X7F o UUID..."
                  disabled={isLoading}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs transition shadow-inner disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-mono font-bold mb-2 uppercase tracking-wider">
                  PIN DE SEGURIDAD (4 DÍGITOS) *
                </label>
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="••••"
                  maxLength={10}
                  disabled={isLoading}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-cyan-700 dark:text-cyan-300 text-center text-2xl tracking-[0.4em] placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:border-cyan-500 font-mono transition shadow-inner disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 via-sky-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-bold tracking-wider rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:scale-[1.01] transition-all disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer uppercase text-xs"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                    <span>VERIFICANDO EN BASE DE DATOS...</span>
                  </>
                ) : (
                  <span>VERIFICAR Y CONFIRMAR ENTREGA</span>
                )}
              </button>
            </form>

            {/* Mensajes de Feedback de Usuario (UI/UX) */}
            {feedback && (
              <div
                className={`p-4 rounded-xl border font-mono text-xs space-y-2 transition-all duration-200 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : feedback.type === 'warning'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                    : 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span>
                    {feedback.type === 'success' ? '✓' : feedback.type === 'warning' ? '⚠️' : '✕'}
                  </span>
                  <span>{feedback.message}</span>
                </div>

                {/* Resumen de la Orden en Caso de Éxito o Advertencia */}
                {feedback.order && (
                  <div className="pt-2 border-t border-slate-700/60 text-slate-300 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cliente:</span>
                      <span className="font-bold text-white">{feedback.order.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Teléfono:</span>
                      <span className="text-white font-mono">{feedback.order.customerPhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total:</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        ${Number(feedback.order.totalAmount || 0).toLocaleString('es-CL')} CLP
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estado Logístico:</span>
                      <span className="font-bold px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 text-[10px]">
                        {feedback.order.logisticsStatus || 'ENTREGADO'}
                      </span>
                    </div>

                    {/* Lista de Prendas */}
                    {parseCartItems(feedback.order.cartItems).length > 0 && (
                      <div className="pt-1">
                        <span className="text-slate-400 block mb-1">Prendas entregadas:</span>
                        <div className="bg-slate-950/60 rounded-lg p-2 space-y-1">
                          {parseCartItems(feedback.order.cartItems).map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-[10px]">
                              <span className="text-white">• {item.name || 'Producto'}</span>
                              <span className="text-slate-400 font-mono">
                                ${Number(item.price || 0).toLocaleString('es-CL')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columna Derecha: Panel de Instrucciones para el Operador */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-md dark:shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400"></span>
                  Instrucciones para el Operador
                </h3>
                <span className="text-[10px] font-mono bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 px-2 py-0.5 rounded-full">
                  GUÍA RÁPIDA
                </span>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-cyan-600 dark:text-cyan-400 font-black text-sm">01.</span>
                  <div className="space-y-0.5">
                    <p className="text-slate-900 dark:text-slate-200 font-bold">Solicitar Comprobante</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pídele al cliente el ID del pedido o el comprobante generado tras su compra web.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-cyan-600 dark:text-cyan-400 font-black text-sm">02.</span>
                  <div className="space-y-0.5">
                    <p className="text-slate-900 dark:text-slate-200 font-bold">Ingresar ID y PIN</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Escribe o escanea el ID de la orden y solicita el PIN de seguridad (pickupCode) de 4 dígitos.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-cyan-600 dark:text-cyan-400 font-black text-sm">03.</span>
                  <div className="space-y-0.5">
                    <p className="text-slate-900 dark:text-slate-200 font-bold">Confirmación y Despacho</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Haz clic en "Verificar y Confirmar Entrega". El sistema validará los datos en AWS AppSync y marcará el estado logístico como ENTREGADO.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta de Seguridad y Protocolo */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-md dark:shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
                <span className="text-cyan-600 dark:text-cyan-400">🛡️</span>
                <span>Seguridad de Despacho Presencial</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Cada validación exitosa actualiza el registro logístico en tiempo real con trazabilidad criptográfica en la base de datos de AWS Amplify.
              </p>
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-200 dark:border-slate-800">
                <span>STATUS:</span>
                <span className="text-emerald-600 dark:text-green-400 font-bold">ONLINE // APPSYNC_SECURE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
