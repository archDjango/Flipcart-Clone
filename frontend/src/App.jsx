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
import ManageProducts from './pages/ManageProducts/ManageProducts';
import ManageAdmins from './pages/ManageAdmins/ManageAdmins'; // Import the new ManageAdmins component
import ManageReviews from './pages/ManageReviews/ManageReviews';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

const ProtectedRoute = ({ children, roles }) => {
  const { role } = useContext(AuthContext);
  if (!role || (roles && !roles.includes(role))) {
    return <Navigate to={roles.includes('admin') || roles.includes('manager') || roles.includes('staff') ? '/admin-login' : '/login'} />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <SearchProvider>
            <ThemeProvider>
              <Router>
                <div className="app-container">
                  <Navbar />
                  <main className="main-content">
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/product/:id" element={<ProductDetailsPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/wishlist" element={<ProtectedRoute roles={['user']}><WishlistPage /></ProtectedRoute>} />
                      <Route path="/checkout" element={<ProtectedRoute roles={['user']}><CheckoutPage /></ProtectedRoute>} />
                      <Route path="/thank-you" element={<ProtectedRoute roles={['user']}><ThankYouPage /></ProtectedRoute>} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/order-history" element={<ProtectedRoute roles={['user']}><OrderHistoryPage /></ProtectedRoute>} />
                      <Route path="/dashboard" element={<ProtectedRoute roles={['user']}><Dashboard /></ProtectedRoute>} />
                      <Route path="/admin" element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><AdminDashboard /></ProtectedRoute>} />
                      <Route path="/admin-login" element={<AdminLogin />} />
                      <Route path="/admin/manage-products" element={<ProtectedRoute roles={['admin', 'manager']}><ManageProducts /></ProtectedRoute>} />
                      <Route path="/admin/manage-reviews" element={<ProtectedRoute roles={['admin', 'manager']}><ManageReviews /></ProtectedRoute>} />
                      <Route path="/admin/manage-admins" element={<ProtectedRoute roles={['admin']}><ManageAdmins /></ProtectedRoute>} /> {/* New Route */}
                    </Routes>
                  </main>
                </div>
              </Router>
            </ThemeProvider>
          </SearchProvider>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}

export default App;