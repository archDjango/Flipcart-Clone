import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import './Notifications.css';

const Notifications = ({ onClose }) => {
  const { notifications, markNotificationAsRead, deleteNotification } = useContext(AuthContext);

  const handleMarkAsRead = async (notificationId) => {
    const result = await markNotificationAsRead(notificationId);
    if (result.success) {
      toast.success('Notification marked as read');
    } else {
      toast.error(result.message);
    }
  };

  const handleDelete = async (notificationId) => {
    const result = await deleteNotification(notificationId);
    if (result.success) {
      toast.success('Notification deleted');
    } else {
      toast.error(result.message);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read);

  return (
    <div className="notifications-dropdown">
      <div className="notifications-header">
        <h3>Notifications</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      {notifications.length === 0 ? (
        <p className="no-notifications">No notifications</p>
      ) : (
        <>
          {unreadNotifications.length > 0 && (
            <div className="notifications-section">
              <h4>Unread ({unreadNotifications.length})</h4>
              {unreadNotifications.map(notification => (
                <div key={notification.id} className="notification-item unread">
                  <div className="notification-content">
                    <h5>{notification.title}</h5>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="notification-actions">
                    <button
                      className="mark-read-btn"
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      Mark as Read
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(notification.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {readNotifications.length > 0 && (
            <div className="notifications-section">
              <h4>Read ({readNotifications.length})</h4>
              {readNotifications.map(notification => (
                <div key={notification.id} className="notification-item read">
                  <div className="notification-content">
                    <h5>{notification.title}</h5>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="notification-actions">
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(notification.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Notifications;