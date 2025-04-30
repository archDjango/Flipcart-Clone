import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar/Sidebar";
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import './Dashboard.css';

const Dashboard = () => {
  const { user, orders, returns } = useContext(AuthContext);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [isSidebarRetracted, setIsSidebarRetracted] = useState(false); // New state for sidebar

  // Load user profile from localStorage
  useEffect(() => {
    const storedProfile = JSON.parse(localStorage.getItem("userProfile"));
    if (storedProfile) setProfile(storedProfile);
  }, []);

  // Show toast notifications for recent order status updates
  useEffect(() => {
    if (orders.length > 0) {
      orders.forEach((order) => {
        if (order.updated_at) {
          const lastUpdated = new Date(order.updated_at).getTime();
          const now = new Date().getTime();
          // Show toast if status updated within the last 5 seconds
          if (now - lastUpdated < 5000) {
            toast.info(`Order #${order.id} status updated to ${order.status}`, {
              position: "top-right",
              autoClose: 3000,
            });
          }
        }
      });
    }
  }, [orders]);

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarRetracted(!isSidebarRetracted);
  };

  // Handle profile updates
  const handleProfileUpdate = (e) => {
    e.preventDefault();
    localStorage.setItem("userProfile", JSON.stringify(profile));
    toast.success("Profile updated successfully!");
    setShowForm(false);
  };

  // Handle return submission
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/returns',
        {
          orderId: selectedOrderId,
          productName: selectedProduct,
          reason: returnReason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Return request submitted successfully!');
      setShowReturnModal(false);
      setSelectedOrderId(null);
      setSelectedProduct("");
      setReturnReason("");
      const res = await axios.get('http://localhost:5000/api/user/returns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Note: Update returns state via AuthContext if needed
    } catch (err) {
      console.error('Submit return error:', err);
      toast.error(err.response?.data?.message || 'Failed to submit return request');
    }
  };

  // Check if order is eligible for return
  const isReturnEligible = (order) => {
    if (order.status === 'Cancelled') return false;
    const orderDate = new Date(order.createdAt);
    const now = new Date();
    const daysSinceOrder = (now - orderDate) / (1000 * 60 * 60 * 24);
    return daysSinceOrder <= 30;
  };

  // Generate timeline events for an order
  const getTimelineEvents = (order) => {
    const events = [
      {
        status: 'Pending',
        date: order.createdAt,
        icon: '⏳',
        description: 'Order placed and awaiting confirmation.',
      },
    ];

    // Add status transitions based on current status and updated_at
    if (order.status !== 'Pending') {
      events.push({
        status: 'Processing',
        date: order.updated_at || new Date(order.createdAt).setHours(new Date(order.createdAt).getHours() + 1),
        icon: '⚙️',
        description: 'Order is being prepared.',
      });
    }
    if (['Shipped', 'Delivered'].includes(order.status)) {
      events.push({
        status: 'Shipped',
        date: order.updated_at || new Date(order.createdAt).setDate(new Date(order.createdAt).getDate() + 1),
        icon: '🚚',
        description: 'Order has been shipped.',
      });
    }
    if (order.status === 'Delivered') {
      events.push({
        status: 'Delivered',
        date: order.updated_at || new Date(order.createdAt).setDate(new Date(order.createdAt).getDate() + 3),
        icon: '✅',
        description: 'Order has been delivered.',
      });
    }
    if (order.status === 'Cancelled') {
      events.push({
        status: 'Cancelled',
        date: order.updated_at || new Date(order.createdAt).setHours(new Date(order.createdAt).getHours() + 2),
        icon: '❌',
        description: 'Order has been cancelled.',
      });
    }

    return events;
  };

  return (
    <div className={`dashboard-container ${isSidebarRetracted ? 'retracted' : ''}`}>
      <Sidebar />
      <button
        className={`sidebar-toggle ${isSidebarRetracted ? 'retracted' : ''}`}
        onClick={toggleSidebar}
      >
        {isSidebarRetracted ? '☰' : '✕'}
      </button>
      <div className="dashboard-content">
        <h2>Welcome, {profile.name || user?.name || "User"}!</h2>

        {/* User Profile Card */}
        <div className="profile-card">
          <div className="profile-card-header">
            <h3>User Profile</h3>
          </div>
          <div className="profile-card-body">
            <p><strong>Name:</strong> {profile.name}</p>
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>Phone:</strong> {profile.phone}</p>
            <p><strong>Address:</strong> {profile.address}</p>
          </div>
          <div className="profile-card-footer">
            <button className="update-profile-btn" onClick={() => setShowForm(true)}>
              Update Profile
            </button>
          </div>
        </div>

        {/* Profile Update Form */}
        {showForm && (
          <div className="profile-form-container">
            <h3>Update Profile</h3>
            <form onSubmit={handleProfileUpdate} className="profile-form">
              <label>Name:</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
              <label>Email:</label>
              <input type="email" value={profile.email} readOnly />
              <label>Phone Number:</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
              <label>Address:</label>
              <textarea
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              />
              <div className="form-buttons">
                <button type="submit">Save Changes</button>
                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Order History */}
        <h3>Order History</h3>
        {orders.length > 0 ? (
          <ul className="order-list">
            {orders.map((order) => (
              <li key={order.id} className="order-item">
                <p><strong>Order ID:</strong> {order.id}</p>
                <p><strong>Total Price:</strong> ₹{order.totalPrice}</p>
                <p><strong>Status:</strong> {order.status}</p>
                <p><strong>Items:</strong></p>
                <ul>
                  {order.items.map((item, index) => (
                    <li key={index}>
                      {item.name} - ₹{item.price} x {item.quantity}
                      {isReturnEligible(order) && (
                        <button
                          className="return-btn"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setSelectedProduct(item.name);
                            setShowReturnModal(true);
                          }}
                        >
                          Request Return
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <h4>Order Tracking</h4>
                <VerticalTimeline layout="1-column-left">
                  {getTimelineEvents(order).map((event, index) => (
                    <VerticalTimelineElement
                      key={index}
                      date={new Date(event.date).toLocaleString()}
                      icon={event.icon}
                      iconStyle={{ background: '#36A2EB', color: '#fff' }}
                    >
                      <h4>{event.status}</h4>
                      <p>{event.description}</p>
                    </VerticalTimelineElement>
                  ))}
                </VerticalTimeline>
              </li>
            ))}
          </ul>
        ) : (
          <p>No past orders found.</p>
        )}

        {/* Return History */}
        <h3>Return History</h3>
        {returns.length > 0 ? (
          <div className="returns-table">
            <table>
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted On</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((ret) => (
                  <tr key={ret.id}>
                    <td>{ret.id}</td>
                    <td>{ret.orderId}</td>
                    <td>{ret.productName}</td>
                    <td>{ret.reason}</td>
                    <td className={`status-${ret.status.toLowerCase()}`}>{ret.status}</td>
                    <td>{new Date(ret.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No return requests found.</p>
        )}

        {/* Return Request Modal */}
        {showReturnModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Request Return</h3>
              <form onSubmit={handleReturnSubmit}>
                <p><strong>Order ID:</strong> {selectedOrderId}</p>
                <p><strong>Product:</strong> {selectedProduct}</p>
                <label>
                  Reason for Return:
                  <textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    required
                    placeholder="Please provide the reason for your return"
                  />
                </label>
                <div className="modal-buttons">
                  <button type="submit">Submit Return</button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowReturnModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;