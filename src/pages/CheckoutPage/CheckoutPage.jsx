import React, { useContext, useState, useEffect } from "react";
import { CartContext } from "../../context/CartContext";
import { useNavigate } from "react-router-dom";
import "./CheckoutPage.css";

const CheckoutPage = () => {
  const { cartItems, getTotalPrice, clearCart } = useContext(CartContext);
  const navigate = useNavigate();
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    paymentMethod: "Cash on Delivery",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePlaceOrder = () => {
    if (!form.name || !form.address || !form.phone) {
      alert("Please fill all the required fields!");
      return;
    }

    const newOrder = {
      id: Date.now(),
      items: cartItems,
      totalAmount: getTotalPrice(),
      date: new Date().toLocaleString(),
      status: "Processing",
    };

    // Store order in localStorage
    const previousOrders = JSON.parse(localStorage.getItem("orders")) || [];
    localStorage.setItem("orders", JSON.stringify([...previousOrders, newOrder]));

    // Clear cart after order is placed
    clearCart();

    // Delay redirection slightly to ensure cart is cleared
    setTimeout(() => {
      setOrderPlaced(true);
    }, 500);
  };

  useEffect(() => {
    if (orderPlaced) {
      navigate("/thank-you");
    }
  }, [orderPlaced, navigate]);

  return (
    <div className="checkout-page">
      <h2>🛒 Checkout</h2>
      <div className="checkout-container">
        {/* Left: Shipping Details Form */}
        <div className="checkout-form card">
          <h3>📍 Shipping Details</h3>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
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
          <select name="paymentMethod" value={form.paymentMethod} onChange={handleChange}>
            <option>Cash on Delivery</option>
            <option>Credit/Debit Card</option>
            <option>UPI</option>
            <option>Net Banking</option>
          </select>
          <button className="place-order-btn" onClick={handlePlaceOrder}>
            ✅ Place Order
          </button>
        </div>

        {/* Right: Order Summary */}
        <div className="order-summary card">
          <h3>📦 Order Summary</h3>
          {cartItems.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            cartItems.map((item) => (
              <div className="summary-item" key={item.id}>
                <img src={item.image} alt={item.name} />
                <div>
                  <h4>{item.name}</h4>
                  <p>₹{item.price} × {item.quantity}</p>
                </div>
              </div>
            ))
          )}
          <hr />
          <h4>Total: ₹{getTotalPrice()}</h4>
        </div>
      </div>

      {/* Continue Shopping Button */}
      <button className="continue-shopping-btn" onClick={() => navigate("/")}>
        ⬅️ Continue Shopping
      </button>
    </div>
  );
};

export default CheckoutPage;
