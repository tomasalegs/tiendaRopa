'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession, fetchUserAttributes, updateUserAttributes } from 'aws-amplify/auth';
import { uploadData, getUrl } from 'aws-amplify/storage';
import imageCompression from 'browser-image-compression';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import type { Schema } from '@/amplify/data/resource';
import ThemeToggle from '@/components/ThemeToggle';

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

const authFormFields = {
  signUp: {
    name: { order: 1, label: 'Nombre Completo', placeholder: 'Ingresa tu nombre completo', isRequired: true },
    email: { order: 2 },
    password: { order: 3 },
    confirm_password: { order: 4 }
  }
};

export default function CuentaPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f1c] text-gray-900 dark:text-white selection:bg-cyan-500 selection:text-black font-sans transition-colors duration-200">
      {/* Estilos personalizados para el Authenticator adaptables a modo claro y oscuro */}
      <style jsx global>{`
        html:not(.dark) [data-amplify-authenticator] {
          --amplify-colors-background-primary: #ffffff;
          --amplify-colors-background-secondary: #f8fafc;
          --amplify-colors-brand-primary-10: #ecfeff;
          --amplify-colors-brand-primary-80: #0891b2;
          --amplify-colors-brand-primary-90: #0e7490;
          --amplify-colors-brand-primary-100: #155e75;
          --amplify-colors-font-primary: #0f172a;
          --amplify-colors-font-secondary: #475569;
          --amplify-colors-font-interactive: #0891b2;
          --amplify-colors-border-primary: #cbd5e1;
          --amplify-colors-border-secondary: #e2e8f0;
          --amplify-components-authenticator-router-border-color: #cbd5e1;
          --amplify-components-authenticator-router-box-shadow: 0 4px 25px rgba(0, 0, 0, 0.08);
          --amplify-components-tabs-item-active-border-color: #0891b2;
          --amplify-components-tabs-item-active-color: #0891b2;
          --amplify-components-tabs-item-color: #64748b;
          --amplify-components-button-primary-background-color: #0891b2;
          --amplify-components-button-primary-hover-background-color: #06b6d4;
          --amplify-components-fieldcontrol-border-color: #cbd5e1;
          --amplify-components-fieldcontrol-color: #0f172a;
          --amplify-components-fieldcontrol-focus-border-color: #0891b2;
          --amplify-components-fieldcontrol-focus-box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.2);
          border-radius: 1.25rem !important;
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          color: #0f172a !important;
          padding: 1.5rem !important;
        }
        html:not(.dark) [data-amplify-authenticator] input {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 0.75rem !important;
        }
        html:not(.dark) [data-amplify-authenticator] button[type="submit"] {
          background: linear-gradient(to right, #0891b2, #9333ea) !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border: none !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.2) !important;
        }
        .dark [data-amplify-authenticator] {
          --amplify-colors-background-primary: #020617;
          --amplify-colors-background-secondary: #0f172a;
          --amplify-colors-brand-primary-10: #083344;
          --amplify-colors-brand-primary-80: #06b6d4;
          --amplify-colors-brand-primary-90: #0891b2;
          --amplify-colors-brand-primary-100: #0e7490;
          --amplify-colors-font-primary: #f8fafc;
          --amplify-colors-font-secondary: #94a3b8;
          --amplify-colors-font-interactive: #22d3ee;
          --amplify-colors-border-primary: #1e293b;
          --amplify-colors-border-secondary: #334155;
          --amplify-components-authenticator-router-border-color: #1e293b;
          --amplify-components-authenticator-router-box-shadow: 0 0 50px rgba(6, 182, 212, 0.25);
          --amplify-components-tabs-item-active-border-color: #06b6d4;
          --amplify-components-tabs-item-active-color: #06b6d4;
          --amplify-components-tabs-item-color: #94a3b8;
          --amplify-components-button-primary-background-color: #0891b2;
          --amplify-components-button-primary-hover-background-color: #06b6d4;
          --amplify-components-fieldcontrol-border-color: #334155;
          --amplify-components-fieldcontrol-color: #ffffff;
          --amplify-components-fieldcontrol-focus-border-color: #06b6d4;
          --amplify-components-fieldcontrol-focus-box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
          border-radius: 1.25rem !important;
          border: 1px solid #1e293b !important;
          background: #090d16 !important;
          color: #f8fafc !important;
          padding: 1.5rem !important;
        }
        .dark [data-amplify-authenticator] input {
          background-color: #020617 !important;
          color: #ffffff !important;
          border: 1px solid #334155 !important;
          border-radius: 0.75rem !important;
        }
        .dark [data-amplify-authenticator] button[type="submit"] {
          background: linear-gradient(to right, #0891b2, #9333ea) !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border: none !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.3) !important;
        }
        [data-amplify-authenticator] .amplify-tabs {
          background: transparent !important;
        }
        [data-amplify-authenticator] .amplify-tabs__item {
          font-weight: 700 !important;
        }
        [data-amplify-authenticator] .amplify-tabs__item--active {
          border-color: #06b6d4 !important;
        }
      `}</style>

      <div className="flex min-h-screen items-center justify-center p-4">
        <Authenticator formFields={authFormFields}>
          {({ signOut, user }) => (
            <ClientVault user={user} signOut={signOut} />
          )}
        </Authenticator>
      </div>
    </div>
  );
}

// 1. Definir los Pasos (Steps) según el método de entrega
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
  return 0; // Preparando por defecto
};

// 3. Componente UI (Stepper Visual)
function OrderStepper({ order }: { order: Schema['Order']['type'] }) {
  const isAnulado =
    order.status === 'CANCELADO' ||
    order.logisticsStatus === 'ANULADO' ||
    order.logisticsStatus === 'CANCELADO';
  const steps = getStepperSteps(order);
  const currentStepIndex = getCurrentStepIndex(order.logisticsStatus, isAnulado);

  if (isAnulado) {
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
              {/* Nodo Circular con Label debajo */}
              <div className="flex flex-col items-center relative z-10 w-24 sm:w-28 text-center shrink-0 -mx-3 first:ml-0 last:mr-0">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all duration-300 ${
                    isReached
                      ? 'bg-cyan-500 shadow-[0_0_10px_#06b6d4] text-white'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-slate-300 dark:border-gray-700'
                  } ${isCurrent ? 'ring-4 ring-cyan-500/20' : ''}`}
                >
                  {isReached && currentStepIndex > index ? (
                    '✓'
                  ) : (
                    <span>{index + 1}</span>
                  )}
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

              {/* Línea Conectora */}
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

function ClientVault({ user, signOut }: { user?: any; signOut?: () => void }) {
  const [orders, setOrders] = useState<Schema['Order']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Schema['Order']['type'] | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Obtener atributos del usuario autenticado y verificar roles
  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
        const userIsAdmin = groups.includes('Super_Admin') || groups.includes('Admin_Tienda');
        if (isMounted) setIsAdmin(userIsAdmin);

        const attributes = await fetchUserAttributes();
        if (!isMounted) return;

        const email = attributes.email || user?.signInDetails?.loginId || '';
        setUserEmail(email);

        const fullName = attributes.name || '';
        const firstName = fullName.trim() ? fullName.trim().split(' ')[0] : (email ? email.split('@')[0] : 'Cliente');
        setUserName(firstName);

        if (attributes.picture) {
          try {
            if (attributes.picture.startsWith('http://') || attributes.picture.startsWith('https://') || attributes.picture.startsWith('data:')) {
              setAvatarUrl(attributes.picture);
            } else {
              const urlResult = await getUrl({ path: attributes.picture });
              setAvatarUrl(urlResult.url.toString());
            }
          } catch (picErr) {
            console.error('Error cargando avatar:', picErr);
          }
        }
      } catch {
        if (!isMounted) return;
        const email = user?.signInDetails?.loginId || '';
        setUserEmail(email);
        setUserName(email ? email.split('@')[0] : 'Cliente');
      }
    }

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Subida y Vinculación de la Foto de Perfil
  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);

      // a) Comprimir a un tamaño pequeño (max 400x400px, maxSizeMB: 0.2)
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true,
        fileType: 'image/webp',
      };
      const compressedFile = await imageCompression(file, options);

      // b) Subir a Storage en una ruta pública
      const safeEmail = (userEmail || user?.signInDetails?.loginId || 'user').replace(/[^a-zA-Z0-9]/g, '_');
      const storagePath = `public/avatars/${safeEmail}-avatar.webp`;

      await uploadData({
        path: storagePath,
        data: compressedFile,
        options: {
          contentType: 'image/webp',
        },
      }).result;

      // c) Actualizar el perfil del usuario vinculando la ruta de la imagen
      await updateUserAttributes({
        userAttributes: {
          picture: storagePath,
        },
      });

      // Refrescar el estado con la URL de la imagen subida
      const urlResult = await getUrl({ path: storagePath });
      setAvatarUrl(urlResult.url.toString());
    } catch (error) {
      console.error('Error al subir avatar:', error);
    } finally {
      setIsUploadingAvatar(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  }

  // 2. Cargar y observar pedidos que coincidan con el email del cliente con authMode: 'userPool'
  useEffect(() => {
    if (!userEmail) return;

    let isMounted = true;
    setLoading(true);

    async function loadOrders() {
      try {
        const { data: userOrders, errors } = await client.models.Order.list({
          filter: { customerEmail: { eq: userEmail } },
          authMode: 'userPool',
        });

        if (errors && errors.length > 0) {
          console.error('Error cargando bóveda:', errors);
        }

        if (isMounted && userOrders) {
          const sorted = [...userOrders].filter(Boolean) as Schema['Order']['type'][];
          sorted.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          setOrders(sorted);
        }
      } catch (err) {
        console.error('Error cargando bóveda:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadOrders();

    let sub: any = null;
    try {
      sub = client.models.Order.observeQuery({
        filter: { customerEmail: { eq: userEmail } },
        authMode: 'userPool',
      }).subscribe({
        next: ({ items }) => {
          if (!isMounted) return;

          const myOrders = (items as Schema['Order']['type'][]).filter((o) => {
            if (!o || !o.customerEmail) return false;
            return o.customerEmail.toLowerCase().trim() === userEmail.toLowerCase().trim();
          });

          myOrders.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          setOrders(myOrders);
          setLoading(false);
        },
        error: (err) => {
          console.warn('ObserveQuery en bóveda fallback a list():', err);
          if (isMounted) setLoading(false);
        },
      });
    } catch (subErr) {
      console.warn('Error iniciando suscripción en bóveda:', subErr);
    }

    return () => {
      isMounted = false;
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [userEmail]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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

  // Contadores de estado
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'CANCELADO' && o.logisticsStatus !== 'CANCELADO' && o.logisticsStatus !== 'ANULADO' && o.logisticsStatus !== 'ENTREGADO'
  ).length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn font-sans">
      {/* Fondo Glow Cyber-Y2K */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/3 w-96 sm:w-[600px] h-96 sm:h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl" />
      </div>

      {/* HEADER PRINCIPAL */}
      <div className="relative z-10 p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col md:flex-row md:items-center md:justify-between gap-6 backdrop-blur-md transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* AVATAR INTERACTIVO */}
          <div className="relative flex-shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploadingAvatar}
            />
            <div
              onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
              className="w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-500 relative group cursor-pointer bg-slate-100 dark:bg-slate-950 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all hover:scale-105 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              title="Haz clic para cambiar tu foto de perfil"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userName || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-300 select-none">
                  {(userName || userEmail || 'U').charAt(0).toUpperCase()}
                </span>
              )}

              {/* Overlay semi-transparente con ícono de cámara en hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-cyan-300">
                <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[8px] font-mono font-bold uppercase tracking-wider">Cambiar</span>
              </div>

              {/* Indicador de carga cuando se está subiendo */}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] animate-pulse flex-shrink-0" />
              <h1 className="!text-xl md:!text-2xl !font-extrabold !leading-tight !whitespace-nowrap text-slate-900 dark:text-white">
                Mi Bóveda <span className="text-cyan-500 dark:text-cyan-400 font-mono text-lg md:text-xl font-normal">//</span> Historial de Pedidos
              </h1>
            </div>
            <p className="!text-xs text-slate-600 dark:text-slate-400 font-mono">
              ¡Hola, <span className="font-bold text-cyan-600 dark:text-cyan-300">{userName || 'Cliente'}</span>! Bienvenido a tu terminal de compras y seguimiento en vivo.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                📧 {userEmail}
              </span>
              {activeOrdersCount > 0 && (
                <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-3 py-1 rounded-lg border border-amber-300 dark:border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.25)] animate-pulse">
                  ⚡ {activeOrdersCount} en curso
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ACCIONES DEL HEADER */}
        <div className="flex flex-row items-center gap-2 lg:gap-3 flex-wrap lg:flex-nowrap justify-end w-full lg:w-auto">
          <ThemeToggle />

          {isAdmin && (
            <Link
              href="/admin"
              className="!px-3 !py-1.5 !text-xs font-bold rounded-lg whitespace-nowrap h-fit flex items-center justify-center gap-1.5 bg-fuchsia-100 dark:bg-fuchsia-950/80 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300 hover:text-fuchsia-900 dark:hover:text-white border border-fuchsia-300 dark:border-fuchsia-700/80 font-mono transition-all shadow-sm cursor-pointer"
              title="Ir al Centro de Control de Administración"
            >
              <span className="text-xs">👑</span>
              <span>Panel Admin</span>
            </Link>
          )}

          <Link
            href="/"
            className="!px-3 !py-1.5 !text-xs font-semibold rounded-lg whitespace-nowrap h-fit flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-cyan-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-cyan-500/40 font-mono transition-all shadow-sm cursor-pointer"
          >
            <span className="text-xs">←</span>
            <span>Volver a la Vitrina</span>
          </Link>

          {signOut && (
            <button
              type="button"
              onClick={signOut}
              className="!px-3 !py-1.5 !text-xs font-semibold rounded-lg whitespace-nowrap h-fit flex items-center justify-center gap-1.5 bg-rose-100 dark:bg-rose-950/80 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white border border-rose-300 dark:border-rose-800/80 font-mono transition-all cursor-pointer shadow-sm"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: LISTADO DE ÓRDENES O ESTADO VACÍO */}
      <div className="relative z-10 space-y-6">
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-cyan-500 dark:border-cyan-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 tracking-wider animate-pulse">
              ACCEDIENDO A LA BÓVEDA DE REGISTROS...
            </p>
          </div>
        ) : orders.length === 0 ? (
          /* ESTADO VACÍO CYBER-Y2K */
          <div className="max-w-xl mx-auto p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-md">
            <div className="w-20 h-20 rounded-2xl bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-500/40 flex items-center justify-center mx-auto text-4xl shadow-[0_0_30px_rgba(6,182,212,0.25)]">
              📭
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">
                STATUS://ZERO_ORDERS_DETECTED
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Aún no tienes registros en nuestra base de datos
              </h2>
              <p className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                No se han encontrado compras asociadas a tu cuenta. Explora nuestro catálogo de ropa y accesorios Cyber-Y2K exclusivos para realizar tu primer pedido.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-mono text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:scale-105"
              >
                <span>🛍️</span>
                <span>Explorar Catálogo</span>
              </Link>
            </div>
          </div>
        ) : (
          /* GRID DE TARJETAS DE PEDIDOS */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              const isPickup = order.deliveryMethod === 'RETIRO_PRESENCIAL';
              const isAnulado = order.status === 'CANCELADO' || order.logisticsStatus === 'ANULADO' || order.logisticsStatus === 'CANCELADO';
              const displayCode = order.shortId || `#${order.id ? order.id.slice(0, 8) : '---'}`;
              const logistics = order.logisticsStatus || 'PREPARANDO';
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
                  key={order.id}
                  className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 relative overflow-hidden transition-all duration-300 ease-in-out backdrop-blur-md ${
                    isAnulado
                      ? 'bg-slate-100/60 dark:bg-slate-900/60 border-red-300 dark:border-red-950/60 opacity-80'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-cyan-500/60 dark:hover:border-cyan-400/60 shadow-md hover:shadow-[0_0_25px_rgba(6,182,212,0.25)] hover:-translate-y-1'
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
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                          CÓDIGO DE ORDEN
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(order.shortId || order.id, order.id + '-code')}
                          className="font-mono font-black text-lg text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer text-left"
                          title="Haz clic para copiar código"
                        >
                          <span>{displayCode}</span>
                          <span className="text-[11px] text-slate-500">
                            {copiedKey === order.id + '-code' ? '✓' : '📋'}
                          </span>
                        </button>
                      </div>

                      {/* Fecha de compra */}
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        📅 {formattedDate}
                      </span>
                    </div>

                    {/* MÉTODO DE ENTREGA */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isPickup ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 text-[10px] font-bold">
                          <span>🏢</span>
                          <span>Retiro en Tienda</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-950/80 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-800 text-[10px] font-bold">
                          <span>🚚</span>
                          <span>Envío a Región</span>
                        </span>
                      )}
                    </div>

                    {/* Stepper Visual de Estado del Pedido */}
                    <OrderStepper order={order} />
                  </div>

                  {/* DATO CRÍTICO: RECUADRO BRILLANTE CON PIN SECRETO DE RETIRO */}
                  {isPickup && order.pickupCode && !isAnulado && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-cyan-50 dark:from-cyan-950/90 dark:via-slate-950 dark:to-slate-950 border-2 border-cyan-500/70 shadow-[0_0_25px_rgba(6,182,212,0.25)] space-y-2 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-700 dark:text-cyan-400 font-black flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
                          PIN SECRETO DE RETIRO
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(order.pickupCode!, order.id + '-pin')}
                            className="text-[10px] text-cyan-800 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-white font-mono font-bold bg-cyan-100 dark:bg-cyan-950/80 px-2.5 py-0.5 rounded border border-cyan-300 dark:border-cyan-700/60 transition cursor-pointer"
                          >
                            {copiedKey === order.id + '-pin' ? '✓ Copiado' : '📋 Copiar'}
                          </button>
                          {(() => {
                            const shortId = order.shortId || order.id?.slice(0, 8);
                            const whatsappText = encodeURIComponent(`¡Hola! Aquí tienes el comprobante de compra en Y2K Store.\n\n🛍️ *Orden:* ${shortId}\n🔐 *PIN Secreto:* ${order.pickupCode}\n\nPreséntalo en la tienda para retirar tu pedido.`);
                            const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
                            return (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-white font-mono font-bold bg-[#25D366] hover:bg-[#1DA851] px-2.5 py-0.5 rounded transition flex items-center gap-1 shadow-sm cursor-pointer"
                                title="Enviar PIN a WhatsApp"
                              >
                                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.185 1.564 5.939l-1.656 6.053 6.195-1.625c1.691.921 3.63 1.445 5.697 1.445 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                                </svg>
                                <span>WhatsApp</span>
                              </a>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="text-center py-1">
                        <span className="font-mono font-black text-3xl sm:text-4xl text-cyan-600 dark:text-cyan-300 tracking-[0.3em] select-all drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
                          {order.pickupCode}
                        </span>
                      </div>

                      <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 text-center leading-relaxed">
                        Muestra este PIN al encargado en Valparaíso para validar y retirar tu pedido.
                      </p>
                    </div>
                  )}

                  {/* DIRECCIÓN DE ENVÍO SI ES COURIER */}
                  {!isPickup && order.shippingAddress && (
                    <div className="p-3 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1">
                      <span className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400 font-bold uppercase block">
                        Destino de Despacho:
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-2">📍 {order.shippingAddress}</p>
                    </div>
                  )}

                  {/* RESUMEN DE PRODUCTOS COMPRADOS */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                      Productos ({items.length})
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800/70 space-y-1.5 max-h-32 overflow-y-auto text-xs font-mono">
                      {items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                          <span className="truncate pr-2">{it.name || 'Producto'}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            ${Number(it.price || 0).toLocaleString('es-CL')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FOOTER DE LA TARJETA: TOTAL Y DETALLES */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block">Total Pagado:</span>
                      <span className="text-base sm:text-lg font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-400 dark:to-emerald-400">
                        ${formattedTotal} CLP
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-[11px] font-mono font-bold transition cursor-pointer shadow-sm"
                    >
                      Ver Comprobante
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE COMPROBANTE DIGITAL DEL PEDIDO */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border-2 border-cyan-500/50 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] space-y-6 relative max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="font-mono font-black text-sm text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950 px-3 py-1 rounded-xl border border-cyan-300 dark:border-cyan-800">
                  {selectedOrder.shortId || `#${selectedOrder.id?.slice(0, 8)}`}
                </span>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">Comprobante Oficial de Compra</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Cerrar comprobante"
              >
                ✕
              </button>
            </div>

            {/* Stepper Visual de Estado dentro del Modal */}
            <OrderStepper order={selectedOrder} />

            {/* PIN en Modal si es Retiro */}
            {selectedOrder.deliveryMethod === 'RETIRO_PRESENCIAL' && selectedOrder.pickupCode && (
              <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-500 text-center space-y-2 shadow-sm dark:shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 font-bold uppercase tracking-widest">
                  PIN DE RETIRO
                </span>
                <div className="font-mono font-black text-3xl text-cyan-700 dark:text-cyan-300 tracking-[0.3em]">
                  {selectedOrder.pickupCode}
                </div>
                <div className="flex justify-center pt-1">
                  {(() => {
                    const shortId = selectedOrder.shortId || selectedOrder.id?.slice(0, 8);
                    const whatsappText = encodeURIComponent(`¡Hola! Aquí tienes el comprobante de compra en Y2K Store.\n\n🛍️ *Orden:* ${shortId}\n🔐 *PIN Secreto:* ${selectedOrder.pickupCode}\n\nPreséntalo en la tienda para retirar tu pedido.`);
                    const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
                    return (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white shadow-md cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.159.57 4.185 1.564 5.939l-1.656 6.053 6.195-1.625c1.691.921 3.63 1.445 5.697 1.445 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                        </svg>
                        <span>Enviar PIN a WhatsApp</span>
                      </a>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Datos de Despacho / Cliente */}
            <div className="bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="text-slate-900 dark:text-white font-bold">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-700 dark:text-slate-300">{selectedOrder.customerEmail}</span>
              </div>
              {selectedOrder.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Teléfono:</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedOrder.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Método:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                  {selectedOrder.deliveryMethod === 'RETIRO_PRESENCIAL' ? 'Retiro en Tienda' : 'Envío a Región'}
                </span>
              </div>
            </div>

            {/* Lista Completa de Productos */}
            <div className="space-y-2 text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                Detalle de Productos
              </span>
              <div className="bg-slate-50 dark:bg-slate-950/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
                {parseCartItems(selectedOrder.cartItems).map((it: any, i: number) => (
                  <div key={i} className="py-2 first:pt-0 last:pb-0 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-xs">{it.name || 'Producto'}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {it.category || ''} {it.size ? `• Talla: ${it.size}` : ''}
                      </p>
                    </div>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      ${Number(it.price || 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Modal */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800 font-mono">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total:</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ${Number(selectedOrder.totalAmount || 0).toLocaleString('es-CL')} CLP
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
