import React from "react";
import "./Sorting.css";

const Sorting = ({ handleSort }) => {
  return (
    <div className="sorting">
      <span className="sorting-label">Sort by:</span>
      <select className="sorting-select" onChange={handleSort}>
        <option value="relevance">Relevance</option>
        <option value="lowToHigh">Price - Low to High</option>
        <option value="highToLow">Price - High to Low</option>
        <option value="newest">Newest First</option>
      </select>
    </div>
  );
};

export default Sorting;
