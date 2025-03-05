import React, { useContext } from "react";
import { Link } from "react-router-dom";
import "./ProductCard.css";
import { CartContext } from "../../context/CartContext";

const ProductCard = ({ product }) => {
  const { addToCart } = useContext(CartContext);

  const handleAddToCart = (e) => {
    e.stopPropagation(); // prevent triggering the Link navigation
    e.preventDefault();
    addToCart(product);
  };

  return (
    <Link to={`/product/${product.id}`} className="product-card-link">
      <div className="product-card">
        <img src={product.image} alt={product.name} className="product-image" />
        <h3 className="product-name">{product.name}</h3>
        <p className="product-price">₹{product.price}</p>
        <p className="product-category">{product.category}</p>
        <button className="add-to-cart-btn" onClick={handleAddToCart}>
          Add to Cart
        </button>
      </div>
    </Link>
  );
};

export default ProductCard;
