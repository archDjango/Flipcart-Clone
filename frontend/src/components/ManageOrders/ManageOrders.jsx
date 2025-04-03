import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import "./ManageOrders.css";

const ManageOrders = () => {
  const { updateOrder } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("Please log in to view orders");
        return;
      }
      try {
        const res = await axios.get('http://localhost:5000/api/orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('ManageOrders fetched orders:', res.data);
        setOrders(res.data);
        setError("");
      } catch (err) {
        console.error('Error fetching orders in ManageOrders:', err.response?.data || err.message);
        setError("Failed to fetch orders: " + (err.response?.data?.message || "Unknown error"));
      }
    };
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const updatedOrder = await updateOrder(orderId, newStatus);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setError("");
    } catch (err) {
      setError("Failed to update order: " + (err.response?.data?.message || "Unknown error"));
    }
  };

  return (
    <div className="manage-orders">
      <h2>Manage Orders</h2>
      {error && <p className="error">{error}</p>}
      {orders.length === 0 && !error ? (
        <p>No orders found.</p>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} className="order-item">
              <h3>Order #{order.id}</h3>
              <p><strong>User:</strong> {order.userEmail}</p>
              <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
              <p><strong>Total:</strong> ₹{order.totalPrice}</p>
              <p><strong>Items:</strong> {order.items.map(item => item.name).join(", ")}</p>
              <p><strong>Status:</strong> {order.status}</p>
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(order.id, e.target.value)}
              >
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageOrders;