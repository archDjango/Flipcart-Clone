import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CompareContext } from '../../context/CompareContext';
import './ComparePage.css';

const ComparePage = () => {
  const {
    selectedProductIds,
    toggleProduct,
    recentComparisons,
    loadComparison,
    clearSelectedProducts,
    error: contextError,
    clearError,
  } = useContext(CompareContext);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Fetch selected products
  const fetchSelectedProducts = async () => {
    console.log('Fetching products for selectedProductIds:', selectedProductIds);
    if (selectedProductIds.length < 2) {
      setLocalError('Select at least 2 products to compare');
      setSelectedProducts([]);
      console.log('Error: Fewer than 2 products selected');
      return;
    }
    if (selectedProductIds.length > 4) {
      setLocalError('You can compare up to 4 products');
      setSelectedProducts([]);
      console.log('Error: More than 4 products selected');
      return;
    }

    setLocalError('');
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/public/products', {
        params: { ids: selectedProductIds.join(','), limit: 100, offset: 0 },
      });
      const products = response.data.products || [];
      console.log('Raw API response:', response.data);
      // Filter products to include only those in selectedProductIds
      const filteredProducts = products.filter((product) =>
        selectedProductIds.includes(product.id)
      );
      console.log('Filtered products:', filteredProducts);
      if (filteredProducts.length === 0) {
        setLocalError('No valid products found for the selected IDs');
        setSelectedProducts([]);
        console.log('Error: No matching products after filtering');
      } else {
        setSelectedProducts(filteredProducts);
      }
    } catch (err) {
      const errorMsg = 'Failed to load products: ' + (err.response?.data?.message || err.message);
      setLocalError(errorMsg);
      setSelectedProducts([]);
      console.error('API error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelectedProducts();
  }, [selectedProductIds]);

  // Clear errors after 3 seconds
  useEffect(() => {
    if (localError || contextError) {
      const timer = setTimeout(() => {
        setLocalError('');
        clearError();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [localError, contextError, clearError]);

  // Highlight differences
  const getHighlightedClass = (value, index, values) => {
    return values.some((v, i) => i !== index && v !== value) ? 'bg-yellow-100' : '';
  };

  // Parse features from description
  const getFeatures = (description) => {
    if (!description) return 'N/A';
    const sentences = description.split('. ').slice(0, 3).join('. ');
    return sentences || 'N/A';
  };

  // Get availability
  const getAvailability = (stock, lowStockThreshold) => {
    if (stock === 0) return 'Out of Stock';
    if (stock <= lowStockThreshold) return 'Low Stock';
    return 'In Stock';
  };

  if (loading) return <div className="loading text-center text-gray-600">Loading...</div>;
  if (localError || contextError) return (
    <div className="compare-page-container max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Compare Products</h1>
      <div className="error text-center text-red-500">{localError || contextError}</div>
      {selectedProductIds.length > 0 && (
        <div className="text-center mt-4">
          <button
            onClick={clearSelectedProducts}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>
      )}
      <div className="text-center mt-4">
        <Link to="/products" className="text-blue-600 hover:underline">
          Go to Products
        </Link>
      </div>
    </div>
  );

  return (
    <div className="compare-page-container max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Compare Products</h1>

      {selectedProducts.length === 0 ? (
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Please select 2–4 products to compare.{' '}
            <Link to="/products" className="text-blue-600 hover:underline">
              Go to Products
            </Link>
          </p>
          {selectedProductIds.length > 0 && (
            <button
              onClick={clearSelectedProducts}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Clear All
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="comparison-table w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-4 bg-gray-100"></th>
                  {selectedProducts.map((product) => (
                    <th key={product.id} className="border p-4 bg-gray-100 text-center">
                      <button
                        onClick={() => toggleProduct(product.id)}
                        className="text-red-500 hover:text-red-700 text-lg"
                        aria-label={`Remove ${product.name} from comparison`}
                      >
                        ×
                      </button>
                      <Link to={`/product/${product.id}`} className="block text-blue-600 hover:underline mt-2">
                        {product.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'image', label: 'Image', render: (p) => <img src={p.image} alt={p.name} className="w-20 h-20 object-cover mx-auto rounded" /> },
                  { key: 'price', label: 'Price', render: (p) => `₹${p.price.toLocaleString()}` },
                  { key: 'rating', label: 'Rating', render: (p) => `${p.rating} ★` },
                  { key: 'brand', label: 'Brand', render: (p) => p.seller_name || 'Unknown' },
                  { key: 'features', label: 'Features', render: (p) => getFeatures(p.description) },
                  { key: 'availability', label: 'Availability', render: (p) => getAvailability(p.stock, p.low_stock_threshold) },
                ].map(({ key, label, render }) => (
                  <tr key={key}>
                    <td className="border p-4 font-semibold bg-gray-50">{label}</td>
                    {selectedProducts.map((product, index) => (
                      <td
                        key={product.id}
                        className={`border p-4 text-center ${getHighlightedClass(
                          render(product),
                          index,
                          selectedProducts.map((p) => render(p))
                        )}`}
                      >
                        {render(product)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Comparisons */}
      {recentComparisons.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Recent Comparisons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentComparisons.map((comparison) => (
              <div key={comparison.id} className="border p-4 rounded-lg shadow-sm recent-comparison-card">
                <p className="text-sm text-gray-600">
                  Saved on {new Date(comparison.created_at).toLocaleDateString()}
                </p>
                <ul className="list-disc pl-5">
                  {comparison.productIds.map((id) => {
                    const product = selectedProducts.find((p) => p.id === id) || { name: 'Unknown' };
                    return (
                      <li key={id} className="text-sm">
                        <Link to={`/product/${id}`} className="text-blue-600 hover:underline">
                          {product.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => loadComparison(comparison)}
                  className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Load Comparison
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparePage;