import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./ProductsPage.css";

const PRODUCTS_PER_PAGE = 16;

const ProductsPage = () => {
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 100000],
    rating: 0,
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sample categories (replace with dynamic fetch if available)
  const categories = ["Electronics", "Clothing", "Home & Kitchen", "Books", "Sports"];

  const fetchAllProducts = async (retryCount = 0) => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:5000/api/public/products", {
        params: {
          limit: 100,
          offset: 0,
        },
      });

      console.log("Products fetched:", {
        productCount: response.data.products?.length || 0,
        total: response.data.total || 0,
      });

      setAllProducts(response.data.products || []);
      setFilteredProducts(response.data.products || []);
      setTotalPages(Math.ceil((response.data.total || 0) / PRODUCTS_PER_PAGE));
      setError("");
      setLoading(false);
    } catch (err) {
      console.error("Fetch products error:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });

      if (retryCount < 2) {
        console.log(`Retrying fetch products (attempt ${retryCount + 2})...`);
        setTimeout(() => fetchAllProducts(retryCount + 1), 1000);
        return;
      }

      setError(
        "Failed to load products: " +
          (err.response?.data?.message || err.message || "Please try again later.")
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProducts();
  }, []);

  useEffect(() => {
    // Apply filters
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

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  const toggleFilters = () => {
    setIsFilterOpen((prev) => !prev);
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

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
            </div>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="error">No products match your filters.</div>
          ) : (
            <div className="products-grid">
              {paginatedProducts.map((product) => (
                <Link to={`/products/${product.id}`} key={product.id} className="product-card">
                  <img
                    src={product.image || "/default-product-image.jpg"}
                    alt={product.name}
                    className="product-image"
                  />
                  <div className="product-info">
                    <h3 className="product-title">{product.name}</h3>
                    <p className="product-price">₹{product.price.toLocaleString()}</p>
                    <div className="product-rating">
                      <span className="rating-stars">
                        {product.rating ? `${product.rating.toFixed(1)} ★` : "No rating"}
                      </span>
                      <span className="rating-count">({product.reviews || 0})</span>
                    </div>
                    <p className={`product-stock ${product.stock > 0 ? "in-stock" : ""}`}>
                      {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                    </p>
                  </div>
                </Link>
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
    </div>
  );
};

export default ProductsPage;