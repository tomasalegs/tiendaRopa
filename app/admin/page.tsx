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

  // Estados del formulario
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaTalla, setNuevaTalla] = useState("");
  const [nuevoColor, setNuevoColor] = useState("");
  const [creando, setCreando] = useState(false);
  const [prendaEnEdicion, setPrendaEnEdicion] = useState<string | null>(null);

  useEffect(() => {
    fetchProductos();
  }, []);

  async function fetchProductos() {
    try {
      const { data } = await client.models.Product.list({ authMode: 'apiKey' });
      setProductos(data);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleEliminar = async (id: string) => {
    try {
      await client.models.Product.delete({ id });
      await fetchProductos();
    } catch (error) {
      console.error("Error al eliminar la prenda:", error);
    }
  };

  const handleEditar = (prenda: Schema['Product']['type']) => {
    setNuevoNombre(prenda.nombre || "");
    setNuevaTalla(prenda.talla || "");
    setNuevoColor(prenda.color || "");
    setPrendaEnEdicion(prenda.id);
  };

  const cancelarEdicion = () => {
    setNuevoNombre("");
    setNuevaTalla("");
    setNuevoColor("");
    setPrendaEnEdicion(null);
  };

  async function handleCrearPrenda(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);

    try {
      if (prendaEnEdicion) {
        await client.models.Product.update({
          id: prendaEnEdicion,
          nombre: nuevoNombre,
          talla: nuevaTalla,
          color: nuevoColor,
        });
      } else {
        const idAleatorio = `Y2K-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        const pinAleatorio = Math.floor(1000 + Math.random() * 9000).toString();

        await client.models.Product.create({
          id: idAleatorio,
          nombre: nuevoNombre,
          pinSecreto: pinAleatorio,
          estado: 'Disponible',
          talla: nuevaTalla,
          color: nuevoColor
        });
      }

      // Limpiar formulario y resetear edición
      setNuevoNombre("");
      setNuevaTalla("");
      setNuevoColor("");
      setPrendaEnEdicion(null);

      // Recargar tabla
      await fetchProductos();
    } catch (error) {
      console.error(prendaEnEdicion ? "Error al actualizar la prenda:" : "Error al crear la prenda:", error);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans flex flex-col items-center">
      <h1 className="text-purple-400 font-black text-2xl text-center tracking-widest mb-8 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
        CENTRO DE COMANDO
        <span className="block text-zinc-500 text-[10px] tracking-widest mt-2 font-normal">INVENTARIO GLOBAL</span>
      </h1>

      {/* Formulario de Ingreso / Edición */}
      <form onSubmit={handleCrearPrenda} className="bg-zinc-900 border border-purple-500/30 p-6 rounded-xl w-full max-w-5xl mb-8 flex flex-wrap md:flex-nowrap gap-4 items-end shadow-[0_0_15px_rgba(168,85,247,0.05)]">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-purple-400 text-xs font-mono mb-2 tracking-widest">PRENDA</label>
          <input
            type="text"
            required
            placeholder="Ej: PANTALÓN CARGO"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 text-purple-100 p-3 rounded focus:outline-none focus:border-purple-500 uppercase font-mono text-sm transition-colors"
          />
        </div>
        <div className="w-full md:w-32">
          <label className="block text-purple-400 text-xs font-mono mb-2 tracking-widest">TALLA</label>
          <input
            type="text"
            placeholder="Ej: M o 42"
            value={nuevaTalla}
            onChange={(e) => setNuevaTalla(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 text-purple-100 p-3 rounded focus:outline-none focus:border-purple-500 uppercase font-mono text-sm transition-colors"
          />
        </div>
        <div className="w-full md:w-40">
          <label className="block text-purple-400 text-xs font-mono mb-2 tracking-widest">COLOR</label>
          <input
            type="text"
            placeholder="Ej: NEGRO"
            value={nuevoColor}
            onChange={(e) => setNuevoColor(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 text-purple-100 p-3 rounded focus:outline-none focus:border-purple-500 uppercase font-mono text-sm transition-colors"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            type="submit"
            disabled={creando || !nuevoNombre}
            className={`w-full md:w-auto font-black px-6 py-3 rounded transition-all disabled:bg-zinc-700 disabled:text-zinc-500 text-white disabled:drop-shadow-none ${
              prendaEnEdicion
                ? "bg-cyan-600 hover:bg-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                : "bg-purple-600 hover:bg-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"
            }`}
          >
            {creando
              ? prendaEnEdicion
                ? "GUARDANDO..."
                : "CREANDO..."
              : prendaEnEdicion
              ? "GUARDAR CAMBIOS"
              : "AGREGAR"}
          </button>

          {prendaEnEdicion && (
            <button
              type="button"
              onClick={cancelarEdicion}
              className="bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-red-500 px-4 py-3 rounded font-bold transition-colors"
            >
              CANCELAR
            </button>
          )}
        </div>
      </form>

      {/* Tabla de Inventario */}
      <div className="w-full max-w-5xl bg-zinc-900 rounded-xl border border-purple-500/30 overflow-x-auto shadow-[0_0_25px_rgba(168,85,247,0.1)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4 whitespace-nowrap">ID ORDEN</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">PRENDA</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">TALLA</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">COLOR</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4 whitespace-nowrap">PIN SECRETO</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4">ESTADO</th>
              <th className="font-mono text-xs text-purple-400 border-b border-purple-500/30 p-4 whitespace-nowrap">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="font-mono text-sm text-purple-400 p-8 text-center animate-pulse tracking-widest">
                  CARGANDO BASE DE DATOS...
                </td>
              </tr>
            ) : productos.length === 0 ? (
              <tr>
                <td colSpan={7} className="font-mono text-sm text-zinc-500 p-8 text-center tracking-widest">
                  NO HAY PRENDAS EN EL INVENTARIO.
                </td>
              </tr>
            ) : (
              productos.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="font-mono text-sm text-zinc-300 p-4 border-b border-zinc-800 whitespace-nowrap">{item.id}</td>
                  <td className="font-mono text-sm text-zinc-300 p-4 border-b border-zinc-800 uppercase">{item.nombre}</td>
                  <td className="font-mono text-sm text-zinc-400 p-4 border-b border-zinc-800 uppercase">{item.talla || '-'}</td>
                  <td className="font-mono text-sm text-zinc-400 p-4 border-b border-zinc-800 uppercase">{item.color || '-'}</td>
                  <td className="font-mono text-sm text-zinc-500 p-4 border-b border-zinc-800 tracking-widest">{item.pinSecreto}</td>
                  <td className={`font-mono text-sm p-4 border-b border-zinc-800 uppercase font-bold ${item.estado === 'Entregado' ? 'text-emerald-400' : 'text-fuchsia-400'}`}>
                    {item.estado}
                  </td>
                  <td className="p-4 border-b border-zinc-800 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        onClick={() => handleEditar(item)}
                        className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors mr-3 font-mono text-xs"
                      >
                        EDITAR
                      </button>
                      <button
                        onClick={() => handleEliminar(item.id)}
                        className="text-red-500 hover:text-red-400 font-bold transition-colors font-mono text-xs"
                      >
                        ELIMINAR
                      </button>
                    </div>
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