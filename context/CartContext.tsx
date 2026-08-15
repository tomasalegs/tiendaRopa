'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Schema } from '@/amplify/data/resource';

type Product = Schema['Product']['type'];

interface CartContextType {
  cart: Product[];
  setCart: React.Dispatch<React.SetStateAction<Product[]>>;
  isCartOpen: boolean;
  setIsCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (indexToRemove: number) => void;
  removeItemsById: (productId: string) => void;
  clearCart: () => void;
  totalItems: number;
  cartTotal: number;
  formattedCartTotal: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'y2k_store_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // 1. Inicialización en el cliente leyendo desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (err) {
      console.error('Error al cargar el carrito desde localStorage:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 2. Persistencia en localStorage ante cambios en el carrito
  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.error('Error al guardar el carrito en localStorage:', err);
    }
  }, [cart, isHydrated]);

  const addToCart = (product: Product, quantity: number = 1) => {
    if (!product) return;
    const itemsToAdd = Array.from({ length: Math.max(1, quantity) }, () => product);
    setCart((prev) => [...prev, ...itemsToAdd]);
  };

  const removeFromCart = (indexToRemove: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const removeItemsById = (productId: string) => {
    setCart((prev) => prev.filter((item) => item?.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + Number(item?.price ?? 0), 0);
  const formattedCartTotal = cartTotal.toLocaleString('es-CL');
  const totalItems = cart.length;

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        removeItemsById,
        clearCart,
        totalItems,
        cartTotal,
        formattedCartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser utilizado dentro de un <CartProvider>');
  }
  return context;
}

export default CartProvider;
