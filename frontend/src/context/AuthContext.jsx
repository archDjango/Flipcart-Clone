// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);

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
        } else {
          setPermissions({}); // Regular users have no permissions
        }
        if (decoded.role === 'user') fetchUserOrders(token);
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
      });
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
      } else {
        setPermissions({});
      }
      if (res.data.user.role === 'user') fetchUserOrders(res.data.token);
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
    setWishlist([]);
  };

  const fetchUserOrders = async (token) => {
    try {
      const res = await axios.get('http://localhost:5000/api/user/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(res.data);
    } catch (err) {
      console.error('Error fetching user orders:', err.message);
    }
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
        addOrder,
        updateOrder,
        wishlist,
        addToWishlist,
        removeFromWishlist,
        getUsers,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};