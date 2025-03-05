import React from "react";
import { useParams } from "react-router-dom";
import "./ProductDetailsPage.css";
import { Products as productsData } from "../../data/Products.js";

const ProductDetailsPage = () => {
  const { id } = useParams();
  const product = productsData.find((item) => item.id === parseInt(id));

  if (!product) {
    return <h2>Product not found!</h2>;
  }

  return (
    <div className="product-details-container">
      <div className="product-details-card">
        <div className="product-image">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="product-category">{product.category}</p>
          <p className="product-price">₹{product.price}</p>
          <p className="product-description">{product.description}</p>
          <button className="buy-now-btn">Buy Now</button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
