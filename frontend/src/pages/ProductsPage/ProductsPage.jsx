import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import Filters from '../../components/Filters/Filters.jsx';
import Sorting from '../../components/Sorting/Sorting';
import ProductCard from '../../components/ProductCard/ProductCard';
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
    if (sort === 'newest') return new Date(b.date) - new Date(a.date);
    return 0;
  });

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState('relevance');
  const [filters, setFilters] = useState({ category: [], priceRange: 10000, minRating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { searchQuery } = useContext(SearchContext);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/public/products');
        setProducts(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load products. Please try again later.');
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filtered = filterProducts(products, filters, searchQuery);
  const sorted = sortProducts(filtered, sort);
  const totalPages = Math.ceil(sorted.length / PRODUCTS_PER_PAGE);
  const paginated = sorted.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  useEffect(() => setCurrentPage(1), [filters, searchQuery]);

  return (
    <div className="products-page">
      <div className="filters-container">
        <Filters onFilterChange={setFilters} />
      </div>
      <div className="products-content">
        <Sorting handleSort={e => setSort(e.target.value)} />
        {loading ? (
          <p>Loading products...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="products-grid">
            {paginated.length > 0 ? (
              paginated.map(product => <ProductCard key={product.id} product={product} />)
            ) : (
              <p>No products found</p>
            )}
          </div>
        )}
        {!loading && !error && (
          <div className="pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;