import React, { useState, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { CartContext } from "../../context/CartContext";
import { WishlistContext } from "../../context/WishlistContext";
import { SearchContext } from "../../context/SearchContext";
import { AuthContext } from "../../context/AuthContext";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { setSearchQuery } = useContext(SearchContext);
  const { cartItems } = useContext(CartContext);
  const { wishlistItems = [] } = useContext(WishlistContext);
  const { user, role, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchQuery(value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate("/products");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-container")) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-text">Flipkart</span>
          <span className="logo-subtext">Explore Plus</span>
        </Link>

        <form className="search-container" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search for products, brands and more"
            className="search-input"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button type="submit" className="search-button">🔍</button>
        </form>

        <div className="desktop-nav">
          <div
            className="nav-item profile-container"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            <button className="profile-btn">
              {user ? user.name : "Login"} ▼
            </button>

            {showProfileDropdown && (
              <div className="profile-dropdown">
                {user ? (
                  <>
                    {role === 'admin' ? (
                      <Link to="/admin" className="dropdown-item">
                        Admin Dashboard
                      </Link>
                    ) : (
                      <Link to="/dashboard" className="dropdown-item">
                        User Dashboard
                      </Link>
                    )}
                    <Link to="/wishlist" className="dropdown-item">
                      Wishlist ({wishlistItems.length})
                    </Link>
                    <Link to="/order-history" className="dropdown-item">
                      Orders
                    </Link>
                    <button className="dropdown-item logout-btn" onClick={logout}>
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="dropdown-item">Login</Link>
                    <Link to="/admin-login" className="dropdown-item">Admin Login</Link>
                    <Link to="/signup" className="dropdown-item">Sign Up</Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link to="/cart" className="nav-item cart-btn">
            🛒 Cart <span className="cart-count">({cartItems.length})</span>
          </Link>
        </div>

        <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          ☰
        </button>
      </div>
    </nav>
  );
};

export default Navbar;