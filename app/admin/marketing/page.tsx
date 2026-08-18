'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import imageCompression from 'browser-image-compression';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'userPool' });

function BannerThumbnail({ imagePath, alt }: { imagePath?: string | null; alt: string }) {
  if (!imagePath) {
    return (
      <div className="w-24 h-14 rounded-lg bg-gray-900 flex items-center justify-center text-[9px] text-gray-500 font-mono border border-slate-700 flex-shrink-0">
        NO_SIGNAL
      </div>
    );
  }

  return (
    <div className="w-24 h-14 rounded-lg overflow-hidden bg-gray-900 border border-slate-700 shadow-sm flex-shrink-0 relative flex items-center justify-center">
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

export default function AdminMarketingPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [banners, setBanners] = useState<Schema['MarketingBanner']['type'][]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badgeText, setBadgeText] = useState('NUEVO DROP');
  const [actionUrl, setActionUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Referencia al input file para limpieza visual
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guardián de seguridad: Solo 'Super_Admin' y 'Admin_Tienda' pueden acceder
  useEffect(() => {
    let isMounted = true;
    async function verifyMarketingClearance() {
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
        console.error('Error verificando privilegios en Marketing:', err);
        router.replace('/admin/escaner');
      }
    }

    verifyMarketingClearance();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Cargar Banners existentes
  async function fetchBanners() {
    try {
      const { data: items } = await client.models.MarketingBanner.list();
      if (items) {
        setBanners(items.filter(Boolean) as Schema['MarketingBanner']['type'][]);
      }
    } catch (error) {
      console.error('Error al cargar banners:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBanners();
  }, []);

  // Guardar Banner
  async function handleGuardarBanner(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);

    try {
      let finalImageUrl = existingImageUrl || '';

      if (file) {
        setSubiendo(true);
        const compressionOptions = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };

        const compressedFile = await imageCompression(file, compressionOptions);
        const path = `public/marketing/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        await uploadData({
          path,
          data: compressedFile,
        }).result;

        finalImageUrl = path;
        setSubiendo(false);
      }

      if (editingBannerId) {
        await client.models.MarketingBanner.update({
          id: editingBannerId,
          title,
          subtitle,
          badgeText,
          actionUrl: actionUrl.trim() || undefined,
          imageUrl: finalImageUrl || undefined,
        });
        setEditingBannerId(null);
      } else {
        await client.models.MarketingBanner.create({
          title,
          subtitle,
          badgeText,
          actionUrl: actionUrl.trim() || undefined,
          imageUrl: finalImageUrl || undefined,
          isActive: true,
        });
      }

      // Reset completo de formulario e input file
      setTitle('');
      setSubtitle('');
      setBadgeText('NUEVO DROP');
      setActionUrl('');
      setFile(null);
      setExistingImageUrl(null);
      setEditingBannerId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchBanners();
    } catch (error: any) {
      console.error('Error detallado en Marketing:', error);
      alert('Error: ' + (error?.message || 'No se pudo guardar el banner. Revisa la consola.'));
    } finally {
      setGuardando(false);
      setSubiendo(false);
    }
  }

  // Toggle estado activo/inactivo
  async function handleToggleActive(banner: Schema['MarketingBanner']['type']) {
    if (!banner.id) return;
    try {
      await client.models.MarketingBanner.update({
        id: banner.id,
        isActive: !banner.isActive,
      });
      await fetchBanners();
    } catch (error) {
      console.error('Error al actualizar estado del banner:', error);
    }
  }

  // Eliminar Banner
  async function handleEliminarBanner(id: string) {
    if (!id) return;
    if (confirm('¿Estás seguro de eliminar este banner publicitario?')) {
      try {
        await client.models.MarketingBanner.delete({ id });
        await fetchBanners();
      } catch (error) {
        console.error('Error al eliminar banner:', error);
      }
    }
  }

  // Editar Banner
  function handlePrepararEdicion(banner: Schema['MarketingBanner']['type']) {
    setEditingBannerId(banner.id);
    setTitle(banner.title || '');
    setSubtitle(banner.subtitle || '');
    setBadgeText(banner.badgeText || 'NUEVO DROP');
    setActionUrl(banner.actionUrl || '');
    setExistingImageUrl(banner.imageUrl || null);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  if (!isAuthorized) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
        <p className="font-mono text-xs text-fuchsia-600 dark:text-fuchsia-400 tracking-wider animate-pulse">
          VERIFICANDO PRIVILEGIOS DE ADMINISTRADOR...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-8 font-sans space-y-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.8)] animate-pulse" />
          <span>Marketing & Banners Dinámicos</span>
        </h1>
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
          Administra las campañas publicitarias, drops, ofertas y enlaces de redirección del Carrusel Hero.
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario Crear / Editar */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-md dark:shadow-xl lg:col-span-1 h-fit space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
              {editingBannerId ? 'Editar Banner' : 'Crear Nuevo Banner'}
            </h2>
            {editingBannerId && (
              <button
                type="button"
                onClick={() => {
                  setEditingBannerId(null);
                  setTitle('');
                  setSubtitle('');
                  setBadgeText('NUEVO DROP');
                  setActionUrl('');
                  setFile(null);
                  setExistingImageUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>

          <form onSubmit={handleGuardarBanner} className="space-y-4 text-xs">
            <div>
              <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Etiqueta / Badge *
              </label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                required
                placeholder="Ej. NUEVO DROP / REMATE 40% OFF / EXCLUSIVO"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm transition-all duration-300 ease-in-out"
              />
            </div>

            <div>
              <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Título Principal *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Ej. FUTURE NOSTALGIA // Y2K STREETWEAR"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 min-h-[44px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm transition-all duration-300 ease-in-out"
              />
            </div>

            <div>
              <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">
                Subtítulo / Bajada
              </label>
              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
                placeholder="Ej. Prendas únicas y zapatillas icónicas curadas para la era digital."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 min-h-[64px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm transition-all duration-300 ease-in-out"
              />
            </div>

            <div>
              <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">
                Enlace de destino (Opcional)
              </label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="Ej. /?categoria=Ropa o /cuenta o /remates"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 min-h-[44px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono text-sm transition-all duration-300 ease-in-out"
              />
            </div>

            <div>
              <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">
                Foto de Fondo (Horizontal / Panorámica)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-400 hover:file:bg-slate-700 cursor-pointer bg-slate-950 p-2 min-h-[44px] rounded-xl border border-slate-700 transition-all duration-300 ease-in-out"
              />

              {file ? (
                <p className="text-xs text-cyan-400 font-bold mt-1.5 flex items-center gap-1">
                  <span>✓</span> {file.name}
                </p>
              ) : existingImageUrl ? (
                <p className="text-[11px] text-slate-400 mt-1">
                  Foto actual guardada. Selecciona una nueva si deseas reemplazarla.
                </p>
              ) : null}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={guardando || subiendo}
                className="w-full min-h-[48px] bg-gradient-to-r from-cyan-600 via-sky-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-bold p-3 rounded-xl transition-all duration-300 ease-in-out shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer uppercase tracking-wider text-xs"
              >
                {subiendo
                  ? 'Subiendo imagen a Storage...'
                  : guardando
                  ? 'Guardando Banner...'
                  : editingBannerId
                  ? 'Actualizar Banner'
                  : 'Publicar Banner'}
              </button>
            </div>
          </form>
        </div>

        {/* Listado de Banners */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Banners del Carrusel</h2>
              <span className="text-xs font-mono text-slate-400">Total: {banners.length} banners configurados</span>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-400 text-xs py-8 text-center animate-pulse">Cargando banners...</p>
          ) : banners.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-mono space-y-2">
              <span className="text-3xl block">🎨</span>
              <p>No hay banners creados aún. El inicio usará el banner de respaldo automático.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    b.isActive
                      ? 'bg-slate-950/80 border-slate-800 hover:border-cyan-500/50 shadow-sm'
                      : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  {/* Visual Preview */}
                  <div className="flex items-center gap-4">
                    <BannerThumbnail imagePath={b.imageUrl} alt={b.title || 'Banner'} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700/60">
                          {b.badgeText || 'PROMO'}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            b.isActive
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.isActive ? 'ACTIVO' : 'PAUSADO'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-1">{b.title}</h3>
                      {b.subtitle && (
                        <p className="text-xs text-slate-400 line-clamp-1">{b.subtitle}</p>
                      )}
                      {b.actionUrl && (
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50 inline-block truncate max-w-xs">
                          🔗 {b.actionUrl}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(b)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                        b.isActive
                          ? 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900'
                      }`}
                    >
                      {b.isActive ? 'Pausar' : 'Activar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrepararEdicion(b)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-mono transition-colors cursor-pointer"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEliminarBanner(b.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/80 text-rose-300 hover:text-white hover:bg-rose-900 text-xs font-mono transition-colors cursor-pointer border border-rose-800/60"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
