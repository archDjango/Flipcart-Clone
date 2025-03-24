import React, { useState } from "react";
import "./Filters.css";

const Filters = ({ onFilterChange }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState(10000); // Adjusted max value
  const [minRating, setMinRating] = useState(0); // New state for rating filter

  const handleCategoryChange = (category) => {
    let updatedCategories = [...selectedCategories];
    if (updatedCategories.includes(category)) {
      updatedCategories = updatedCategories.filter((cat) => cat !== category);
    } else {
      updatedCategories.push(category);
    }
    setSelectedCategories(updatedCategories);
    onFilterChange({ category: updatedCategories, priceRange, minRating });
  };

  const handlePriceChange = (e) => {
    const value = e.target.value;
    setPriceRange(value);
    onFilterChange({ category: selectedCategories, priceRange: value, minRating });
  };

  const handleRatingChange = (rating) => {
    setMinRating(rating);
    onFilterChange({ category: selectedCategories, priceRange, minRating: rating });
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange(10000);
    setMinRating(0);
    onFilterChange({ category: [], priceRange: 10000, minRating: 0 });
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
        <input
          type="range"
          min="0"
          max="10000"
          value={priceRange}
          onChange={handlePriceChange}
        />
        <div className="price-range">
          <span>₹0</span>
          <span>₹{priceRange}</span>
        </div>
      </div>

      <div className="filter-section">
        <h3 className="filter-heading">Rating</h3>
        {[4, 3, 2, 1].map((rating) => (
          <div className="filter-item" key={rating}>
            <input
              type="radio"
              name="rating"
              checked={minRating === rating}
              onChange={() => handleRatingChange(rating)}
            />
            <label>{rating}★ & above</label>
          </div>
        ))}
        <div className="filter-item">
          <input
            type="radio"
            name="rating"
            checked={minRating === 0}
            onChange={() => handleRatingChange(0)}
          />
          <label>All Ratings</label>
        </div>
      </div>

      <button className="clear-filters-btn" onClick={clearFilters}>
        Clear Filters
      </button>
    </aside>
  );
};

export default Filters;