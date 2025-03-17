import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';
import { CartContext } from '../../context/CartContext';
import { WishlistContext } from '../../context/WishlistContext';
import { SearchContext } from '../../context/SearchContext';
import { AuthContext } from '../../context/AuthContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { setSearchQuery } = useContext(SearchContext);
  const { cartItems } = useContext(CartContext);
  const { wishlistItems = [] } = useContext(WishlistContext);
  const { user, logout } = useContext(AuthContext);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchQuery(value);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-text">Flipkart</span>
          <span className="logo-subtext">Explore Plus</span>
        </Link>

        <div className="search-container">
          <input 
            type="text" 
            placeholder="Search for products, brands and more"
            className="search-input"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button className="search-button">
            <svg xmlns="http://www.w3.org/2000/svg" className="search-icon" viewBox="0 0 24 24">
              <path d="M10 18a7.952 7.952 0 0 0 4.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0 0 18 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z"/>
            </svg>
          </button>
        </div>

        <div className="desktop-nav">
          {user ? (
            <div className="nav-item user-info">
              <span>Welcome, {user.name}</span>
              <button className="logout-btn" onClick={logout}>Logout</button>
            </div>
          ) : (
            <>
              <Link to="/login" className="nav-item login-btn">Login</Link>
              <Link to="/signup" className="nav-item signup-btn">Sign Up</Link>
            </>
          )}

          <div 
            className="nav-item more-container"
            onMouseEnter={() => setShowMoreDropdown(true)}
            onMouseLeave={() => setShowMoreDropdown(false)}
          >
            <span>More</span>
            {showMoreDropdown && (
              <div className="more-dropdown">
                <button className="dropdown-item">Notification</button>
                <button className="dropdown-item">24x7 Customer Care</button>
                <button className="dropdown-item">Advertise</button>
                <button className="dropdown-item">Download App</button>
              </div>
            )}
          </div>

          <Link to="/wishlist" className="nav-item wishlist-btn">
            <span>Wishlist ({wishlistItems.length})</span>
          </Link>

          <Link to="/cart" className="nav-item cart-btn">
            <span>Cart ({cartItems.length})</span>
          </Link>
        </div>

        <button 
          className="mobile-menu-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <div className="hamburger"></div>
          <div className="hamburger"></div>
          <div className="hamburger"></div>
        </button>
      </div>

      {isMenuOpen && (
        <div className="mobile-nav">
          {user ? (
            <>
              <span className="mobile-nav-item">Welcome, {user.name}</span>
              <button className="mobile-nav-item logout-btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-nav-item">Login</Link>
              <Link to="/signup" className="mobile-nav-item">Sign Up</Link>
            </>
          )}
          <Link to="/wishlist" className="mobile-nav-item">Wishlist ({wishlistItems.length})</Link>
          <Link to="/cart" className="mobile-nav-item">Cart ({cartItems.length})</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
