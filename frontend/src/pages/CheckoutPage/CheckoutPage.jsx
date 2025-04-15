// src/pages/CheckoutPage/CheckoutPage.jsx
import React, { useContext, useState, useEffect } from 'react';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './CheckoutPage.css';

const CheckoutPage = () => {
  const { cartItems, getTotalPrice, clearCart } = useContext(CartContext);
  const { addOrder } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    paymentMethod: 'Cash on Delivery',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePlaceOrder = async () => {
    setError('');
    if (!form.name || !form.address || !form.phone) {
      setError('Please fill all the required fields!');
      return;
    }

    const order = {
      items: cartItems.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      totalPrice: getTotalPrice(),
      paymentMethod: form.paymentMethod,
    };

    try {
      const result = await addOrder(order);
      if (result.success) {
        clearCart();
        setOrderPlaced(true);
      } else {
        setError(result.message || 'Failed to place order');
      }
    } catch (err) {
      setError('Failed to place order: ' + (err.message || 'Please try again.'));
    }
  };

  useEffect(() => {
    if (orderPlaced) {
      navigate('/thank-you');
    }
  }, [orderPlaced, navigate]);

  return (
    <div className="checkout-page">
      <h2>🛒 Checkout</h2>
      {error && <p className="error">{error}</p>}
      <div className="checkout-container">
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
            <option value="Cash on Delivery">Cash on Delivery</option>
            <option value="Credit/Debit Card">Credit/Debit Card</option>
            <option value="UPI">UPI</option>
            <option value="Net Banking">Net Banking</option>
          </select>
          <button className="place-order-btn" onClick={handlePlaceOrder}>
            ✅ Place Order
          </button>
        </div>

        <div className="order-summary card">
          <h3>📦 Order Summary</h3>
          {cartItems.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            cartItems.map(item => (
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

      <button className="continue-shopping-btn" onClick={() => navigate('/')}>
        ⬅️ Continue Shopping
      </button>
    </div>
  );
};

export default CheckoutPage;