import React, { useContext } from "react";
import { CartContext } from "../../context/CartContext";
import "./CartPage.css";

const CartPage = () => {
  const { cartItems, removeFromCart } = useContext(CartContext);

  const totalPrice = cartItems.reduce((total, item) => total + item.price, 0);

  return (
    <div className="cart-page">
      <h2>Your Cart ({cartItems.length} items)</h2>
      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div className="cart-items">
          {cartItems.map((item) => (
            <div key={item.id} className="cart-item">
              <img src={item.image} alt={item.name} className="cart-item-image" />
              <div className="cart-item-details">
                <h3>{item.name}</h3>
                <p>₹{item.price}</p>
                <button onClick={() => removeFromCart(item.id)} className="remove-btn">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {cartItems.length > 0 && (
        <div className="cart-summary">
          <h3>Total: ₹{totalPrice}</h3>
          <button className="checkout-btn">Proceed to Checkout</button>
        </div>
      )}
    </div>
  );
};

export default CartPage;
