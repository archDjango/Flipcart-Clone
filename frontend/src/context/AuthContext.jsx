import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ name: decoded.name, email: decoded.email });
        setRole(decoded.role);
        if (decoded.role === 'user') fetchUserOrders(token);
      } catch (err) {
        console.error('Invalid token:', err);
        logout();
      }
    }
  }, []);

  const signup = async (name, email, password, adminCode, phone, address) => {
    try {
      await axios.post('http://localhost:5000/api/signup', { name, email, password, adminCode, phone, address });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response.data.message };
    }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post('http://localhost:5000/api/login', { email, password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setRole(res.data.user.role);
      if (res.data.user.role === 'user') fetchUserOrders(res.data.token);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response.data.message };
    }
  };

  const adminLogin = async (email, password) => {
    try {
      const res = await axios.post('http://localhost:5000/api/admin-login', { email, password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setRole('admin');
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response.data.message };
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setOrders([]);
    localStorage.removeItem('token');
  };

  const fetchUserOrders = async (token) => {
    try {
      const res = await axios.get('http://localhost:5000/api/user/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched orders:', res.data);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching orders:', err.response?.data || err.message);
      setOrders([]);
    }
  };

  const addOrder = async (order) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:5000/api/orders', order, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders([...orders, res.data]);
      return { success: true, data: res.data };
    } catch (err) {
      console.error('Error adding order:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to add order' };
    }
  };

  const getUsers = async () => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    const res = await axios.get('http://localhost:5000/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  const deleteUser = async (email) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    await axios.delete(`http://localhost:5000/api/users/${email}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { success: true };
  };

  const updateOrder = async (orderId, status) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    const res = await axios.put(
      `http://localhost:5000/api/orders/${orderId}`,
      { status },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.data;
  };

  const addToWishlist = (product) => {
    if (!wishlist.some(item => item.id === product.id)) {
      const updatedWishlist = [...wishlist, product];
      setWishlist(updatedWishlist);
      localStorage.setItem('wishlist', JSON.stringify(updatedWishlist));
    }
  };

  const removeFromWishlist = (productId) => {
    const updatedWishlist = wishlist.filter(item => item.id !== productId);
    setWishlist(updatedWishlist);
    localStorage.setItem('wishlist', JSON.stringify(updatedWishlist));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
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