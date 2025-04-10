import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import ProductCard from '../../components/ProductCard/ProductCard';
import Filters from '../../components/Filters/Filters.jsx';
import Sorting from '../../components/Sorting/Sorting';
import { SearchContext } from '../../context/SearchContext.jsx';
import './ProductsPage.css';

const PRODUCTS_PER_PAGE = 8;

const filterProducts = (products, filters, searchQuery) =>
  products.filter(
    p =>
      (!filters.category.length || filters.category.includes(p.category)) &&
      p.price <= filters.priceRange &&
      p.rating >= filters.minRating &&
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

const sortProducts = (products, sort) =>
  [...products].sort((a, b) => {
    if (sort === 'lowToHigh') return a.price - b.price;
    if (sort === 'highToLow') return b.price - a.price;
    if (sort === 'rating') return b.rating - a.rating;
    if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    return 0;
  });

const ProductsPage = () => {
  const [allProducts, setAllProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('relevance');
  const [filters, setFilters] = useState({ category: [], priceRange: 10000, minRating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { searchQuery } = useContext(SearchContext);

  useEffect(() => {
    fetchAllProducts();
  }, []);

  const fetchAllProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/public/products', {
        params: {
          limit: 100, // Fetch all products (adjust if you have more than 100)
          offset: 0,
        },
      });
      setAllProducts(response.data.products);
      setLoading(false);
    } catch (err) {
      console.error('Fetch products error:', err.response?.data || err.message);
      setError('Failed to load products: ' + (err.response?.data?.error || 'Please try again later.'));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allProducts.length > 0) {
      const filtered = filterProducts(allProducts, filters, searchQuery);
      const sorted = sortProducts(filtered, sort);
      setDisplayedProducts(sorted);
      setTotalPages(Math.ceil(sorted.length / PRODUCTS_PER_PAGE));
      setCurrentPage(1); // Reset to first page when filters/search change
    }
  }, [allProducts, filters, searchQuery, sort]);

  const getPaginatedProducts = () => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return displayedProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      pageNumbers.push(
        <button key={1} onClick={() => setCurrentPage(1)}>
          1
        </button>
      );
      if (startPage > 2) {
        pageNumbers.push(<span key="start-ellipsis">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          className={currentPage === i ? 'active' : ''}
          onClick={() => setCurrentPage(i)}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="end-ellipsis">...</span>);
      }
      pageNumbers.push(
        <button key={totalPages} onClick={() => setCurrentPage(totalPages)}>
          {totalPages}
        </button>
      );
    }

    return (
      <div className="pagination">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        {pageNumbers}
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    );
  };

  return (
    <div className="products-page">
      <div className="filters-container">
        <Filters onFilterChange={setFilters} />
      </div>
      <div className="products-content">
        <div className="products-header">
          <h2>All Products ({displayedProducts.length})</h2>
          <Sorting handleSort={e => setSort(e.target.value)} />
        </div>
        
        {loading ? (
          <div className="products-grid">
            {Array(PRODUCTS_PER_PAGE).fill().map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-image"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-text short"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            <div className="products-grid">
              {getPaginatedProducts().length > 0 ? (
                getPaginatedProducts().map(product => (
                  <ProductCard key={product.id} product={product} />
                ))
              ) : (
                <p className="no-products">No products match your filters.</p>
              )}
            </div>
            {displayedProducts.length > PRODUCTS_PER_PAGE && renderPagination()}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;