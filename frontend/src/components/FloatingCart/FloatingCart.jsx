import React from "react";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import "./FloatingCart.css";

const FloatingCart = ({ cartCount, onClick }) => {
  return (
    <div className="floating-cart" onClick={onClick}>
      <ShoppingCartIcon className="cart-icon" />
      {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
    </div>
  );
};

export default FloatingCart;
