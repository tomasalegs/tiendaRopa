'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import AdminSidebar from './AdminSidebar';
import ThemeToggle from '@/components/ThemeToggle';

Amplify.configure(outputs, { ssr: true });

const authFormFields = {
  signUp: {
    name: { order: 1, label: 'Nombre Completo', placeholder: 'Ingresa tu nombre completo', isRequired: true },
    email: { order: 2 },
    password: { order: 3 },
    confirm_password: { order: 4 }
  }
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-cyan-500 selection:text-black font-sans transition-colors duration-200">
      {/* Estilos personalizados para el contenedor de Login de AWS Amplify en modo oscuro Y2K */}
      <style jsx global>{`
        [data-amplify-authenticator] {
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
        [data-amplify-authenticator] input {
          background-color: #020617 !important;
          color: #ffffff !important;
          border: 1px solid #334155 !important;
          border-radius: 0.75rem !important;
        }
        [data-amplify-authenticator] button[type="submit"] {
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
          color: #94a3b8 !important;
          font-weight: 700 !important;
        }
        [data-amplify-authenticator] .amplify-tabs__item--active {
          color: #22d3ee !important;
          border-color: #22d3ee !important;
        }
      `}</style>

      <Authenticator formFields={authFormFields}>
        {({ signOut, user }) => (
          <AdminRBACShell signOut={signOut} user={user}>
            {({ userRole, userGroups, userName, avatarUrl, isSuperAdmin, isAdminTienda, isLogistics }) => {
              const displayName = userName || user?.signInDetails?.loginId?.split('@')[0] || 'Admin';

              return (
                <div className="flex min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-100 relative">
                  {/* Sidebar Responsive */}
                  <AdminSidebar
                    isSidebarOpen={isSidebarOpen}
                    isMobileOpen={isMobileSidebarOpen}
                    onCloseMobile={() => setIsMobileSidebarOpen(false)}
                    userGroups={userGroups}
                    isSuperAdmin={isSuperAdmin}
                    isAdminTienda={isAdminTienda}
                    isLogistics={isLogistics}
                  />

                  {/* Área Principal */}
                  <main className="flex-1 min-h-screen overflow-x-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
                    {/* Header con Botón Toggle a la Izquierda, ThemeToggle, Avatar y Datos de Usuario a la Derecha */}
                    <header className="sticky top-0 z-20 w-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
                      {/* Botón Toggle del Sidebar */}
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined' && window.innerWidth < 768) {
                            setIsMobileSidebarOpen((prev) => !prev);
                          } else {
                            setIsSidebarOpen((prev) => !prev);
                          }
                        }}
                        className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-300 dark:border-slate-800 hover:border-cyan-500/40 transition-all duration-300 ease-in-out cursor-pointer flex items-center justify-center shadow-sm"
                        title="Abrir / Colapsar menú lateral"
                        aria-label="Abrir / Colapsar menú lateral"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>

                      {/* Bloque de Información del Usuario, Theme Toggle y Avatar */}
                      <div className="flex items-center justify-end gap-3 sm:gap-4">
                        {/* Theme Toggle Button (justo a la izquierda del Avatar) */}
                        <ThemeToggle />

                        {/* Avatar del Administrador */}
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-cyan-500 bg-slate-100 dark:bg-slate-900 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)] flex-shrink-0">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-black font-mono text-cyan-600 dark:text-cyan-300 select-none">
                              {displayName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                          <span className="text-slate-400">👤</span>
                          <span className="font-bold text-slate-900 dark:text-white">{displayName}</span>
                        </span>

                        {userRole && (
                          <span
                            className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${userRole === 'Super_Admin'
                                ? 'bg-fuchsia-100 dark:bg-fuchsia-950/80 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-700/60 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
                                : userRole === 'Admin_Tienda'
                                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700/60 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                                  : 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/60 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                              }`}
                          >
                            <span>{userRole === 'Super_Admin' ? '👑' : userRole === 'Admin_Tienda' ? '⚡' : '📦'}</span>
                            <span>{userRole.replace('_', ' ')}</span>
                          </span>
                        )}

                        {signOut && (
                          <button
                            type="button"
                            onClick={signOut}
                            className="bg-rose-100 dark:bg-rose-950/80 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white border border-rose-300 dark:border-rose-800/60 px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow hover:shadow-[0_0_12px_rgba(244,63,94,0.25)]"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Cerrar Sesión</span>
                          </button>
                        )}
                      </div>
                    </header>

                    {/* Contenido de la vista */}
                    <div className="flex-1">
                      {children}
                    </div>
                  </main>
                </div>
              );
            }}
          </AdminRBACShell>
        )}
      </Authenticator>
    </div>
  );
}

function AdminRBACShell({
  children,
  signOut,
  user,
}: {
  children: (props: {
    userRole: string;
    userGroups: string[];
    userName: string;
    avatarUrl: string;
    isSuperAdmin: boolean;
    isAdminTienda: boolean;
    isLogistics: boolean;
  }) => React.ReactNode;
  signOut?: () => void;
  user?: any;
}) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    let isMounted = true;

    async function checkSecurityClearance() {
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || (session.tokens?.idToken?.payload?.['cognito:groups'] as string[]) || [];

        // Obtener el atributo 'name' y 'picture' del perfil de usuario
        try {
          const attributes = await fetchUserAttributes();
          if (isMounted) {
            const fullName = attributes.name || '';
            const firstName = fullName.trim() ? fullName.trim().split(' ')[0] : (user?.signInDetails?.loginId ? user.signInDetails.loginId.split('@')[0] : 'Admin');
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
                console.error('Error cargando avatar admin:', picErr);
              }
            }
          }
        } catch {
          if (isMounted) {
            const fallback = user?.signInDetails?.loginId ? user.signInDetails.loginId.split('@')[0] : 'Admin';
            setUserName(fallback);
          }
        }

        if (!isMounted) return;
        setUserGroups(groups);

        const ALLOWED_ADMIN_ROLES = ['Super_Admin', 'Admin_Tienda', 'Logistica_Operadores'];
        const matchedRole = ALLOWED_ADMIN_ROLES.find((role) => groups.includes(role));

        if (matchedRole) {
          setUserRole(matchedRole);
          setIsAuthorized(true);
          setCheckingAuth(false);
        } else {
          setIsAuthorized(false);
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error('Error al verificar sesión y roles RBAC:', err);
        if (isMounted) {
          setIsAuthorized(false);
          setCheckingAuth(false);
        }
      }
    }

    checkSecurityClearance();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!checkingAuth && !isAuthorized) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.replace('/?error=access_denied');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [checkingAuth, isAuthorized, router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-5 bg-slate-950">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <span className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,1)] animate-pulse" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-xs text-cyan-400 uppercase tracking-widest font-bold">
            SYS://VERIFYING_SECURITY_CLEARANCE...
          </p>
          <p className="font-mono text-[11px] text-slate-500">
            Comprobando tokens de autorización y grupos RBAC de AWS Cognito
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <div className="max-w-lg w-full bg-slate-900/95 border-2 border-rose-500/50 rounded-2xl p-8 shadow-[0_0_40px_rgba(244,63,94,0.25)] space-y-6 text-center backdrop-blur-md relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto text-3xl shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse">
            ✕
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60">
              ACCESO DENEGADO // PRIVILEGIOS INSUFICIENTES
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Sin Permisos de Administrador
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              Tu cuenta ({user?.signInDetails?.loginId || user?.username || 'Usuario'}) no cuenta con privilegios administrativos autorizados.
            </p>
          </div>

          <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 text-left font-mono text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span>Grupo detectado:</span>
              <span className="text-rose-400 font-bold">
                {userGroups.length > 0 ? userGroups.join(', ') : 'Clientes / Sin grupo'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Roles autorizados:</span>
              <span className="text-cyan-400 font-bold">Super_Admin, Admin_Tienda, Logistica</span>
            </div>
          </div>

          <p className="text-xs font-mono text-amber-400/90">
            Redirigiendo a la vitrina principal en <span className="font-bold text-white underline">{countdown}s</span>...
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/?error=access_denied"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              ← Volver a la Tienda
            </Link>
            {signOut && (
              <button
                type="button"
                onClick={signOut}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-mono text-xs font-bold transition cursor-pointer"
              >
                Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isSuperAdmin = userGroups.includes('Super_Admin');
  const isAdminTienda = userGroups.includes('Admin_Tienda');
  const isLogistics = userGroups.includes('Logistica_Operadores');

  return (
    <>
      {children({
        userRole: userRole || 'Admin',
        userGroups,
        userName,
        avatarUrl,
        isSuperAdmin,
        isAdminTienda,
        isLogistics,
      })}
    </>
  );
}
