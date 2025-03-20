import React, { useState, useEffect, useContext } from "react";
import Filters from "../../components/Filters/Filters.jsx";
import Sorting from "../../components/Sorting/Sorting";
import ProductCard from "../../components/ProductCard/ProductCard";
import { Products as productsData } from "../../data/Products.js";
import { SearchContext } from "../../context/SearchContext.jsx";
import "./ProductsPage.css";

const PRODUCTS_PER_PAGE = 8;

const ProductsPage = () => {
  const [products, setProducts] = useState(productsData);
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState("relevance");
  const [filters, setFilters] = useState({ category: [], priceRange: 50000 });
  const { searchQuery } = useContext(SearchContext);

  // Filter products based on search, category, and price
  const filteredProducts = productsData.filter(
    (product) =>
      (filters.category.length === 0 ||
        filters.category.includes(product.category)) &&
      product.price <= filters.priceRange &&
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorting Logic
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sort === "lowToHigh") return a.price - b.price;
    if (sort === "highToLow") return b.price - a.price;
    if (sort === "newest") return new Date(b.date) - new Date(a.date);
    return 0;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1); // Reset page when filters/search change
  }, [filters, searchQuery]);

  return (
    <div className="products-page">
      <div className="filters-container">
        <Filters onFilterChange={setFilters} />
      </div>

      <div className="products-content">
        <Sorting handleSort={(e) => setSort(e.target.value)} />

        {/* Search Bar */}
        <input
          type="text"
          className="search-bar"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />

        <div className="products-grid">
          {paginatedProducts.length > 0 ? (
            paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <p>No products found</p>
          )}
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
