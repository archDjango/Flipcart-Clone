import React, { useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './CheckoutPage.css';

const CheckoutPage = () => {
  const { cartItems, getTotalPrice, getDiscount, clearCart, selectCoupon, selectedCoupon } = useContext(CartContext);
  const { coupons } = useContext(AuthContext); // Removed addOrder, using axios directly
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

  const handleCouponChange = (e) => {
    const couponCode = e.target.value;
    if (!couponCode) {
      selectCoupon(null);
    } else {
      const coupon = coupons.find(c => c.code === couponCode);
      selectCoupon(coupon || null);
    }
  };

  const handlePlaceOrder = async () => {
    setError('');
    if (!form.name || !form.address || !form.phone) {
      setError('Please fill all the required fields!');
      return;
    }

    const totalPrice = getTotalPrice();
    const order = {
      items: cartItems.map(item => ({
        productId: item.id, // Changed to productId for backend consistency
        quantity: item.quantity,
        price: item.price, // Added price for backend
      })),
      totalPrice, // Added totalPrice
      shippingAddress: form.address, // Changed to shippingAddress for backend
      paymentMethod: form.paymentMethod,
      coupon_code: selectedCoupon ? selectedCoupon.code : undefined,
    };

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/orders', order, {
        headers: { Authorization: `Bearer ${token}` },
      });
      clearCart();
      setOrderPlaced(true);
    } catch (err) {
      console.error('Add order error:', err.response?.data || err.message);
      setError('Failed to place order: ' + (err.response?.data?.message || 'Please try again.'));
    }
  };

  useEffect(() => {
    if (orderPlaced) {
      navigate('/thank-you');
    }
  }, [orderPlaced, navigate]);

  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const discount = getDiscount();
  const finalTotal = getTotalPrice();

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
          <h3>💸 Apply Coupon</h3>
          <select onChange={handleCouponChange} value={selectedCoupon ? selectedCoupon.code : ''}>
            <option value="">No Coupon</option>
            {coupons.map(coupon => (
              <option key={coupon.id} value={coupon.code}>
                {coupon.code} ({coupon.discount_type === 'flat' ? `₹${coupon.discount_value}` : `${coupon.discount_value}%`})
              </option>
            ))}
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
          <h4>Subtotal: ₹{subtotal.toFixed(2)}</h4>
          {discount > 0 && <h4>Discount: -₹{discount.toFixed(2)}</h4>}
          <h4>Total: ₹{finalTotal.toFixed(2)}</h4>
        </div>
      </div>

      <button className="continue-shopping-btn" onClick={() => navigate('/')}>
        ⬅️ Continue Shopping
      </button>
    </div>
  );
};

export default CheckoutPage;