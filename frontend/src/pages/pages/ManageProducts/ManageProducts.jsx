import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import imageCompression from 'browser-image-compression';
import { Tooltip } from 'react-tooltip';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../context/AuthContext';
import './ManageProducts.css';

const PRODUCTS_PER_PAGE = 10;

const filterProducts = (products, search, categoryFilter, stockFilter) =>
  products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
    const matchesStock =
      stockFilter === 'all' ? true :
      stockFilter === 'inStock' ? p.stock > 0 :
      stockFilter === 'outOfStock' ? p.stock === 0 :
      stockFilter === 'lowStock' ? p.alert_status === 'active' : true;
    return matchesSearch && matchesCategory && matchesStock;
  });

const sortProducts = (products, sortField, sortOrder) =>
  [...products].sort((a, b) => {
    const order = sortOrder === 'asc' ? 1 : -1;
    return a[sortField] > b[sortField] ? order : -order;
  });

const ManageProducts = () => {
  const { permissions, restockProduct, fetchInventoryTransactions, fetchLowStockAlerts, acknowledgeLowStockAlert } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', price: '', stock: '', category: '', description: '', image: null, low_stock_threshold: '', seller_id: '' });
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
  const [loading, setLoading] = useState(true);
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState({ title: '', category: '', keywords: '' });
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockForm, setRestockForm] = useState({ productId: null, quantity: '' });
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [sellers, setSellers] = useState([]);

  useEffect(() => {
    if (!permissions?.products?.view) {
      setError('You do not have permission to view products');
      setLoading(false);
      return;
    }
    fetchProducts();
    fetchSellers();
    if (permissions?.inventory?.view) {
      fetchLowStockAlertsData();
    }
    const ws = new WebSocket('ws://localhost:5001');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data) return;

        if (data.type === 'lowStock' && data.product) {
          setLowStockAlerts(prev => {
            const newAlert = {
              id: data.alert_id || Date.now(),
              product_id: data.product.id,
              product_name: data.product.name,
              stock: data.product.stock,
              threshold: data.product.low_stock_threshold,
              status: 'active',
              created_at: new Date(),
              acknowledged: false
            };
            return [...prev, ...[newAlert].filter(a => !prev.some(p => p.product_id === a.product_id && p.status === 'active'))];
          });
          setProducts(prev => prev.map(p =>
            p.id === data.product.id ? { ...p, stock: data.product.stock, alert_id: data.alert_id || null, alert_status: 'active' } : p
          ));
        } else if (data.type === 'restock' && data.product) {
          setProducts(prev => prev.map(p =>
            p.id === data.product.id ? { ...p, stock: data.product.stock, alert_id: data.alert_id || null, alert_status: data.product.stock > p.low_stock_threshold ? null : p.alert_status } : p
          ));
          setLowStockAlerts(prev => prev.map(a =>
            a.product_id === data.product.id && data.product.stock > a.threshold
              ? { ...a, status: 'resolved', acknowledged: true }
              : a
          ));
          toast.info(`Product ${data.product.name} restocked`);
        } else if (data.type === 'lowStockAcknowledged' && data.alert_id) {
          setLowStockAlerts(prev => prev.map(a =>
            a.id === data.alert_id ? { ...a, status: 'resolved', acknowledged: true } : a
          ));
          setProducts(prev => prev.map(p =>
            p.id === data.product_id ? { ...p, alert_status: 'resolved' } : p
          ));
          toast.success('Low stock alert acknowledged');
        } else if (data.deleted && data.id) {
          setProducts(prev => prev.filter(p => p.id !== data.id));
          setLowStockAlerts(prev => prev.filter(a => a.product_id !== data.id));
        } else if (data.id) {
          setProducts(prev => prev.map(p => p.id === data.id ? { ...data, alert_id: data.alert_id || null, alert_status: data.alert_status || null } : p));
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };
    ws.onerror = (err) => console.error('WebSocket error:', err);
    return () => ws.close();
  }, [permissions]);

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
        params: { low_stock: stockFilter === 'lowStock' ? 'true' : undefined }
      });
      setProducts(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch products: ' + (err.response?.data?.message || 'Unknown error'));
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/sellers', {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'Approved' }
      });
      setSellers(res.data);
    } catch (err) {
      toast.error('Failed to fetch sellers');
    }
  };

  const fetchLowStockAlertsData = async () => {
    try {
      const token = localStorage.getItem('token');
      const alerts = await fetchLowStockAlerts(token, 'active');
      setLowStockAlerts(alerts);
    } catch (err) {
      toast.error('Failed to fetch low stock alerts');
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Product name is required';
    if (!form.price || isNaN(form.price) || form.price <= 0) newErrors.price = 'Price must be a positive number';
    if (!form.stock || isNaN(form.stock) || form.stock < 0) newErrors.stock = 'Stock must be a non-negative number';
    if (!form.category.trim()) newErrors.category = 'Category is required';
    if (!form.low_stock_threshold || isNaN(form.low_stock_threshold) || form.low_stock_threshold < 0) newErrors.low_stock_threshold = 'Low stock threshold must be a non-negative number';
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
    formData.append('description', form.description || '');
    formData.append('low_stock_threshold', form.low_stock_threshold);
    formData.append('seller_id', form.seller_id || '');
    if (form.image instanceof File) {
      formData.append('image', form.image);
    } else if (editMode && form.image) {
      formData.append('image', form.image);
    }

    try {
      const res = editMode
        ? await axios.put(`http://localhost:5000/api/products/${form.id}`, formData, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          })
        : await axios.post('http://localhost:5000/api/products', formData, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          });
      setProducts(editMode
        ? products.map(p => p.id === form.id ? { ...res.data, alert_id: res.data.alert_id || null, alert_status: res.data.alert_status || null } : p)
        : [...products, { ...res.data, alert_id: res.data.alert_id || null, alert_status: res.data.alert_status || null }]
      );
      closeModal();
      toast.success(editMode ? 'Product updated successfully!' : 'Product added successfully!');
    } catch (err) {
      setError('Failed to save product: ' + (err.response?.data?.message || 'Unknown error'));
      toast.error('Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setForm({
      ...product,
      image: null,
      low_stock_threshold: product.low_stock_threshold || 10,
      seller_id: product.seller_id || ''
    });
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
      setLowStockAlerts(prev => prev.filter(a => a.product_id !== id));
      toast.success('Product deleted successfully!');
    } catch (err) {
      setError('Failed to delete product: ' + (err.response?.data?.message || 'Unknown error'));
      toast.error('Failed to delete product');
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
      setLowStockAlerts(prev => prev.filter(a => !selectedProducts.includes(a.product_id)));
      setSelectedProducts([]);
      toast.success(`${selectedProducts.length} products deleted successfully!`);
    } catch (err) {
      setError('Failed to delete products: ' + (err.response?.data?.message || 'Unknown error'));
      toast.error('Failed to delete products');
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
          description: row.description || '',
          low_stock_threshold: Number(row.low_stock_threshold) || 10,
          seller_id: row.seller_id || '',
        }));
        try {
          const responses = await Promise.all(
            newProducts.map(product =>
              axios.post('http://localhost:5000/api/products', product, {
                headers: { Authorization: `Bearer ${token}` },
              })
            )
          );
          setProducts(prev => [...prev, ...responses.map(res => ({
            ...res.data,
            alert_id: res.data.alert_id || null,
            alert_status: res.data.alert_status || null
          }))]);
          setCsvFile(null);
          toast.success('Products imported successfully!');
        } catch (err) {
          setError('Failed to import products: ' + (err.response?.data?.message || 'Unknown error'));
          toast.error('Failed to import products');
        }
      },
    });
  };

  const openRestockModal = (product) => {
    setRestockForm({ productId: product.id, quantity: '' });
    setRestockModalOpen(true);
  };

  const closeRestockModal = () => {
    setRestockModalOpen(false);
    setRestockForm({ productId: null, quantity: '' });
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockForm.quantity || isNaN(restockForm.quantity) || restockForm.quantity <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }
    const result = await restockProduct(restockForm.productId, Number(restockForm.quantity));
    if (result.success) {
      setProducts(prev => prev.map(p =>
        p.id === restockForm.productId
          ? { ...p, stock: result.product.stock, alert_status: result.product.stock > p.low_stock_threshold ? null : p.alert_status }
          : p
      ));
      toast.success('Product restocked successfully!');
      closeRestockModal();
    } else {
      toast.error(result.message);
    }
  };

  const openTransactionsModal = async (productId) => {
    try {
      const transactionsData = await fetchInventoryTransactions({ product_id: productId });
      setTransactions(transactionsData);
      setTransactionsModalOpen(true);
    } catch (err) {
      toast.error('Failed to fetch transactions');
    }
  };

  const closeTransactionsModal = () => {
    setTransactionsModalOpen(false);
    setTransactions([]);
  };

  const handleAcknowledgeAlert = async (alertId) => {
    const result = await acknowledgeLowStockAlert(alertId);
    if (result.success) {
      setLowStockAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'resolved', acknowledged: true } : a
      ));
      setProducts(prev => prev.map(p =>
        p.alert_id === alertId ? { ...p, alert_status: 'resolved' } : p
      ));
      toast.success('Alert acknowledged');
    } else {
      toast.error(result.message);
    }
  };

  const openModal = () => {
    setForm({ id: '', name: '', price: '', stock: '', category: '', description: '', image: null, low_stock_threshold: '10', seller_id: '' });
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

  const handleGenerateDescription = async () => {
    if (!aiPrompt.title || !aiPrompt.category) {
      toast.error('Please provide at least title and category');
      return;
    }
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/products/generate-description',
        aiPrompt,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGeneratedDescription(response.data.description);
      toast.success('Description generated successfully!');
    } catch (err) {
      toast.error('Failed to generate description: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptDescription = () => {
    setForm(prev => ({ ...prev, description: generatedDescription }));
    setDescriptionModalOpen(false);
    setGeneratedDescription('');
    setAiPrompt({ title: '', category: '', keywords: '' });
    toast.info('Description added to product form');
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
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Manage Products</h2>
      {permissions?.inventory?.view && lowStockAlerts.length > 0 && (
        <div className="low-stock-alerts">
          <h3>Low Stock Alerts</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Current Stock</th>
                <th>Threshold</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lowStockAlerts.map(alert => (
                <tr key={alert.id}>
                  <td>{alert.product_name}</td>
                  <td>{alert.stock}</td>
                  <td>{alert.threshold}</td>
                  <td>{alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}</td>
                  <td>{new Date(alert.created_at).toLocaleString()}</td>
                  <td>
                    {alert.status === 'active' && permissions?.inventory?.edit && (
                      <button onClick={() => handleAcknowledgeAlert(alert.id)}>Acknowledge</button>
                    )}
                    {permissions?.inventory?.restock && (
                      <button onClick={() => openRestockModal({ id: alert.product_id, name: alert.product_name })}>Restock</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="controls">
        <button className="add-btn" onClick={openModal} data-tooltip-id="tooltip" data-tooltip-content="Add a new product">
          Add Product
        </button>
        <div className="csv-upload">
          <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} />
          <button onClick={handleCsvUpload}>Import CSV</button>
        </div>
        <input type="text" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />
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
          <option value="lowStock">Low Stock</option>
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
              <th onClick={() => handleSort('id')}>ID {sortField === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('name')}>Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('price')}>Price {sortField === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('stock')}>Stock {sortField === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('low_stock_threshold')}>Threshold {sortField === 'low_stock_threshold' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('category')}>Category {sortField === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('seller_name')}>Seller {sortField === 'seller_name' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('created_at')}>Date Added {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th>Alert Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(product => (
              <tr key={product.id} className={product.alert_status === 'active' ? 'low-stock' : ''}>
                <td><input type="checkbox" checked={selectedProducts.includes(product.id)} onChange={() => toggleSelectProduct(product.id)} /></td>
                <td>{product.id}</td>
                <td>
                  {product.name}
                  {product.alert_status === 'active' && <span className="low-stock-badge">Low</span>}
                </td>
                <td>₹{product.price}</td>
                <td>{product.stock}</td>
                <td>{product.low_stock_threshold}</td>
                <td>{product.category}</td>
                <td>{product.seller_name || 'N/A'}</td>
                <td>{new Date(product.created_at).toLocaleDateString()}</td>
                <td>{product.alert_status ? product.alert_status.charAt(0).toUpperCase() + product.alert_status.slice(1) : 'None'}</td>
                <td>
                  <button className="edit-btn" onClick={() => handleEdit(product)} data-tooltip-id="tooltip" data-tooltip-content="Edit this product">Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(product.id)} data-tooltip-id="tooltip" data-tooltip-content="Delete this product">Delete</button>
                  {permissions?.inventory?.restock && (
                    <button className="restock-btn" onClick={() => openRestockModal(product)} data-tooltip-id="tooltip" data-tooltip-content="Restock this product">Restock</button>
                  )}
                  {permissions?.inventory?.transactions_view && (
                    <button className="transactions-btn" onClick={() => openTransactionsModal(product.id)} data-tooltip-id="tooltip" data-tooltip-content="View transactions">Transactions</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="pagination">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
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
                <label>Low Stock Threshold</label>
                <input
                  type="number"
                  name="low_stock_threshold"
                  value={form.low_stock_threshold}
                  onChange={handleChange}
                  className={errors.low_stock_threshold ? 'input-error' : ''}
                  placeholder="Enter low stock threshold"
                  min="0"
                />
                {errors.low_stock_threshold && <span className="error">{errors.low_stock_threshold}</span>}
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
                <label>Seller</label>
                <select
                  name="seller_id"
                  value={form.seller_id}
                  onChange={handleChange}
                >
                  <option value="">No Seller</option>
                  {sellers.map(seller => (
                    <option key={seller.id} value={seller.id}>{seller.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <div className="description-group">
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className={form.description ? 'has-ai-content' : ''}
                    placeholder="Enter product description or generate one"
                    rows="4"
                  />
                  <button
                    type="button"
                    className="ai-generate-btn"
                    onClick={() => setDescriptionModalOpen(true)}
                    data-tooltip-id="tooltip"
                    data-tooltip-content="Generate description using AI"
                  >
                    Generate with AI
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Image</label>
                <input type="file" name="image" accept="image/*" onChange={handleChange} />
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

      {restockModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Restock Product</h3>
            <form onSubmit={handleRestockSubmit}>
              <div className="form-group">
                <label>Quantity to Add</label>
                <input
                  type="number"
                  value={restockForm.quantity}
                  onChange={e => setRestockForm(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                  min="1"
                  required
                />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="save-btn">Restock</button>
                <button type="button" className="cancel-btn" onClick={closeRestockModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transactionsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Inventory Transactions</h3>
            {transactions.length === 0 ? (
              <p>No transactions found.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.transaction_type}</td>
                      <td>{t.quantity}</td>
                      <td>{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={closeTransactionsModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {descriptionModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content ai-modal">
            <h3>Generate Product Description</h3>
            <div className="form-group">
              <label>Product Title *</label>
              <input
                type="text"
                value={aiPrompt.title}
                onChange={(e) => setAiPrompt(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter product title"
              />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select
                value={aiPrompt.category}
                onChange={(e) => setAiPrompt(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="">Select Category</option>
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Appliances">Appliances</option>
                <option value="Accessories">Accessories</option>
                <option value="Furniture">Furniture</option>
                <option value="Sports">Sports</option>
              </select>
            </div>
            <div className="form-group">
              <label>Keywords/Highlights (comma-separated)</label>
              <input
                type="text"
                value={aiPrompt.keywords}
                onChange={(e) => setAiPrompt(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="e.g., durable, lightweight, premium"
              />
              <small className="info-tip">Separate keywords with commas for better results</small>
            </div>
            <div className="form-group">
              {generatedDescription && (
                <>
                  <label>Generated Description</label>
                  <textarea value={generatedDescription} readOnly rows="4" className="generated-description" />
                </>
              )}
            </div>
            <div className="modal-buttons">
              <button onClick={handleGenerateDescription} disabled={generating} className="generate-btn">
                {generating ? 'Generating...' : 'Generate'}
              </button>
              {generatedDescription && (
                <button onClick={handleAcceptDescription} className="accept-btn">Accept</button>
              )}
              <button onClick={() => setDescriptionModalOpen(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <Tooltip id="tooltip" />
    </div>
  );
};

export default ManageProducts;