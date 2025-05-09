import React, { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar/Sidebar";
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import './Dashboard.css';

// Heroicons SVG icons (inline for consistency)
const actionIcons = {
  login: (
    <svg className="activity-timeline__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  ),
  download: (
    <svg className="activity-timeline__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  account_update: (
    <svg className="activity-timeline__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  purchase: (
    <svg className="activity-timeline__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  view: (
    <svg className="activity-timeline__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  default: (
    <svg className="activity-timeline__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
    </svg>
  ),
};

const Dashboard = () => {
  const { user, orders, returns, userActivities, fetchUserActivities, logActivity, downloadInvoice } = useContext(AuthContext);
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
  const [isSidebarRetracted, setIsSidebarRetracted] = useState(false);
  const lastFetchedUserId = useRef(null);

  // Fetch user activities on mount or user change
  useEffect(() => {
    if (user && user.id && lastFetchedUserId.current !== user.id) {
      const token = localStorage.getItem('token');
      fetchUserActivities(token, user.id).catch(err => {
        console.error('Failed to fetch activities:', err);
        toast.error('Failed to load user activities');
      });
      lastFetchedUserId.current = user.id;
    }
  }, [user, fetchUserActivities]);

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

  // Filter activities for the last 7 days or last 10 actions
  const filteredActivities = userActivities
    .filter((activity) => {
      if (!activity || !activity.timestamp) return false;
      const activityDate = new Date(activity.timestamp);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return activityDate >= sevenDaysAgo;
    })
    .slice(0, 10);

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarRetracted(!isSidebarRetracted);
  };

  // Handle profile updates
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    localStorage.setItem("userProfile", JSON.stringify(profile));
    toast.success("Profile updated successfully!");
    setShowForm(false);
    try {
      await logActivity({
        action_type: 'account_update',
        description: 'Updated user profile',
        metadata: { email: profile.email },
      });
    } catch (err) {
      console.error('Failed to log profile update activity:', err);
      toast.error('Failed to log profile update');
    }
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
      await logActivity({
        action_type: 'view',
        description: `Submitted return request for order ${selectedOrderId}`,
        metadata: { order_id: selectedOrderId, product: selectedProduct },
      });
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
                <p><strong>Total Price:</strong> ₹{order.totalPrice || order.total}</p>
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
                <button
    className="download-invoice-btn"
    onClick={() => downloadInvoice(order.id)}
  >
    Download Invoice
  </button>
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

        {/* Activity Timeline */}
        <h3>Recent Activity</h3>
        {filteredActivities.length > 0 ? (
          <div className="activity-timeline">
            <ul className="activity-timeline__list">
              {filteredActivities.map((activity) => (
                <li
                  key={activity.id}
                  className={`activity-timeline__item activity-timeline__item--${activity.action_type || 'default'}`}
                >
                  <div className="activity-timeline__icon-container">
                    {actionIcons[activity.action_type] || actionIcons.default}
                  </div>
                  <div className="activity-timeline__content">
                    <p className="activity-timeline__description">{activity.description}</p>
                    <p className="activity-timeline__timestamp">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                    {activity.metadata && (
                      <p className="activity-timeline__metadata">
                        Details: {JSON.stringify(activity.metadata, null, 2)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>No recent activity found.</p>
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