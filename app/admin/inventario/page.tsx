'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { uploadData, downloadData } from 'aws-amplify/storage';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import imageCompression from 'browser-image-compression';
import { removeBackground } from '@imgly/background-removal';
import type { Schema } from '@/amplify/data/resource';
import SocialStudioModal from './SocialStudioModal';

const client = generateClient<Schema>({ authMode: 'userPool' });

function ProductImageThumbnail({ imagePath, alt }: { imagePath?: string | null; alt: string }) {
  if (!imagePath) {
    return (
      <div className="w-11 h-11 rounded-lg bg-gray-900 flex items-center justify-center text-[9px] text-gray-500 font-mono border border-slate-700 flex-shrink-0">
        NO_SIGNAL
      </div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-lg overflow-hidden bg-gray-900 border border-slate-700 shadow-sm flex-shrink-0 flex items-center justify-center">
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

export default function AdminInventarioPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [products, setProducts] = useState<Schema['Product']['type'][]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductForPost, setSelectedProductForPost] = useState<Schema['Product']['type'] | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(1);
  const [category, setCategory] = useState('Ropa');
  const [gender, setGender] = useState('Unisex');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [isOnSale, setIsOnSale] = useState<boolean>(false);
  const [promoType, setPromoType] = useState<string>('descuento'); // 'descuento' o 'remate'
  const [salePrice, setSalePrice] = useState<number | string>('');
  const [creando, setCreando] = useState(false);
  const [prendaEnEdicion, setPrendaEnEdicion] = useState<string | null>(null);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [busqueda, setBusqueda] = useState<string>('');

  // Guardián de seguridad: Solo 'Super_Admin' y 'Admin_Tienda' pueden acceder
  useEffect(() => {
    let isMounted = true;
    async function verifyInventarioClearance() {
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
        console.error('Error verificando privilegios en Inventario:', err);
        router.replace('/admin/escaner');
      }
    }

    verifyInventarioClearance();
    return () => {
      isMounted = false;
    };
  }, [router]);

  async function fetchProducts() {
    try {
      const { data: items } = await client.models.Product.list();
      if (items) {
        setProducts(items.filter(Boolean) as Schema['Product']['type'][]);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setPrendaEnEdicion(null);
    setName('');
    setPrice(0);
    setStock(1);
    setCategory('Ropa');
    setGender('Unisex');
    setSize('');
    setColor('');
    setIsOnSale(false);
    setPromoType('descuento');
    setSalePrice('');
    setFiles([]);
    setExistingImageUrls([]);
  };

  const handleMagicEraser = async () => {
    if (!files || files.length === 0) return;
    setIsProcessingImages(true);

    try {
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          // 1. La IA quita el fondo (Retorna un Blob PNG)
          const transparentBlob = await removeBackground(file);
          const tempFile = new File([transparentBlob], 'temp.png', { type: 'image/png' });

          // 2. Comprimir y convertir a WebP para máxima velocidad web
          const compressionOptions = {
            maxSizeMB: 0.3, // Máximo 300KB
            maxWidthOrHeight: 1200,
            useWebWorker: true,
            fileType: 'image/webp', // Formato moderno con transparencia
          };

          const compressedBlob = await imageCompression(tempFile, compressionOptions);

          // 3. Retornar el archivo final listo para AWS
          const safeName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          return new File([compressedBlob], `y2k-${safeName}-${Date.now()}.webp`, { type: 'image/webp' });
        })
      );

      // Reemplaza el estado con los archivos optimizados
      setFiles(processedFiles);
      alert('¡Fondos eliminados y fotos optimizadas con éxito!');
    } catch (error) {
      console.error('Error procesando imágenes:', error);
      alert('Hubo un error al procesar las imágenes.');
    } finally {
      setIsProcessingImages(false);
    }
  };

  async function handleGuardarPrenda(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);

    try {
      let finalImageUrls = [...existingImageUrls];

      if (files.length > 0) {
        setSubiendoImagen(true);
        const compressionOptions = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };

        const uploadPromises = files.map(async (file) => {
          try {
            const compressedFile = await imageCompression(file, compressionOptions);
            const path = `products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            await uploadData({
              path,
              data: compressedFile,
            }).result;
            return path;
          } catch (uploadErr) {
            console.error('Error subiendo imagen:', uploadErr);
            return null;
          }
        });

        const uploadedPaths = await Promise.all(uploadPromises);
        const validUploadedPaths = uploadedPaths.filter(Boolean) as string[];
        finalImageUrls = [...finalImageUrls, ...validUploadedPaths];
        setSubiendoImagen(false);
      }

      const parsedSalePrice = isOnSale && salePrice !== '' ? Number(salePrice) : undefined;
      const finalPromoType = isOnSale ? promoType : undefined;

      if (prendaEnEdicion) {
        await client.models.Product.update({
          id: prendaEnEdicion,
          name,
          price,
          stock,
          category,
          gender,
          size: size || undefined,
          color: color || undefined,
          imageUrl: finalImageUrls[0] || undefined,
          imageUrls: finalImageUrls,
          isAvailable: stock > 0,
          isOnSale,
          promoType: finalPromoType,
          salePrice: parsedSalePrice,
        });
      } else {
        await client.models.Product.create({
          name,
          price,
          stock,
          category,
          gender,
          size: size || undefined,
          color: color || undefined,
          imageUrl: finalImageUrls[0] || undefined,
          imageUrls: finalImageUrls,
          isAvailable: stock > 0,
          isOnSale,
          promoType: finalPromoType,
          salePrice: parsedSalePrice,
        });
      }

      resetForm();
      setIsSidePanelOpen(false);
      await fetchProducts();
    } catch (error) {
      console.error('Error al guardar el producto:', error);
      alert('Hubo un error al guardar el producto.');
    } finally {
      setCreando(false);
      setSubiendoImagen(false);
    }
  }

  function prepararEdicion(product: Schema['Product']['type']) {
    setPrendaEnEdicion(product.id);
    setName(product.name || '');
    setPrice(product.price || 0);
    setStock(product.stock || 0);
    setCategory(product.category || 'Ropa');
    setGender(product.gender || 'Unisex');
    setSize(product.size || '');
    setColor(product.color || '');
    setIsOnSale(Boolean(product.isOnSale));
    setPromoType(product.promoType || 'descuento');
    setSalePrice(product.salePrice != null ? product.salePrice : '');

    const imgs = product.imageUrls && product.imageUrls.length > 0
      ? (product.imageUrls.filter(Boolean) as string[])
      : product.imageUrl ? [product.imageUrl] : [];

    setExistingImageUrls(imgs);
    setFiles([]);
    setIsSidePanelOpen(true);
  }

  const handleRemoveExistingImage = (idxToRemove: number) => {
    setExistingImageUrls((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleRemoveBackgroundExisting = async (idx: number, photoPath: string) => {
    try {
      setIsProcessingImages(true);

      // 1. Descargar la imagen real de S3 de forma segura (o fetch si es HTTP)
      let originalBlob: Blob;
      if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
        const res = await fetch(photoPath);
        originalBlob = await res.blob();
      } else {
        const { body } = await downloadData({ path: photoPath }).result;
        originalBlob = await body.blob();
      }

      // 2. Aplicar IA para quitar el fondo
      const transparentBlob = await removeBackground(originalBlob);
      const tempFile = new File([transparentBlob], 'temp.png', { type: 'image/png' });

      // 3. Comprimir a WebP
      const compressionOptions = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/webp',
      };
      const compressedBlob = await imageCompression(tempFile, compressionOptions);
      const safeName = photoPath.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'edited';
      const newFile = new File([compressedBlob], `y2k-edited-${safeName}-${Date.now()}.webp`, { type: 'image/webp' });

      // 4. Mover la foto a 'Nuevos Archivos' y sacarla de 'Fotos Actuales'
      setFiles((prev) => [...prev, newFile]);
      setExistingImageUrls((prev) => prev.filter((_, i) => i !== idx));

      alert('¡Fondo eliminado con IA! La foto transparente se subirá y guardará al presionar Actualizar Producto.');
    } catch (error) {
      console.error('Error procesando imagen guardada:', error);
      alert('Hubo un error al quitar el fondo de la foto guardada.');
    } finally {
      setIsProcessingImages(false);
    }
  };

  async function eliminarPrenda(id: string) {
    if (!id) return;
    if (confirm('¿Estás seguro de eliminar este producto del inventario?')) {
      try {
        await client.models.Product.delete({ id });
        await fetchProducts();
      } catch (error) {
        console.error('Error al eliminar el producto:', error);
      }
    }
  }

  const productosFiltrados = products.filter((p) => {
    if (!p) return false;
    const matchCat = filtroCategoria === 'TODAS' || p.category === filtroCategoria;
    const matchBusqueda = !busqueda.trim() || (p.name?.toLowerCase() || '').includes(busqueda.toLowerCase());
    return matchCat && matchBusqueda;
  });

  if (!isAuthorized) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <p className="font-mono text-xs text-cyan-600 dark:text-cyan-400 tracking-wider animate-pulse">
          VERIFICANDO PRIVILEGIOS DE INVENTARIO...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-8 font-sans text-slate-900 dark:text-slate-100 relative">
      {/* Encabezado Principal */}
      <div className="mb-8 pb-4 border-b border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <span>Gestión de Inventario</span>
          </h1>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
            Agrega, edita, actualiza stock y sube fotos de las prendas del catálogo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsSidePanelOpen(true);
          }}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 font-bold py-2.5 px-6 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all transform hover:scale-105 whitespace-nowrap cursor-pointer self-start sm:self-auto text-xs font-mono uppercase tracking-wider"
        >
          + Agregar Producto
        </button>
      </div>

      {/* Tabla de Inventario al 100% de Ancho */}
      <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-md dark:shadow-xl overflow-x-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Inventario Actual</h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Total: {products.length} productos ({productosFiltrados.length} mostrados)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar prenda..."
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />

            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="TODAS">Todas las categorías</option>
              <option value="Ropa">Ropa</option>
              <option value="Zapatillas">Zapatillas</option>
              <option value="Carteras">Carteras</option>
              <option value="Colonias">Colonias</option>
              <option value="Accesorios">Accesorios</option>
              <option value="Gorros">Gorros</option>
              <option value="Cosmética">Cosmética</option>
            </select>
          </div>
        </div>

        {loadingProducts ? (
          <p className="text-slate-400 text-xs py-8 text-center animate-pulse">Cargando base de datos...</p>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs">
            No se encontraron productos coincidentes con los filtros aplicados.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <th className="p-3">Foto</th>
                <th className="p-3">Producto</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Detalles</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {productosFiltrados.map((p, index) => {
                const primaryThumb = p?.imageUrls?.[0] || p?.imageUrl;
                const galleryCount = p?.imageUrls?.length || (p?.imageUrl ? 1 : 0);

                return (
                  <tr key={p?.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      <div className="relative inline-block">
                        <ProductImageThumbnail imagePath={primaryThumb} alt={p?.name || 'Producto'} />
                        {galleryCount > 1 && (
                          <span className="absolute -bottom-1 -right-1 bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 text-[9px] font-bold px-1 rounded">
                            +{galleryCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{p?.name || 'Sin nombre'}</span>
                        {p?.isOnSale && (
                          <span className={`border text-[9px] font-mono font-black px-1.5 py-0.5 rounded shadow-sm animate-pulse ${
                            p.promoType === 'remate'
                              ? 'bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-600/70 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                              : 'bg-fuchsia-100 dark:bg-fuchsia-950/90 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-600/70 shadow-[0_0_8px_rgba(217,70,239,0.4)]'
                          }`}>
                            {p.promoType === 'remate' ? '🔥 REMATE' : '🏷️ REBAJA'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 text-[10px] font-bold px-2 py-0.5 rounded">
                        {p?.category || 'General'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">
                      {p?.isOnSale && p?.salePrice ? (
                        <div className="flex flex-col">
                          <span className="text-rose-600 dark:text-rose-400 font-black">${Number(p.salePrice).toLocaleString('es-CL')}</span>
                          <span className="text-[10px] text-slate-400 line-through">${Number(p?.price ?? 0).toLocaleString('es-CL')}</span>
                        </div>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">${Number(p?.price ?? 0).toLocaleString('es-CL')}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          (p?.stock ?? 0) <= 0
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/50 animate-pulse'
                            : (p?.stock ?? 0) <= 2
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/50'
                        }`}
                      >
                        {p?.stock ?? 0}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">
                      {p?.size ? `Talla: ${p.size} ` : ''}
                      {p?.color ? `• ${p.color} ` : ''}
                      {p?.gender ? `• ${p.gender}` : ''}
                      {!p?.size && !p?.color && !p?.gender ? '-' : ''}
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedProductForPost(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white border border-cyan-700/60 font-mono font-bold text-[11px] shadow-sm hover:shadow-[0_0_10px_rgba(6,182,212,0.4)] transition-all cursor-pointer mr-1"
                        title="Generar post para Instagram / TikTok"
                      >
                        <span>📸</span>
                        <span>Crear Post</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => prepararEdicion(p)}
                        className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-semibold cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => p?.id && eliminarPrenda(p.id)}
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-semibold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Overlay oscuro (Fondo del Panel Lateral) */}
      {isSidePanelOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity cursor-pointer"
          onClick={() => setIsSidePanelOpen(false)}
        />
      )}

      {/* Panel Lateral Derecho (Slide-over) para Agregar / Editar Producto */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isSidePanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-widest">
              {prendaEnEdicion ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}
            </h2>
            <button
              type="button"
              onClick={() => setIsSidePanelOpen(false)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleGuardarPrenda} className="space-y-4 text-xs">
            <div>
              <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Nombre del producto *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm transition-all duration-300 ease-in-out"
                placeholder="Ej. Zapatillas Y2K Skate / Polerón Vintage"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Precio ($ CLP) *</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  required
                  min={0}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono text-sm transition-all duration-300 ease-in-out"
                />
              </div>
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Stock *</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  required
                  min={0}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono text-sm transition-all duration-300 ease-in-out"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 text-sm transition-all duration-300 ease-in-out"
                >
                  <option value="Ropa">Ropa</option>
                  <option value="Zapatillas">Zapatillas</option>
                  <option value="Carteras">Carteras</option>
                  <option value="Colonias">Colonias</option>
                  <option value="Accesorios">Accesorios</option>
                  <option value="Gorros">Gorros / Jockeis</option>
                  <option value="Cosmética">Cosmética</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Género</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 text-sm transition-all duration-300 ease-in-out"
                >
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Unisex">Unisex</option>
                  <option value="Infantil">Infantil</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {category === 'Colonias' || category === 'Cosmética' ? 'Volumen (Opc.)' : 'Talla (Opc.)'}
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 text-sm transition-all duration-300 ease-in-out"
                  placeholder={category === 'Colonias' || category === 'Cosmética' ? 'Ej. 100ml' : 'Ej. M, 42'}
                />
              </div>
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Color (Opc.)</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[44px] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 text-sm transition-all duration-300 ease-in-out"
                  placeholder="Ej. Negro / Cromo"
                />
              </div>
            </div>

            {/* Contenedor del Switch Principal de Promoción */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-slate-900 dark:text-white font-bold text-xs">Activar Promoción</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Visible en carrusel y filtros</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOnSale}
                  onChange={(e) => setIsOnSale(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-500 shadow-sm"></div>
              </label>
            </div>

            {/* Controles de Promoción (Solo si el switch está ON) */}
            {isOnSale && (
              <div className="mt-2 p-4 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl animate-fade-in-down space-y-4">
                <div>
                  <label className="block text-xs text-fuchsia-600 dark:text-fuchsia-300 font-mono tracking-wider mb-2 font-bold">
                    TIPO DE PROMOCIÓN *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-slate-800 dark:text-white text-sm cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="promoType"
                        value="descuento"
                        checked={promoType === 'descuento'}
                        onChange={(e) => setPromoType(e.target.value)}
                        className="accent-fuchsia-500"
                      />
                      Rebaja / Descuento
                    </label>
                    <label className="flex items-center gap-2 text-slate-800 dark:text-white text-sm cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="promoType"
                        value="remate"
                        checked={promoType === 'remate'}
                        onChange={(e) => setPromoType(e.target.value)}
                        className="accent-fuchsia-500"
                      />
                      🔥 Remate Final
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-fuchsia-600 dark:text-fuchsia-300 font-mono tracking-wider mb-2 font-bold">
                    PRECIO REBAJADO ($ CLP) *
                  </label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="Ej. 19990"
                    min={0}
                    className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white outline-none focus:border-fuchsia-500 font-mono text-sm shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* Subida de Múltiples Imágenes (Galería) */}
            <div>
              <label className="block font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Fotos del producto (Múltiples / Galería)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setFiles(Array.from(e.target.files));
                  }
                }}
                className="w-full text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-slate-800 file:text-cyan-700 dark:file:text-cyan-400 hover:file:bg-slate-300 dark:hover:file:bg-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-950 p-2 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 transition-all duration-300 ease-in-out"
              />

              {/* Botón de Borrador Mágico con IA + Compresión WebP */}
              <button
                type="button"
                onClick={handleMagicEraser}
                disabled={isProcessingImages || files.length === 0}
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white font-bold py-2.5 px-4 rounded-xl mt-3 w-full shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono tracking-wider"
              >
                {isProcessingImages ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>🪄 Recortando y Comprimiendo...</span>
                  </>
                ) : (
                  <>
                    <span>🪄</span>
                    <span>Quitar Fondos antes de subir</span>
                  </>
                )}
              </button>

              {files.length > 0 ? (
                <p className="text-xs text-cyan-600 dark:text-cyan-400 font-bold mt-2 flex items-center gap-1">
                  <span>✓</span> {files.length} {files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
                </p>
              ) : existingImageUrls.length > 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  {existingImageUrls.length} {existingImageUrls.length === 1 ? 'foto guardada' : 'fotos guardadas'}. Selecciona fotos si deseas agregar más.
                </p>
              ) : null}

              {/* Galería de Fotos Existentes en Base de Datos / S3 */}
              {prendaEnEdicion && existingImageUrls.length > 0 && (
                <div className="mt-4 mb-4">
                  <h4 className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-mono">
                    Fotos Actuales en Base de Datos
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {existingImageUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center p-2 min-h-[128px]"
                      >
                        {url.startsWith('http') || url.startsWith('blob:') ? (
                          <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-32 object-contain" />
                        ) : (
                          <StorageImage path={url} alt={`Foto ${idx + 1}`} className="w-full h-32 object-contain" />
                        )}

                        {/* Acciones flotantes en la imagen (Quitar fondo + Eliminar) */}
                        <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleRemoveBackgroundExisting(idx, url)}
                            disabled={isProcessingImages}
                            className="bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white p-1.5 rounded-lg shadow-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                            title="Borrador Mágico (Quitar Fondo con IA)"
                          >
                            🪄
                          </button>
                        </div>

                        {/* Botón para Eliminar Foto */}
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingImage(idx)}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow text-xs"
                          title="Eliminar esta foto"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={creando || subiendoImagen}
                className="flex-1 min-h-[48px] bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-bold p-3 rounded-xl transition-all duration-300 ease-in-out shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer uppercase tracking-wider text-xs"
              >
                {subiendoImagen
                  ? `Subiendo ${files.length} fotos a Storage...`
                  : creando
                  ? 'Guardando...'
                  : prendaEnEdicion
                  ? 'Actualizar Producto'
                  : 'Crear Producto'}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsSidePanelOpen(false);
                }}
                className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal del Generador de Marketing para Redes Sociales */}
      <SocialStudioModal
        product={selectedProductForPost}
        isOpen={!!selectedProductForPost}
        onClose={() => setSelectedProductForPost(null)}
      />
    </div>
  );
}
