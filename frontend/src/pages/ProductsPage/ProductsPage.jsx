import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ProductCard from "../../components/ProductCard/ProductCard";
import { CompareContext } from "../../context/CompareContext";
import "./ProductsPage.css";

const PRODUCTS_PER_PAGE = 16;

const ProductsPage = () => {
  const { selectedProductIds, toggleProduct, clearSelectedProducts, error: contextError } = useContext(CompareContext);
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 100000],
    rating: 0,
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const categories = ["Electronics", "Clothing", "Home & Kitchen", "Books", "Sports", "Accessories"];

  const fetchAllProducts = async (retryCount = 0) => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:5000/api/public/products", {
        params: {
          limit: 100,
          offset: 0,
        },
      });
      setAllProducts(response.data.products || []);
      setFilteredProducts(response.data.products || []);
      setTotalPages(Math.ceil((response.data.total || 0) / PRODUCTS_PER_PAGE));
      setLocalError("");
      setLoading(false);
    } catch (err) {
      if (retryCount < 2) {
        setTimeout(() => fetchAllProducts(retryCount + 1), 1000);
        return;
      }
      setLocalError("Failed to load products: " + (err.response?.data?.message || err.message));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProducts();
  }, []);

  useEffect(() => {
    const filtered = allProducts.filter((product) => {
      const matchesCategory =
        filters.categories.length === 0 ||
        filters.categories.includes(product.category);
      const matchesPrice =
        product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1];
      const matchesRating = product.rating >= filters.rating;
      return matchesCategory && matchesPrice && matchesRating;
    });
    setFilteredProducts(filtered);
    setTotalPages(Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
    setCurrentPage(1);
  }, [filters, allProducts]);

  const handleCategoryChange = (category) => {
    setFilters((prev) => {
      const categories = prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category];
      return { ...prev, categories };
    });
  };

  const handlePriceChange = (e) => {
    const value = Number(e.target.value);
    setFilters((prev) => ({
      ...prev,
      priceRange: [0, value],
    }));
  };

  const handleRatingChange = (rating) => {
    setFilters((prev) => ({ ...prev, rating }));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCompare = () => {
    console.log('handleCompare called with selectedProductIds:', selectedProductIds);
    if (selectedProductIds.length < 2) {
      setLocalError("Select at least 2 products to compare");
      setTimeout(() => setLocalError(""), 3000);
      return;
    }
    if (selectedProductIds.length > 4) {
      setLocalError("You can compare up to 4 products");
      setTimeout(() => setLocalError(""), 3000);
      return;
    }
    navigate('/compare');
  };

  const handleRemoveFromCompare = (productId) => {
    toggleProduct(productId);
  };

  const handleClearAll = () => {
    clearSelectedProducts();
  };

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.includes(product.id)
  );

  const toggleFilters = () => {
    setIsFilterOpen((prev) => !prev);
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (localError || contextError) return <div className="error">{localError || contextError}</div>;

  return (
    <div className="products-page-container">
      <button className="filter-toggle" onClick={toggleFilters}>
        {isFilterOpen ? "Hide Filters" : "Show Filters"}
      </button>
      <div className="products-main">
        <div className={`filter-sidebar ${isFilterOpen ? "active" : ""}`}>
          <h2>Filters</h2>
          <div className="filter-section">
            <h3>Category</h3>
            {categories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={() => handleCategoryChange(category)}
                />
                {category}
              </label>
            ))}
          </div>
          <div className="filter-section">
            <h3>Price</h3>
            <input
              type="range"
              min="0"
              max="100000"
              step="1000"
              value={filters.priceRange[1]}
              onChange={handlePriceChange}
            />
            <div className="price-value">Up to ₹{filters.priceRange[1].toLocaleString()}</div>
          </div>
          <div className="filter-section">
            <h3>Rating</h3>
            {[4, 3, 2, 1].map((rating) => (
              <label key={rating}>
                <input
                  type="radio"
                  name="rating"
                  checked={filters.rating === rating}
                  onChange={() => handleRatingChange(rating)}
                />
                {rating} ★ & above
              </label>
            ))}
            <label>
              <input
                type="radio"
                name="rating"
                checked={filters.rating === 0}
                onChange={() => handleRatingChange(0)}
              />
              All
            </label>
          </div>
        </div>
        <div className="products-content">
          <div className="products-header">
            <h1>All Products</h1>
            <div className="sort-filter">
              <select>
                <option>Sort by: Relevance</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Rating</option>
              </select>
              <button
                onClick={handleCompare}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={selectedProductIds.length < 2 || selectedProductIds.length > 4}
              >
                Compare Now ({selectedProductIds.length}/4)
              </button>
            </div>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="error">No products match your filters.</div>
          ) : (
            <div className="products-grid">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Fixed Bottom Bar */}
      {selectedProductIds.length > 0 && (
        <div className="comparison-bar fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 flex items-center justify-between z-50">
          <div className="selected-comparison-container flex items-center space-x-4 overflow-x-auto">
            {selectedProducts.map((product) => (
              <div key={product.id} className="selected-comparison-item flex items-center space-x-2">
                <img
                  src={product.image}
                  alt={product.name}
                  className="comparison-product-image w-20 h-20 object-cover rounded"
                />
                <span className="comparison-product-name text-sm text-gray-700">{product.name}</span>
                <button
                  onClick={() => handleRemoveFromCompare(product.id)}
                  className="remove-comparison-item text-red-500 hover:text-red-700"
                  aria-label={`Remove ${product.name} from comparison`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearAll}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Clear All
            </button>
            <button
              onClick={handleCompare}
              className="compare-bar-button bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={selectedProductIds.length < 2 || selectedProductIds.length > 4}
            >
              Compare Now ({selectedProductIds.length}/4)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;