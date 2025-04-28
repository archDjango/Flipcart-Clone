import React from 'react';
import { Link } from 'react-router-dom';
import './ProductRecommendations.css';

const ProductRecommendations = ({ recommendations, isLoading, title }) => {
  return (
    <div className="recommendations-container">
      <h2 className="section-title">{title || 'Recommended Products'}</h2>
      {isLoading ? (
        <div className="loading-spinner">Loading...</div>
      ) : recommendations.length === 0 ? (
        <p>No recommendations available.</p>
      ) : (
        <div className="recommendations-carousel">
          {recommendations.map((product) => (
            <div key={product.id} className="recommendation-card">
              <img src={product.image} alt={product.name} className="recommendation-image" />
              <div className="recommendation-details">
                <h3>{product.name}</h3>
                <p>₹{product.price.toFixed(2)}</p>
                {product.reason && <p className="recommendation-reason">{product.reason}</p>}
                <Link to={`/product/${product.id}`} className="view-more-btn">
                  View More
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductRecommendations;