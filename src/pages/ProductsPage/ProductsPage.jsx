import React, { useState, useEffect, useContext } from "react";
import Filters from "../../components/Filters/Filters.jsx";
import Sorting from "../../components/Sorting/Sorting";
import ProductCard from "../../components/ProductCard/ProductCard";
import { Products as productsData } from "../../data/Products.js";
import { SearchContext } from "../../context/SearchContext.jsx";
import "./ProductsPage.css";

const ProductsPage = () => {
  const [products, setProducts] = useState(productsData);
  const [sort, setSort] = useState("relevance");
  const [filters, setFilters] = useState({ category: [], priceRange: 5000 });
  const { searchQuery } = useContext(SearchContext);

  useEffect(() => {
    let filteredProducts = productsData.filter((product) => {
      return (
        (filters.category.length === 0 ||
          filters.category.includes(product.category)) &&
        product.price <= filters.priceRange &&
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    if (sort === "lowToHigh") {
      filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sort === "highToLow") {
      filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sort === "newest") {
      filteredProducts.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
    }

    setProducts(filteredProducts);
  }, [filters, sort, searchQuery]);

  const handleSort = (e) => {
    setSort(e.target.value);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="products-page">
      <div className="filters-container">
        <Filters onFilterChange={handleFilterChange} />
      </div>

      <div className="products-content">
        <Sorting handleSort={handleSort} />
        <div className="products-grid">
          {products.length > 0 ? (
            products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <p>No products found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
