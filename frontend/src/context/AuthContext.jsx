import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';

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
  const [productPricing, setProductPricing] = useState({});
  const [questions, setQuestions] = useState([]);
  const [moderationFlags, setModerationFlags] = useState([]);
  const [userActivities, setUserActivities] = useState([]);
  const activityDebounceRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:5001');
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        if (data.type === 'newNotification' && user) {
          if (
            data.notification.user_id === user.id ||
            data.notification.target === 'all' ||
            (data.notification.target === 'role:user' && user.role === 'user') ||
            (data.notification.target === 'role:admin' && user.role === 'admin')
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
        } else if (data.type === 'orderStatusUpdate' && user && data.user_id === user.id) {
          setOrders((prev) =>
            prev.map((order) =>
              order.id === data.order_id
                ? { ...order, status: data.status, updated_at: data.updated_at }
                : order
            )
          );
        } else if (data.type === 'priceUpdate') {
          setProductPricing((prev) => ({
            ...prev,
            [data.product_id]: {
              base_price: data.base_price,
              current_price: data.current_price,
              price_change_reason: data.price_change_reason,
              price_update_time: new Date().toISOString(),
            },
          }));
        } else if (data.type === 'newQuestion' && user) {
          setQuestions((prev) => [
            {
              question_id: data.question_id,
              product_id: data.product_id,
              question_text: data.question_text,
              question_user_id: data.user_id,
              question_created_at: new Date().toISOString(),
              answers: [],
            },
            ...prev,
          ]);
        } else if (data.type === 'newAnswer' && user) {
          setQuestions((prev) =>
            prev.map((q) =>
              q.question_id === data.question_id
                ? {
                    ...q,
                    answers: [
                      ...q.answers,
                      {
                        answer_id: data.answer_id,
                        answer_text: data.answer_text,
                        answer_user_id: data.user_id,
                        answer_created_at: new Date().toISOString(),
                        upvotes: 0,
                        downvotes: 0,
                        is_most_helpful: false,
                      },
                    ],
                  }
                : q
            )
          );
        } else if (data.type === 'voteUpdate' && user) {
          setQuestions((prev) =>
            prev.map((q) =>
              q.question_id === data.question_id
                ? {
                    ...q,
                    answers: q.answers.map((a) =>
                      a.answer_id === data.answer_id
                        ? {
                            ...a,
                            upvotes:
                              data.vote_type === 'upvote'
                                ? a.upvotes + 1
                                : a.upvotes > 0
                                ? a.upvotes - 1
                                : a.upvotes,
                            downvotes:
                              data.vote_type === 'downvote'
                                ? a.downvotes + 1
                                : a.downvotes > 0
                                ? a.downvotes - 1
                                : a.downvotes,
                          }
                        : a
                    ),
                  }
                : q
            )
          );
        } else if (data.type === 'helpfulAnswer' && user) {
          setQuestions((prev) =>
            prev.map((q) =>
              q.question_id === data.question_id
                ? {
                    ...q,
                    answers: q.answers.map((a) => ({
                      ...a,
                      is_most_helpful: a.answer_id === data.answer_id,
                    })),
                  }
                : q
            )
          );
        } else if (data.type === 'newModerationFlag' && user && ['admin', 'manager'].includes(user.role)) {
          setModerationFlags((prev) => [
            {
              flag_id: data.flag_id,
              content_type: data.content_type,
              content_id: data.content_id,
              content_text: data.content_text,
              flagged_by_user_id: data.flagged_by_user_id,
              reason: data.reason,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        } else if (data.type === 'moderationStatusUpdate' && user && ['admin', 'manager'].includes(user.role)) {
          setModerationFlags((prev) =>
            prev.map((flag) =>
              flag.flag_id === data.flag_id
                ? { ...flag, status: data.status }
                : flag
            )
          );
          if (data.status === 'rejected') {
            setQuestions((prev) =>
              prev.filter((q) =>
                data.content_type === 'question' && q.question_id === data.content_id
                  ? false
                  : {
                      ...q,
                      answers:
                        data.content_type === 'answer'
                          ? q.answers.filter((a) => a.answer_id !== data.content_id)
                          : q.answers,
                    }
              )
            );
          }
        } else if (data.type === 'userActivityLog' && user) {
          // Debounce activity updates
          if (activityDebounceRef.current) {
            clearTimeout(activityDebounceRef.current);
          }
          activityDebounceRef.current = setTimeout(() => {
            if (data.user_id === user.id || ['admin', 'manager'].includes(user.role)) {
              let parsedMetadata = data.metadata;
              if (typeof data.metadata === 'string') {
                try {
                  parsedMetadata = JSON.parse(data.metadata);
                } catch (err) {
                  console.error('Failed to parse WebSocket metadata:', err, { metadata: data.metadata });
                  parsedMetadata = { error: 'Invalid metadata' };
                }
              }
              setUserActivities((prev) => {
                // Avoid duplicates
                if (prev.some(activity => activity.id === data.activity_id)) {
                  return prev;
                }
                return [
                  {
                    id: data.activity_id,
                    user_id: data.user_id,
                    action_type: data.action_type,
                    description: data.description,
                    timestamp: data.timestamp,
                    metadata: parsedMetadata,
                  },
                  ...prev,
                ];
              });
            }
          }, 500);
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err.message, { rawData: event.data });
      }
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setWs(null);
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
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
            fetchModerationFlags(token);
            fetchAdminActivities(token);
          }
        } else {
          setPermissions({});
          fetchUserOrders(token);
          fetchUserReturns(token);
          fetchPublicCoupons();
          fetchNotifications(token, decoded.id);
          fetchUserActivities(token, decoded.id);
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
        moderation: { view: false, edit: false },
        activity: { view: false },
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
        moderation: { view: false, edit: false },
        activity: { view: false },
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
      toast.error('Failed to fetch orders');
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
      toast.error('Failed to fetch returns');
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

  const fetchQuestions = async (productId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/questions/${productId}`);
      setQuestions(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching questions:', err.message, err.response?.status);
      setQuestions([]);
      return [];
    }
  };

  const submitQuestion = async (questionData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/questions', questionData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      await logActivity({
        action_type: 'view',
        description: `Submitted question for product ${questionData.product_id}`,
        metadata: { question_id: res.data.question_id, product_id: questionData.product_id },
      });
      return { success: true, question: res.data };
    } catch (err) {
      console.error('Submit question error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.error || 'Failed to submit question' };
    }
  };

  const submitAnswer = async (answerData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/answers', answerData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      await logActivity({
        action_type: 'view',
        description: `Submitted answer for question ${answerData.question_id}`,
        metadata: { answer_id: res.data.answer_id, question_id: answerData.question_id },
      });
      return { success: true, answer: res.data };
    } catch (err) {
      console.error('Submit answer error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.error || 'Failed to submit answer' };
    }
  };

  const voteAnswer = async (answerId, voteType) => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/answers/${answerId}/vote`,
        { vote_type: voteType },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      await logActivity({
        action_type: 'view',
        description: `Voted ${voteType} on answer ${answerId}`,
        metadata: { answer_id: answerId, vote_type: voteType },
      });
      return { success: true, message: res.data.message };
    } catch (err) {
      console.error('Vote answer error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.error || 'Failed to vote on answer' };
    }
  };

  const markAnswerHelpful = async (answerId, questionId) => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/answers/${answerId}/helpful`,
        { question_id: questionId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      await logActivity({
        action_type: 'view',
        description: `Marked answer ${answerId} as helpful for question ${questionId}`,
        metadata: { answer_id: answerId, question_id: questionId },
      });
      return { success: true, message: res.data.message };
    } catch (err) {
      console.error('Mark helpful error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.error || 'Failed to mark answer as helpful' };
    }
  };

  const flagContent = async (flagData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/moderation/flag', flagData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      await logActivity({
        action_type: 'view',
        description: `Flagged ${flagData.content_type} ${flagData.content_id} for moderation`,
        metadata: { flag_id: res.data.flag_id, content_type: flagData.content_type, content_id: flagData.content_id },
      });
      return { success: true, flag: res.data };
    } catch (err) {
      console.error('Flag content error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.error || 'Failed to flag content' };
    }
  };

  const fetchModerationFlags = async (token, status = 'pending') => {
    try {
      const res = await axios.get('http://localhost:5000/api/moderation/flags', {
        headers: { Authorization: `Bearer ${token}` },
        params: { status },
      });
      setModerationFlags(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching moderation flags:', err.message, err.response?.status);
      setModerationFlags([]);
      return [];
    }
  };

  const updateModerationStatus = async (flagId, status) => {
    try {
      const res = await axios.patch(
        `http://localhost:5000/api/moderation/flags/${flagId}`,
        { status },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      await logActivity({
        action_type: 'view',
        description: `Updated moderation flag ${flagId} to status ${status}`,
        metadata: { flag_id: flagId, status },
      });
      return { success: true, message: res.data.message };
    } catch (err) {
      console.error('Update moderation status error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.error || 'Failed to update moderation status' };
    }
  };

  const logActivity = async (activityData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/activity/log', activityData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return { success: true, activity: res.data };
    } catch (err) {
      console.error('Log activity error:', err.response?.data || err.message);
      toast.error('Failed to log activity');
      return { success: false, message: err.response?.data?.message || 'Failed to log activity' };
    }
  };

  const fetchUserActivities = async (token, userId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/activity/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserActivities(res.data || []);
      return res.data;
    } catch (err) {
      console.error('Error fetching user activities:', err.message, err.response?.status);
      toast.error('Failed to fetch user activities');
      setUserActivities([]);
      return [];
    }
  };

  const fetchAdminActivities = async (token, filters = {}) => {
    try {
      const { user_id, action_type, start_date, end_date } = filters;
      const params = {};
      if (user_id) params.user_id = user_id;
      if (action_type) params.action_type = action_type;
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;

      const res = await axios.get('http://localhost:5000/api/activity/admin', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setUserActivities(res.data || []);
      return res.data;
    } catch (err) {
      console.error('Error fetching admin activities:', err.message, err.response?.status);
      toast.error('Failed to fetch admin activities');
      setUserActivities([]);
      return [];
    }
  };

  const createNotification = async (notificationData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/notifications', notificationData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setNotifications((prev) => [res.data, ...prev]);
      await logActivity({
        action_type: 'view',
        description: `Created notification ${res.data.id}`,
        metadata: { notification_id: res.data.id, target: notificationData.target },
      });
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
      await logActivity({
        action_type: 'view',
        description: `Marked notification ${notificationId} as read`,
        metadata: { notification_id: notificationId },
      });
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
      await logActivity({
        action_type: 'view',
        description: `Deleted notification ${notificationId}`,
        metadata: { notification_id: notificationId },
      });
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
      await logActivity({
        action_type: 'account_update',
        description: `Updated customer ${customerId} status to ${status}`,
        metadata: { customer_id: customerId, status },
      });
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
          await fetchModerationFlags(res.data.token);
          await fetchAdminActivities(res.data.token);
        }
      } else {
        setPermissions({});
        await fetchUserOrders(res.data.token);
        await fetchUserReturns(res.data.token);
        await fetchPublicCoupons();
        await fetchNotifications(res.data.token, decoded.id);
        await fetchUserActivities(res.data.token, decoded.id);
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
        await fetchModerationFlags(res.data.token);
        await fetchAdminActivities(res.data.token);
      }
    } catch (err) {
      console.error('Admin login error:', err.response?.data || err.message);
      throw err.response?.data || { message: 'Admin login failed' };
    }
  };

  const logout = async () => {
    try {
      await logActivity({
        action_type: 'logout',
        description: 'User logged out',
        metadata: { email: user?.email },
      });
    } catch (err) {
      console.error('Logout activity logging error:', err.message);
    }
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
    setProductPricing({});
    setQuestions([]);
    setModerationFlags([]);
    setUserActivities([]);
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
      await logActivity({
        action_type: 'view',
        description: `Restocked product ${productId} with ${quantity} units`,
        metadata: { product_id: productId, quantity },
      });
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
      await logActivity({
        action_type: 'view',
        description: `Acknowledged low stock alert ${alertId}`,
        metadata: { alert_id: alertId },
      });
      return { success: true };
    } catch (err) {
      console.error('Acknowledge low stock alert error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to acknowledge alert' };
    }
  };

  const addToWishlist = async (product) => {
    setWishlist([...wishlist, product]);
    await logActivity({
      action_type: 'view',
      description: `Added product ${product.id} to wishlist`,
      metadata: { product_id: product.id },
    });
  };

  const removeFromWishlist = async (productId) => {
    setWishlist(wishlist.filter((item) => item.id !== productId));
    await logActivity({
      action_type: 'view',
      description: `Removed product ${productId} from wishlist`,
      metadata: { product_id: productId },
    });
  };

  const getUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      await logActivity({
        action_type: 'view',
        description: 'Viewed user list',
        metadata: {},
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
      await logActivity({
        action_type: 'account_update',
        description: `Deleted user with email ${email}`,
        metadata: { email },
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
      await logActivity({
        action_type: 'view',
        description: `Updated order ${orderId} status to ${status}`,
        metadata: { order_id: orderId, status },
      });
      return res.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to update order' };
    }
  };

  const fetchProductPrice = async (productId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/product-price/${productId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setProductPricing((prev) => ({
        ...prev,
        [productId]: {
          base_price: res.data.base_price,
          current_price: res.data.current_price,
          stock_quantity: res.data.stock_quantity,
          demand_level: res.data.demand_level,
          price_update_time: res.data.price_update_time,
          price_change_reason: res.data.price_change_reason,
        },
      }));
      await logActivity({
        action_type: 'view',
        description: `Fetched price for product ${productId}`,
        metadata: { product_id: productId },
      });
      return { success: true, pricing: res.data };
    } catch (err) {
      console.error('Error fetching product price:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to fetch product price' };
    }
  };

  const updateProductPrice = async (pricingData) => {
    try {
      const res = await axios.post('http://localhost:5000/api/product-price/update', pricingData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setProductPricing((prev) => ({
        ...prev,
        [res.data.product_id]: {
          base_price: res.data.base_price,
          current_price: res.data.current_price,
          stock_quantity: res.data.stock_quantity,
          demand_level: res.data.demand_level,
          price_update_time: new Date().toISOString(),
          price_change_reason: res.data.price_change_reason,
        },
      }));
      await logActivity({
        action_type: 'view',
        description: `Updated price for product ${res.data.product_id}`,
        metadata: { product_id: res.data.product_id, current_price: res.data.current_price },
      });
      return { success: true, pricing: res.data };
    } catch (err) {
      console.error('Update product price error:', err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Failed to update product price' };
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
        productPricing,
        fetchProductPrice,
        updateProductPrice,
        questions,
        fetchQuestions,
        submitQuestion,
        submitAnswer,
        voteAnswer,
        markAnswerHelpful,
        flagContent,
        moderationFlags,
        fetchModerationFlags,
        updateModerationStatus,
        userActivities,
        logActivity,
        fetchUserActivities,
        fetchAdminActivities,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};