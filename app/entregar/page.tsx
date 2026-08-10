"use client";

import { useState, FormEvent } from "react";

export default function EntregarPage() {
  const [orderIdentifier, setOrderIdentifier] = useState("");
  const [pin, setPin] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("Validando código...", { orderIdentifier, pin });
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full mb-2">
            Panel de Reparto
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Validación de Entrega
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ingresa los datos para confirmar la entrega del pedido
          </p>
        </div>

        {/* Tarjeta del Formulario */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="orderIdentifier"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                ID de la Orden o Nombre
              </label>
              <input
                id="orderIdentifier"
                type="text"
                value={orderIdentifier}
                onChange={(e) => setOrderIdentifier(e.target.value)}
                placeholder="Ej. ORD-1024 o Juan Pérez"
                required
                className="w-full px-4 py-3.5 text-base text-gray-900 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent focus:bg-white outline-none transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-semibold text-gray-700 mb-2"
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
                placeholder="• • • •"
                required
                className="w-full px-4 py-3.5 text-center text-2xl font-bold tracking-widest text-gray-900 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent focus:bg-white outline-none transition-all placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-lg"
              />
              <p className="text-xs text-gray-400 mt-1.5 text-center">
                Pide el código de seguridad de 4 a 6 dígitos al cliente
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer text-base"
            >
              Validar Código
            </button>
          </form>
        </div>

        {/* Pie informativo */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Sistema de entregas seguras &copy; Y2K Store
        </p>
      </div>
    </main>
  );
}
