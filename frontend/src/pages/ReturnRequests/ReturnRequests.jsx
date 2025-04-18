import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../context/AuthContext';
import './ReturnRequests.css';

const ReturnRequests = () => {
  const { permissions } = useContext(AuthContext);
  const [returnRequests, setReturnRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmationModal, setConfirmationModal] = useState({
    open: false,
    action: '',
    returnId: null,
    returnReason: '',
  });
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!permissions?.returns?.view) {
      setError('You do not have permission to view return requests');
      setLoading(false);
      return;
    }
    fetchReturnRequests();
  }, [permissions]);

  const fetchReturnRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/returns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReturnRequests(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch return requests: ' + (err.response?.data?.message || 'Unknown error'));
      toast.error('Failed to fetch return requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (returnId, action) => {
    try {
      const endpoint = `/api/returns/${returnId}/${action}`;
      await axios.put(`http://localhost:5000${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Return request ${action}ed successfully!`);
      setConfirmationModal({ open: false, action: '', returnId: null, returnReason: '' });
      fetchReturnRequests();
    } catch (err) {
      toast.error(`Failed to ${action} return request: ${err.response?.data?.message || 'Unknown error'}`);
      setConfirmationModal({ open: false, action: '', returnId: null, returnReason: '' });
    }
  };

  const openConfirmationModal = (action, returnId, returnReason) => {
    setConfirmationModal({ open: true, action, returnId, returnReason });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({ open: false, action: '', returnId: null, returnReason: '' });
  };

  return (
    <div className="return-requests">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Manage Return Requests</h2>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="spinner">Loading return requests...</div>
      ) : returnRequests.length === 0 ? (
        <p>No return requests found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Return ID</th>
              <th>Order ID</th>
              <th>Product</th>
              <th>Seller</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Requested At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {returnRequests.map(request => (
              <tr key={request.id}>
                <td>{request.id}</td>
                <td>{request.order_id}</td>
                <td>{request.product_name}</td>
                <td>{request.seller_name || 'N/A'}</td>
                <td>{request.reason}</td>
                <td>
                  <span className={`status-badge ${request.status.toLowerCase()}`}>
                    {request.status}
                  </span>
                </td>
                <td>{new Date(request.created_at).toLocaleString()}</td>
                <td>
                  {permissions?.returns?.edit && request.status === 'Pending' && (
                    <>
                      <button
                        className="approve-btn"
                        onClick={() => openConfirmationModal('approve', request.id, request.reason)}
                      >
                        Approve
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => openConfirmationModal('reject', request.id, request.reason)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmationModal.open && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Confirm Action</h3>
            <p>
              Are you sure you want to {confirmationModal.action} this return request? <br />
              <strong>Reason:</strong> {confirmationModal.returnReason}
            </p>
            <div className="modal-buttons">
              <button
                className="confirm-btn"
                onClick={() => handleAction(confirmationModal.returnId, confirmationModal.action)}
              >
                Confirm
              </button>
              <button className="cancel-btn" onClick={closeConfirmationModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnRequests;