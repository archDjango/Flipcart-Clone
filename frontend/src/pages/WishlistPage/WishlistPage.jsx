import React, { useContext } from "react";
import "./WishlistPage.css";
import { WishlistContext } from "../../context/WishlistContext";
import { CartContext } from "../../context/CartContext";

const WishlistPage = () => {
  const { wishlistItems, removeFromWishlist } = useContext(WishlistContext);
  const { addToCart } = useContext(CartContext);

  const handleMoveToCart = (product) => {
    addToCart(product);
    removeFromWishlist(product.id);
  };

  return (
    <div className="wishlist-page">
      <h2 className="wishlist-heading">My Wishlist ({wishlistItems.length})</h2>
      
      {wishlistItems.length === 0 ? (
        <div className="empty-wishlist">
          Your Wishlist is empty 😔
        </div>
      ) : (
        <div className="wishlist-items">
          {wishlistItems.map((product) => (
            <div className="wishlist-item" key={product.id}>
              <img src={product.image} alt={product.name} />
              <div className="wishlist-item-details">
                <h3 className="wishlist-item-name">{product.name}</h3>
                <p className="wishlist-item-price">₹{product.price}</p>
                <p className="wishlist-item-category">{product.category}</p>
              </div>
              <div className="wishlist-item-buttons">
                <button
                  className="wishlist-btn move-to-cart-btn"
                  onClick={() => handleMoveToCart(product)}
                >
                  Move to Cart
                </button>
                <button
                  className="wishlist-btn remove-btn"
                  onClick={() => removeFromWishlist(product.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
