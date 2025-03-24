import React, { useContext } from "react";
import { CartContext } from "../../context/CartContext";
import "./CartPage.css";
import { Link, useNavigate } from "react-router-dom";

const CartPage = () => {
  const { cartItems, increaseQuantity, decreaseQuantity, removeFromCart, getTotalPrice } = useContext(CartContext);
  const navigate = useNavigate();

  return (
    <div className="cart-container">
      {cartItems.length === 0 ? (
        <p className="empty-cart">Your cart is empty.</p>
      ) : (
        <>
          <h2 className="cart-heading">Shopping Cart</h2>
          <div className="cart-content">
            {/* Left: Cart Items */}
            <div className="cart-items">
              {cartItems.map((item) => (
                <div className="cart-item" key={item.id}>
                  <img src={item.image} alt={item.name} className="cart-item-image" />
                  <div className="cart-item-details">
                    <h3>{item.name}</h3>
                    <p>₹{item.price}</p>
                    <div className="cart-quantity-controls">
                      <button onClick={() => decreaseQuantity(item.id)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => increaseQuantity(item.id)}>+</button>
                    </div>
                    <button className="remove-btn" onClick={() => removeFromCart(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Price Summary */}
            <div className="cart-summary">
              <h3>PRICE DETAILS</h3>
              <hr />
              <p>Price ({cartItems.length} items): ₹{getTotalPrice()}</p>
              <p>Discount: ₹0</p>
              <p>Delivery Charges: Free</p>
              <hr />
              <h4>Total Amount: ₹{getTotalPrice()}</h4>
              <p className="savings-text">You will save ₹0 on this order</p>
              <button className="place-order-btn" onClick={() => navigate("/checkout")}>
                Proceed to checkout
              </button>
              <button className="continue-shopping-btn" onClick={() => navigate("/")}>
              Continue Shopping
            </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CartPage;
