import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import './ProductCard.css';
import { CartContext } from '../../context/CartContext';
import { WishlistContext } from '../../context/WishlistContext';
import { FiShoppingCart, FiHeart } from 'react-icons/fi';

const ProductCard = ({ product }) => {
  const { addToCart } = useContext(CartContext);
  const { wishlist = [], addToWishlist, removeFromWishlist } = useContext(WishlistContext) || {};
  
  const isInWishlist = wishlist.some(item => item.id === product.id);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    addToCart(product);
  };

  const handleWishlistClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isInWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  // Calculate discounted price if available
  const originalPrice = product.price;
  const discountedPrice = product.discountedPrice || product.price;

  return (
    <Link to={`/product/${product.id}`} className="product-card-link">
      <div className="product-card">
        <div className="product-image-container">
          <img
            src={product.image}
            alt={product.name}
            className="product-image"
            loading="lazy"
          />
          <button 
            className={`wishlist-button ${isInWishlist ? 'active' : ''}`}
            onClick={handleWishlistClick}
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <FiHeart className="wishlist-icon" />
          </button>
        </div>
        
        <div className="product-info">
          <h3 className="product-name">{product.name}</h3>
          {product.seller_name && (
            <p className="product-seller">Sold by: {product.seller_name}</p>
          )}
          {product.stock <= product.low_stock_threshold && (
            <span className="low-stock-badge">Low Stock</span>
          )}
          <div className="product-meta">
            <div className="product-rating">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`star ${i < Math.floor(product.rating) ? 'filled' : ''}`}>
                  ★
                </span>
              ))}
              <span className="rating-count">({product.ratingCount || 0})</span>
            </div>
            <p className="product-price">
              ₹{discountedPrice.toLocaleString()}
              {discountedPrice < originalPrice && (
                <span>₹{originalPrice.toLocaleString()}</span>
              )}
            </p>
          </div>
        </div>

        <button 
          className="add-to-cart-button"
          onClick={handleAddToCart}
          aria-label="Add to cart"
        >
          <FiShoppingCart className="cart-icon" />
          <span>Add to Cart</span>
        </button>
      </div>
    </Link>
  );
};

export default ProductCard;