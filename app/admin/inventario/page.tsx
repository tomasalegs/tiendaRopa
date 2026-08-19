'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
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
  const [creando, setCreando] = useState(false);

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
  const [prendaEnEdicion, setPrendaEnEdicion] = useState<string | null>(null);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [busqueda, setBusqueda] = useState<string>('');

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
        });
        setPrendaEnEdicion(null);
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
        });
      }

      // Reset
      setName('');
      setPrice(0);
      setStock(1);
      setCategory('Ropa');
      setGender('Unisex');
      setSize('');
      setColor('');
      setIsOnSale(false);
      setFiles([]);
      setExistingImageUrls([]);
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

    const imgs = product.imageUrls && product.imageUrls.length > 0
      ? (product.imageUrls.filter(Boolean) as string[])
      : product.imageUrl ? [product.imageUrl] : [];

    setExistingImageUrls(imgs);
    setFiles([]);
  }

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
    <div className="w-full p-4 sm:p-8 font-sans text-slate-900 dark:text-slate-100">
      <div className="mb-8 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
          <span>Gestión de Inventario</span>
        </h1>
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
          Agrega, edita, actualiza stock y sube fotos de las prendas del catálogo.
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario Crear / Editar */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-md dark:shadow-xl lg:col-span-1 h-fit space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400"></span>
              {prendaEnEdicion ? 'Editar Producto' : 'Agregar al Inventario'}
            </h2>
            {prendaEnEdicion && (
              <button
                type="button"
                onClick={() => {
                  setPrendaEnEdicion(null);
                  setName('');
                  setPrice(0);
                  setStock(1);
                  setCategory('Ropa');
                  setGender('Unisex');
                  setSize('');
                  setColor('');
                  setFiles([]);
                  setExistingImageUrls([]);
                }}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancelar
              </button>
            )}
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

            {/* Toggle de Producto en Remate / Oferta */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-base">🔥</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white text-xs block">Producto en Remate / Oferta</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Visible al filtrar por promociones</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOnSale}
                  onChange={(e) => setIsOnSale(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-rose-600 peer-checked:to-fuchsia-600 shadow-[0_0_10px_rgba(244,63,94,0.3)]"></div>
              </label>
            </div>

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
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={creando || subiendoImagen}
                className="w-full min-h-[48px] bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-bold p-3 rounded-xl transition-all duration-300 ease-in-out shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer uppercase tracking-wider text-xs"
              >
                {subiendoImagen
                  ? `Subiendo ${files.length} fotos a Storage...`
                  : creando
                  ? 'Guardando...'
                  : prendaEnEdicion
                  ? 'Actualizar Producto'
                  : 'Crear Producto'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla de Inventario */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-md dark:shadow-xl lg:col-span-2 overflow-x-auto space-y-4">
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
                            <span className="bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-600/70 text-[9px] font-mono font-black px-1.5 py-0.5 rounded shadow-sm dark:shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse">
                              🔥 OFERTA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 text-[10px] font-bold px-2 py-0.5 rounded">
                          {p?.category || 'General'}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">${Number(p?.price ?? 0).toLocaleString('es-CL')}</td>
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
