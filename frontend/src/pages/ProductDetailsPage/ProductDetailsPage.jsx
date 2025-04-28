import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import Reviews from '../../components/Reviews/Reviews.jsx';
import './ProductDetailsPage.css';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addToCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:5000/api/public/products/${id}`);
        console.log('Fetched product:', res.data);
        setProduct(res.data);
        setError('');
        // Log view activity for authenticated users
        if (user) {
          try {
            const token = localStorage.getItem('token');
            await axios.post(
              'http://localhost:5000/user-activity',
              { product_id: parseInt(id), activity_type: 'view' },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch (err) {
            console.error('Log view activity error:', err);
          }
        }
      } catch (err) {
        console.error('Fetch product error:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        });
        setError(
          'Failed to load product: ' +
            (err.response?.data?.message || err.message || 'Unknown error')
        );
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, user]);

  const handleAddToCart = () => {
    if (product && product.stock > 0) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image || '/default-product-image.jpg',
        quantity: 1,
      });
      // Log add_to_cart activity
      if (user) {
        try {
          const token = localStorage.getItem('token');
          axios.post(
            'http://localhost:5000/user-activity',
            { product_id: product.id, activity_type: 'add_to_cart' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error('Log add_to_cart activity error:', err);
        }
      }
    } else {
      setError('Product is out of stock.');
    }
  };

  const handleBuyNow = () => {
    if (product && product.stock > 0) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image || '/default-product-image.jpg',
        quantity: 1,
      });
      // Log add_to_cart activity
      if (user) {
        try {
          const token = localStorage.getItem('token');
          axios.post(
            'http://localhost:5000/user-activity',
            { product_id: product.id, activity_type: 'add_to_cart' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error('Log add_to_cart activity error:', err);
        }
      }
      navigate('/checkout');
    } else {
      setError('Product is out of stock.');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!product) return <h2>Product not found!</h2>;

  return (
    <div className="product-details-container">
      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        <Link to="/">Home</Link> &gt; <Link to="/products">Products</Link> &gt;{' '}
        <span>{product.category}</span> &gt; <span>{product.name}</span>
      </div>

      <div className="product-details-card">
        {/* Product Image */}
        <div className="product-image">
          <img src={product.image || '/default-product-image.jpg'} alt={product.name} />
        </div>

        {/* Product Info */}
        <div className="product-info">
          {product.name ? (
            <>
              <h1 className="product-title">{product.name}</h1>
              <p className="product-category">{product.category}</p>
              {product.seller_name && (
                <p className="product-seller">Sold by: {product.seller_name}</p>
              )}
              <div className="product-rating">
                <span>⭐ {product.rating ? product.rating.toFixed(1) : 'No rating yet'}</span>
                <span className="rating-count">(Based on reviews)</span>
              </div>
              <p className="product-price">₹{product.price?.toLocaleString('en-IN') || 'N/A'}</p>
              <p className={`stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                {product.stock > 0 ? `In Stock (${product.stock} left)` : 'Out of Stock'}
                {product.stock > 0 && product.stock <= product.low_stock_threshold && (
                  <span className="low-stock-warning"> (Low Stock)</span>
                )}
              </p>
              <div className="product-description">
                <h3>Description</h3>
                <p>{product.description || 'No description available for this product.'}</p>
              </div>
              <div className="action-buttons">
                <button className="buy-now-btn" onClick={handleBuyNow}>
                  Buy Now
                </button>
                <button className="add-to-cart-btn" onClick={handleAddToCart}>
                  Add to Cart
                </button>
              </div>
            </>
          ) : (
            <div className="debug-info">
              <p>No valid product data. Raw data: {JSON.stringify(product)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="reviews-section">
        <Reviews productId={parseInt(id)} />
      </div>
    </div>
  );
};

export default ProductDetailsPage;