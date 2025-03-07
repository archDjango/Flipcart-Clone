import React, { useContext, useState } from "react";
import { CartContext } from "../../context/CartContext";
import "./CheckoutPage.css";

const CheckoutPage = () => {
  const { cartItems, getTotalPrice } = useContext(CartContext);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    paymentMethod: "Cash on Delivery",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePlaceOrder = () => {
    if (form.name && form.address && form.paymentMethod) {
      setOrderPlaced(true);
    } else {
      alert("Please fill all fields!");
    }
  };

  if (orderPlaced) {
    return (
      <div className="checkout-success">
        <h2>Thank you for your order!</h2>
        <p>Your order has been placed successfully.</p>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <h2>Checkout</h2>
      <div className="checkout-container">
        <div className="checkout-form">
          <h3>Shipping Details</h3>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
          />
          <textarea
            name="address"
            placeholder="Full Address"
            value={form.address}
            onChange={handleChange}
            required
          />
          <select
            name="paymentMethod"
            value={form.paymentMethod}
            onChange={handleChange}
          >
            <option>Cash on Delivery</option>
            <option>Credit/Debit Card</option>
            <option>UPI</option>
            <option>Net Banking</option>
          </select>
          <button className="place-order-btn" onClick={handlePlaceOrder}>
            Place Order
          </button>
        </div>

        <div className="order-summary">
          <h3>Order Summary</h3>
          {cartItems.map((item) => (
            <div className="summary-item" key={item.id}>
              <img src={item.image} alt={item.name} />
              <div>
                <h4>{item.name}</h4>
                <p>₹{item.price} × {item.quantity}</p>
              </div>
            </div>
          ))}
          <hr />
          <h4>Total: ₹{getTotalPrice()}</h4>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
