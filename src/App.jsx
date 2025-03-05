import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Banner from './components/HeroSection/HeroSection';
import Promotions from './components/Promotions/Promotions';
import Footer from './components/Footer/Footer';
import FloatingCart from './components/FloatingCart/FloatingCart';
import ProductsPage from './pages/ProductsPage/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage/ProductDetailsPage';
import CartPage from './pages/CartPage/CartPage';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <Banner />
                    <Promotions />
                  </>
                }
              />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:id" element={<ProductDetailsPage />} />
              <Route path="/cart" element={<CartPage />} />
            </Routes>
          </main>
          <FloatingCart />
          <Footer />
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
