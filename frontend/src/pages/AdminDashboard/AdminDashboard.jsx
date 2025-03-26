import React, { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ManageProducts from "../../components/ManageProducts/ManageProducts";
import ManageOrders from "../../components/ManageOrders/ManageOrders";
import ManageUsers from "../../components/ManageUsers/ManageUsers";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const { role, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("products");

  useEffect(() => {
    if (role !== 'admin') {
      navigate("/admin-login");
    }
  }, [role, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/admin-login");
  };

  if (role !== 'admin') return null;

  return (
    <div className="admin-dashboard-container">
      <div className="admin-sidebar">
        <h2>Admin Dashboard</h2>
        <button
          className={`admin-nav-item ${activeSection === "products" ? "active" : ""}`}
          onClick={() => setActiveSection("products")}
        >
          Manage Products
        </button>
        <button
          className={`admin-nav-item ${activeSection === "orders" ? "active" : ""}`}
          onClick={() => setActiveSection("orders")}
        >
          Manage Orders
        </button>
        <button
          className={`admin-nav-item ${activeSection === "users" ? "active" : ""}`}
          onClick={() => setActiveSection("users")}
        >
          Manage Users
        </button>
        <button className="admin-nav-item" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <div className="admin-content">
        <h1>Welcome, Admin {user?.name}</h1>
        {activeSection === "products" && <ManageProducts />}
        {activeSection === "orders" && <ManageOrders />}
        {activeSection === "users" && <ManageUsers />}
      </div>
    </div>
  );
};

export default AdminDashboard;