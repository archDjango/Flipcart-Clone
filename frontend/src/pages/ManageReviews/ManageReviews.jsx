import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './ManageReviews.css';

const REVIEWS_PER_PAGE = 10;

const ManageReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ productName: '', rating: '', status: 'all' });
  const [selectedReview, setSelectedReview] = useState(null);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/reviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReviews(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch reviews: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const filterReviews = () => {
    return reviews.filter(review => {
      const matchesProduct = filters.productName
        ? review.productName.toLowerCase().includes(filters.productName.toLowerCase())
        : true;
      const matchesRating = filters.rating ? review.rating === parseInt(filters.rating) : true;
      const matchesStatus = filters.status === 'all' ? true : review.status === filters.status;
      return matchesProduct && matchesRating && matchesStatus;
    });
  };

  const handleStatusUpdate = async (reviewId, newStatus) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(
        `http://localhost:5000/api/reviews/${reviewId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviews(reviews.map(r => (r.id === reviewId ? { ...r, status: newStatus } : r)));
      toast.success(`Review ${newStatus.toLowerCase()} successfully!`);
    } catch (err) {
      toast.error('Failed to update review status');
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://localhost:5000/api/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReviews(reviews.filter(r => r.id !== reviewId));
      toast.success('Review deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete review');
    }
  };

  const handleRespond = async (reviewId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.post(
        `http://localhost:5000/api/reviews/${reviewId}/respond`,
        { response: responseText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviews(reviews.map(r => 
        r.id === reviewId ? { ...r, adminResponse: responseText } : r
      ));
      setResponseModalOpen(false);
      setResponseText('');
      toast.success('Response submitted successfully!');
    } catch (err) {
      toast.error('Failed to submit response');
    }
  };

  const openResponseModal = (review) => {
    setSelectedReview(review);
    setResponseText(review.adminResponse || '');
    setResponseModalOpen(true);
  };

  const openDetailModal = (review) => {
    setSelectedReview(review);
    setDetailModalOpen(true);
  };

  const filteredReviews = filterReviews();
  const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * REVIEWS_PER_PAGE,
    currentPage * REVIEWS_PER_PAGE
  );

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>★</span>
    ));
  };

  return (
    <div className="manage-reviews">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Manage Reviews</h2>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by product name..."
          value={filters.productName}
          onChange={e => setFilters({ ...filters, productName: e.target.value })}
        />
        <select
          value={filters.rating}
          onChange={e => setFilters({ ...filters, rating: e.target.value })}
        >
          <option value="">All Ratings</option>
          {[1, 2, 3, 4, 5].map(r => (
            <option key={r} value={r}>{r} Stars</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="all">All Statuses</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="spinner">Loading reviews...</div>
      ) : paginatedReviews.length === 0 ? (
        <p>No reviews found.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Customer Name</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Date Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReviews.map(review => (
                <tr key={review.id}>
                  <td>
                    <a href={`/product/${review.productId}`} onClick={(e) => { e.preventDefault(); openDetailModal(review); }}>
                      {review.productName}
                    </a>
                  </td>
                  <td onClick={() => openDetailModal(review)} className="clickable">
                    {review.customerName}
                  </td>
                  <td>{renderStars(review.rating)}</td>
                  <td>{review.comment.substring(0, 50)}...</td>
                  <td>{new Date(review.dateSubmitted).toLocaleDateString()}</td>
                  <td>{review.status}</td>
                  <td>
                    {review.status !== 'Approved' && (
                      <button onClick={() => handleStatusUpdate(review.id, 'Approved')} className="approve-btn">
                        Approve
                      </button>
                    )}
                    {review.status !== 'Rejected' && (
                      <button onClick={() => handleStatusUpdate(review.id, 'Rejected')} className="reject-btn">
                        Reject
                      </button>
                    )}
                    <button onClick={() => handleDelete(review.id)} className="delete-btn">
                      Delete
                    </button>
                    <button onClick={() => openResponseModal(review)} className="respond-btn">
                      Respond
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {responseModalOpen && selectedReview && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Respond to Review</h3>
            <p><strong>Product:</strong> {selectedReview.productName}</p>
            <p><strong>Customer:</strong> {selectedReview.customerName}</p>
            <p><strong>Review:</strong> {selectedReview.comment}</p>
            <textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder="Type your response here..."
              rows="4"
            />
            <div className="modal-buttons">
              <button onClick={() => handleRespond(selectedReview.id)} className="submit-btn">
                Submit Response
              </button>
              <button onClick={() => setResponseModalOpen(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {detailModalOpen && selectedReview && (
        <div className="modal-overlay">
          <div className="modal-content detail-modal">
            <h3>Review Details</h3>
            <p><strong>Product:</strong> <a href={`/product/${selectedReview.productId}`}>{selectedReview.productName}</a></p>
            <p><strong>Customer:</strong> {selectedReview.customerName}</p>
            <p><strong>Rating:</strong> {renderStars(selectedReview.rating)}</p>
            <p><strong>Comment:</strong> {selectedReview.comment}</p>
            <p><strong>Date Submitted:</strong> {new Date(selectedReview.dateSubmitted).toLocaleString()}</p>
            <p><strong>Status:</strong> {selectedReview.status}</p>
            {selectedReview.adminResponse && (
              <p><strong>Admin Response:</strong> {selectedReview.adminResponse}</p>
            )}
            <button onClick={() => setDetailModalOpen(false)} className="close-btn">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageReviews;