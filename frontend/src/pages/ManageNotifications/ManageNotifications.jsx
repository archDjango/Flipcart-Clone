import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './ManageNotifications.css';

const ManageNotifications = () => {
  const { permissions, notifications, createNotification, user } = useContext(AuthContext);
  const [form, setForm] = useState({
    title: '',
    message: '',
    target: 'all',
    targetId: '',
    priority: 'normal',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!permissions?.notifications?.view) {
      setError('You do not have permission to view notifications');
      setLoading(false);
      return;
    }
    fetchUsers();
    setLoading(false);
  }, [permissions]);

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to fetch users');
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.message.trim()) newErrors.message = 'Message is required';
    if (form.target === 'user' && !form.targetId) newErrors.targetId = 'Please select a user';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const notificationData = {
      title: form.title,
      message: form.message,
      target: form.target,
      targetId: form.target === 'user' ? form.targetId : undefined,
      priority: form.priority,
    };

    const result = await createNotification(notificationData);
    if (result.success) {
      toast.success('Notification sent successfully!');
      setForm({ title: '', message: '', target: 'all', targetId: '', priority: 'normal' });
      // Fetch notifications for the current user if they are an admin
      if (user && ['admin', 'manager'].includes(user.role)) {
        const token = localStorage.getItem('token');
        try {
          const res = await axios.get(`http://localhost:5000/api/notifications/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setNotifications(res.data);
        } catch (err) {
          console.error('Error fetching notifications after creation:', err.message);
        }
      }
    } else {
      toast.error(result.message);
    }
  };

  if (loading) {
    return <div className="spinner">Loading...</div>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  return (
    <div className="manage-notifications">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Manage Notifications</h2>

      <div className="notification-form card">
        <h3>Create Notification</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              className={errors.title ? 'input-error' : ''}
              placeholder="Enter notification title"
            />
            {errors.title && <span className="error">{errors.title}</span>}
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              className={errors.message ? 'input-error' : ''}
              placeholder="Enter notification message"
              rows="4"
            />
            {errors.message && <span className="error">{errors.message}</span>}
          </div>
          <div className="form-group">
            <label>Target Audience</label>
            <select name="target" value={form.target} onChange={handleChange}>
              <option value="all">All Users</option>
              <option value="user">Specific User</option>
              <option value="role:user">Customers</option>
              <option value="role:admin">Admins</option>
            </select>
          </div>
          {form.target === 'user' && (
            <div className="form-group">
              <label>Select User</label>
              <select
                name="targetId"
                value={form.targetId}
                onChange={handleChange}
                className={errors.targetId ? 'input-error' : ''}
              >
                <option value="">Select a user</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                ))}
              </select>
              {errors.targetId && <span className="error">{errors.targetId}</span>}
            </div>
          )}
          <div className="form-group">
            <label>Priority</label>
            <select name="priority" value={form.priority} onChange={handleChange}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="form-buttons">
            <button type="submit" className="send-btn">Send Notification</button>
          </div>
        </form>
      </div>

      <div className="notification-history card">
  <h3>Sent Notifications</h3>
  {notifications.length === 0 ? (
    <p>No notifications sent.</p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Message</th>
          <th>Target</th>
          <th>Priority</th>
          <th>Sent At</th>
        </tr>
      </thead>
      <tbody>
        {notifications.map(notification => (
          <tr key={notification.id}>
            <td>{notification.id}</td>
            <td>{notification.title}</td>
            <td>{notification.message}</td>
            <td>{notification.user_id ? `User ${notification.user_id}` : 'Multiple'}</td>
            <td>
              {notification.priority
                ? notification.priority.charAt(0).toUpperCase() + notification.priority.slice(1)
                : 'Normal'}
            </td>
            <td>{new Date(notification.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
    </div>
  );
};

export default ManageNotifications;