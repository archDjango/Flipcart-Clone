import React, { useContext } from 'react';
import './OrderHistory.css';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';

const OrderHistory = () => {
  const { orders } = useContext(AuthContext);
  const { addToCart } = useContext(CartContext);

  const handleReorder = (items) => {
    items.forEach(item => {
      addToCart({ id: Date.now(), ...item }); // Add unique ID for cart
    });
    alert('Order added to cart!');
  };

  // Fallback if orders is undefined
  const safeOrders = Array.isArray(orders) ? orders : [];

  return (
    <div className="order-history">
      <h2>Your Order History</h2>
      {safeOrders.length === 0 ? (
        <p>No past orders found.</p>
      ) : (
        <div className="order-list">
          {safeOrders.map((order, index) => (
            <div key={order.id} className="order-card">
              <h3>Order #{order.id}</h3>
              <p>
                <strong>Date:</strong> {new Date(order.created_at || order.date).toLocaleString()}
              </p>
              <p>
                <strong>Subtotal:</strong> ₹{order.total + (order.discount || 0)}
              </p>
              {order.discount > 0 && (
                <p>
                  <strong>Discount ({order.coupon_code || 'Coupon'}):</strong> -₹{order.discount}
                </p>
              )}
              <p>
                <strong>Total:</strong> ₹{order.total}
              </p>
              <p>
                <strong>Status:</strong> {order.status}
              </p>
              <details>
                <summary>View Order Details</summary>
                <ul>
                  {order.items.map((item, i) => (
                    <li key={i}>
                      {item.name} - ₹{item.price} x {item.quantity}
                    </li>
                  ))}
                </ul>
              </details>
              <button className="reorder-btn" onClick={() => handleReorder(order.items)}>
                Reorder
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;