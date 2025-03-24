import React, { useState, useEffect } from "react";
import "./ManageProducts.css";

const ManageProducts = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    price: "",
    rating: "",
    category: "",
    image: ""
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const storedProducts = JSON.parse(localStorage.getItem("products")) || [];
    setProducts(storedProducts);
  }, []);

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedProducts = isEditing
      ? products.map(p => (p.id === form.id ? { ...form, id: p.id } : p))
      : [...products, { ...form, id: Date.now() }]; // Use timestamp as ID for new products

    setProducts(updatedProducts);
    localStorage.setItem("products", JSON.stringify(updatedProducts));
    resetForm();
  };

  const handleEdit = (product) => {
    setForm(product);
    setIsEditing(true);
  };

  const handleDelete = (id) => {
    const updatedProducts = products.filter(p => p.id !== id);
    setProducts(updatedProducts);
    localStorage.setItem("products", JSON.stringify(updatedProducts));
  };

  const resetForm = () => {
    setForm({ id: null, name: "", price: "", rating: "", category: "", image: "" });
    setIsEditing(false);
  };

  return (
    <div className="manage-products">
      <h2>{isEditing ? "Edit Product" : "Add Product"}</h2>
      <form className="product-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Product Name"
          value={form.name}
          onChange={handleInputChange}
          required
        />
        <input
          type="number"
          name="price"
          placeholder="Price"
          value={form.price}
          onChange={handleInputChange}
          required
        />
        <input
          type="number"
          name="rating"
          placeholder="Rating (1-5)"
          value={form.rating}
          onChange={handleInputChange}
          min="1"
          max="5"
          step="0.1"
          required
        />
        <select
          name="category"
          value={form.category}
          onChange={handleInputChange}
          required
        >
          <option value="">Select Category</option>
          <option value="Electronics">Electronics</option>
          <option value="Fashion">Fashion</option>
          <option value="Appliances">Appliances</option>
          <option value="Accessories">Accessories</option>
          <option value="Furniture">Furniture</option>
          <option value="Sports">Sports</option>
        </select>
        <input
          type="url"
          name="image"
          placeholder="Image URL"
          value={form.image}
          onChange={handleInputChange}
          required
        />
        <button type="submit">{isEditing ? "Update" : "Add"} Product</button>
        {isEditing && <button type="button" onClick={resetForm}>Cancel</button>}
      </form>

      <h2>Product List</h2>
      <div className="product-list">
        {products.map(product => (
          <div key={product.id} className="product-item">
            <img src={product.image} alt={product.name} />
            <p><strong>{product.name}</strong></p>
            <p>₹{product.price}</p>
            <p>{product.rating} ★</p>
            <p>{product.category}</p>
            <button className="edit-btn" onClick={() => handleEdit(product)}>Edit</button>
            <button className="delete-btn" onClick={() => handleDelete(product.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageProducts;