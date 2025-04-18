import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        console.log('Decoded token:', decoded);
        setUser({ name: decoded.name || decoded.email, email: decoded.email });
        setRole(decoded.role);
        if (['admin', 'manager', 'staff'].includes(decoded.role)) {
          fetchPermissions(token, decoded.id);
          fetchInventoryTransactions(token);
          fetchLowStockAlerts(token);
        } else {
          setPermissions({});
          fetchUserOrders(token);
          fetchUserReturns(token);
        }
      } catch (err) {
        console.error('Invalid token:', err);
        logout();
      }
    }
  }, []);

  const fetchPermissions = async (token, userId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/users/${userId}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Permissions fetched:', res.data.permissions);
      setPermissions(res.data.permissions || {});
    } catch (err) {
      console.error('Error fetching permissions:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setPermissions({
        products: { view: false, create: false, edit: false, delete: false },
        orders: { view: false, create: false, edit: false, delete: false },
        reviews: { view: false, create: false, edit: false, delete: false },
        users: { view: false, create: false, edit: false, delete: false },
        admins: { view: false, create: false, edit: false, delete: false },
        analytics: { view: false, create: false, edit: false, delete: false },
        roles: { view: false, create: false, edit: false, delete: false },
        returns: { view: false, edit: false },
        sellers: { view: false, edit: false },
        inventory: { view: false, edit: false, restock: false, transactions_view: false },
      });
    }
  };

  const fetchUserOrders = async (token) => {
    try {
      const res = await axios.get('http://localhost:5000/api/user/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(res.data);
    } catch (err) {
      console.error('Error fetching user orders:', err.message, err.response?.status);
    }
  };

  const fetchUserReturns = async (token) => {
    try {
      const res = await axios.get('http://localhost:5000/api/user/returns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReturns(res.data);
    } catch (err) {
      console.error('Error fetching user returns:', err.message, err.response?.status);
    }
  };

  const fetchInventoryTransactions = async (token, filters = {}) => {
    try {
      const { product_id, start_date, end_date, transaction_type } = filters;
      const params = {};
      if (product_id) params.product_id = product_id;
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      if (transaction_type) params.transaction_type = transaction_type;

      const res = await axios.get('http://localhost:5000/api/inventory/transactions', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setInventoryTransactions(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching inventory transactions:', err.message, err.response?.status);
      return [];
    }
  };

  const fetchLowStockAlerts = async (token, status = 'active') => {
    try {
      const params = status !== null ? { status } : {};
      const res = await axios.get('http://localhost:5000/api/inventory/low-stock-alerts', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setLowStockAlerts(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching low stock alerts:', err.message, err.response?.status);
      return [];
    }
  };

  const signup = async (userData) => {
    try {
      await axios.post('http://localhost:5000/api/signup', userData);
    } catch (err) {
      throw err.response?.data || { message: 'Signup failed' };
    }
  };

  const login = async ({ email, password }) => {
    try {
      const res = await axios.post('http://localhost:5000/api/login', { email, password });
      localStorage.setItem('token', res.data.token);
      const decoded = jwtDecode(res.data.token);
      console.log('Login decoded token:', decoded);
      setUser(res.data.user);
      setRole(res.data.user.role);
      if (['admin', 'manager', 'staff'].includes(res.data.user.role)) {
        await fetchPermissions(res.data.token, decoded.id);
        await fetchInventoryTransactions(res.data.token);
        await fetchLowStockAlerts(res.data.token);
      } else {
        setPermissions({});
        fetchUserOrders(res.data.token);
        fetchUserReturns(res.data.token);
      }
    } catch (err) {
      throw err.response?.data || { message: 'Login failed' };
    }
  };

  const adminLogin = async ({ email, password }) => {
    try {
      console.log('Admin login payload:', { email, password });
      const res = await axios.post('http://localhost:5000/api/admin-login', { email, password });
      localStorage.setItem('token', res.data.token);
      const decoded = jwtDecode(res.data.token);
      console.log('Admin login decoded token:', decoded);
      setUser(res.data.user);
      setRole(res.data.user.role);
      await fetchPermissions(res.data.token, decoded.id);
      await fetchInventoryTransactions(res.data.token);
      await fetchLowStockAlerts(res.data.token);
    } catch (err) {
      console.error('Admin login error:', err.response?.data || err.message);
      throw err.response?.data || { message: 'Admin login failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setRole(null);
    setPermissions(null);
    setOrders([]);
    setReturns([]);
    setWishlist([]);
    setInventoryTransactions([]);
    setLowStockAlerts([]);
  };

  const addOrder = async (orderData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/orders', orderData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setOrders([...orders, res.data]);
      return { success: true };
    } catch (err) {
      console.error('Add order error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to add order' };
    }
  };

  const restockProduct = async (productId, quantity) => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/products/${productId}/restock`,
        { quantity },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      await fetchInventoryTransactions(localStorage.getItem('token'), { product_id: productId });
      return { success: true, product: res.data };
    } catch (err) {
      console.error('Restock product error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to restock product' };
    }
  };

  const acknowledgeLowStockAlert = async (alertId) => {
    try {
      await axios.put(
        `http://localhost:5000/api/inventory/low-stock-alerts/${alertId}/acknowledge`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setLowStockAlerts(lowStockAlerts.map(alert =>
        alert.id === alertId ? { ...alert, status: 'resolved', acknowledged: true } : alert
      ));
      return { success: true };
    } catch (err) {
      console.error('Acknowledge low stock alert error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to acknowledge alert' };
    }
  };

  const addToWishlist = (product) => {
    setWishlist([...wishlist, product]);
  };

  const removeFromWishlist = (productId) => {
    setWishlist(wishlist.filter(item => item.id !== productId));
  };

  const getUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return res.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to fetch users' };
    }
  };

  const deleteUser = async (email) => {
    try {
      await axios.delete(`http://localhost:5000/api/users/${email}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    } catch (err) {
      throw err.response?.data || { message: 'Failed to delete user' };
    }
  };

  const updateOrder = async (orderId, status) => {
    try {
      const res = await axios.put(
        `http://localhost:5000/api/orders/${orderId}`,
        { status },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setOrders(orders.map(order => order.id === orderId ? { ...order, status } : order));
      return res.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to update order' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        signup,
        login,
        adminLogin,
        logout,
        orders,
        returns,
        addOrder,
        updateOrder,
        wishlist,
        addToWishlist,
        removeFromWishlist,
        getUsers,
        deleteUser,
        inventoryTransactions,
        lowStockAlerts,
        fetchInventoryTransactions,
        fetchLowStockAlerts,
        restockProduct,
        acknowledgeLowStockAlert,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};