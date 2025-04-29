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
  const [coupons, setCoupons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [ws, setWs] = useState(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:5001');
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
    
      if (data.type === 'newNotification') {
        // For bulk notifications, check if the current user is affected
        if (
          user &&
          (data.notification.user_id === user.id ||
            data.notification.target === 'all' ||
            (data.notification.target === 'role:user' && user.role === 'user') ||
            (data.notification.target === 'role:admin' && user.role === 'admin'))
        ) {
          setNotifications((prev) => [data.notification, ...prev]);
        }
      } else if (data.type === 'notificationRead' && user && data.user_id === user.id) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === data.notification_id ? { ...notif, is_read: true } : notif
          )
        );
      } else if (data.type === 'notificationDeleted' && user && data.user_id === user.id) {
        setNotifications((prev) => prev.filter((notif) => notif.id !== data.notification_id));
      }
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      websocket.close();
    };
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        console.log('Decoded token:', decoded);
        setUser({ id: decoded.id, name: decoded.name || decoded.email, email: decoded.email });
        setRole(decoded.role);
        if (['admin', 'manager', 'staff'].includes(decoded.role)) {
          fetchPermissions(token, decoded.id);
          fetchInventoryTransactions(token);
          fetchLowStockAlerts(token);
          if (['admin', 'manager'].includes(decoded.role)) {
            fetchCustomers(token);
            fetchNotifications(token, decoded.id);
          }
        } else {
          setPermissions({});
          fetchUserOrders(token);
          fetchUserReturns(token);
          fetchPublicCoupons();
          fetchNotifications(token, decoded.id);
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
      setPermissions(res.data.permissions || {
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
        coupons: { view: false, create: false, edit: false, delete: false },
        customers: { view: false, edit: false },
        notifications: { view: false, create: false, edit: false, delete: false },
      });
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
        coupons: { view: false, create: false, edit: false, delete: false },
        customers: { view: false, edit: false },
        notifications: { view: false, create: false, edit: false, delete: false },
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

  const fetchPublicCoupons = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/public/coupons');
      setCoupons(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching public coupons:', err.message, err.response?.status);
      setCoupons([]);
      return [];
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

  const fetchCustomers = async (token, search = '') => {
    try {
      const params = search ? { search } : {};
      const res = await axios.get('http://localhost:5000/api/customers', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setCustomers(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching customers:', err.message, err.response?.status);
      setCustomers([]);
      return [];
    }
  };

// Updated fetchNotifications function
const fetchNotifications = async (token, userId) => {
  try {
    const res = await axios.get(`http://localhost:5000/api/notifications/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(res.data);
    return res.data;
  } catch (err) {
    console.error('Error fetching notifications:', err.message, err.response?.status);
    setNotifications([]);
    return [];
  }
};

  const createNotification = async (notificationData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/notifications', notificationData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setNotifications((prev) => [res.data, ...prev]);
      return { success: true, notification: res.data };
    } catch (err) {
      console.error('Create notification error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to create notification' };
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await axios.put(
        `http://localhost:5000/api/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      return { success: true };
    } catch (err) {
      console.error('Mark notification as read error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to mark notification as read' };
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`http://localhost:5000/api/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      return { success: true };
    } catch (err) {
      console.error('Delete notification error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to delete notification' };
    }
  };

  const updateCustomerStatus = async (customerId, status) => {
    try {
      const res = await axios.put(
        `http://localhost:5000/api/customers/${customerId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setCustomers(customers.map((customer) =>
        customer.id === customerId ? { ...customer, status } : customer
      ));
      return { success: true, customer: res.data };
    } catch (err) {
      console.error('Update customer status error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to update customer status' };
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
      setUser({ id: decoded.id, name: decoded.name || decoded.email, email: decoded.email });
      setRole(res.data.user.role);
      if (['admin', 'manager', 'staff'].includes(res.data.user.role)) {
        await fetchPermissions(res.data.token, decoded.id);
        await fetchInventoryTransactions(res.data.token);
        await fetchLowStockAlerts(res.data.token);
        if (['admin', 'manager'].includes(res.data.user.role)) {
          await fetchCustomers(res.data.token);
          await fetchNotifications(res.data.token, decoded.id);
        }
      } else {
        setPermissions({});
        await fetchUserOrders(res.data.token);
        await fetchUserReturns(res.data.token);
        await fetchPublicCoupons();
        await fetchNotifications(res.data.token, decoded.id);
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
      setUser({ id: decoded.id, name: decoded.name || decoded.email, email: decoded.email });
      setRole(res.data.user.role);
      await fetchPermissions(res.data.token, decoded.id);
      await fetchInventoryTransactions(res.data.token);
      await fetchLowStockAlerts(res.data.token);
      if (['admin', 'manager'].includes(res.data.user.role)) {
        await fetchCustomers(res.data.token);
        await fetchNotifications(res.data.token, decoded.id);
      }
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
    setCoupons([]);
    setCustomers([]);
    setNotifications([]);
    if (ws) {
      ws.close();
    }
  };

  const addOrder = async (orderData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/orders', orderData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setOrders([...orders, res.data]);
      return { success: true, order: res.data };
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
      setLowStockAlerts(lowStockAlerts.map((alert) =>
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
    setWishlist(wishlist.filter((item) => item.id !== productId));
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
      setOrders(orders.map((order) => (order.id === orderId ? { ...order, status } : order)));
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
        coupons,
        fetchPublicCoupons,
        customers,
        fetchCustomers,
        updateCustomerStatus,
        notifications,
        fetchNotifications,
        createNotification,
        markNotificationAsRead,
        deleteNotification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};