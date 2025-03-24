import React, { useEffect, useState, useContext } from "react";
import "./OrderHistory.css";
import { CartContext } from "../../context/CartContext";

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    // Fetch orders from localStorage
    const storedOrders = JSON.parse(localStorage.getItem("orders")) || [];
    setOrders(storedOrders);
  }, []);

  const handleReorder = (items) => {
    items.forEach((item) => {
      addToCart(item);
    });
    alert("Order added to cart!");
  };

  return (
    <div className="order-history">
      <h2>Your Order History</h2>
      {orders.length === 0 ? (
        <p>No past orders found.</p>
      ) : (
        <div className="order-list">
          {orders.map((order, index) => (
            <div key={index} className="order-card">
              <h3>Order #{index + 1}</h3>
              <p><strong>Date:</strong> {order.date}</p>
              <p><strong>Total:</strong> ₹{order.totalPrice}</p>
              <p><strong>Status:</strong> {order.status}</p>
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
              <button className="reorder-btn" onClick={() => handleReorder(order.items)}>Reorder</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
