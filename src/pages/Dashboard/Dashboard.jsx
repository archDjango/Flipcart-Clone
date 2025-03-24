import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar/Sidebar"; // Sidebar for navigation
import "./Dashboard.css";

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false); // Controls form visibility

  // Load user profile from localStorage
  useEffect(() => {
    const storedProfile = JSON.parse(localStorage.getItem("userProfile"));
    if (storedProfile) setProfile(storedProfile);

    const storedOrders = JSON.parse(localStorage.getItem("orderHistory")) || [];
    setOrders(storedOrders);
  }, []);

  // Handle profile updates
  const handleProfileUpdate = (e) => {
    e.preventDefault();
    localStorage.setItem("userProfile", JSON.stringify(profile));
    alert("Profile updated successfully!");
    setShowForm(false); // Hide form after updating
  };

  return (
    <div className="dashboard-container">
      <Sidebar /> {/* Sidebar for navigation */}
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

        {/* Profile Update Form (Hidden Initially) */}
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

        {/* Show Order History */}
        <h3>Order History</h3>
        {orders.length > 0 ? (
          <ul className="order-list">
            {orders.map((order, index) => (
              <li key={index} className="order-item">
                <p><strong>Order ID:</strong> {order.id}</p>
                <p><strong>Items:</strong> {order.items.map(item => item.name).join(", ")}</p>
                <p><strong>Total Price:</strong> ₹{order.totalPrice}</p>
                <p><strong>Status:</strong> {order.status}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No past orders found.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
