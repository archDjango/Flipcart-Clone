import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ManageProducts from "../ManageProducts/ManageProducts";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  if (!user || !user.isAdmin) {
    navigate("/"); // Redirect non-admins
    return null;
  }

  return (
    <div className="admin-dashboard-container">
      <div className="admin-sidebar">
        <h2>Admin Dashboard</h2>
        <button className="admin-nav-item" onClick={() => navigate("/admin/products")}>
          Manage Products
        </button>
        {/* Add more navigation items later, e.g., Manage Orders */}
      </div>
      <div className="admin-content">
        <h1>Welcome, Admin {user.name}</h1>
        <ManageProducts />
      </div>
    </div>
  );
};

export default AdminDashboard;