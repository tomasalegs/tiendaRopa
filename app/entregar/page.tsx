"use client";
import { useState } from "react";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import outputs from '../../amplify_outputs.json';

// 1. Configuramos Amplify con las credenciales de tu backend
Amplify.configure(outputs);

// 2. Generamos el cliente para conectarnos a la base de datos
const client = generateClient<Schema>();

export default function EntregarPage() {
  const [orderId, setOrderId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 3. Buscamos la orden usando la API Key
      const { data: items, errors } = await client.models.Product.list({
        filter: { id: { eq: orderId.trim() } },
        authMode: 'apiKey'
      });

      if (errors) {
        console.error("GraphQL Errors:", errors);
        alert("Error de conexión con la base de datos");
        setLoading(false);
        return;
      }

      if (!items || items.length === 0) {
        alert("Error: Orden no encontrada en el sistema");
        setLoading(false);
        return;
      }

      const prenda = items[0];
      const pinBD = String(prenda.pinSecreto || "").trim();
      const pinIngresado = String(pin || "").trim();

      // 4. Si el PIN coincide, actualizamos el estado
      if (pinBD === pinIngresado) {
        await client.models.Product.update({
          id: prenda.id,
          estado: "Entregado"
        }, {
          authMode: 'apiKey'
        });

        alert("¡Prenda Entregada y registrada con Éxito!");
        setOrderId("");
        setPin("");
      } else {
        alert("Error: Código incorrecto");
      }
    } catch (err) {
      console.error("Error al validar:", err);
      alert("Ocurrió un error inesperado al consultar la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl p-8 border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.15)] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,1)]"></div>

        <h1 className="text-purple-400 font-black text-2xl text-center tracking-widest mb-8 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
          VALIDACIÓN
          <span className="block text-zinc-500 text-[10px] tracking-widest mt-2 font-normal">CONFIRMACIÓN DE ENTREGA</span>
        </h1>

        <form onSubmit={handleValidate} className="space-y-6">
          <div>
            <label className="block text-zinc-400 text-xs font-bold mb-2 uppercase tracking-widest">
              ID DE ORDEN
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Ej: Y2K-001"
              disabled={loading}
              className="w-full bg-zinc-800 border-none rounded p-3 text-purple-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-xs font-bold mb-2 uppercase tracking-widest">
              PIN SECRETO
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={4}
              disabled={loading}
              className="w-full bg-zinc-950 border border-zinc-900 rounded p-3 text-purple-100 text-center text-3xl tracking-[0.5em] placeholder-zinc-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-bold tracking-widest rounded shadow-[0_0_15px_rgba(192,38,211,0.4)] hover:shadow-[0_0_25px_rgba(192,38,211,0.7)] hover:scale-[1.02] transition-all disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? "VERIFICANDO..." : "VERIFICAR CÓDIGO"}
          </button>
        </form>
      </div>
    </div>
  );
}