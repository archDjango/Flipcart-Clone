import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext"; // Assuming this is where your AuthContext is defined
import "./Reviews.css";

const Reviews = ({ productId }) => {
  const { user } = useContext(AuthContext); // Get user from AuthContext to check if logged in
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ name: "", rating: 0, comment: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:5000/api/public/reviews?productId=${productId}`);
        setReviews(res.data);
        setError("");
      } catch (err) {
        setError("Failed to load reviews: " + (err.response?.data?.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, [productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.name || newReview.rating === 0 || !newReview.comment) {
      setError("All fields are required");
      return;
    }

    if (!user) {
      setError("Please log in to submit a review");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `http://localhost:5000/api/reviews`,
        {
          productId,
          rating: newReview.rating,
          comment: newReview.comment,
          name: newReview.name,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNewReview({ name: "", rating: 0, comment: "" });
      setShowForm(false);
      setError("");
      alert("Review submitted for approval!");
    } catch (err) {
      setError("Failed to submit review: " + (err.response?.data?.message || "Unknown error"));
    }
  };

  return (
    <div className="reviews-section">
      <h2>Customer Reviews</h2>

      {/* Loading and Error States */}
      {loading ? (
        <p>Loading reviews...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : reviews.length > 0 ? (
        <ul className="reviews-list">
          {reviews.map((review) => (
            <li key={review.id} className="review-item">
              <strong>{review.customerName}</strong> - ⭐ {review.rating}/5
              <p>{review.comment}</p>
              {review.adminResponse && (
                <p className="admin-response">
                  <strong>Admin Response:</strong> {review.adminResponse}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No reviews yet. Be the first to review!</p>
      )}

      {/* Write a Review Button */}
      <button onClick={() => setShowForm(true)} className="write-review-btn">
        Write a Review
      </button>

      {/* Review Form Popup */}
      {showForm && (
        <div className="review-form-overlay">
          <div className="review-form">
            <h3>Write a Review</h3>
            {error && <p className="error">{error}</p>}
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Your Name"
                value={newReview.name}
                onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                required
              />
              <select
                value={newReview.rating}
                onChange={(e) => setNewReview({ ...newReview, rating: Number(e.target.value) })}
                required
              >
                <option value="0">Select Rating</option>
                <option value="5">⭐ 5</option>
                <option value="4">⭐ 4</option>
                <option value="3">⭐ 3</option>
                <option value="2">⭐ 2</option>
                <option value="1">⭐ 1</option>
              </select>
              <textarea
                placeholder="Your Review"
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                required
              ></textarea>
              <button type="submit">Submit Review</button>
              <button onClick={() => setShowForm(false)} className="cancel-btn">
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;