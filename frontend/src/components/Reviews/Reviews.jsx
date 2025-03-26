import React, { useState } from "react";
import "./Reviews.css";

const Reviews = ({ productId }) => {
  const [reviews, setReviews] = useState([
    { id: 1, name: "Amit", rating: 5, comment: "Amazing product!" },
    { id: 2, name: "Priya", rating: 4, comment: "Good quality, but late delivery." },
  ]);
  const [newReview, setNewReview] = useState({ name: "", rating: 0, comment: "" });
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newReview.name && newReview.rating > 0 && newReview.comment) {
      setReviews([...reviews, { id: Date.now(), ...newReview }]);
      setNewReview({ name: "", rating: 0, comment: "" });
      setShowForm(false);
    }
  };

  return (
    <div className="reviews-section">
      <h2>Customer Reviews</h2>

      {/* Display Reviews */}
      {reviews.length > 0 ? (
        <ul className="reviews-list">
          {reviews.map((review) => (
            <li key={review.id} className="review-item">
              <strong>{review.name}</strong> - ⭐ {review.rating}/5
              <p>{review.comment}</p>
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
