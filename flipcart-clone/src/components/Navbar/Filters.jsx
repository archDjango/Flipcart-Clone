// src/components/Filters.jsx
import React from 'react';
import './Filters.css';

const Filters = ({ setFilter, setSortOrder }) => {
  return (
    <div className="filters-container">
      <select onChange={(e) => setFilter((prev) => ({ ...prev, category: e.target.value }))}>
        <option value="">All Categories</option>
        <option value="Electronics">Electronics</option>
        <option value="Fashion">Fashion</option>
        <option value="Appliances">Appliances</option>
        <option value="Home Essentials">Home Essentials</option>
      </select>

      <select onChange={(e) => setFilter((prev) => ({ ...prev, brand: e.target.value }))}>
        <option value="">All Brands</option>
        <option value="Samsung">Samsung</option>
        <option value="Nike">Nike</option>
        <option value="Sony">Sony</option>
        <option value="Whirlpool">Whirlpool</option>
      </select>

      <select onChange={(e) => setSortOrder(e.target.value)}>
        <option value="">Sort By</option>
        <option value="low-to-high">Price: Low to High</option>
        <option value="high-to-low">Price: High to Low</option>
      </select>
    </div>
  );
};

export default Filters;
