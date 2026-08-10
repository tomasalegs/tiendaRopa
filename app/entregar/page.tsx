"use client";

import { useState, FormEvent } from "react";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import outputs from "@/amplify_outputs.json";
import type { Schema } from "@/amplify/data/resource";

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function EntregarPage() {
  const [orderId, setOrderId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleValidate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: items, errors } = await client.models.Product.list({
        filter: { id: { eq: orderId.trim() } },
        authMode: 'apiKey',
      });

      if (errors) {
        console.error("GraphQL Errors:", errors);
        alert("Error de conexión con la base de datos");
        return;
      }

      if (!items || items.length === 0) {
        alert("Error: Orden no encontrada en el sistema");
        return;
      }

      const prenda = items[0];
      const pinBD = String(prenda.pinSecreto || "").trim();
      const pinIngresado = String(pin || "").trim();

      if (pinBD === pinIngresado) {
        await client.models.Product.update(
          {
            id: prenda.id,
            estado: "Entregado",
          },
          { authMode: 'apiKey' }
        );

        alert("¡Prenda Entregada y registrada con Éxito!");
        setOrderId("");
        setPin("");
      } else {
        alert("Error: Código incorrecto");
      }
    } catch (err) {
      console.error("Error al validar entrega:", err);
      alert("Ocurrió un error inesperado al consultar la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-xl border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.15)] p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-purple-400 tracking-widest drop-shadow-[0_2px_10px_rgba(168,85,247,0.5)]">
            VALIDACIÓN
          </h1>
          <p className="text-xs text-zinc-500 tracking-wider mt-1 uppercase font-medium">
            Confirmación de Entrega
          </p>
        </div>

        <form onSubmit={handleValidate} className="space-y-5">
          <div>
            <label
              htmlFor="orderId"
              className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-2"
            >
              ID de Orden
            </label>
            <input
              id="orderId"
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Ej. ORD-0099"
              required
              disabled={loading}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-purple-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50 transition-all text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="pin"
              className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-2"
            >
              PIN Secreto
            </label>
            <input
              id="pin"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              required
              disabled={loading}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-purple-100 placeholder:text-zinc-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50 transition-all text-center text-3xl font-mono tracking-[0.5em]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-[0_0_15px_rgba(192,38,211,0.4)] transition-all cursor-pointer text-sm tracking-wider uppercase flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>VERIFICANDO...</span>
              </>
            ) : (
              "VERIFICAR CÓDIGO"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
