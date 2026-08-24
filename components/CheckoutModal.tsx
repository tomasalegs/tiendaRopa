'use client';

import React, { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '@/amplify/data/resource';
import { useCart } from '@/context/CartContext';

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { cart, cartTotal, formattedCartTotal, clearCart, setIsCartOpen } = useCart();

  const [step, setStep] = useState<'FORM' | 'SUCCESS'>('FORM');
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{
    id: string;
    customerName: string;
    totalAmount: number;
  } | null>(null);

  // Temporizador de 20 minutos (1200 segundos) para la reserva
  const [timeLeft, setTimeLeft] = useState<number>(20 * 60);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('FORM');
      setErrorMessage(null);
      setIsSubmitting(false);
      setTimeLeft(20 * 60);
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (step === 'SUCCESS' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timeLeft]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validar campos del formulario
    if (
      !formData.customerName.trim() ||
      !formData.customerEmail.trim() ||
      !formData.customerPhone.trim() ||
      !formData.shippingAddress.trim()
    ) {
      setErrorMessage('Por favor, completa todos los campos del formulario.');
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('Tu carrito de compras está vacío.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await fetchAuthSession();
      const isAuth = session.tokens !== undefined;
      const authMode = isAuth ? 'userPool' : 'identityPool';

      // 2. Crear la Orden en el modelo Order con estado 'PENDIENTE'
      const cartSummary = cart.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        size: p.size,
        category: p.category,
        imageUrl: p.imageUrls?.[0] || p.imageUrl,
        imageUrls: p.imageUrls,
      }));

      const orderResult = await client.models.Order.create(
        {
          customerName: formData.customerName.trim(),
          customerEmail: formData.customerEmail.trim(),
          customerPhone: formData.customerPhone.trim(),
          shippingAddress: formData.shippingAddress.trim(),
          totalAmount: Number(cartTotal),
          status: 'PENDIENTE',
          cartItems: JSON.stringify(cartSummary),
        },
        { authMode }
      );

      if (orderResult.errors && orderResult.errors.length > 0) {
        console.error('Errores al crear la orden:', orderResult.errors);
        throw new Error('No se pudo registrar la orden en el sistema. Intenta nuevamente.');
      }

      const createdOrderData = orderResult.data;

      // 3. NUEVO PASO: Descontar Stock inmediatamente después de crear la Orden de forma exitosa
      if (createdOrderData) {
        const requestedQtyMap: Record<string, number> = {};
        for (const item of cart) {
          if (item?.id) {
            requestedQtyMap[item.id] = (requestedQtyMap[item.id] || 0) + 1;
          }
        }

        const uniqueProductIds = Object.keys(requestedQtyMap);

        for (const productId of uniqueProductIds) {
          try {
            // Obtener el producto actual para saber su stock real
            const { data: currentProduct } = await client.models.Product.get(
              { id: productId },
              { authMode }
            );

            if (currentProduct && typeof currentProduct.stock === 'number') {
              const qtyDeducted = requestedQtyMap[productId];
              const nuevoStock = Math.max(0, currentProduct.stock - qtyDeducted);
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
          } catch (err) {
            console.error(`Error descontando stock para el producto ${productId}`, err);
          }
        }
      }

      // 4. Limpiar el carrito global y mostrar comprobante de éxito
      clearCart();
      setIsCartOpen(false);

      setCreatedOrder({
        id: createdOrderData?.id || 'ORD-' + Math.floor(100000 + Math.random() * 900000),
        customerName: formData.customerName.trim(),
        totalAmount: cartTotal,
      });

      setStep('SUCCESS');
    } catch (err: any) {
      console.error('Error en el checkout:', err);
      setErrorMessage(err?.message || 'Ocurrió un error inesperado al procesar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bankDetails = {
    bank: 'Banco Estado',
    accountType: 'Cuenta Corriente',
    accountNumber: '001-23456789-0',
    rut: '76.123.456-7',
    holder: 'Y2K Store SpA',
    email: 'pagos@y2kstore.cl',
  };

  const whatsappMessage = encodeURIComponent(
    `¡Hola Y2K Store! 👋 Acabo de realizar el pedido #${createdOrder?.id || ''} por $${(
      createdOrder?.totalAmount || 0
    ).toLocaleString('es-CL')} a nombre de ${createdOrder?.customerName || ''}. Adjunto el comprobante de transferencia bancaria.`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop oscuro */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={step === 'FORM' ? onClose : undefined}
      />

      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 my-8">
        {/* Encabezado */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wide">
                {step === 'FORM' ? 'Finalizar Pedido • Transferencia' : '¡Pedido Reservado!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {step === 'FORM' ? 'Ingresa tus datos de envío' : `Orden #${createdOrder?.id || ''}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo del Modal: Paso 1 Formulario */}
        {step === 'FORM' && (
          <form onSubmit={handleConfirmOrder} className="p-5 sm:p-6 space-y-5">
            {/* Resumen del Monto */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Total a Pagar</span>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-400 dark:to-emerald-400">
                  ${formattedCartTotal} <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">CLP</span>
                </p>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2.5 py-1 rounded-full font-mono">
                {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>

            {/* Mensaje de Error */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <svg className="w-5 h-5 text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Inputs del Formulario */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre Completo <span className="text-cyan-600 dark:text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Ej: Tomás García"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Correo Electrónico <span className="text-cyan-600 dark:text-cyan-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    placeholder="tucorreo@ejemplo.cl"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Teléfono / WhatsApp <span className="text-cyan-600 dark:text-cyan-400">*</span>
                  </label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleInputChange}
                    placeholder="+56 9 1234 5678"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Dirección de Envío Completa <span className="text-cyan-600 dark:text-cyan-400">*</span>
                </label>
                <textarea
                  name="shippingAddress"
                  value={formData.shippingAddress}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Calle, Número, Depto, Comuna, Ciudad"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* Aviso informativo */}
            <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 text-[11px] text-cyan-800 dark:text-cyan-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>El stock se descontará automáticamente de la base de datos al confirmar el pedido.</span>
            </div>

            {/* Botón de Confirmación */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-fuchsia-600 to-purple-600 hover:from-cyan-500 hover:via-fuchsia-500 hover:to-purple-500 text-white font-extrabold uppercase tracking-wider text-sm shadow-[0_0_25px_rgba(217,70,239,0.5)] hover:shadow-[0_0_35px_rgba(6,182,212,0.7)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-5 h-5 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Verificando Stock y Creando Pedido...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Confirmar Pedido • ${formattedCartTotal}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Cuerpo del Modal: Paso 2 Pantalla de Éxito y Datos Bancarios */}
        {step === 'SUCCESS' && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Mensaje de Éxito */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm dark:shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">¡Pedido Reservado con Éxito!</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Gracias, <span className="font-bold text-slate-900 dark:text-white">{createdOrder?.customerName}</span>. Hemos descontado el inventario y tu orden está en estado <span className="text-amber-600 dark:text-amber-400 font-bold">PENDIENTE</span>.
              </p>
            </div>

            {/* ALERTA CRÍTICA DESTACADA (Neón / Rojo) con Temporizador de 20 Minutos */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-100 via-rose-50 to-rose-100 dark:from-rose-950/90 dark:via-red-900/80 dark:to-rose-950/90 border-2 border-rose-400 dark:border-rose-500 shadow-sm dark:shadow-[0_0_30px_rgba(244,63,94,0.3)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span>Tiempo de Reserva</span>
                </div>
                <span className="font-mono text-xl font-black text-rose-800 dark:text-white bg-white/80 dark:bg-black/60 px-3 py-1 rounded-lg border border-rose-300 dark:border-rose-500/50 shadow-inner">
                  ⏱️ {formattedTimer}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-extrabold text-rose-900 dark:text-rose-100 leading-snug">
                ⚠️ ¡Tu pedido ha sido reservado! Tienes exactamente{' '}
                <span className="text-rose-950 dark:text-white underline decoration-rose-400 font-black">20 MINUTOS</span> para realizar la transferencia y enviar el comprobante a nuestro WhatsApp/Correo. De lo contrario, el sistema cancelará tu pedido y liberará el stock.
              </p>
            </div>

            {/* Ficha de Datos Bancarios */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-700 dark:text-cyan-400 font-bold">
                  Datos de Transferencia Bancaria
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Total: ${(createdOrder?.totalAmount || 0).toLocaleString('es-CL')} CLP
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Banco */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Banco:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{bankDetails.bank}</span>
                    <button
                      onClick={() => copyToClipboard(bankDetails.bank, 'bank')}
                      className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-mono"
                    >
                      {copiedField === 'bank' ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Tipo de Cuenta */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Tipo de Cuenta:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{bankDetails.accountType}</span>
                    <button
                      onClick={() => copyToClipboard(bankDetails.accountType, 'type')}
                      className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-mono"
                    >
                      {copiedField === 'type' ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Número de Cuenta */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Número de Cuenta:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-700 dark:text-cyan-300 font-mono">{bankDetails.accountNumber}</span>
                    <button
                      onClick={() => copyToClipboard(bankDetails.accountNumber, 'acc')}
                      className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-mono"
                    >
                      {copiedField === 'acc' ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* RUT */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">RUT Titular:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{bankDetails.rut}</span>
                    <button
                      onClick={() => copyToClipboard(bankDetails.rut, 'rut')}
                      className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-mono"
                    >
                      {copiedField === 'rut' ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Nombre Titular */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Nombre Titular:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{bankDetails.holder}</span>
                    <button
                      onClick={() => copyToClipboard(bankDetails.holder, 'holder')}
                      className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-mono"
                    >
                      {copiedField === 'holder' ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Correo */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Correo para Comprobante:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{bankDetails.email}</span>
                    <button
                      onClick={() => copyToClipboard(bankDetails.email, 'email')}
                      className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-mono"
                    >
                      {copiedField === 'email' ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Asunto / Referencia */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Asunto / Mensaje de Transf.:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-700 dark:text-purple-300 font-mono">Pedido #{createdOrder?.id}</span>
                    <button
                      onClick={() => copyToClipboard(`Pedido #${createdOrder?.id}`, 'ref')}
                      className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-mono"
                    >
                      {copiedField === 'ref' ? '✓' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de Acción: Enviar WhatsApp y Cerrar */}
            <div className="space-y-2.5">
              <a
                href={`https://wa.me/56912345678?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold uppercase tracking-wider text-xs sm:text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>Enviar Comprobante por WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Volver a la Tienda
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
