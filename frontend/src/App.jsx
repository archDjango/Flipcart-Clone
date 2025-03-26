import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
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
import AdminLogin from './pages/AdminLogin/AdminLogin';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import './App.css';

const ProtectedRoute = ({ children, roleRequired }) => {
  const { role } = useContext(AuthContext);
  if (!role || (roleRequired && role !== roleRequired)) {
    return <Navigate to={roleRequired === 'admin' ? '/admin-login' : '/login'} />;
  }
  return children;
};

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
                    <Route path="/wishlist" element={<ProtectedRoute roleRequired="user"><WishlistPage /></ProtectedRoute>} />
                    <Route path="/checkout" element={<ProtectedRoute roleRequired="user"><CheckoutPage /></ProtectedRoute>} />
                    <Route path="/thank-you" element={<ProtectedRoute roleRequired="user"><ThankYouPage /></ProtectedRoute>} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/order-history" element={<ProtectedRoute roleRequired="user"><OrderHistoryPage /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute roleRequired="user"><Dashboard /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute roleRequired="admin"><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin-login" element={<AdminLogin />} />
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