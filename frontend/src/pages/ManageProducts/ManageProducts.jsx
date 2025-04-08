import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import imageCompression from 'browser-image-compression';
import { Tooltip } from 'react-tooltip';
import './ManageProducts.css';

const PRODUCTS_PER_PAGE = 10;

const filterProducts = (products, search, categoryFilter, stockFilter) =>
  products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
    const matchesStock =
      stockFilter === 'all' ? true :
      stockFilter === 'inStock' ? p.stock > 0 :
      p.stock === 0;
    return matchesSearch && matchesCategory && matchesStock;
  });

const sortProducts = (products, sortField, sortOrder) =>
  [...products].sort((a, b) => {
    const order = sortOrder === 'asc' ? 1 : -1;
    return a[sortField] > b[sortField] ? order : -order;
  });

const ManageProducts = () => {
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', stock: '', category: '', image: null });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [csvFile, setCsvFile] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [loading, setLoading] = useState(true); // Added for loading spinner

  useEffect(() => {
    fetchProducts();
    const ws = new WebSocket('ws://localhost:5001');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'lowStock') {
        setProducts(prev => prev.map(p => data.products.find(lp => lp.id === p.id) || p));
      } else if (data.deleted) {
        setProducts(prev => prev.filter(p => p.id !== data.id));
      } else {
        setProducts(prev => prev.map(p => p.id === data.id ? data : p));
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.removeItem('token');
        window.location.href = '/admin-login';
      }, 30 * 60 * 1000);
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    resetTimer();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
    };
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch products: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Product name is required';
    if (!form.price || isNaN(form.price) || form.price <= 0) newErrors.price = 'Price must be a positive number';
    if (!form.stock || isNaN(form.stock) || form.stock < 0) newErrors.stock = 'Stock must be a non-negative number';
    if (!form.category.trim()) newErrors.category = 'Category is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image' && files[0]) {
      compressImage(files[0]).then(compressedFile => {
        setForm(prev => ({ ...prev, image: compressedFile }));
      });
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 800,
      useWebWorker: true,
    };
    try {
      return await imageCompression(file, options);
    } catch (err) {
      setError('Image compression failed: ' + err.message);
      return file;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('price', form.price);
    formData.append('stock', form.stock);
    formData.append('category', form.category);
    if (form.image) formData.append('image', form.image);

    try {
      const res = editMode
        ? await axios.put(`http://localhost:5000/api/products/${form.id}`, formData, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : await axios.post('http://localhost:5000/api/products', formData, {
            headers: { Authorization: `Bearer ${token}` },
          });
      setProducts(editMode ? products.map(p => p.id === form.id ? res.data : p) : [...products, res.data]);
      closeModal();
    } catch (err) {
      setError('Failed to save product: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleEdit = (product) => {
    setForm({ ...product, image: null });
    setEditMode(true);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://localhost:5000/api/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      setError('Failed to delete product: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleMultiDelete = async () => {
    if (selectedProducts.length === 0) return setError('No products selected');
    if (!window.confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete('http://localhost:5000/api/products/bulk', {
        headers: { Authorization: `Bearer ${token}` },
        data: { ids: selectedProducts },
      });
      setProducts(products.filter(p => !selectedProducts.includes(p.id)));
      setSelectedProducts([]);
    } catch (err) {
      setError('Failed to delete products: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return setError('Please upload a CSV file');
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const token = localStorage.getItem('token');
        const newProducts = result.data.map(row => ({
          name: row.name,
          price: Number(row.price),
          stock: Number(row.stock),
          category: row.category,
        }));
        try {
          await Promise.all(
            newProducts.map(product =>
              axios.post('http://localhost:5000/api/products', product, {
                headers: { Authorization: `Bearer ${token}` },
              })
            )
          );
          fetchProducts();
          setCsvFile(null);
        } catch (err) {
          setError('Failed to import products: ' + (err.response?.data?.message || 'Unknown error'));
        }
      },
    });
  };

  const openModal = () => {
    setForm({ name: '', price: '', stock: '', category: '', image: null });
    setEditMode(false);
    setModalOpen(true);
    setErrors({});
  };

  const closeModal = () => setModalOpen(false);

  const toggleSelectProduct = (id) =>
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );

  const handleSort = (field) => {
    setSortField(field);
    setSortOrder(sortField === field && sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const filtered = filterProducts(products, search, categoryFilter, stockFilter);
  const sorted = sortProducts(filtered, sortField, sortOrder);
  const paginated = sorted.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );
  const totalPages = Math.ceil(sorted.length / PRODUCTS_PER_PAGE);

  return (
    <div className="manage-products">
      <h2>Manage Products</h2>
      <div className="controls">
        <button
          className="add-btn"
          onClick={openModal}
          data-tooltip-id="tooltip"
          data-tooltip-content="Add a new product"
        >
          Add Product
        </button>
        <div className="csv-upload">
          <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} />
          <button onClick={handleCsvUpload}>Import CSV</button>
        </div>
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {[...new Set(products.map(p => p.category))].map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
          <option value="all">All Stock Levels</option>
          <option value="inStock">In Stock</option>
          <option value="outOfStock">Out of Stock</option>
        </select>
        <button
          className="delete-selected-btn"
          onClick={handleMultiDelete}
          disabled={!selectedProducts.length}
          data-tooltip-id="tooltip"
          data-tooltip-content="Delete selected products"
        >
          Delete Selected ({selectedProducts.length})
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="spinner">Loading products...</div>
      ) : paginated.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th></th>
              <th onClick={() => handleSort('id')}>
                ID {sortField === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('name')}>
                Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('price')}>
                Price {sortField === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('stock')}>
                Stock {sortField === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('category')}>
                Category {sortField === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('created_at')}>
                Date Added {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(product => (
              <tr key={product.id} className={product.stock < 10 ? 'low-stock' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => toggleSelectProduct(product.id)}
                  />
                </td>
                <td>{product.id}</td>
                <td>
                  {product.name} 
                  {product.stock < 10 && <span className="low-stock-badge">Low</span>}
                </td>
                <td>₹{product.price}</td>
                <td>{product.stock}</td>
                <td>{product.category}</td>
                <td>{new Date(product.created_at).toLocaleDateString()}</td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(product)}
                    data-tooltip-id="tooltip"
                    data-tooltip-content="Edit this product"
                  >
                    Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(product.id)}
                    data-tooltip-id="tooltip"
                    data-tooltip-content="Delete this product"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(prev => prev - 1)}
        >
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(prev => prev + 1)}
        >
          Next
        </button>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editMode ? 'Edit Product' : 'Add Product'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={errors.name ? 'input-error' : ''}
                  placeholder="Enter product name"
                />
                {errors.name && <span className="error">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label>Price</label>
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  className={errors.price ? 'input-error' : ''}
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                />
                {errors.price && <span className="error">{errors.price}</span>}
              </div>
              <div className="form-group">
                <label>Stock</label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  className={errors.stock ? 'input-error' : ''}
                  placeholder="Enter stock"
                  min="0"
                />
                {errors.stock && <span className="error">{errors.stock}</span>}
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className={errors.category ? 'input-error' : ''}
                >
                  <option value="">Select Category</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Appliances">Appliances</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Sports">Sports</option>
                </select>
                {errors.category && <span className="error">{errors.category}</span>}
              </div>
              <div className="form-group">
                <label>Image</label>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={handleChange}
                />
                {editMode && form.image && <p>Current image will be replaced if a new file is uploaded.</p>}
              </div>
              <div className="modal-buttons">
                <button type="submit" className="save-btn">{editMode ? 'Update' : 'Add'}</button>
                <button type="button" className="cancel-btn" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Tooltip id="tooltip" />
    </div>
  );
};

export default ManageProducts;