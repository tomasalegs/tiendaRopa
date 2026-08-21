'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import domtoimage from 'dom-to-image';
import { downloadData } from 'aws-amplify/storage';
import type { Schema } from '@/amplify/data/resource';

interface SocialStudioModalProps {
  product: Schema['Product']['type'] | null;
  isOpen: boolean;
  onClose: () => void;
}

type ColorTheme = 'cyber-purple' | 'matrix-cyan' | 'acid-pink' | 'deep-carbon';

export default function SocialStudioModal({ product, isOpen, onClose }: SocialStudioModalProps) {
  const postRef = useRef<HTMLDivElement>(null);

  // Estados de personalización en vivo
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loadingImage, setLoadingImage] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // Controles de diseño
  const [theme, setTheme] = useState<ColorTheme>('cyber-purple');
  const [customBadge, setCustomBadge] = useState<string>('');
  const [showBadge, setShowBadge] = useState<boolean>(true);
  const [showStockInfo, setShowStockInfo] = useState<boolean>(true);
  const [showStoreFooter, setShowStoreFooter] = useState<boolean>(true);

  // Cálculo Dinámico del Descuento
  const discountPercentage = product
    ? (product as any).salePrice && product.price > (product as any).salePrice
      ? Math.round(((product.price - (product as any).salePrice) / product.price) * 100)
      : (product as any).originalPrice && (product as any).originalPrice > product.price
      ? Math.round((((product as any).originalPrice - product.price) / (product as any).originalPrice) * 100)
      : (product as any).discountPercentage
      ? Math.round(Number((product as any).discountPercentage))
      : (product.isOnSale ? 30 : 0)
    : 0;

  // Lista de imágenes disponibles del producto memorizada para evitar re-renderizados continuos
  const availableImages: string[] = useMemo(() => {
    if (!product) return [];
    if (product.imageUrls && product.imageUrls.length > 0) {
      return product.imageUrls.filter(Boolean) as string[];
    }
    if (product.imageUrl) return [product.imageUrl];
    if ((product as any).image) return [(product as any).image];
    return [];
  }, [product]);

  // Ruta aislada de la foto seleccionada
  const photoPath = availableImages[selectedImageIndex] || '';

  // Sincronizar badge inicial según isOnSale y discountPercentage
  useEffect(() => {
    if (product) {
      if (product.isOnSale) {
        setCustomBadge(discountPercentage > 0 ? `-${discountPercentage}% OFF` : '🔥 REMATE');
        setShowBadge(true);
      } else {
        setCustomBadge('⚡ NUEVO DROP');
        setShowBadge(false);
      }
      setSelectedImageIndex(0);
    }
  }, [product?.id, product?.isOnSale, discountPercentage]);

  // Cargar y descargar la imagen de Amplify Storage en Base64 local para evitar Tainted Canvas
  useEffect(() => {
    if (!photoPath) {
      setImageUrl('');
      setLoadingImage(false);
      return;
    }

    let isMounted = true;

    const loadLocalImage = async () => {
      setLoadingImage(true);
      try {
        if (photoPath.startsWith('data:')) {
          if (isMounted) {
            setImageUrl(photoPath);
            setLoadingImage(false);
          }
          return;
        }

        if (photoPath.startsWith('http://') || photoPath.startsWith('https://') || photoPath.startsWith('/')) {
          const response = await fetch(photoPath, { cache: 'no-cache' });
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            if (isMounted) {
              setImageUrl(reader.result as string);
              setLoadingImage(false);
            }
          };
          reader.readAsDataURL(blob);
          return;
        }

        // 1. Descargamos el archivo real de AWS de forma segura
        const { body } = await downloadData({ path: photoPath }).result;
        const blob = await body.blob();

        // 2. Lo convertimos a texto Base64 (Local)
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMounted) {
            setImageUrl(reader.result as string);
            setLoadingImage(false);
          }
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error descargando imagen para Social Studio:', error);
        if (isMounted) {
          setLoadingImage(false);
        }
      }
    };

    loadLocalImage();
    return () => {
      isMounted = false;
    };
  }, [photoPath]);

  // Lógica de Descarga ultra-estable con dom-to-image
  const handleDownload = async () => {
    if (!postRef.current) return;

    // Dimensiones oficiales para Instagram Feed
    const targetWidth = 1080;
    const targetHeight = 1080;
    // Factor de escala para HD (2 = 2160x2160)
    const scale = 2;

    setIsExporting(true);

    try {
      const dataUrl = await domtoimage.toPng(postRef.current, {
        quality: 1,
        width: targetWidth * scale,
        height: targetHeight * scale,
        style: {
          transform: `scale(${scale})`, // Anulamos cualquier scale() previo del UI
          transformOrigin: 'top left',
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          margin: '0'
        }
      });

      const link = document.createElement('a');
      link.download = `y2k-post-${product?.name || 'promo'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error ajustando la escala de la imagen:", error);
      alert("Hubo un error al generar la imagen.");
    } finally {
      setIsExporting(false);
    }
  };

  // Copiar imagen al portapapeles
  const handleCopyToClipboard = async () => {
    if (!postRef.current) return;

    const targetWidth = 1080;
    const targetHeight = 1080;
    const scale = 2; 

    setIsExporting(true);

    try {
      // Usamos toBlob en lugar de toPng para el portapapeles
      const blob = await domtoimage.toBlob(postRef.current, {
         quality: 1,
         width: targetWidth * scale,
         height: targetHeight * scale,
         style: {
           transform: `scale(${scale})`,
           transformOrigin: 'top left',
           width: `${targetWidth}px`,
           height: `${targetHeight}px`,
           margin: '0'
         }
      });

      if (blob) {
        // API nativa para copiar imágenes
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);

        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 3000);
        alert('¡Post copiado con éxito! Ya puedes pegarlo (Ctrl+V) en WhatsApp, Canva o Redes Sociales.');
      }
    } catch (error) {
      console.error("Error al copiar al portapapeles:", error);
      alert("Hubo un error al copiar o tu navegador no lo soporta.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen || !product) return null;

  // Temas de fondo y ambientación
  const themeStyles = {
    'cyber-purple': {
      bg: 'bg-gradient-to-br from-[#0a0a14] via-[#0f172a] to-[#2e0854]',
      radial: 'radial-gradient(circle at 80% 20%, rgba(217,70,239,0.25) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(34,211,238,0.2) 0%, transparent 60%)',
      gridColor: 'rgba(217, 70, 239, 0.08)',
    },
    'matrix-cyan': {
      bg: 'bg-gradient-to-br from-[#031518] via-[#051c24] to-[#0d3b4c]',
      radial: 'radial-gradient(circle at 75% 25%, rgba(6,182,212,0.3) 0%, transparent 60%), radial-gradient(circle at 20% 75%, rgba(16,185,129,0.2) 0%, transparent 60%)',
      gridColor: 'rgba(6, 182, 212, 0.1)',
    },
    'acid-pink': {
      bg: 'bg-gradient-to-br from-[#180414] via-[#24061e] to-[#4c0535]',
      radial: 'radial-gradient(circle at 50% 30%, rgba(244,63,94,0.3) 0%, transparent 70%), radial-gradient(circle at 80% 80%, rgba(217,70,239,0.25) 0%, transparent 60%)',
      gridColor: 'rgba(244, 63, 94, 0.1)',
    },
    'deep-carbon': {
      bg: 'bg-gradient-to-br from-[#05070a] via-[#090d16] to-[#131b2e]',
      radial: 'radial-gradient(circle at 50% 50%, rgba(148,163,184,0.15) 0%, transparent 70%), radial-gradient(circle at 80% 20%, rgba(56,189,248,0.15) 0%, transparent 50%)',
      gridColor: 'rgba(255, 255, 255, 0.05)',
    },
  }[theme];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      {/* Contenedor Principal del Modal */}
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header del Modal */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-fuchsia-500 flex items-center justify-center text-white text-lg shadow-[0_0_15px_rgba(34,211,238,0.5)]">
              📸
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                <span>Social Studio</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase tracking-widest">
                  1080 x 1080 Square Post
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Genera piezas gráficas HD de marketing listas para Instagram, TikTok y WhatsApp Stories.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del Modal: Columna Izquierda (Controles) + Columna Derecha (Preview del Lienzo) */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1">
          {/* PANEL DE CONTROL LATERAL (5 columnas en LG) */}
          <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Información del producto seleccionado */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">
                  Prenda Seleccionada
                </span>
                <h3 className="text-sm font-bold text-white leading-snug">{product.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    ${Number(product.price ?? 0).toLocaleString('es-CL')}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                    {product.category || 'Ropa'}
                  </span>
                  {product.gender && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      {product.gender}
                    </span>
                  )}
                  {product.size && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      Talla: {product.size}
                    </span>
                  )}
                </div>
              </div>

              {/* Selector de Foto si hay múltiples en Galería */}
              {availableImages.length > 1 && (
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    Seleccionar Foto de la Galería ({availableImages.length} disponibles)
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {availableImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedImageIndex === idx
                            ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.6)] font-black'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        <span>Foto #{idx + 1}</span>
                        {selectedImageIndex === idx && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selector de Estilo de Fondo / Gradiente Y2K */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Estilo de Fondo Y2K
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTheme('cyber-purple')}
                    className={`p-2.5 rounded-xl border text-left font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      theme === 'cyber-purple'
                        ? 'bg-purple-950/80 border-fuchsia-500 text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex-shrink-0" />
                    <span>Cyber Purple</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('matrix-cyan')}
                    className={`p-2.5 rounded-xl border text-left font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      theme === 'matrix-cyan'
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex-shrink-0" />
                    <span>Matrix Cyan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('acid-pink')}
                    className={`p-2.5 rounded-xl border text-left font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      theme === 'acid-pink'
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-500 flex-shrink-0" />
                    <span>Acid Pink</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('deep-carbon')}
                    className={`p-2.5 rounded-xl border text-left font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      theme === 'deep-carbon'
                        ? 'bg-slate-900 border-slate-500 text-white shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-slate-600 to-slate-900 flex-shrink-0" />
                    <span>Deep Carbon</span>
                  </button>
                </div>
              </div>

              {/* Control de Etiqueta / Badge Promocional */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300">
                    Etiqueta / Badge Rotado
                  </label>
                  <label className="inline-flex items-center cursor-pointer gap-1.5 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={showBadge}
                      onChange={(e) => setShowBadge(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span>Mostrar Badge</span>
                  </label>
                </div>

                {showBadge && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={customBadge}
                      onChange={(e) => setCustomBadge(e.target.value)}
                      placeholder="Ej. 🔥 REMATE, -30% OFF"
                      className="w-[180px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomBadge('🔥 REMATE')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950 border border-rose-700 text-rose-300 text-[11px] font-mono font-bold hover:bg-rose-900 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Remate
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomBadge('⚡ NUEVO DROP')}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-950 border border-cyan-700 text-cyan-300 text-[11px] font-mono font-bold hover:bg-cyan-900 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Drop
                    </button>
                    <button
                      type="button"
                      disabled={discountPercentage <= 0}
                      onClick={() => setCustomBadge(`-${discountPercentage}% OFF`)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-bold transition-all whitespace-nowrap ${
                        discountPercentage > 0
                          ? 'bg-fuchsia-950/80 border-fuchsia-600 text-fuchsia-300 hover:bg-fuchsia-900 cursor-pointer shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                          : 'bg-slate-900 border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                      }`}
                      title={discountPercentage > 0 ? `Aplicar badge de ${discountPercentage}% descuento` : 'Sin descuento configurado'}
                    >
                      Descuento
                    </button>
                  </div>
                )}
              </div>

              {/* Toggles extras */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer text-slate-300">
                  <span>Mostrar Talla / Color / Género</span>
                  <input
                    type="checkbox"
                    checked={showStockInfo}
                    onChange={(e) => setShowStockInfo(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer text-slate-300">
                  <span>Barra Inferior (Envíos a todo Chile // Link en Bio)</span>
                  <input
                    type="checkbox"
                    checked={showStoreFooter}
                    onChange={(e) => setShowStoreFooter(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                </label>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN (Exportar / Copiar) */}
            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isExporting || loadingImage}
                className="w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Renderizando Post Ultra-HD (2160x2160)...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Descargar Imagen (PNG HD)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyToClipboard}
                disabled={isExporting || loadingImage}
                className="w-full py-2.5 px-4 rounded-xl font-mono font-bold text-xs uppercase tracking-wider text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {copiedNotification ? (
                  <span className="text-emerald-400 font-bold">✓ ¡Copiado al portapapeles!</span>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copiar al Portapapeles</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PREVIEW DEL LIENZO (7 columnas en LG) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-950/80 rounded-2xl border border-slate-800 p-4 relative overflow-hidden min-h-[460px] sm:min-h-[560px]">
            {/* Header del Preview */}
            <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
              <span className="text-[11px] font-mono text-cyan-400 font-bold flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-cyan-900/60 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                VISTA PREVIA EN VIVO
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                1080 x 1080 px (1:1 Ratio)
              </span>
            </div>

            {/* Contenedor del Preview Escalado con CSS transform scale */}
            <div className="w-full flex items-center justify-center my-auto py-6">
              <div
                className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-700 flex-shrink-0"
                style={{
                  width: '450px',
                  height: '450px',
                  maxWidth: '100%',
                  aspectRatio: '1/1',
                }}
              >
                {/* 
                  EL LIENZO EXACTO DE 1080x1080 
                  Se renderiza a 1080px reales y se escala con transform para ajustarse perfectamente al viewport de preview.
                  html2canvas capturará este nodo con todas sus dimensiones y fuentes nítidas.
                */}
                <div
                  ref={postRef}
                  id="social-marketing-post-canvas"
                  style={{
                    width: '1080px',
                    height: '1080px',
                    minWidth: '1080px',
                    minHeight: '1080px',
                    transform: 'scale(0.4166666)', // 450 / 1080 = ~0.416666
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                  className={`w-[1080px] h-[1080px] relative overflow-hidden flex flex-col justify-between p-12 select-none ${themeStyles.bg}`}
                >
                  {/* Capa de Efecto Radial y Gradientes de Luz Neón */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: themeStyles.radial }}
                  />

                  {/* Capa de Cuadrícula Retro-Cyberpunk */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-40"
                    style={{
                      backgroundImage: `linear-gradient(${themeStyles.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${themeStyles.gridColor} 1px, transparent 1px)`,
                      backgroundSize: '40px 40px',
                    }}
                  />

                  {/* Brackets y Marcadores Tecnológicos Y2K en las Esquinas Superiores */}
                  <div className="absolute top-6 left-6 font-mono text-xs font-black text-cyan-400/70 tracking-widest pointer-events-none whitespace-nowrap flex-shrink-0 z-0">
                    ◤ ARCHIVE // 001
                  </div>
                  <div className="absolute top-6 right-6 font-mono text-xs font-black text-fuchsia-400/70 tracking-widest pointer-events-none whitespace-nowrap flex-shrink-0 z-0">
                    SYS:AUTHENTIC ◢
                  </div>

                  {/* ======================================================== */}
                  {/* 1. SECCIÓN SUPERIOR: Logo de la Tienda + Badge Promocional */}
                  {/* ======================================================== */}
                  <div className="relative z-10 flex items-center justify-between w-full pt-2">
                    {/* Logo Y2K STORE con Efecto Neón Glow */}
                    <div className="flex flex-col flex-shrink-0">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,1)] animate-pulse flex-shrink-0" />
                        <h1 className="text-4xl font-black tracking-widest text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] font-sans whitespace-nowrap">
                          Y2K <span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.7)]">STORE</span>
                        </h1>
                      </div>
                      <span className="font-mono text-xs tracking-[0.3em] text-slate-300 font-bold uppercase mt-1 pl-6 whitespace-nowrap">
                        OFFICIAL ARCHIVE // STREETWEAR
                      </span>
                    </div>

                    {/* Badge Rotado (🔥 REMATE / NUEVO DROP / -X% OFF) */}
                    {showBadge && customBadge && (
                      <div className="transform rotate-[-6deg]">
                        <div className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-fuchsia-600 to-rose-600 text-white font-black text-2xl tracking-wider font-mono uppercase shadow-[0_0_30px_rgba(244,63,94,0.9)] border-2 border-white/60">
                          {customBadge}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ======================================================== */}
                  {/* 2. SECCIÓN CENTRAL: Imagen Destacada del Producto (Flotante Transparente) */}
                  {/* ======================================================== */}
                  <div className="relative z-10 w-full flex-1 flex items-center justify-center my-4">
                    {/* Halo de luz difusa detrás del producto */}
                    <div className="absolute w-[580px] h-[580px] rounded-full bg-gradient-to-tr from-cyan-500/20 via-fuchsia-500/20 to-purple-600/25 blur-3xl pointer-events-none" />

                    {loadingImage ? (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
                        <span className="font-mono text-sm text-cyan-300 font-bold tracking-widest animate-pulse">
                          CARGANDO FOTO DE PRODUCTO...
                        </span>
                      </div>
                    ) : imageUrl ? (
                      /* Contenedor Div Estilo Tarjeta Flotante Transparente */
                      <div className="relative p-2 bg-transparent flex items-center justify-center max-h-[750px] max-w-[950px] w-full h-full overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={product.name || 'Prenda'}
                          className="h-[750px] max-h-[750px] max-w-[920px] w-auto object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.8)] filter drop-shadow-[0_0_30px_rgba(6,182,212,0.25)] transition-all duration-300"
                          style={{
                            maxHeight: '750px',
                            maxWidth: '920px',
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-96 h-96 rounded-3xl bg-slate-950/80 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 space-y-3">
                        <span className="text-6xl">👕</span>
                        <span className="font-mono text-base tracking-widest text-slate-400 uppercase">
                          NO_IMAGE_AVAILABLE
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ======================================================== */}
                  {/* 3. SECCIÓN INFERIOR: Nombre, Precio Destacado e Info */}
                  {/* ======================================================== */}
                  <div className="w-full flex flex-col gap-2 mb-4 relative z-10">
                    {/* Caja de información tipo tarjeta translúcida de vidrio */}
                    <div className="p-6 rounded-3xl bg-slate-950/95 border border-slate-700/80 shadow-[0_15px_35px_rgba(0,0,0,0.8)] flex items-end justify-between gap-6">
                      {/* Lado Izquierdo: Categoría + Nombre */}
                      <div className="space-y-2 flex-1">
                        {/* Tags de Categoría y Detalles */}
                        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                          <span className="px-3.5 py-1 rounded-full text-xs font-mono font-black uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] whitespace-nowrap flex-shrink-0">
                            {product.category || 'EXCLUSIVO'}
                          </span>

                          {showStockInfo && (
                            <>
                              {product.gender && (
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-slate-900 text-slate-300 border border-slate-700 whitespace-nowrap flex-shrink-0">
                                  {product.gender}
                                </span>
                              )}
                              {product.size && (
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-slate-900 text-slate-300 border border-slate-700 whitespace-nowrap flex-shrink-0">
                                  Talla: {product.size}
                                </span>
                              )}
                              {product.color && (
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-slate-900 text-slate-300 border border-slate-700 whitespace-nowrap flex-shrink-0">
                                  {product.color}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Nombre del Producto */}
                        <h2 className="text-4xl font-black text-white uppercase tracking-tight line-clamp-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] leading-tight">
                          {product.name}
                        </h2>
                      </div>

                      {/* Lado Derecho: Precio Neón Fucsia Destacado */}
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[11px] font-mono font-bold text-slate-400 tracking-widest uppercase">
                          PRECIO DROP
                        </span>
                        <div className="text-6xl font-black font-mono tracking-tight text-fuchsia-500 drop-shadow-[0_0_20px_rgba(217,70,239,0.8)]">
                          ${Number(product.price ?? 0).toLocaleString('es-CL')}
                        </div>
                      </div>
                    </div>

                    {/* Barra de Enlace & Envíos Inferior */}
                    {showStoreFooter && (
                      <div className="flex items-center justify-between w-full px-4 py-2 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-[10px] sm:text-xs text-slate-300 whitespace-nowrap z-10">
                        <span className="flex items-center gap-2 text-cyan-400 font-bold whitespace-nowrap">
                          <span>📦</span> ENVÍOS A TODO CHILE // RETIRO EN TIENDA
                        </span>
                        <span className="flex items-center gap-2 text-fuchsia-300 font-bold whitespace-nowrap">
                          <span>🔗</span> LINK DIRECTO EN NUESTRO PERFIL
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
