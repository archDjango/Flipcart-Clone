import React from "react";
import { Link } from "react-router-dom";
import "./ProductCard.css";

const ProductCard = ({ product }) => {
  return (
    <Link to={`/product/${product.id}`} className="product-card-link">
      <div className="product-card">
        <img src={product.image} alt={product.name} className="product-image" />
        <h3 className="product-name">{product.name}</h3>
        <p className="product-price">₹{product.price}</p>
        <p className="product-category">{product.category}</p>
      </div>
    </Link>
  );
};

export default ProductCard;
