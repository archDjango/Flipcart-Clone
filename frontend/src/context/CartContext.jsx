import React, { createContext, useState } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(null); // Store selected coupon

  const addToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const increaseQuantity = (id) => {
    setCartItems(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity: item.quantity + 1 } : item))
    );
  };

  const decreaseQuantity = (id) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === id && item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : item
      )
    );
  };

  const getTotalPrice = () => {
    const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
    if (!selectedCoupon) return subtotal;

    let discount = 0;
    if (selectedCoupon.discount_type === 'flat') {
      discount = selectedCoupon.discount_value;
    } else if (selectedCoupon.discount_type === 'percentage') {
      discount = (selectedCoupon.discount_value / 100) * subtotal;
    }
    return Math.max(0, subtotal - discount); // Ensure total doesn't go negative
  };

  const getDiscount = () => {
    if (!selectedCoupon) return 0;
    const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
    if (selectedCoupon.discount_type === 'flat') {
      return selectedCoupon.discount_value;
    } else if (selectedCoupon.discount_type === 'percentage') {
      return (selectedCoupon.discount_value / 100) * subtotal;
    }
    return 0;
  };

  const clearCart = () => {
    setCartItems([]);
    setSelectedCoupon(null); // Clear coupon on cart clear
  };

  const selectCoupon = (coupon) => {
    setSelectedCoupon(coupon);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        getTotalPrice,
        getDiscount,
        clearCart,
        selectedCoupon,
        selectCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};