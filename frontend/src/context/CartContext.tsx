import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { CartItem, PosProductDto } from "../api/types";
import { useAuth } from "../auth/AuthContext";

interface CartContextValue {
  cart: CartItem[];
  selectedTerminalId: string;
  setSelectedTerminalId: (id: string) => void;
  addToCart: (product: PosProductDto) => void;
  updateQty: (productId: string, delta: number) => void;
  setQty: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = "pos_cart";
const TERMINAL_STORAGE_KEY = "pos_terminal_id";

const CartContext = createContext<CartContextValue>({
  cart: [],
  selectedTerminalId: "",
  setSelectedTerminalId: () => {},
  addToCart: () => {},
  updateQty: () => {},
  setQty: () => {},
  removeItem: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedTerminalId, setSelectedTerminalIdState] = useState<string>(() => {
    try {
      return sessionStorage.getItem(TERMINAL_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  // Clear cart and terminal on logout or user change
  useEffect(() => {
    if (!user) {
      setCart([]);
      setSelectedTerminalIdState("");
      try {
        sessionStorage.removeItem(CART_STORAGE_KEY);
        sessionStorage.removeItem(TERMINAL_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
    }
  }, [user]);

  // Sync cart to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  // Sync terminal ID to sessionStorage
  const setSelectedTerminalId = useCallback((id: string) => {
    setSelectedTerminalIdState(id);
    try {
      if (id) {
        sessionStorage.setItem(TERMINAL_STORAGE_KEY, id);
      } else {
        sessionStorage.removeItem(TERMINAL_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const addToCart = useCallback((product: PosProductDto) => {
    setCart((prev) => {
      const effectivePrice = product.discountedPrice ?? product.salePrice;
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                lineTotal: (i.quantity + 1) * effectivePrice,
                productDiscountAmount: (i.quantity + 1) * (product.salePrice - effectivePrice),
              }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          barcode: product.barcode,
          name: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
          lineTotal: effectivePrice,
          discountedPrice: product.discountedPrice,
          discountName: product.discountName,
          discountPercentage: product.discountPercentage,
          productDiscountAmount: product.salePrice - effectivePrice,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const effectivePrice = item.discountedPrice ?? item.unitPrice;
          return {
            ...item,
            quantity: newQty,
            lineTotal: newQty * effectivePrice,
            productDiscountAmount: newQty * (item.unitPrice - effectivePrice),
          };
        })
        .filter(Boolean) as CartItem[];
    });
  }, []);

  const setQty = useCallback((productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      return prev.map((item) => {
        if (item.productId !== productId) return item;
        const effectivePrice = item.discountedPrice ?? item.unitPrice;
        return {
          ...item,
          quantity,
          lineTotal: quantity * effectivePrice,
          productDiscountAmount: quantity * (item.unitPrice - effectivePrice),
        };
      });
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const value = useMemo(
    () => ({
      cart,
      selectedTerminalId,
      setSelectedTerminalId,
      addToCart,
      updateQty,
      setQty,
      removeItem,
      clearCart,
    }),
    [cart, selectedTerminalId, setSelectedTerminalId, addToCart, updateQty, setQty, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  return useContext(CartContext);
}
