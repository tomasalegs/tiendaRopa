'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import ThemeToggle from '@/components/ThemeToggle';

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

// Helper para verificar si un pedido está anulado/cancelado
const isOrderAnulado = (order: Schema['Order']['type']) => {
  if (!order) return false;
  return (
    order.status === 'CANCELADO' ||
    order.logisticsStatus === 'ANULADO' ||
    order.logisticsStatus === 'CANCELADO'
  );
};

// 1. Definir los Pasos del Stepper
const getStepperSteps = (order: Schema['Order']['type']) => {
  const isRetiro = order.deliveryMethod === 'Retiro en Tienda' || order.deliveryMethod === 'RETIRO_PRESENCIAL';
  return [
    { id: 'Preparando', label: 'Preparando' },
    { id: isRetiro ? 'Listo Retiro' : 'En Tránsito', label: isRetiro ? 'Listo para Retiro' : 'En Tránsito' },
    { id: 'Entregado', label: 'Entregado' },
  ];
};

// 2. Calcular el Progreso (CurrentStepIndex)
const getCurrentStepIndex = (status?: string | null, isAnulado?: boolean): number => {
  if (isAnulado) return -1;
  const s = (status || 'PREPARANDO').toUpperCase();
  if (s === 'ENTREGADO') return 2;
  if (s === 'LISTO_PARA_RETIRO' || s === 'EN_TRANSITO' || s === 'LISTO RETIRO' || s === 'EN TRÁNSITO') return 1;
  return 0;
};

// 3. Componente UI Stepper Visual
function OrderStepper({ order }: { order: Schema['Order']['type'] }) {
  const anulado = isOrderAnulado(order);
  const steps = getStepperSteps(order);
  const currentStepIndex = getCurrentStepIndex(order.logisticsStatus, anulado);

  if (anulado) {
    return (
      <div className="w-full mt-6 mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center gap-2 text-rose-700 dark:text-rose-400">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider">
          Pedido Anulado
        </span>
      </div>
    );
  }

  return (
    <div className="w-full mt-6 mb-4">
      <div className="flex items-center w-full">
        {steps.map((step, index) => {
          const isReached = currentStepIndex >= index;
          const isCurrent = currentStepIndex === index;
          const isNextReached = currentStepIndex > index;
          const showLine = index < steps.length - 1;

          return (
            <div key={step.id} className="flex-1 flex items-center last:flex-none">
              <div className="flex flex-col items-center relative z-10 w-24 sm:w-28 text-center shrink-0 -mx-3 first:ml-0 last:mr-0">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all duration-300 ${
                    isReached
                      ? 'bg-cyan-500 shadow-[0_0_10px_#06b6d4] text-white'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-slate-300 dark:border-gray-700'
                  } ${isCurrent ? 'ring-4 ring-cyan-500/20' : ''}`}
                >
                  {isReached && currentStepIndex > index ? '✓' : <span>{index + 1}</span>}
                </div>

                <span
                  className={`text-xs mt-2 text-center leading-tight font-mono font-bold block ${
                    isReached
                      ? 'text-cyan-700 dark:text-cyan-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {showLine && (
                <div
                  className={`flex-1 h-1 mx-2 rounded transition-all duration-300 ${
                    isNextReached
                      ? 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.4)]'
                      : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Masking helpers para resguardar privacidad en consulta pública por apiKey
function maskEmail(email?: string | null): string {
  if (!email) return 'c***o@y2k.cl';
  const parts = email.split('@');
  if (parts.length !== 2) return 'c***o@y2k.cl';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? name.charAt(0) + '***' : name.charAt(0) + '***' + name.charAt(name.length - 1);
  return `${maskedName}@${domain}`;
}

function maskPhone(phone?: string | null): string {
  if (!phone) return '+56 9 **** ****';
  if (phone.length < 8) return '+56 9 **** ****';
  return phone.slice(0, 4) + ' **** ' + phone.slice(-4);
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

export default function EstadoPedidoPage() {
  const [codigoInput, setCodigoInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<Schema['Order']['type'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Validación de PIN para desbloquear datos de contacto y PIN de retiro
  const [pinVerificationInput, setPinVerificationInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  async function handleBuscarPedido(e: React.FormEvent) {
    e.preventDefault();
    const queryClean = codigoInput.trim().replace(/^#/, '').toUpperCase();

    if (!queryClean) {
      setErrorMessage('Por favor ingresa un código de orden válido.');
      return;
    }

    setSearching(true);
    setErrorMessage(null);
    setOrder(null);
    setIsUnlocked(false);
    setUnlockError(null);

    try {
      // 1. Buscar por shortId (ej. Y2K-QUGR) usando authMode: 'apiKey'
      let foundOrder: Schema['Order']['type'] | null = null;

      const { data: byShortId } = await client.models.Order.list({
        filter: { shortId: { eq: queryClean } },
        authMode: 'apiKey',
      });

      if (byShortId && byShortId.length > 0) {
        foundOrder = byShortId[0] as Schema['Order']['type'];
      } else {
        // 2. Intentar buscar por id (UUID)
        const { data: byId } = await client.models.Order.list({
          filter: { id: { eq: queryClean.toLowerCase() } },
          authMode: 'apiKey',
        });

        if (byId && byId.length > 0) {
          foundOrder = byId[0] as Schema['Order']['type'];
        } else {
          // 3. Intentar por pickupCode
          const { data: byPickup } = await client.models.Order.list({
            filter: { pickupCode: { eq: queryClean } },
            authMode: 'apiKey',
          });
          if (byPickup && byPickup.length > 0) {
            foundOrder = byPickup[0] as Schema['Order']['type'];
          }
        }
      }

      if (foundOrder) {
        setOrder(foundOrder);
      } else {
        setErrorMessage(`No se encontró ningún pedido asociado al código "${queryClean}". Revisa tu comprobante o correo electrónico.`);
      }
    } catch (err) {
      console.error('Error buscando pedido:', err);
      setErrorMessage('Hubo un problema al consultar la base de datos. Inténtalo de nuevo.');
    } finally {
      setSearching(false);
    }
  }

  function handleUnlockData(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    const inputClean = pinVerificationInput.trim().toLowerCase();
    const actualEmail = (order.customerEmail || '').toLowerCase();
    const actualPin = (order.pickupCode || '').toLowerCase();

    if (inputClean === actualEmail || inputClean === actualPin) {
      setIsUnlocked(true);
      setUnlockError(null);
    } else {
      setUnlockError('El correo ingresado no coincide con el registro del pedido.');
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f1c] text-slate-900 dark:text-white font-sans transition-colors duration-200 flex flex-col justify-between">
      
      {/* Background Cyber-Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-fuchsia-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        
        {/* HEADER CON BOTONES DE NAVEGACIÓN Y TOGGLE */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-pulse" />
            <span className="text-lg sm:text-xl font-black tracking-widest text-slate-900 dark:text-white group-hover:text-cyan-500 transition-colors">
              Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-fuchsia-500">STORE</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-800 transition cursor-pointer"
            >
              ← Volver a la Vitrina
            </Link>
          </div>
        </div>

        {/* SI NO HAY ORDEN ENCONTRADA: MOSTRAR EL BUSCADOR PRINCIPAL */}
        {!order ? (
          <div className="max-w-2xl mx-auto py-8 sm:py-16 space-y-8 animate-fadeIn">
            <div className="text-center space-y-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                RASTREO EN TIEMPO REAL
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Estado del Pedido
              </h1>
              <p className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Consulta la preparación, estado de envío o retiros en tienda ingresando el código de tu orden.
              </p>
            </div>

            {/* FORMULARIO DE BÚSQUEDA CENTRALIZADO */}
            <form onSubmit={handleBuscarPedido} className="space-y-4">
              <div className="p-2 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-cyan-500/40 shadow-xl dark:shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value)}
                  placeholder="Ingresa tu Código de Orden (ej. Y2K-QUGR)"
                  className="flex-1 px-4 py-3 sm:py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono uppercase tracking-wider text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition"
                  disabled={searching}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={searching || !codigoInput.trim()}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  {searching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Buscar Pedido</span>
                    </>
                  )}
                </button>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-mono text-center animate-fadeIn">
                  ⚠️ {errorMessage}
                </div>
              )}
            </form>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 text-xs font-mono text-slate-500 dark:text-slate-400 space-y-2">
              <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>💡</span> ¿Dónde encuentro mi Código de Orden?
              </p>
              <p className="leading-relaxed">
                El código de orden tiene el formato <span className="font-bold text-cyan-600 dark:text-cyan-300">Y2K-XXXX</span> (ej. Y2K-QUGR) y te fue entregado al finalizar la compra en el comprobante en pantalla y por correo electrónico.
              </p>
            </div>
          </div>
        ) : (
          /* RESULTADO ENCONTRADO: RENDERIZAR LA TARJETA DE PEDIDO COMPLETA */
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            {/* Barra superior con botón para buscar otra orden */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setOrder(null);
                  setCodigoInput('');
                }}
                className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <span>←</span> Buscar otro pedido
              </button>

              <span className="text-xs font-mono text-slate-500">
                Consulta pública realizada con éxito
              </span>
            </div>

            {/* TARJETA DE PEDIDO (IDÉNTICA A LA VISTA MI BÓVEDA CON SEGURIDAD PÚBLICA) */}
            {(() => {
              const isPickup = order.deliveryMethod === 'RETIRO_PRESENCIAL';
              const isAnulado = isOrderAnulado(order);
              const displayCode = order.shortId || `#${order.id ? order.id.slice(0, 8) : '---'}`;
              const items = parseCartItems(order.cartItems);
              const formattedTotal = Number(order.totalAmount || 0).toLocaleString('es-CL');
              const formattedDate = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('es-CL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Reciente';

              return (
                <div
                  className={`rounded-3xl border p-6 sm:p-8 flex flex-col justify-between space-y-6 relative overflow-hidden backdrop-blur-md shadow-2xl transition-all duration-300 ${
                    isAnulado
                      ? 'bg-slate-100/60 dark:bg-slate-900/60 border-red-300 dark:border-red-950/60 opacity-90'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Línea Superior Neón */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                      isAnulado
                        ? 'from-red-900 to-rose-700'
                        : isPickup
                        ? 'from-cyan-500 via-sky-500 to-fuchsia-500'
                        : 'from-fuchsia-500 via-purple-500 to-cyan-500'
                    }`}
                  />

                  {/* CABECERA DE LA TARJETA */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                          CÓDIGO DE ORDEN
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(order.shortId || order.id, 'shortid')}
                          className="font-mono font-black text-xl text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer text-left"
                          title="Haz clic para copiar código"
                        >
                          <span>{displayCode}</span>
                          <span className="text-[11px] text-slate-500">
                            {copiedKey === 'shortid' ? '✓' : '📋'}
                          </span>
                        </button>
                      </div>

                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        📅 {formattedDate}
                      </span>
                    </div>

                    {/* MÉTODO DE ENTREGA */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isPickup ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 text-xs font-bold">
                          <span>🏢</span>
                          <span>Retiro en Tienda (Valparaíso)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-950/80 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-800 text-xs font-bold">
                          <span>🚚</span>
                          <span>Envío a Región</span>
                        </span>
                      )}
                    </div>

                    {/* Stepper Visual de Estado del Pedido */}
                    <OrderStepper order={order} />
                  </div>

                  {/* PRIVACIDAD PÚBLICA / VALIDACIÓN DE PIN */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
                        DATOS DEL COMPRADOR & PRIVACIDAD
                      </span>
                      {isUnlocked ? (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                          ✓ VERIFICADO
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                          🔒 DATOS PROTEGIDOS
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Cliente:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {isUnlocked ? order.customerName : maskEmail(order.customerEmail)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Teléfono:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {isUnlocked ? order.customerPhone : maskPhone(order.customerPhone)}
                        </span>
                      </div>
                    </div>

                    {/* RECUADRO PIN DE RETIRO (SOLO VISIBLE SI ESTÁ DESBLOQUEADO O RETIRO) */}
                    {isPickup && order.pickupCode && !isAnulado && (
                      <div className="pt-2">
                        {isUnlocked ? (
                          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-cyan-50 dark:from-cyan-950/90 dark:via-slate-950 dark:to-slate-950 border-2 border-cyan-500 shadow-md space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-700 dark:text-cyan-400 font-black">
                                PIN SECRETO DE RETIRO
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(order.pickupCode!, 'pin')}
                                className="text-[10px] text-cyan-800 dark:text-cyan-300 font-mono font-bold bg-cyan-100 dark:bg-cyan-950 px-2.5 py-0.5 rounded border border-cyan-300 cursor-pointer"
                              >
                                {copiedKey === 'pin' ? '✓ Copiado' : '📋 Copiar'}
                              </button>
                            </div>
                            <div className="text-center py-1">
                              <span className="font-mono font-black text-3xl sm:text-4xl text-cyan-600 dark:text-cyan-300 tracking-[0.3em] select-all">
                                {order.pickupCode}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleUnlockData} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                            <p className="text-[11px] font-mono text-slate-500">
                              🔒 Para ver el <span className="font-bold text-slate-700 dark:text-slate-300">PIN de Retiro</span> y tus datos personales completos, confirma tu correo electrónico:
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="email"
                                value={pinVerificationInput}
                                onChange={(e) => setPinVerificationInput(e.target.value)}
                                placeholder="Tu correo electrónico de compra"
                                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:border-cyan-500"
                              />
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold cursor-pointer transition shrink-0"
                              >
                                Validar
                              </button>
                            </div>
                            {unlockError && (
                              <p className="text-[10px] font-mono text-rose-500">{unlockError}</p>
                            )}
                          </form>
                        )}
                      </div>
                    )}
                  </div>

                  {/* RESUMEN DE PRODUCTOS COMPRADOS */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                      Productos en la Orden ({items.length})
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-2 max-h-36 overflow-y-auto text-xs font-mono">
                      {items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                          <span className="truncate pr-2 font-semibold">{it.name || 'Producto'}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            ${Number(it.price || 0).toLocaleString('es-CL')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FOOTER DE LA TARJETA: TOTAL */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block">Total de la Orden:</span>
                      <span className="text-xl font-black font-mono text-cyan-600 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-cyan-400 dark:to-emerald-400">
                        ${formattedTotal} CLP
                      </span>
                    </div>

                    <Link
                      href="/cuenta"
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold transition cursor-pointer shadow-sm"
                    >
                      Ir a Mi Bóveda
                    </Link>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
