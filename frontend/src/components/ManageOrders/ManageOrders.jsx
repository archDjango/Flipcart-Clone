import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import "./ManageOrders.css";

const ManageOrders = () => {
  const { updateOrder } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("Please log in to view orders");
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get('http://localhost:5000/api/orders', {
          headers: { Authorization: `Bearer ${token}` },
          params: { status: statusFilter !== "all" ? statusFilter : undefined },
        });
        console.log('ManageOrders fetched orders:', res.data);
        setOrders(res.data);
        setFilteredOrders(res.data);
        setError("");
      } catch (err) {
        console.error('Error fetching orders:', err.response?.data || err.message);
        setError("Failed to fetch orders: " + (err.response?.data?.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();

    const ws = new WebSocket('ws://localhost:5001');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setOrders(prev => prev.map(o => o.id === data.id ? { ...o, status: data.status } : o));
    };
    return () => ws.close();
  }, [statusFilter]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrder(orderId, newStatus);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setFilteredOrders(filteredOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setError("");
    } catch (err) {
      setError("Failed to update order: " + (err.response?.data?.message || "Unknown error"));
    }
  };

  const statusOptions = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

  return (
    <div className="manage-orders">
      <h2>Manage Orders</h2>
      {error && <p className="error">{error}</p>}

      {/* Status Filter */}
      <div className="filter-section">
        <label>Filter by Status: </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All</option>
          {statusOptions.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading orders...</p>
      ) : filteredOrders.length === 0 && !error ? (
        <p>No orders found.</p>
      ) : (
        <div className="order-list">
          {filteredOrders.map((order) => (
            <div key={order.id} className="order-item">
              <h3>Order #{order.id}</h3>
              <p><strong>User:</strong> {order.userEmail}</p>
              <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
              <p><strong>Total:</strong> ₹{order.totalPrice}</p>
              <p><strong>Status:</strong> {order.status}</p>
              <button onClick={() => setSelectedOrder(order)}>View Details</button>
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(order.id, e.target.value)}
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal">
          <div className="modal-content">
            <h3>Order #{selectedOrder.id}</h3>
            <p><strong>User:</strong> {selectedOrder.userEmail}</p>
            <p><strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
            <p><strong>Total:</strong> ₹{selectedOrder.totalPrice}</p>
            <p><strong>Status:</strong> {selectedOrder.status}</p>
            <h4>Items:</h4>
            <ul>
              {selectedOrder.items.map((item, i) => (
                <li key={i}>{item.name} - ₹{item.price} x {item.quantity}</li>
              ))}
            </ul>
            <button onClick={() => setSelectedOrder(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageOrders;