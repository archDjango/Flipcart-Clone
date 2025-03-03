// src/components/ProductCard/ProductCard.jsx
import React from 'react';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
      <div className="product-details">
        <h3>{product.name}</h3>
        <p className="product-brand">{product.brand}</p>
        <p className="product-price">₹{product.price}</p>
        <p className="product-rating">⭐ {product.rating}</p>
        <button className="add-to-cart-btn">Add to Cart</button>
      </div>
    </div>
  );
};

export default ProductCard;
