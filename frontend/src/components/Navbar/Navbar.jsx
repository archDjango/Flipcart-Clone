import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { CartContext } from '../../context/CartContext';
import { WishlistContext } from '../../context/WishlistContext';
import { SearchContext } from '../../context/SearchContext';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import Notifications from '../../components/Notifications/Notifications';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { setSearchQuery } = useContext(SearchContext);
  const { cartItems } = useContext(CartContext);
  const { wishlistItems = [] } = useContext(WishlistContext);
  const { user, role, logout, notifications } = useContext(AuthContext);
  const { darkMode, setDarkMode } = useContext(ThemeContext);
  const navigate = useNavigate();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchQuery(value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate('/products');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-container')) {
        setShowProfileDropdown(false);
      }
      if (!event.target.closest('.notifications-container')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
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

        <div className={`desktop-nav ${isMenuOpen ? 'mobile-open' : ''}`}>
          <div className="nav-item notifications-container">
            {user && (
              <button
                className="notifications-btn"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                🔔
                {unreadCount > 0 && (
                  <span className="notifications-badge">{unreadCount}</span>
                )}
              </button>
            )}
            {showNotifications && user && (
              <Notifications onClose={() => setShowNotifications(false)} />
            )}
          </div>
          <div className="nav-item profile-container" onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
            <button className="profile-btn">
              {user ? user.name : 'Login'} ▼
            </button>
            {showProfileDropdown && (
              <div className="profile-dropdown">
                {user ? (
                  <>
                    {role === 'admin' ? (
                      <>
                        <Link to="/admin" className="dropdown-item">Admin Dashboard</Link>
                        <Link to="/admin/manage-products" className="dropdown-item">Manage Products</Link>
                      </>
                    ) : (
                      <>
                        <Link to="/dashboard" className="dropdown-item">User Dashboard</Link>
                        <Link to="/recommendations" className="dropdown-item">Recommendations</Link>
                      </>
                    )}
                    <Link to="/wishlist" className="dropdown-item">Wishlist ({wishlistItems.length})</Link>
                    <Link to="/order-history" className="dropdown-item">Orders</Link>
                    <button className="dropdown-item logout-btn" onClick={logout}>Logout</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="dropdown-item">Login</Link>
                    <Link to="/admin-login" className="dropdown-item">Admin Login</Link>
                    <Link to="/signup" className="dropdown-item">Sign Up</Link>
                  </>
                )}
                <button className="dropdown-item" onClick={() => setDarkMode(!darkMode)}>
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>
            )}
          </div>
          <Link to="/cart" className="nav-item cart-btn">
            🛒 Cart <span className="cart-count">({cartItems.length})</span>
          </Link>
        </div>

        <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;