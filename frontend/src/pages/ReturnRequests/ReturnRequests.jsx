import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../context/AuthContext';
import './ReturnRequests.css';

const ReturnRequests = () => {
  const { permissions } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    if (!permissions?.returns?.view) {
      setError('You do not have permission to view return requests.');
      setLoading(false);
      return;
    }

    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/returns', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRequests(res.data);
        setError('');
      } catch (err) {
        console.error('Error fetching return requests:', err.response?.data || err.message);
        setError('Failed to load return requests: ' + (err.response?.data?.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();

    const ws = new WebSocket('ws://localhost:5001');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'returnStatusUpdate') {
        setRequests(prev => prev.map(req => req.id === data.id ? { ...req, status: data.status } : req));
        toast.info(`Return request #${data.id} updated to ${data.status}`);
      }
    };
    return () => ws.close();
  }, [permissions]);

  const handleStatusChange = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this return request?`)) return;

    try {
      const token = localStorage.getItem('token');
      const endpoint = action === 'approve' ? `/api/returns/${id}/approve` : `/api/returns/${id}/reject`;
      await axios.put(`http://localhost:5000${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
      setRequests(prev => prev.map(req => req.id === id ? { ...req, status: newStatus } : req));
      toast.success(`Return request #${id} ${newStatus.toLowerCase()} successfully`);
      setError('');
    } catch (err) {
      console.error(`Error ${action}ing return request:`, err.response?.data || err.message);
      setError(`Failed to ${action} return request: ` + (err.response?.data?.message || 'Unknown error'));
      toast.error(`Failed to ${action} return request`);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Approved':
        return 'status-approved';
      case 'Rejected':
        return 'status-rejected';
      case 'Pending':
      default:
        return 'status-pending';
    }
  };

  if (loading) return <div className="spinner">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="return-requests">
      <ToastContainer position="top-right" autoClose={5000} />
      <h2>Manage Return Requests</h2>
      {requests.length === 0 ? (
        <p>No return requests found.</p>
      ) : (
        <div className="requests-list">
          {requests.map((request) => (
            <div key={request.id} className="request-item">
              <p><strong>Return ID:</strong> {request.id}</p>
              <p><strong>Order ID:</strong> {request.orderId}</p>
              <p><strong>Customer:</strong> {request.customerName}</p>
              <p><strong>Product:</strong> {request.productName}</p>
              <p><strong>Reason:</strong> {request.reason}</p>
              <p><strong>Status:</strong> <span className={getStatusClass(request.status)}>{request.status}</span></p>
              <div className="request-actions">
                {request.status === 'Pending' && permissions?.returns?.edit && (
                  <>
                    <button
                      className="approve-btn"
                      onClick={() => handleStatusChange(request.id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => handleStatusChange(request.id, 'reject')}
                    >
                      Reject
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedRequest(request)}>View Details</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className="modal">
          <div className="modal-content">
            <h3>Return Request #{selectedRequest.id}</h3>
            <p><strong>Order ID:</strong> {selectedRequest.orderId}</p>
            <p><strong>Customer:</strong> {selectedRequest.customerName}</p>
            <p><strong>Product:</strong> {selectedRequest.productName}</p>
            <p><strong>Reason:</strong> {selectedRequest.reason}</p>
            <p><strong>Status:</strong> <span className={getStatusClass(selectedRequest.status)}>{selectedRequest.status}</span></p>
            <p><strong>Requested At:</strong> {new Date(selectedRequest.createdAt).toLocaleString()}</p>
            <button onClick={() => setSelectedRequest(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnRequests;