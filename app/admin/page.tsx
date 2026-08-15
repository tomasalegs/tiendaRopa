'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { generateClient } from 'aws-amplify/data';
import { uploadData, getUrl } from 'aws-amplify/storage';
import imageCompression from 'browser-image-compression';
import type { Schema } from '@/amplify/data/resource';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-black">
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

      <div className="flex min-h-screen items-center justify-center p-4">
        <Authenticator>
          {({ signOut, user }) => (
            <div className="w-full">
              <AdminContent signOut={signOut} user={user} />
            </div>
          )}
        </Authenticator>
      </div>
    </div>
  );
}

function ProductImageThumbnail({ imagePath, alt }: { imagePath?: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!imagePath) {
      setUrl(null);
      setLoading(false);
      return;
    }

    getUrl({ path: imagePath })
      .then((res) => {
        if (isMounted) {
          setUrl(res.url.toString());
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error al obtener URL de la imagen:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [imagePath]);

  if (!imagePath) {
    return (
      <div className="w-11 h-11 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 border border-slate-700">
        Sin foto
      </div>
    );
  }

  if (loading) {
    return <div className="w-11 h-11 rounded-lg bg-slate-800 animate-pulse border border-slate-700" />;
  }

  if (!url) {
    return (
      <div className="w-11 h-11 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-rose-400 border border-slate-700">
        Error
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="w-11 h-11 rounded-lg object-cover border border-slate-700 shadow-sm"
    />
  );
}

function AdminContent({ signOut, user }: { signOut?: () => void; user?: any }) {
  // Pestañas activas: 'dashboard' (por defecto) | 'inventario' | 'pedidos'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventario' | 'pedidos'>('dashboard');

  // Estados de Inventario
  const [products, setProducts] = useState<Schema['Product']['type'][]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Estados de Pedidos
  const [orders, setOrders] = useState<Schema['Order']['type'][]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Schema['Order']['type'] | null>(null);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'PENDIENTE' | 'PAGADO' | 'CANCELADO'>('ALL');

  // Estados del Formulario de Productos (Múltiples Fotos)
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(1);
  const [category, setCategory] = useState('Ropa');
  const [gender, setGender] = useState('Unisex');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  const [creando, setCreando] = useState(false);
  const [prendaEnEdicion, setPrendaEnEdicion] = useState<string | null>(null);

  // Cargar Inventario
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

  // Cargar Pedidos en tiempo real usando observeQuery ordenados por fecha descendente
  useEffect(() => {
    const sub = client.models.Order.observeQuery().subscribe({
      next: ({ items }) => {
        const sorted = [...(items || [])].filter(Boolean).sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setOrders(sorted as Schema['Order']['type'][]);
        setLoadingOrders(false);
      },
      error: (err) => {
        console.error('Error al observar pedidos:', err);
        setLoadingOrders(false);
      },
    });

    return () => sub.unsubscribe();
  }, []);

  // --- CÁLCULO DE MÉTRICAS ANALÍTICAS (DASHBOARD) ---
  const metrics = useMemo(() => {
    // 1. Ventas Totales: suma de totalAmount de pedidos con status 'PAGADO'
    const totalSales = orders
      .filter((o) => o?.status === 'PAGADO')
      .reduce((acc, curr) => acc + (Number(curr?.totalAmount) || 0), 0);

    // 2. Pedidos Pendientes
    const pendingOrdersList = orders.filter((o) => o?.status === 'PENDIENTE');

    // 3. Productos con Bajo Stock (<= 2 unidades)
    const lowStockList = products.filter((p) => (p?.stock ?? 0) <= 2);

    // 4. Total en Inventario (Valorización: precio x stock)
    const inventoryValue = products.reduce((acc, curr) => {
      const pPrice = Number(curr?.price) || 0;
      const pStock = Number(curr?.stock) || 0;
      return acc + pPrice * pStock;
    }, 0);

    // Total de unidades físicas
    const totalUnits = products.reduce((acc, curr) => acc + (Number(curr?.stock) || 0), 0);

    return {
      totalSales,
      pendingOrders: pendingOrdersList,
      pendingCount: pendingOrdersList.length,
      lowStockProducts: lowStockList,
      lowStockCount: lowStockList.length,
      inventoryValue,
      totalUnits,
    };
  }, [orders, products]);

  // Manejador para Guardar / Actualizar Producto con Múltiples Imágenes
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
          fileType: 'image/webp' as const,
        };

        const uploadedPaths = await Promise.all(
          files.map(async (fileItem, idx) => {
            let processedFile: File | Blob = fileItem;
            try {
              processedFile = await imageCompression(fileItem, compressionOptions);
            } catch (compError) {
              console.warn('Advertencia al comprimir imagen, subiendo original:', compError);
            }

            // Sanitizar nombre y asegurar extensión .webp para S3
            const rawName = fileItem.name.replace(/\.[^/.]+$/, '');
            const cleanName = rawName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || `foto_${idx}`;
            const imagePath = `product-images/${Date.now()}-${idx}-${cleanName}.webp`;

            await uploadData({
              path: imagePath,
              data: processedFile,
              options: {
                contentType: 'image/webp',
              },
            }).result;
            return imagePath;
          })
        );

        finalImageUrls = prendaEnEdicion && existingImageUrls.length > 0
          ? [...existingImageUrls, ...uploadedPaths]
          : uploadedPaths;

        setSubiendoImagen(false);
      }

      const primaryImageUrl = finalImageUrls[0] || null;

      if (prendaEnEdicion) {
        await client.models.Product.update({
          id: prendaEnEdicion,
          name,
          price: Number(price),
          stock: Number(stock),
          category,
          gender,
          size,
          color,
          imageUrl: primaryImageUrl,
          imageUrls: finalImageUrls,
        });
        setPrendaEnEdicion(null);
      } else {
        await client.models.Product.create({
          name,
          price: Number(price),
          stock: Number(stock),
          category,
          gender,
          size,
          color,
          imageUrl: primaryImageUrl,
          imageUrls: finalImageUrls,
          isAvailable: Number(stock) > 0,
        });
      }

      setName('');
      setPrice(0);
      setStock(1);
      setCategory('Ropa');
      setGender('Unisex');
      setSize('');
      setColor('');
      setFiles([]);
      setExistingImageUrls([]);

      await fetchProducts();
    } catch (error) {
      console.error('Error al guardar el producto:', error);
    } finally {
      setCreando(false);
      setSubiendoImagen(false);
    }
  }

  function prepararEdicion(product: Schema['Product']['type']) {
    if (!product) return;
    setPrendaEnEdicion(product.id);
    setName(product.name || '');
    setPrice(product.price ?? 0);
    setStock(product.stock ?? 1);
    setCategory(product.category || 'Ropa');
    setGender(product.gender || 'Unisex');
    setSize(product.size || '');
    setColor(product.color || '');

    const imgs = (product.imageUrls && product.imageUrls.length > 0)
      ? (product.imageUrls.filter(Boolean) as string[])
      : product.imageUrl ? [product.imageUrl] : [];

    setExistingImageUrls(imgs);
    setFiles([]);
    setActiveTab('inventario');
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

  // --- ACCIONES DE PEDIDOS ---

  async function handleMarcarComoPagado(orderId: string) {
    if (!orderId) return;
    setActionLoadingOrderId(orderId);

    try {
      await client.models.Order.update({
        id: orderId,
        status: 'PAGADO',
      });
      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails((prev) => (prev ? { ...prev, status: 'PAGADO' } : null));
      }
    } catch (err) {
      console.error('Error al marcar pedido como pagado:', err);
      alert('Hubo un error al actualizar el estado del pedido.');
    } finally {
      setActionLoadingOrderId(null);
    }
  }

  async function handleCancelarYDevolverStock(order: Schema['Order']['type']) {
    if (!order || !order.id) return;

    const formattedPrice = Number(order.totalAmount).toLocaleString('es-CL');
    const confirmMessage = `¿Estás seguro de cancelar este pedido y restaurar el inventario?\n\n• Pedido: #${order.id}\n• Cliente: ${order.customerName}\n• Total: $${formattedPrice}\n\nLos productos regresarán automáticamente al stock disponible.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActionLoadingOrderId(order.id);

    try {
      await client.models.Order.update({
        id: order.id,
        status: 'CANCELADO',
      });

      let itemsList: Array<{ id: string; name?: string; price?: number }> = [];
      if (order.cartItems) {
        if (typeof order.cartItems === 'string') {
          try {
            itemsList = JSON.parse(order.cartItems);
          } catch (pErr) {
            console.error('Error al parsear cartItems:', pErr);
          }
        } else if (Array.isArray(order.cartItems)) {
          itemsList = order.cartItems as any[];
        }
      }

      const returnMap: Record<string, number> = {};
      for (const item of itemsList) {
        if (item?.id) {
          returnMap[item.id] = (returnMap[item.id] || 0) + 1;
        }
      }

      for (const [productId, qtyToReturn] of Object.entries(returnMap)) {
        try {
          const { data: prod } = await client.models.Product.get({ id: productId });
          if (prod) {
            const currentStock = prod.stock ?? 0;
            const newStock = currentStock + qtyToReturn;

            await client.models.Product.update({
              id: productId,
              stock: newStock,
              isAvailable: true,
            });
          }
        } catch (prodErr) {
          console.error(`Error al restaurar stock para producto ${productId}:`, prodErr);
        }
      }

      await fetchProducts();

      if (selectedOrderDetails?.id === order.id) {
        setSelectedOrderDetails((prev) => (prev ? { ...prev, status: 'CANCELADO' } : null));
      }
    } catch (err) {
      console.error('Error al cancelar pedido y devolver stock:', err);
      alert('Hubo un error al cancelar el pedido.');
    } finally {
      setActionLoadingOrderId(null);
    }
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

  const paidOrdersCount = orders.filter((o) => o?.status === 'PAGADO').length;
  const canceledOrdersCount = orders.filter((o) => o?.status === 'CANCELADO').length;

  const filteredOrders = orders.filter((o) => {
    if (!o) return false;
    if (orderFilter === 'ALL') return true;
    return o.status === orderFilter;
  });

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      {/* Encabezado Principal */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-800/90">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
            title="Ir a la tienda principal"
          >
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
            <span className="text-xl sm:text-2xl font-black tracking-widest text-white group-hover:text-cyan-400 transition-colors">
              Y2K <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">ADMIN</span>
            </span>
          </Link>
          <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
            Centro de Control
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {user && (
            <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              👤 {user.signInDetails?.loginId || user.username || 'Admin'}
            </span>
          )}

          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
          >
            ← Ver Tienda
          </Link>

          <button
            onClick={signOut}
            className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/60 px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Selector de Pestañas (Tabs) con 3 Secciones: Dashboard | Inventario | Pedidos */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-px overflow-x-auto">
          {/* Pestaña 1: Dashboard (Por Defecto) */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 border-t border-x cursor-pointer flex-shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-cyan-400 border-slate-700 shadow-lg border-b-2 border-b-slate-900 -mb-px'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Dashboard</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              Métricas
            </span>
          </button>

          {/* Pestaña 2: Inventario */}
          <button
            onClick={() => setActiveTab('inventario')}
            className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 border-t border-x cursor-pointer flex-shrink-0 ${
              activeTab === 'inventario'
                ? 'bg-slate-900 text-cyan-400 border-slate-700 shadow-lg border-b-2 border-b-slate-900 -mb-px'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Inventario</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {products.length}
            </span>
          </button>

          {/* Pestaña 3: Gestión de Pedidos */}
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 border-t border-x cursor-pointer flex-shrink-0 ${
              activeTab === 'pedidos'
                ? 'bg-slate-900 text-cyan-400 border-slate-700 shadow-lg border-b-2 border-b-slate-900 -mb-px'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <svg className="w-4 h-4 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>Gestión de Pedidos</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {orders.length}
            </span>

            {metrics.pendingCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {metrics.pendingCount} {metrics.pendingCount === 1 ? 'pendiente' : 'pendientes'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* CONTENIDO TAB 1: DASHBOARD ANALÍTICO */}
      {activeTab === 'dashboard' && (
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Tarjetas de Métricas Clave (Grid de 4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Ventas Totales */}
            <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 shadow-[0_0_25px_rgba(16,185,129,0.1)] relative overflow-hidden group hover:border-emerald-500/60 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">Ventas Totales</span>
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                ${metrics.totalSales.toLocaleString('es-CL')}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400/90 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>{paidOrdersCount} {paidOrdersCount === 1 ? 'pedido pagado' : 'pedidos pagados'}</span>
              </div>
            </div>

            {/* Card 2: Pedidos Pendientes */}
            <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-amber-950/30 border border-amber-500/30 rounded-2xl p-5 shadow-[0_0_25px_rgba(245,158,11,0.1)] relative overflow-hidden group hover:border-amber-500/60 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">Pedidos Pendientes</span>
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                {metrics.pendingCount}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/90 font-medium">
                {metrics.pendingCount > 0 ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="text-amber-300 font-bold">Requiere verificación de pago</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span className="text-slate-400">Todos los pedidos al día</span>
                  </>
                )}
              </div>
            </div>

            {/* Card 3: Productos con Bajo Stock */}
            <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-rose-950/30 border border-rose-500/30 rounded-2xl p-5 shadow-[0_0_25px_rgba(244,63,94,0.1)] relative overflow-hidden group hover:border-rose-500/60 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Bajo Stock</span>
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                {metrics.lowStockCount}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400/90 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Prendas con stock ≤ 2</span>
              </div>
            </div>

            {/* Card 4: Total en Inventario (Valorización) */}
            <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_25px_rgba(6,182,212,0.1)] relative overflow-hidden group hover:border-cyan-500/60 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">Total Inventario</span>
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                ${metrics.inventoryValue.toLocaleString('es-CL')}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan-400/90 font-medium">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span>{metrics.totalUnits} un. en {products.length} productos</span>
              </div>
            </div>
          </div>

          {/* LISTA DE ALERTAS Y ACCIONES REQUERIDAS (2 Columnas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Panel A: Pedidos Pendientes de Pago */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Pedidos Pendientes de Confirmación ({metrics.pendingCount})
                  </h3>
                </div>
                {metrics.pendingCount > 0 && (
                  <button
                    onClick={() => {
                      setOrderFilter('PENDIENTE');
                      setActiveTab('pedidos');
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
                  >
                    Gestionar todos →
                  </button>
                )}
              </div>

              {metrics.pendingCount === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl mx-auto text-emerald-400">
                    ✓
                  </div>
                  <p className="text-xs font-bold text-slate-300">¡No hay pedidos pendientes por revisar!</p>
                  <p className="text-[11px] text-slate-500">Los nuevos pedidos por transferencia bancaria aparecerán aquí.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {metrics.pendingOrders.slice(0, 5).map((order) => {
                    const items = parseCartItems(order.cartItems);
                    const formattedDate = order.createdAt
                      ? new Date(order.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                      : 'Hoy';

                    return (
                      <div
                        key={order.id}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/20 hover:border-amber-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{order.customerName}</span>
                            <span className="text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">
                              {formattedDate}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {items.length} {items.length === 1 ? 'producto' : 'productos'} • Tel: {order.customerPhone}
                          </p>
                          <p className="font-mono text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                            ${Number(order.totalAmount ?? 0).toLocaleString('es-CL')} CLP
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrderDetails(order)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                          >
                            Ver Detalle
                          </button>
                          <button
                            onClick={() => handleMarcarComoPagado(order.id)}
                            disabled={actionLoadingOrderId === order.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)] disabled:opacity-50"
                          >
                            {actionLoadingOrderId === order.id ? '...' : 'Aprobar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panel B: Alerta de Productos con Stock Crítico (≤ 2) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse"></span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Stock Crítico / Por Agotarse ({metrics.lowStockCount})
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('inventario')}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer"
                >
                  Ver inventario →
                </button>
              </div>

              {metrics.lowStockCount === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl mx-auto text-cyan-400">
                    📦
                  </div>
                  <p className="text-xs font-bold text-slate-300">¡Inventario en estado óptimo!</p>
                  <p className="text-[11px] text-slate-500">Todos los productos tienen 3 o más unidades disponibles.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {metrics.lowStockProducts.slice(0, 6).map((product) => {
                    const currentStock = product?.stock ?? 0;
                    const primaryThumb = product?.imageUrls?.[0] || product?.imageUrl;

                    return (
                      <div
                        key={product.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/20 hover:border-rose-500/50 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ProductImageThumbnail imagePath={primaryThumb} alt={product.name || 'Producto'} />
                          <div className="min-w-0">
                            <p className="font-bold text-white text-xs truncate">{product.name}</p>
                            <p className="text-[11px] text-slate-400">
                              {product.category} {product.size ? `• Talla: ${product.size}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg ${
                              currentStock === 0
                                ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {currentStock === 0 ? 'AGOTADO (0)' : `${currentStock} disp.`}
                          </span>

                          <button
                            onClick={() => prepararEdicion(product)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-semibold transition cursor-pointer"
                          >
                            Reponer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 2: INVENTARIO */}
      {activeTab === 'inventario' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario Crear / Editar */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl lg:col-span-1 h-fit space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
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
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleGuardarPrenda} className="space-y-4 text-xs">
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">Nombre del producto *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Ej. Zapatillas Converse / Parka Vintage"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">Precio ($) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">Stock *</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    required
                    min={0}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
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
                  <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">Género</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Unisex">Unisex</option>
                    <option value="Infantil">Infantil</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">
                    {category === 'Colonias' || category === 'Cosmética' ? 'Volumen (Opc.)' : 'Talla (Opc.)'}
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                    placeholder={category === 'Colonias' || category === 'Cosmética' ? 'Ej. 100ml' : 'Ej. M, 42'}
                  />
                </div>
                <div>
                  <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">Color (Opc.)</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                    placeholder="Ej. Negro / Cromo"
                  />
                </div>
              </div>

              {/* Subida de Múltiples Imágenes (Galería) */}
              <div>
                <label className="block font-mono uppercase tracking-wider text-slate-300 mb-1">
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
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-400 hover:file:bg-slate-700 cursor-pointer bg-slate-950 p-1.5 rounded-xl border border-slate-700"
                />

                {files.length > 0 ? (
                  <p className="text-xs text-cyan-400 font-bold mt-1.5 flex items-center gap-1">
                    <span>✓</span> {files.length} {files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
                  </p>
                ) : existingImageUrls.length > 0 ? (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {existingImageUrls.length} {existingImageUrls.length === 1 ? 'foto guardada' : 'fotos guardadas'}. Selecciona fotos si deseas agregar más.
                  </p>
                ) : null}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creando || subiendoImagen}
                  className="w-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-bold p-3 rounded-xl transition shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 cursor-pointer uppercase tracking-wider text-xs"
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
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl lg:col-span-2 overflow-x-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h2 className="text-base font-bold text-white tracking-wide">Inventario Actual</h2>
              <span className="text-xs font-mono text-slate-400">Total: {products.length} productos</span>
            </div>

            {loadingProducts ? (
              <p className="text-slate-400 text-xs py-8 text-center animate-pulse">Cargando base de datos...</p>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No hay productos registrados en el inventario. Agrega el primero usando el formulario.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                    <th className="p-3">Foto</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Precio</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Detalles</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((p, index) => {
                    const primaryThumb = p?.imageUrls?.[0] || p?.imageUrl;
                    const galleryCount = p?.imageUrls?.length || (p?.imageUrl ? 1 : 0);

                    return (
                      <tr key={p?.id || index} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="relative inline-block">
                            <ProductImageThumbnail imagePath={primaryThumb} alt={p?.name || 'Producto'} />
                            {galleryCount > 1 && (
                              <span className="absolute -bottom-1 -right-1 bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-bold px-1 rounded">
                                +{galleryCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-white">{p?.name || 'Sin nombre'}</td>
                        <td className="p-3">
                          <span className="bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 text-[10px] font-bold px-2 py-0.5 rounded">
                            {p?.category || 'General'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">${Number(p?.price ?? 0).toLocaleString('es-CL')}</td>
                        <td className="p-3">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              (p?.stock ?? 0) <= 0
                                ? 'bg-rose-950 text-rose-400 border border-rose-800/50 animate-pulse'
                                : (p?.stock ?? 0) <= 2
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            }`}
                          >
                            {p?.stock ?? 0}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {p?.size ? `Talla: ${p.size} ` : ''}
                          {p?.color ? `• ${p.color} ` : ''}
                          {p?.gender ? `• ${p.gender}` : ''}
                          {!p?.size && !p?.color && !p?.gender ? '-' : ''}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => prepararEdicion(p)}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => p?.id && eliminarPrenda(p.id)}
                            className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
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
      )}

      {/* CONTENIDO TAB 3: GESTIÓN DE PEDIDOS */}
      {activeTab === 'pedidos' && (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Barra de Filtros de Estado */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 mr-2">Filtrar por estado:</span>

              <button
                onClick={() => setOrderFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderFilter === 'ALL'
                    ? 'bg-slate-800 text-white border border-slate-600 shadow'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                Todos ({orders.length})
              </button>

              <button
                onClick={() => setOrderFilter('PENDIENTE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  orderFilter === 'PENDIENTE'
                    ? 'bg-amber-950 text-amber-300 border border-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    : 'text-amber-400/80 hover:text-amber-300 bg-slate-950 border border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Pendientes ({metrics.pendingCount})
              </button>

              <button
                onClick={() => setOrderFilter('PAGADO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  orderFilter === 'PAGADO'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                    : 'text-emerald-400/80 hover:text-emerald-300 bg-slate-950 border border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Pagados ({paidOrdersCount})
              </button>

              <button
                onClick={() => setOrderFilter('CANCELADO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  orderFilter === 'CANCELADO'
                    ? 'bg-rose-950 text-rose-300 border border-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                    : 'text-rose-400/80 hover:text-rose-300 bg-slate-950 border border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                Cancelados ({canceledOrdersCount})
              </button>
            </div>

            <span className="text-xs font-mono text-slate-500">
              Mostrando {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>

          {/* Tabla de Pedidos */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {loadingOrders ? (
              <p className="text-slate-400 text-xs py-16 text-center animate-pulse">
                Cargando historial de pedidos en tiempo real...
              </p>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl mx-auto mb-3">
                  🛍️
                </div>
                <h3 className="text-base font-bold text-white">No hay pedidos registrados</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {orderFilter === 'ALL'
                    ? 'Los pedidos que realicen tus clientes por transferencia bancaria aparecerán automáticamente aquí.'
                    : `No se encontraron pedidos con el estado seleccionado (${orderFilter}).`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="p-4">Pedido / Fecha</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Dirección</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-center">Detalle</th>
                      <th className="p-4 text-right">Acciones de Stock & Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredOrders.map((order) => {
                      const items = parseCartItems(order.cartItems);
                      const isActionLoading = actionLoadingOrderId === order.id;
                      const formattedDate = order.createdAt
                        ? new Date(order.createdAt).toLocaleString('es-CL', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : 'Reciente';

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4">
                            <span className="font-mono font-bold text-cyan-400 block">#{order.id.slice(0, 8)}...</span>
                            <span className="text-[11px] text-slate-500 font-mono">{formattedDate}</span>
                          </td>

                          <td className="p-4">
                            <p className="font-bold text-white">{order.customerName}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{order.customerPhone}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{order.customerEmail}</p>
                          </td>

                          <td className="p-4 max-w-[180px]">
                            <p className="text-slate-300 truncate" title={order.shippingAddress}>
                              {order.shippingAddress}
                            </p>
                          </td>

                          <td className="p-4 font-mono font-extrabold text-sm text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                            ${Number(order.totalAmount ?? 0).toLocaleString('es-CL')}
                          </td>

                          <td className="p-4">
                            {order.status === 'PAGADO' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-400 border border-emerald-800/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                PAGADO
                              </span>
                            ) : order.status === 'CANCELADO' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/90 text-rose-400 border border-rose-800/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                CANCELADO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800/80 shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                PENDIENTE
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-center">
                            <button
                              onClick={() => setSelectedOrderDetails(order)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 mx-auto"
                            >
                              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>Ver ({items.length})</span>
                            </button>
                          </td>

                          <td className="p-4 text-right space-x-2">
                            {order.status === 'PENDIENTE' ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => handleMarcarComoPagado(order.id)}
                                  disabled={isActionLoading}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-[0_0_10px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                  title="Confirmar transferencia y marcar como pagado"
                                >
                                  {isActionLoading ? (
                                    <span className="animate-spin">⌛</span>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  <span>Marcar Pagado</span>
                                </button>

                                <button
                                  onClick={() => handleCancelarYDevolverStock(order)}
                                  disabled={isActionLoading}
                                  className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 font-bold text-[11px] transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                  title="Cancelar pedido y reponer el stock a los productos"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Cancelar & Reponer</span>
                                </button>
                              </div>
                            ) : order.status === 'PAGADO' ? (
                              <span className="text-[11px] text-slate-500 font-mono">Orden completada</span>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">Stock restaurado</span>
                            )}
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
      )}

      {/* MODAL: DETALLES COMPLETOS DEL PEDIDO */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedOrderDetails(null)}
          />

          <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden z-10 my-8">
            <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></span>
                <div>
                  <h3 className="text-base font-black text-white">Detalles del Pedido</h3>
                  <p className="text-xs font-mono text-cyan-400">ID: #{selectedOrderDetails.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-mono uppercase tracking-wider text-slate-400 font-bold">Datos del Comprador</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      selectedOrderDetails.status === 'PAGADO'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : selectedOrderDetails.status === 'CANCELADO'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {selectedOrderDetails.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block">Nombre:</span>
                    <span className="font-semibold text-white">{selectedOrderDetails.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Teléfono / WhatsApp:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-cyan-400">{selectedOrderDetails.customerPhone}</span>
                      <a
                        href={`https://wa.me/${selectedOrderDetails.customerPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-400 hover:underline"
                      >
                        (Chat)
                      </a>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Correo Electrónico:</span>
                    <span className="text-slate-300">{selectedOrderDetails.customerEmail}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Fecha y Hora:</span>
                    <span className="font-mono text-slate-400">
                      {selectedOrderDetails.createdAt
                        ? new Date(selectedOrderDetails.createdAt).toLocaleString('es-CL')
                        : 'Reciente'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 block">Dirección de Despacho:</span>
                  <span className="text-slate-200 font-medium">{selectedOrderDetails.shippingAddress}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Productos Comprados ({parseCartItems(selectedOrderDetails.cartItems).length})
                </h4>

                <div className="space-y-2">
                  {parseCartItems(selectedOrderDetails.cartItems).map((item, idx) => (
                    <div
                      key={`${item?.id}-${idx}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800"
                    >
                      <ProductImageThumbnail imagePath={item?.imageUrl} alt={item?.name || 'Producto'} />

                      <div className="flex-1 min-w-0 text-xs">
                        <p className="font-bold text-white truncate">{item?.name || 'Producto sin nombre'}</p>
                        <p className="text-[11px] text-slate-400">
                          {item?.category || 'Ropa'} {item?.size ? `• Talla: ${item.size}` : ''}
                        </p>
                      </div>

                      <div className="text-right font-mono text-xs font-bold text-emerald-400">
                        ${Number(item?.price ?? 0).toLocaleString('es-CL')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-mono">Total de la Orden</span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-mono">
                    ${Number(selectedOrderDetails.totalAmount ?? 0).toLocaleString('es-CL')} CLP
                  </span>
                </div>

                {selectedOrderDetails.status === 'PENDIENTE' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleMarcarComoPagado(selectedOrderDetails.id)}
                      disabled={actionLoadingOrderId === selectedOrderDetails.id}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-50 cursor-pointer"
                    >
                      Marcar como Pagado
                    </button>
                    <button
                      onClick={() => handleCancelarYDevolverStock(selectedOrderDetails)}
                      disabled={actionLoadingOrderId === selectedOrderDetails.id}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800 font-bold text-xs uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                    >
                      Cancelar & Reponer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}