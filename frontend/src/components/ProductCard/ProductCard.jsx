import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import './ProductCard.css';
import { CartContext } from '../../context/CartContext';
import { WishlistContext } from '../../context/WishlistContext';

const ProductCard = ({ product }) => {
  const { addToCart } = useContext(CartContext);
  const { addToWishlist } = useContext(WishlistContext);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    addToCart(product);
  };

  const handleAddToWishlist = (e) => {
    e.stopPropagation();
    e.preventDefault();
    addToWishlist(product);
  };

  return (
    <Link to={`/product/${product.id}`} className="product-card-link">
      <div className="product-card">
        <img
          src={product.image}
          alt={product.name}
          className="product-image"
          loading="lazy" // Added for performance
        />
        <h3 className="product-name">{product.name}</h3>
        <p className="product-price">₹{product.price}</p>
        <p>{product.rating} ★</p>
        <div className="product-card-buttons">
          <button className="add-to-cart-btn" onClick={handleAddToCart}>Add to Cart</button>
          <button className="add-to-wishlist-btn" onClick={handleAddToWishlist}>❤️ Wishlist</button>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;