import React, { useState } from "react";
import "./Filters.css";

const Filters = ({ onFilterChange }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState(5000);

  const handleCategoryChange = (category) => {
    let updatedCategories = [...selectedCategories];
    if (updatedCategories.includes(category)) {
      updatedCategories = updatedCategories.filter((cat) => cat !== category);
    } else {
      updatedCategories.push(category);
    }
    setSelectedCategories(updatedCategories);
    onFilterChange({ category: updatedCategories, priceRange });
  };

  const handlePriceChange = (e) => {
    setPriceRange(e.target.value);
    onFilterChange({ category: selectedCategories, priceRange: e.target.value });
  };

  return (
    <aside className="filters">
      <h2 className="filters-title">Filters</h2>

      <div className="filter-section">
        <h3 className="filter-heading">Categories</h3>
        {["Electronics", "Fashion", "Home", "Sports", "Books"].map((category) => (
          <div className="filter-item" key={category}>
            <input
              type="checkbox"
              checked={selectedCategories.includes(category)}
              onChange={() => handleCategoryChange(category)}
            />
            <label>{category}</label>
          </div>
        ))}
      </div>

      <div className="filter-section">
        <h3 className="filter-heading">Price</h3>
        <input type="range" min="0" max="5000" value={priceRange} onChange={handlePriceChange} />
        <div className="price-range">
          <span>₹0</span>
          <span>₹{priceRange}</span>
        </div>
      </div>

      <button className="clear-filters-btn" onClick={() => onFilterChange({ category: [], priceRange: 5000 })}>
        Clear Filters
      </button>
    </aside>
  );
};

export default Filters;
