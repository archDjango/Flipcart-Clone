import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import HomePage from './pages/Home/Home';
import ProductsPage from './pages/ProductsPage/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage/ProductDetailsPage';
import CartPage from './pages/CartPage/CartPage';
import WishlistPage from './pages/WishlistPage/WishlistPage';
import CheckoutPage from './pages/CheckoutPage/CheckoutPage';
import LoginPage from './pages/LoginPage/LoginPage';
import Signup from './pages/Signup/Signup';
import ThankYouPage from './pages/ThankYouPage/ThankYouPage';
import OrderHistoryPage from './pages/OrderHistory/OrderHistory';
import Dashboard from './pages/Dashboard/Dashboard';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext'; // Added for search functionality
import './App.css'; // Assuming you have this for global styles like .main-content

function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <SearchProvider>
            <Router>
              <div className="app-container">
                <Navbar />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/product/:id" element={<ProductDetailsPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/wishlist" element={<WishlistPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/thank-you" element={<ThankYouPage />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/order-history" element={<OrderHistoryPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                  </Routes>
                </main>
              </div>
            </Router>
          </SearchProvider>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}

export default App;