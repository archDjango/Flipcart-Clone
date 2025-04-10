import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ProductShowcase.css';

const products = [
  { id: 1, name: "Smartphone", price: "₹15,999", image: "https://images-cdn.ubuy.co.in/633fd9ec9f50f57b704f1be2-hilitand-s22-ultra-unlocked-smartphone.jpg" },
  { id: 2, name: "Running Shoes", price: "₹3,499", image: "https://m.media-amazon.com/images/I/81o8bHAXG3L._AC_UY1000_.jpg" },
  { id: 3, name: "Refrigerator", price: "₹41,999", image: "https://images-cdn.ubuy.co.in/65979c2cb910f53d2e6e34ae-3-5cu-ft-compact-refrigerator-mini.jpg" }
];

const ProductShowcase = () => {
  const navigate = useNavigate();

  return (
    <div className="product-showcase">
      {products.map((product) => (
        <div key={product.id} className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
          <img src={product.image} alt={product.name} />
          <h3>{product.name}</h3>
          <p>{product.price}</p>
        </div>
      ))}
    </div>
  );
};

export default ProductShowcase;
