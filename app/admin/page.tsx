"use client";
import { useState, useEffect } from "react";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import outputs from '../../amplify_outputs.json';

Amplify.configure(outputs);
const client = generateClient<Schema>();

export default function AdminPage() {
  const [productos, setProductos] = useState<Array<Schema['Product']['type']>>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const fetchProductos = async () => {
    try {
      const { data } = await client.models.Product.list({ authMode: 'apiKey' });
      setProductos(data);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  const handleCrearPrenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    setCreando(true);
    try {
      const id = `Y2K-${Math.floor(Math.random() * 10000)}`;
      const pinAleatorio = Math.floor(1000 + Math.random() * 9000).toString();

      await client.models.Product.create({
        id,
        nombre: nuevoNombre.trim(),
        pinSecreto: pinAleatorio,
        estado: 'Disponible',
      }, {
        authMode: 'apiKey'
      });

      setNuevoNombre("");
      await fetchProductos();
    } catch (error) {
      console.error("Error creando prenda:", error);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans flex flex-col items-center">
      <h1 className="text-purple-400 font-black text-2xl text-center tracking-widest mb-8 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
        CENTRO DE COMANDO
        <span className="block text-zinc-500 text-[10px] tracking-widest mt-2 font-normal">INVENTARIO GLOBAL</span>
      </h1>

      {/* Formulario de ingreso de nuevas prendas */}
      <form
        onSubmit={handleCrearPrenda}
        className="w-full max-w-4xl bg-zinc-900 border border-purple-500/30 p-6 rounded-xl mb-8 flex gap-4"
      >
        <input
          type="text"
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          placeholder="Ej: Pantalón Cargo Paracaidista"
          disabled={creando}
          required
          className="flex-1 bg-zinc-950 border border-zinc-700 text-purple-100 p-3 rounded focus:outline-none focus:border-purple-500 uppercase font-mono text-sm"
        />
        <button
          type="submit"
          disabled={creando}
          className="bg-purple-600 hover:bg-purple-500 text-white font-black px-6 py-3 rounded transition-all drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] disabled:opacity-50"
        >
          {creando ? "CREANDO..." : "AGREGAR PRENDA"}
        </button>
      </form>

      {/* Tabla de inventario */}
      <div className="w-full max-w-4xl bg-zinc-900 rounded-xl border border-purple-500/30 overflow-x-auto shadow-[0_0_25px_rgba(168,85,247,0.1)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">ID ORDEN</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">PRENDA</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">PIN SECRETO</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="font-mono text-sm text-purple-400 p-8 text-center animate-pulse tracking-widest">
                  CARGANDO BASE DE DATOS...
                </td>
              </tr>
            ) : productos.length === 0 ? (
              <tr>
                <td colSpan={4} className="font-mono text-sm text-zinc-500 p-8 text-center tracking-widest">
                  NO HAY PRENDAS EN EL INVENTARIO.
                </td>
              </tr>
            ) : (
              productos.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="font-mono text-sm text-zinc-300 p-4 border-b border-zinc-800">{item.id}</td>
                  <td className="font-mono text-sm text-zinc-300 p-4 border-b border-zinc-800 uppercase">{item.nombre}</td>
                  <td className="font-mono text-sm text-zinc-500 p-4 border-b border-zinc-800 tracking-widest">{item.pinSecreto}</td>
                  <td className={`font-mono text-sm p-4 border-b border-zinc-800 uppercase font-bold ${item.estado === 'Entregado' ? 'text-emerald-400' : 'text-fuchsia-400'}`}>
                    {item.estado}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}