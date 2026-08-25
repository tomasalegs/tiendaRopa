'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import { listUsers, updateUserRole, ManagedUser, UserRole } from '@/app/actions/userManagement';

// Componente para renderizar la foto de perfil del usuario de Cognito con soporte Storage
function UserAvatar({ picture, name, email }: { picture?: string; name: string; email: string }) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const displayName = name || email.split('@')[0] || 'U';
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    let isMounted = true;
    async function resolvePicture() {
      if (!picture) return;
      if (picture.startsWith('http://') || picture.startsWith('https://') || picture.startsWith('data:')) {
        setResolvedUrl(picture);
        return;
      }
      try {
        const result = await getUrl({ path: picture });
        if (isMounted) {
          setResolvedUrl(result.url.toString());
        }
      } catch (err) {
        console.warn('Error resolviendo avatar de usuario:', err);
      }
    }

    resolvePicture();
    return () => {
      isMounted = false;
    };
  }, [picture]);

  return (
    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-cyan-500 bg-slate-100 dark:bg-slate-900 flex items-center justify-center shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.25)] flex-shrink-0">
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={() => setResolvedUrl('')}
        />
      ) : (
        <span className="text-sm font-black font-mono text-cyan-600 dark:text-cyan-300 select-none">
          {initial}
        </span>
      )}
    </div>
  );
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [isSuperAdminAuthorized, setIsSuperAdminAuthorized] = useState<boolean>(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [updatingUsername, setUpdatingUsername] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Función para cargar los usuarios
  const loadUsersData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await listUsers();
      if (response.success && response.users) {
        setUsers(response.users);
      } else {
        const errMsg = response.error || 'No se pudieron obtener los usuarios de Cognito.';
        setApiError(errMsg);
        setToast({
          type: 'error',
          message: errMsg,
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Error al conectar con el servidor.';
      setApiError(errMsg);
      setToast({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  // Guardián de seguridad: Solo 'Super_Admin' puede acceder a esta página
  useEffect(() => {
    let isMounted = true;
    async function verifySuperAdminClearance() {
      try {
        const session = await fetchAuthSession();
        const groups =
          (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) ||
          (session.tokens?.idToken?.payload?.['cognito:groups'] as string[]) ||
          [];

        if (!groups.includes('Super_Admin')) {
          router.replace('/admin/escaner');
          return;
        }

        if (isMounted) {
          setIsSuperAdminAuthorized(true);
          loadUsersData();
        }
      } catch (err) {
        console.error('Error verificando privilegios de Super_Admin:', err);
        router.replace('/admin/escaner');
      }
    }

    verifySuperAdminClearance();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Autocerrar el toast después de 4 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Manejar cambio de rol
  const handleRoleChange = async (username: string, newRole: UserRole, userEmail: string) => {
    setUpdatingUsername(username);

    startTransition(async () => {
      try {
        const result = await updateUserRole(username, newRole);

        if (result.success) {
          // Actualización optimista de la tabla
          setUsers((prev) =>
            prev.map((u) =>
              u.username === username
                ? {
                    ...u,
                    role: newRole,
                    groups: newRole === 'Cliente' ? [] : [newRole],
                  }
                : u
            )
          );

          const roleLabels: Record<UserRole, string> = {
            Super_Admin: 'Super Administrador 👑',
            Admin_Tienda: 'Admin de Tienda ⚡',
            Logistica_Operadores: 'Operador Logístico 📦',
            Cliente: 'Cliente (Sin grupo)',
          };

          setToast({
            type: 'success',
            message: `¡Rol de "${userEmail}" actualizado a ${roleLabels[newRole]} con éxito!`,
          });
        } else {
          setToast({
            type: 'error',
            message: result.error || 'No se pudo actualizar el rol en Cognito.',
          });
        }
      } catch (err: any) {
        setToast({
          type: 'error',
          message: err?.message || 'Ocurrió un error inesperado al actualizar el rol.',
        });
      } finally {
        setUpdatingUsername(null);
      }
    });
  };

  // Contadores para métricas
  const superAdminCount = users.filter((u) => u.role === 'Super_Admin').length;
  const adminTiendaCount = users.filter((u) => u.role === 'Admin_Tienda').length;
  const logisticaCount = users.filter((u) => u.role === 'Logistica_Operadores').length;
  const clientesCount = users.filter((u) => u.role === 'Cliente').length;

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [users, roleFilter, searchQuery]);

  if (!isSuperAdminAuthorized) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
        <p className="font-mono text-xs text-fuchsia-600 dark:text-fuchsia-400 tracking-wider animate-pulse">
          VERIFICANDO PRIVILEGIOS DE SUPER_ADMIN...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-8 font-sans text-slate-900 dark:text-slate-100 space-y-8">
      {/* Toast Flotante */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 animate-slideUp font-sans text-xs max-w-md ${
            toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
              : 'bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.3)]'
          }`}
        >
          <span className="text-base">{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span className="font-bold">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-auto text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Principal */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <span>Gestión de Accesos y Usuarios</span>
          </h1>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
            Administración de grupos de seguridad RBAC de AWS Cognito y asignación de privilegios de acceso.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadUsersData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-300 dark:border-slate-800 font-mono text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            title="Recargar lista de usuarios"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span>{loading ? 'Consultando...' : 'Actualizar'}</span>
          </button>
          <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-3 py-2 rounded-xl border border-cyan-200 dark:border-cyan-800/60 shadow-sm dark:shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            TOTAL: {users.length} USUARIOS
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Banner de Alerta por Error de Credenciales AWS */}
        {apiError && (
          <div className="p-5 rounded-2xl bg-amber-950/90 border border-amber-500/70 text-amber-200 space-y-3 font-sans shadow-[0_0_25px_rgba(245,158,11,0.25)] animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <h3 className="font-mono font-bold text-xs sm:text-sm text-amber-300 uppercase tracking-wider">
                Configuración de Credenciales AWS Requerida
              </h3>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed font-mono">
              {apiError}
            </p>
            <div className="pt-1 text-xs font-mono text-amber-300/80 bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
              <span className="font-bold text-white block">💡 Cómo solucionarlo en entorno de desarrollo local:</span>
              <p className="text-slate-300">
                1. Crea o edita el archivo <code className="text-cyan-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded">.env.local</code> en la raíz del proyecto.
              </p>
              <p className="text-slate-300">
                2. Agrega las siguientes llaves de acceso AWS IAM:
              </p>
              <div className="bg-slate-900/90 p-3 rounded-lg text-cyan-300 text-[11px] select-all font-mono border border-slate-800 space-y-1">
                <div>AWS_ACCESS_KEY_ID=tu_access_key_id_aqui</div>
                <div>AWS_SECRET_ACCESS_KEY=tu_secret_access_key_aqui</div>
                <div>AWS_REGION=us-east-1</div>
              </div>
            </div>
          </div>
        )}

        {/* Tarjetas de Métricas de Roles (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-fuchsia-600 dark:text-fuchsia-400 font-bold block">
                Super Admin 👑
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {superAdminCount}
              </span>
            </div>
            <span className="p-2.5 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-800/60 text-xl">
              👑
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-purple-600 dark:text-purple-400 font-bold block">
                Admin Tienda ⚡
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {adminTiendaCount}
              </span>
            </div>
            <span className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 text-xl">
              ⚡
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-cyan-600 dark:text-cyan-400 font-bold block">
                Logística 📦
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {logisticaCount}
              </span>
            </div>
            <span className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/60 text-xl">
              📦
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-600 dark:text-slate-400 font-bold block">
                Clientes 🛍️
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {clientesCount}
              </span>
            </div>
            <span className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xl">
              🛍️
            </span>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 w-full overflow-hidden">
          {/* Zona de Filtros (Izquierda) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto overflow-hidden">
            <span className="text-xs font-mono font-bold tracking-widest text-slate-400 dark:text-slate-400 shrink-0">
              FILTRAR ROL:
            </span>

            {/* Botones de Filtro con Scroll Horizontal y Tamaño Forzado */}
            <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setRoleFilter('ALL')}
                className={`!px-3 !py-1.5 rounded-full !text-[11px] font-bold font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  roleFilter === 'ALL'
                    ? '!bg-slate-200 dark:!bg-slate-800 !text-slate-900 dark:!text-white border border-slate-300 dark:border-slate-600 shadow-sm'
                    : 'bg-transparent border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                Todos ({users.length})
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter('Super_Admin')}
                className={`!px-3 !py-1.5 rounded-full !text-[11px] font-bold font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  roleFilter === 'Super_Admin'
                    ? '!bg-fuchsia-100 dark:!bg-fuchsia-950/80 !text-fuchsia-800 dark:!text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-700 shadow-sm'
                    : 'bg-transparent border border-slate-200 dark:border-slate-800 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                Super Admin ({superAdminCount})
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter('Admin_Tienda')}
                className={`!px-3 !py-1.5 rounded-full !text-[11px] font-bold font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  roleFilter === 'Admin_Tienda'
                    ? '!bg-purple-100 dark:!bg-purple-950/80 !text-purple-800 dark:!text-purple-300 border border-purple-300 dark:border-purple-700 shadow-sm'
                    : 'bg-transparent border border-slate-200 dark:border-slate-800 text-purple-600 dark:text-purple-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                Admin Tienda ({adminTiendaCount})
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter('Logistica_Operadores')}
                className={`!px-3 !py-1.5 rounded-full !text-[11px] font-bold font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  roleFilter === 'Logistica_Operadores'
                    ? '!bg-cyan-100 dark:!bg-cyan-950/80 !text-cyan-800 dark:!text-cyan-300 border border-cyan-300 dark:border-cyan-700 shadow-sm'
                    : 'bg-transparent border border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                Logística ({logisticaCount})
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter('Cliente')}
                className={`!px-3 !py-1.5 rounded-full !text-[11px] font-bold font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  roleFilter === 'Cliente'
                    ? '!bg-slate-200 dark:!bg-slate-800 !text-slate-900 dark:!text-white border border-slate-300 dark:border-slate-600 shadow-sm'
                    : 'bg-transparent border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                Clientes ({clientesCount})
              </button>
            </div>
          </div>

          {/* Zona de Búsqueda (Derecha) */}
          <div className="w-full lg:w-72 shrink-0 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por correo o nombre..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md dark:shadow-xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-10 h-10 mx-auto rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
              <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 tracking-wider animate-pulse">
                SYS://CONSULTANDO_REGISTROS_COGNITO...
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl mx-auto text-slate-400">
                👥
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No se encontraron usuarios
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prueba cambiando los filtros de búsqueda o el rol seleccionado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="p-4">Foto</th>
                    <th className="p-4">Nombre Completo</th>
                    <th className="p-4">Correo Electrónico</th>
                    <th className="p-4">Estado Cognito</th>
                    <th className="p-4">Rol Actual (Permisos RBAC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isUpdatingThis = updatingUsername === u.username;

                    return (
                      <tr
                        key={u.username}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          isUpdatingThis ? 'opacity-60 bg-cyan-50/40 dark:bg-cyan-950/20' : ''
                        }`}
                      >
                        {/* Foto */}
                        <td className="p-4">
                          <UserAvatar picture={u.picture} name={u.name} email={u.email} />
                        </td>

                        {/* Nombre */}
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                          <div className="space-y-0.5">
                            <span className="block">{u.name || 'Sin nombre registrado'}</span>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              UID: {u.username.substring(0, 12)}...
                            </span>
                          </div>
                        </td>

                        {/* Correo */}
                        <td className="p-4 font-mono">
                          <span className="text-slate-700 dark:text-slate-300 font-bold block">
                            {u.email}
                          </span>
                        </td>

                        {/* Estado Cognito */}
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              u.status === 'CONFIRMED'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                            }`}
                          >
                            <span>{u.status === 'CONFIRMED' ? '●' : '○'}</span>
                            <span>{u.status || 'ACTIVO'}</span>
                          </span>
                        </td>

                        {/* Menú Desplegable de Rol */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              disabled={isUpdatingThis || isPending}
                              onChange={(e) =>
                                handleRoleChange(u.username, e.target.value as UserRole, u.email)
                              }
                              className={`rounded-xl px-3 py-2 text-xs font-mono font-bold transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer border ${
                                u.role === 'Super_Admin'
                                  ? 'bg-fuchsia-50 dark:bg-fuchsia-950/80 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-700/80 shadow-sm'
                                  : u.role === 'Admin_Tienda'
                                  ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700/80 shadow-sm'
                                  : u.role === 'Logistica_Operadores'
                                  ? 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700/80 shadow-sm'
                                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                              } disabled:opacity-50`}
                            >
                              <option value="Cliente">Cliente (Sin grupo)</option>
                              <option value="Logistica_Operadores">Logistica_Operadores (📦)</option>
                              <option value="Admin_Tienda">Admin_Tienda (⚡)</option>
                              <option value="Super_Admin">Super_Admin (👑)</option>
                            </select>

                            {isUpdatingThis && (
                              <div className="w-4 h-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
