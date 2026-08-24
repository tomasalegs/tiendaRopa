'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import type { Schema } from '@/amplify/data/resource';
import { useCart } from '@/context/CartContext';
import ThemeToggle from '@/components/ThemeToggle';

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();

  // Estados del Formulario
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
  });

  const [isEmailAutoCompleted, setIsEmailAutoCompleted] = useState<boolean>(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'RETIRO_PRESENCIAL' | 'ENVIO_REGION'>('RETIRO_PRESENCIAL');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado de Orden Creada (Comprobante Digital)
  const [createdOrder, setCreatedOrder] = useState<{
    id: string;
    shortId?: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    totalAmount: number;
    deliveryMethod: string;
    pickupCode?: string | null;
    logisticsStatus?: string | null;
    shippingAddress: string;
    cartItems: any[];
  } | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Temporizador de cuenta regresiva de 15 minutos (900 segundos) para la reserva
  const [timeLeft, setTimeLeft] = useState<number>(900);

  // 1. Auto-completar datos de usuario logueado en el montaje
  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      try {
        const attributes = await fetchUserAttributes();
        if (isMounted && attributes) {
          const email = attributes.email || '';
          const name = attributes.name || '';
          if (email) {
            setFormData((prev) => ({
              ...prev,
              customerEmail: email,
              customerName: prev.customerName || name,
            }));
            setIsEmailAutoCompleted(true);
          }
        }
      } catch {
        // Usuario invitado o sin sesión activa
      }
    }

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!createdOrder) return;
    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [createdOrder, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Carrito de respaldo simulado si el usuario entra directo sin agregar items
  const effectiveCart = cart.length > 0
    ? cart
    : [
        {
          id: 'item-demo-y2k',
          name: 'Parka Vintage Cyber Y2K (Edición Limitada)',
          price: 29999,
          category: 'Ropa',
          size: 'L',
        },
      ];

  const effectiveTotal = cart.length > 0 ? cartTotal : 29999;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validación básica de campos
    if (!formData.customerName.trim()) {
      setErrorMessage('Por favor, ingresa tu nombre completo.');
      return;
    }
    if (!formData.customerEmail.trim()) {
      setErrorMessage('Por favor, ingresa tu correo electrónico.');
      return;
    }
    if (!formData.customerPhone.trim()) {
      setErrorMessage('Por favor, ingresa tu teléfono o WhatsApp.');
      return;
    }
    if (deliveryMethod === 'ENVIO_REGION' && !formData.shippingAddress.trim()) {
      setErrorMessage('Por favor, ingresa tu dirección de envío o sucursal.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Generación de shortId amigable ej. Y2K-A83B y PIN aleatorio
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let randomSuffix = '';
      for (let i = 0; i < 4; i++) {
        randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const shortId = `Y2K-${randomSuffix}`;

      const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
      const pickupCode = deliveryMethod === 'RETIRO_PRESENCIAL' ? generatedPin : undefined;

      const finalAddress = deliveryMethod === 'RETIRO_PRESENCIAL'
        ? 'Retiro Presencial en Valparaíso (Punto de Entrega)'
        : formData.shippingAddress.trim();

      const itemsSummary = effectiveCart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        size: item.size || null,
        category: item.category || null,
      }));

      const session = await fetchAuthSession();
      const isAuth = session.tokens !== undefined;
      const authMode = isAuth ? 'userPool' : 'identityPool';

      // 2. Mutación en Base de Datos (AppSync)
      const { data: newOrder, errors } = await client.models.Order.create(
        {
          shortId,
          customerName: formData.customerName.trim(),
          customerEmail: formData.customerEmail.trim(),
          customerPhone: formData.customerPhone.trim(),
          shippingAddress: finalAddress,
          totalAmount: Number(effectiveTotal),
          status: 'PENDIENTE',
          cartItems: JSON.stringify(itemsSummary),
          deliveryMethod,
          pickupCode,
          logisticsStatus: 'PREPARANDO',
        },
        {
          authMode,
        }
      );

      if (errors && errors.length > 0) {
        console.error('Errores en creación de orden:', errors);
      }

      if (!newOrder) {
        throw new Error('No se pudo generar la orden en el servidor.');
      }

      // 3. NUEVO PASO: Descontar Stock en Base de Datos (Product.update) inmediatamente después de crear la Orden
      if (newOrder) {
        const requestedQtyMap: Record<string, number> = {};
        for (const item of effectiveCart) {
          if (item?.id && item.id !== 'item-demo-y2k') {
            requestedQtyMap[item.id] = (requestedQtyMap[item.id] || 0) + 1;
          }
        }

        const uniqueIds = Object.keys(requestedQtyMap);
        for (const productId of uniqueIds) {
          try {
            // Obtener el producto actual para conocer su stock real en base de datos
            const { data: currentProduct } = await client.models.Product.get(
              { id: productId },
              { authMode }
            );

            if (currentProduct && typeof currentProduct.stock === 'number') {
              const qtyToDeduct = requestedQtyMap[productId];
              const nuevoStock = Math.max(0, currentProduct.stock - qtyToDeduct);
              const nuevoIsAvailable = nuevoStock > 0;

              await client.models.Product.update(
                {
                  id: productId,
                  stock: nuevoStock,
                  isAvailable: nuevoIsAvailable,
                },
                { authMode }
              );
            }
          } catch (stockErr) {
            console.error(`Error descontando stock para el producto ${productId}`, stockErr);
          }
        }
      }

      // 4. Limpiar carrito de compras si existía
      if (cart.length > 0) {
        clearCart();
      }

      // 5. Mostrar Comprobante Digital
      setCreatedOrder({
        id: newOrder.id,
        shortId: newOrder.shortId || shortId,
        customerName: newOrder.customerName || formData.customerName.trim(),
        customerEmail: newOrder.customerEmail || formData.customerEmail.trim(),
        customerPhone: newOrder.customerPhone || formData.customerPhone.trim(),
        totalAmount: Number(newOrder.totalAmount || effectiveTotal),
        deliveryMethod: newOrder.deliveryMethod || deliveryMethod,
        pickupCode: newOrder.pickupCode || pickupCode,
        logisticsStatus: newOrder.logisticsStatus || 'PREPARANDO',
        shippingAddress: newOrder.shippingAddress || finalAddress,
        cartItems: itemsSummary,
      });
    } catch (error) {
      console.error('Error al crear orden:', error);
      setErrorMessage('Hubo un error al registrar tu orden. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-cyan-500 selection:text-black font-sans py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      {/* Fondo Glow Cyber-Y2K */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 sm:w-[600px] h-96 sm:h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-fuchsia-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-8">
        {/* Header de la Tienda */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer focus:outline-none">
            <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)] animate-pulse" />
            <span className="text-2xl sm:text-3xl font-black tracking-widest text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
              Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500">STORE</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <span className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-300 dark:border-cyan-800/60 shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              CHECKOUT // LOGÍSTICA HÍBRIDA
            </span>
            <Link
              href="/"
              className="text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 transition shadow-sm"
            >
              ← Volver a la Tienda
            </Link>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: FORMULARIO O COMPROBANTE DIGITAL */}
        {!createdOrder ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Columna Izquierda: Formulario de Despacho */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900/90 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-cyan-500/30 shadow-md dark:shadow-[0_0_30px_rgba(6,182,212,0.12)] space-y-6 backdrop-blur-sm relative overflow-hidden text-slate-900 dark:text-slate-100">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-fuchsia-500" />

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Información de Despacho</span>
                </h1>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                  Completa tus datos para coordinar el retiro o envío de tu pedido.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
                  <span>✕</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleConfirmOrder} className="space-y-5 text-xs">
                {/* Datos del Cliente */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      placeholder="Ej. Juan Pérez González"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-sm transition-all duration-300 ease-in-out"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Correo Electrónico *
                        </label>
                        {isEmailAutoCompleted && (
                          <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800/60 flex items-center gap-1">
                            <span>✓</span>
                            <span>Vinculado a tu cuenta</span>
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        name="customerEmail"
                        value={formData.customerEmail}
                        onChange={handleInputChange}
                        required
                        readOnly={isEmailAutoCompleted}
                        disabled={isLoading}
                        placeholder="tu-email@gmail.com"
                        className={`w-full border rounded-xl p-3 min-h-[44px] font-mono text-sm transition-all duration-300 ease-in-out ${
                          isEmailAutoCompleted
                            ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Teléfono / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        name="customerPhone"
                        value={formData.customerPhone}
                        onChange={handleInputChange}
                        required
                        disabled={isLoading}
                        placeholder="+56 9 1234 5678"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-sm transition-all duration-300 ease-in-out"
                      />
                    </div>
                  </div>
                </div>

                {/* Selector de Método de Entrega (Radio Buttons Cyber-Y2K) */}
                <div className="space-y-3 pt-2">
                  <label className="block font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Método de Entrega *
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opción 1: Retiro Presencial en Valparaíso */}
                    <label
                      className={`p-4 rounded-xl border cursor-pointer min-h-[50px] transition-all duration-300 ease-in-out flex flex-col justify-between gap-2 ${
                        deliveryMethod === 'RETIRO_PRESENCIAL'
                          ? 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-500 dark:border-cyan-400 shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.25)] text-slate-900 dark:text-white'
                          : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value="RETIRO_PRESENCIAL"
                          checked={deliveryMethod === 'RETIRO_PRESENCIAL'}
                          onChange={() => setDeliveryMethod('RETIRO_PRESENCIAL')}
                          className="accent-cyan-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-bold text-xs">🏢 Retiro en Valparaíso</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                        Entrega presencial rápida. Genera un <strong className="text-cyan-600 dark:text-cyan-300">PIN Secreto de 4 dígitos</strong>.
                      </p>
                    </label>

                    {/* Opción 2: Envío a Regiones */}
                    <label
                      className={`p-4 rounded-xl border cursor-pointer min-h-[50px] transition-all duration-300 ease-in-out flex flex-col justify-between gap-2 ${
                        deliveryMethod === 'ENVIO_REGION'
                          ? 'bg-fuchsia-50 dark:bg-fuchsia-950/50 border-fuchsia-500 dark:border-fuchsia-400 shadow-sm dark:shadow-[0_0_15px_rgba(217,70,239,0.25)] text-slate-900 dark:text-white'
                          : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value="ENVIO_REGION"
                          checked={deliveryMethod === 'ENVIO_REGION'}
                          onChange={() => setDeliveryMethod('ENVIO_REGION')}
                          className="accent-fuchsia-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-bold text-xs">🚚 Envío a Regiones</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                        Envío por pagar vía Starken / Chilexpress a todo Chile.
                      </p>
                    </label>
                  </div>
                </div>

                {/* Input de Dirección si es Envío a Región */}
                {deliveryMethod === 'ENVIO_REGION' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="block font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Dirección de Envío / Sucursal (Starken / Chilexpress) *
                    </label>
                    <textarea
                      name="shippingAddress"
                      value={formData.shippingAddress}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      rows={2}
                      placeholder="Ej: Av. Providencia 1234, Depto 502, Santiago / Sucursal Starken Viña del Mar"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[64px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-fuchsia-500 font-mono text-sm transition-all duration-300 ease-in-out"
                    />
                  </div>
                )}

                {/* Botón de Confirmación */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-[48px] py-4 bg-gradient-to-r from-cyan-600 via-sky-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-bold tracking-wider rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 ease-in-out disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer uppercase text-xs sm:text-sm"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                        <span>GENERANDO ORDEN EN EL SISTEMA...</span>
                      </>
                    ) : (
                      <span>CONFIRMAR Y FINALIZAR COMPRA</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Columna Derecha: Resumen del Pedido */}
            <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl space-y-5 text-slate-900 dark:text-slate-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                <span>Resumen de Compra</span>
                <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">{effectiveCart.length} ítem(s)</span>
              </h2>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {effectiveCart.map((item, index) => (
                  <div key={index} className="flex justify-between items-start text-xs border-b border-slate-100 dark:border-slate-800/60 pb-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {item.category || 'Producto'} {item.size ? `• Talla: ${item.size}` : ''}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ${Number(item.price || 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-900 dark:text-white">${Number(effectiveTotal).toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Despacho:</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">
                    {deliveryMethod === 'RETIRO_PRESENCIAL' ? 'Gratis (Retiro)' : 'Por Pagar'}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Total a Pagar:</span>
                  <span className="font-mono text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-400 dark:to-emerald-400 font-extrabold">
                    ${Number(effectiveTotal).toLocaleString('es-CL')} CLP
                  </span>
                </div>
              </div>

              {/* Caja de Garantía y Seguridad */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
                  <span>🔒</span>
                  <span>COMPRA PROTEGIDA</span>
                </div>
                <p>Transferencia bancaria directa con reserva asegurada.</p>
              </div>
            </div>
          </div>
        ) : (
          /* COMPROBANTE DIGITAL CYBER-Y2K (SUCCESS STATE) */
          <div className="bg-white/95 dark:bg-slate-900/95 rounded-3xl p-6 sm:p-10 border-2 border-cyan-500/50 shadow-2xl dark:shadow-[0_0_50px_rgba(6,182,212,0.25)] space-y-8 relative overflow-hidden backdrop-blur-md animate-fadeIn text-slate-900 dark:text-slate-100">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 shadow-[0_0_20px_rgba(34,211,238,1)]" />

            {/* Header del Comprobante */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center mx-auto text-3xl shadow-sm dark:shadow-[0_0_25px_rgba(16,185,129,0.35)] text-emerald-600 dark:text-emerald-400">
                ✓
              </div>
              <span className="font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold">
                ORDEN REGISTRADA EXITOSAMENTE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Comprobante de Compra
              </h2>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Tu orden ha sido inyectada al sistema y está en estado{' '}
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">{createdOrder.logisticsStatus || 'PREPARANDO'}</span>.
              </p>
            </div>

            {/* Tarjeta de ID de Orden */}
            <div className="bg-slate-50 dark:bg-slate-950/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono text-slate-500 uppercase block">CÓDIGO DE ORDEN</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 tracking-wider">
                    {createdOrder.shortId || `#${createdOrder.id.slice(0, 8)}`}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5 break-all">
                  UUID: {createdOrder.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(createdOrder.shortId || createdOrder.id, 'orderId')}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-400 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-300 dark:border-slate-700 shadow-sm"
              >
                {copiedField === 'orderId' ? '✓ ¡Copiado!' : 'Copiar Código'}
              </button>
            </div>

            {/* TARJETA DESTACADA DE PIN SECRETO (SI ES RETIRO PRESENCIAL) */}
            {createdOrder.deliveryMethod === 'RETIRO_PRESENCIAL' && createdOrder.pickupCode ? (
              <div className="bg-gradient-to-br from-cyan-50 via-white to-purple-50 dark:from-cyan-950/60 dark:via-slate-950 dark:to-purple-950/40 rounded-3xl p-6 sm:p-8 border-2 border-cyan-400/80 shadow-[0_0_35px_rgba(6,182,212,0.2)] space-y-4 text-center relative overflow-hidden">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950 px-3 py-1 rounded-full border border-cyan-300 dark:border-cyan-800">
                    PIN SECRETO DE RETIRO
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono pt-1">
                    Guarda este PIN, lo necesitarás para retirar tu compra
                  </p>
                </div>

                {/* PIN Grande y Brillante */}
                <div className="py-2">
                  <div className="inline-block bg-white dark:bg-slate-950/90 border border-cyan-500/50 rounded-2xl px-6 sm:px-10 py-3 sm:py-4 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                    <span className="text-4xl sm:text-5xl font-mono font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-sky-500 to-fuchsia-600 dark:from-cyan-300 dark:via-sky-200 dark:to-fuchsia-300 drop-shadow-sm dark:drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]">
                      {createdOrder.pickupCode}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={timeLeft === 0}
                    onClick={() => copyToClipboard(createdOrder.pickupCode || '', 'pinCode')}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
                      timeLeft === 0
                        ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50 shadow-none'
                        : 'bg-cyan-100 dark:bg-cyan-900/60 hover:bg-cyan-200 dark:hover:bg-cyan-900 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/60 cursor-pointer shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    }`}
                  >
                    {timeLeft === 0
                      ? '⛔ PIN Expirado'
                      : copiedField === 'pinCode'
                      ? '✓ ¡PIN Copiado!'
                      : '📋 Copiar PIN'}
                  </button>

                  {/* Botón WhatsApp */}
                  {(() => {
                    const shortId = createdOrder.shortId || createdOrder.id.slice(0, 8);
                    const pickupCode = createdOrder.pickupCode || 'N/A';
                    const whatsappText = encodeURIComponent(`¡Hola! Aquí tienes el comprobante de compra en Y2K Store.\n\n🛍️ *Orden:* ${shortId}\n🔐 *PIN Secreto:* ${pickupCode}\n\nPreséntalo en la tienda para retirar tu pedido.`);
                    const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
                    return (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white shadow-[0_0_15px_rgba(37,211,102,0.35)] hover:scale-[1.02] cursor-pointer"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.185 1.564 5.939l-1.656 6.053 6.195-1.625c1.691.921 3.63 1.445 5.697 1.445 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                        </svg>
                        <span>Guardar en WhatsApp</span>
                      </a>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-5 border border-fuchsia-300 dark:border-fuchsia-500/40 text-center space-y-2">
                <span className="text-xs font-mono text-fuchsia-700 dark:text-fuchsia-400 font-bold uppercase tracking-wider">
                  🚚 DESPACHO A REGIONES POR PAGAR
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Dirección registrada: <strong className="text-slate-900 dark:text-white">{createdOrder.shippingAddress}</strong>
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  Te enviaremos el número de seguimiento (tracking) apenas sea despachado.
                </p>
              </div>
            )}

            {/* Datos de Transferencia Bancaria */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span>💳</span>
                  <span>Datos de Transferencia Bancaria</span>
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Total: ${createdOrder.totalAmount.toLocaleString('es-CL')} CLP
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[10px]">BANCO:</span>
                  <span className="text-slate-900 dark:text-white font-bold">Banco Estado / Cuenta RUT</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[10px]">TIPO DE CUENTA:</span>
                  <span className="text-slate-900 dark:text-white font-bold">Cuenta Vista</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[10px]">RUT:</span>
                  <span className="text-slate-900 dark:text-white font-bold">12.345.678-9</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[10px]">EMAIL COMPROBANTES:</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">pagos@y2kstore.cl</span>
                </div>
              </div>

              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 text-center">
                Envía tu comprobante con el código de orden <strong className="text-cyan-600 dark:text-cyan-300 font-bold">{createdOrder.shortId || `#${createdOrder.id.slice(0, 8)}`}</strong> para confirmar tu pedido.
              </p>
            </div>

            {/* PANEL DE ADVERTENCIA Y URGENCIA CON CUENTA REGRESIVA (CYBER-Y2K) */}
            <div
              className={`p-5 sm:p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden backdrop-blur-md ${
                timeLeft === 0
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-400 dark:border-red-500 shadow-sm dark:shadow-[0_0_30px_rgba(239,68,68,0.35)]'
                  : 'bg-orange-50 dark:bg-orange-950/30 border-orange-400 dark:border-orange-500 shadow-sm dark:shadow-[0_0_25px_rgba(249,115,22,0.3)] animate-pulse'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                      timeLeft === 0
                        ? 'bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-500 text-red-600 dark:text-red-400'
                        : 'bg-orange-100 dark:bg-orange-950 border border-orange-300 dark:border-orange-500 text-orange-600 dark:text-orange-300'
                    }`}
                  >
                    {timeLeft === 0 ? '✕' : '⏱️'}
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border ${
                        timeLeft === 0
                          ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800'
                          : 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700'
                      }`}
                    >
                      {timeLeft === 0 ? 'ESTADO: EXPIRADO' : 'TIEMPO LÍMITE DE RESERVA'}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-wide mt-1">
                      {timeLeft === 0 ? 'Reserva Liberada' : 'Cuenta Regresiva de Pago'}
                    </h4>
                  </div>
                </div>

                {/* Temporizador en formato grande con estilo Cyber-Y2K */}
                <div className="shrink-0">
                  <div
                    className={`px-5 py-2.5 rounded-xl border font-mono font-black text-3xl sm:text-4xl tracking-widest ${
                      timeLeft === 0
                        ? 'bg-red-100 dark:bg-red-950/90 border-red-400 dark:border-red-500 text-red-600 dark:text-red-500 shadow-sm dark:shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                        : 'bg-white dark:bg-slate-950/90 border-orange-400 dark:border-orange-500 text-orange-600 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-orange-400 dark:via-amber-300 dark:to-yellow-400 drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(249,115,22,0.9)] shadow-sm dark:shadow-[0_0_25px_rgba(249,115,22,0.35)]'
                    }`}
                  >
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>

              {/* Texto de Advertencia / Expiración */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
                {timeLeft === 0 ? (
                  <p className="text-red-600 dark:text-red-500 font-bold flex items-center gap-2">
                    <span>⛔</span>
                    <span>TIEMPO EXPIRADO. La reserva de este producto ha sido liberada.</span>
                  </p>
                ) : (
                  <p className="text-orange-700 dark:text-orange-400 leading-relaxed">
                    ⚠️ <strong className="text-orange-800 dark:text-orange-300">ATENCIÓN:</strong> Tienes{' '}
                    <span className="font-bold text-orange-950 dark:text-yellow-300 underline decoration-orange-400 font-mono">
                      {formatTime(timeLeft)}
                    </span>{' '}
                    minutos para realizar la transferencia y enviar el comprobante. Si el tiempo expira, la orden será anulada y el producto volverá a estar disponible en la tienda.
                  </p>
                )}
              </div>
            </div>

            {/* Botones Finales */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] text-center cursor-pointer"
              >
                ← Volver a la Tienda
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 font-mono text-xs font-bold transition cursor-pointer shadow-sm"
              >
                🖨️ Imprimir / Guardar Comprobante
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
