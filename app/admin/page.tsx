'use client';

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { uploadData, getUrl } from 'aws-amplify/storage';
import type { Schema } from '@/amplify/data/resource';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

export default function AdminPage() {
  return (
    <Authenticator>
      {({ signOut }) => (
        <AdminContent signOut={signOut} />
      )}
    </Authenticator>
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
      <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-[10px] text-slate-400">
        Sin foto
      </div>
    );
  }

  if (loading) {
    return <div className="w-10 h-10 rounded bg-slate-700 animate-pulse" />;
  }

  if (!url) {
    return (
      <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-[10px] text-red-400">
        Error
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className="w-10 h-10 rounded object-cover border border-slate-600"
    />
  );
}

function AdminContent({ signOut }: { signOut?: () => void }) {
  const [products, setProducts] = useState<Schema['Product']['type'][]>([]);
  const [loading, setLoading] = useState(true);

  // Estados del formulario
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(1);
  const [category, setCategory] = useState('Ropa');
  const [gender, setGender] = useState('Unisex');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [creando, setCreando] = useState(false);
  const [prendaEnEdicion, setPrendaEnEdicion] = useState<string | null>(null);

  async function fetchProducts() {
    try {
      const { data: items } = await client.models.Product.list();
      if (items) {
        setProducts(items.filter((item) => item !== null && item !== undefined) as Schema['Product']['type'][]);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  async function handleGuardarPrenda(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);

    try {
      let finalImageUrl = existingImageUrl;

      if (file) {
        setSubiendoImagen(true);
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const imagePath = `product-images/${fileName}`;
        await uploadData({
          path: imagePath,
          data: file,
        }).result;
        finalImageUrl = imagePath;
        setSubiendoImagen(false);
      }

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
          imageUrl: finalImageUrl,
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
          imageUrl: finalImageUrl,
          isAvailable: true,
        });
      }

      setName('');
      setPrice(0);
      setStock(1);
      setCategory('Ropa');
      setGender('Unisex');
      setSize('');
      setColor('');
      setFile(null);
      setExistingImageUrl(null);

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
    setExistingImageUrl(product.imageUrl || null);
    setFile(null);
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

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Y2K Admin — Centro de Control</h1>
        <button
          onClick={signOut}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-semibold transition"
        >
          Cerrar Sesión
        </button>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-slate-800 p-6 rounded-lg shadow-md md:col-span-1 h-fit">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">
            {prendaEnEdicion ? 'Editar Producto' : 'Agregar al Inventario'}
          </h2>
          <form onSubmit={handleGuardarPrenda} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre del producto</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                placeholder="Ej. Zapatillas Converse / Parka"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Precio ($)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
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
                <label className="block text-sm font-medium mb-1">Género</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                >
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Unisex">Unisex</option>
                  <option value="Infantil">Infantil</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {category === 'Colonias' || category === 'Cosmética'
                    ? 'Volumen o Medida (Opc.)'
                    : 'Talla (Opc.)'}
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                  placeholder={
                    category === 'Colonias' || category === 'Cosmética'
                      ? 'Ej. 100ml'
                      : 'Ej. M, 42'
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Color (Opc.)</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                  placeholder="Ej. Negro"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Foto del producto (Opc.)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-cyan-400 hover:file:bg-slate-600 cursor-pointer bg-slate-700/50 p-1 rounded border border-slate-600"
              />
              {existingImageUrl && !file && (
                <p className="text-xs text-slate-400 mt-1">
                  Tiene una imagen asignada actualmente. Selecciona otra si deseas reemplazarla.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={creando || subiendoImagen}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold p-2 rounded transition disabled:opacity-50"
              >
                {subiendoImagen
                  ? 'Subiendo foto...'
                  : creando
                  ? 'Guardando...'
                  : prendaEnEdicion
                  ? 'Actualizar'
                  : 'Crear Producto'}
              </button>
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
                    setFile(null);
                    setExistingImageUrl(null);
                  }}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded"
                >
                  X
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg shadow-md md:col-span-2 overflow-x-auto">
          <h2 className="text-xl font-semibold mb-4">Inventario Actual</h2>
          {loading ? (
            <p className="text-slate-400">Cargando base de datos...</p>
          ) : products.filter((p) => p !== null && p !== undefined).length === 0 ? (
            <p className="text-slate-400">No hay productos registrados en esta categoría todavía.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-sm">
                  <th className="p-2">Foto</th>
                  <th className="p-2">Producto</th>
                  <th className="p-2">Categoría</th>
                  <th className="p-2">Precio</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Detalles</th>
                  <th className="p-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) => p !== null && p !== undefined)
                  .map((p, index) => (
                    <tr key={p?.id || index} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="p-2">
                        <ProductImageThumbnail imagePath={p?.imageUrl} alt={p?.name || 'Producto'} />
                      </td>
                      <td className="p-2 font-medium">{p?.name || 'Producto sin nombre'}</td>
                      <td className="p-2">
                        <span className="bg-slate-700 text-xs px-2 py-1 rounded text-cyan-300">
                          {p?.category || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="p-2">${p?.price ?? 0}</td>
                      <td className="p-2">{p?.stock ?? 0}</td>
                      <td className="p-2 text-sm text-slate-300">
                        {p?.size
                          ? p?.category === 'Colonias' || p?.category === 'Cosmética'
                            ? `Volumen: ${p.size} `
                            : `Talla: ${p.size} `
                          : ''}
                        {p?.color ? `Color: ${p.color} ` : ''}
                        {p?.gender ? `Género: ${p.gender}` : ''}
                        {!p?.size && !p?.color && !p?.gender ? '-' : ''}
                      </td>
                      <td className="p-2 text-right space-x-2">
                        <button
                          onClick={() => prepararEdicion(p)}
                          className="text-cyan-400 hover:underline text-sm font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => p?.id && eliminarPrenda(p.id)}
                          className="text-red-400 hover:underline text-sm font-medium"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}