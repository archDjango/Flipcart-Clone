import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../context/AuthContext';
import './SellerManagement.css';

const SELLERS_PER_PAGE = 10;

const SellerManagement = () => {
  const { permissions } = useContext(AuthContext);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmationModal, setConfirmationModal] = useState({ open: false, action: '', sellerId: null, sellerName: '' });
  const [addSellerModal, setAddSellerModal] = useState(false);
  const [sellerDetailsModal, setSellerDetailsModal] = useState({ open: false, seller: null });
  const [newSeller, setNewSeller] = useState({ name: '', companyName: '', email: '', phone: '' });
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!permissions?.sellers?.view) {
      setError('You do not have permission to view sellers');
      setLoading(false);
      return;
    }
    fetchSellers();
    const ws = new WebSocket('ws://localhost:5001');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'newSeller') {
        setSellers(prev => [...prev, data.seller]);
        toast.success(`New seller added: ${data.seller.name}`);
      } else if (data.type === 'sellerStatusUpdate') {
        setSellers(prev => prev.map(s => s.id === data.id ? { ...s, status: data.status } : s));
        toast.info(`Seller ${data.seller.name} status updated to ${data.status}`);
      } else if (data.type === 'restock' || data.type === 'lowStock') {
        setSellerDetailsModal(prev => {
          if (prev.open && prev.seller) {
            const updatedProducts = prev.seller.products.map(p => 
              p.id === data.id ? { ...p, stock: data.stock } : p
            );
            return { ...prev, seller: { ...prev.seller, products: updatedProducts } };
          }
          return prev;
        });
      }
    };
    return () => ws.close();
  }, [permissions]);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/sellers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSellers(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch sellers: ' + (err.response?.data?.message || 'Unknown error'));
      toast.error('Failed to fetch sellers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerDetails = async (sellerId) => {
    try {
      const [sellerRes, productsRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/sellers/${sellerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        permissions?.inventory?.view ? axios.get('http://localhost:5000/api/products', {
          headers: { Authorization: `Bearer ${token}` },
          params: { seller_id: sellerId },
        }) : { data: [] },
      ]);
      setSellerDetailsModal({ open: true, seller: { ...sellerRes.data, products: productsRes.data } });
    } catch (err) {
      toast.error('Failed to fetch seller details: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleAddSeller = async (e) => {
    e.preventDefault();
    if (!newSeller.name || !newSeller.companyName || !newSeller.email || !newSeller.phone) {
      toast.error('Name, company name, email, and phone are required');
      return;
    }
    try {
      const payload = {
        name: newSeller.name,
        company_name: newSeller.companyName,
        email: newSeller.email,
        phone: newSeller.phone,
      };
      await axios.post('http://localhost:5000/api/sellers', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Seller added successfully!');
      setNewSeller({ name: '', companyName: '', email: '', phone: '' });
      setAddSellerModal(false);
      fetchSellers();
    } catch (err) {
      toast.error('Failed to add seller: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleAction = async (action, sellerId) => {
    try {
      const endpoint = `/api/sellers/${sellerId}/${action}`;
      await axios.put(`http://localhost:5000${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Seller ${action}ed successfully!`);
      closeConfirmationModal();
      fetchSellers();
    } catch (err) {
      toast.error(`Failed to ${action} seller: ${err.response?.data?.message || 'Unknown error'}`);
      closeConfirmationModal();
    }
  };

  const openConfirmationModal = (action, sellerId, sellerName) => {
    setConfirmationModal({ open: true, action, sellerId, sellerName });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({ open: false, action: '', sellerId: null, sellerName: '' });
  };

  const openAddSellerModal = () => {
    setAddSellerModal(true);
  };

  const closeAddSellerModal = () => {
    setAddSellerModal(false);
    setNewSeller({ name: '', companyName: '', email: '', phone: '' });
  };

  const closeSellerDetailsModal = () => {
    setSellerDetailsModal({ open: false, seller: null });
  };

  const filterSellers = () => {
    return sellers.filter(seller => {
      const matchesSearch = seller.name.toLowerCase().includes(search.toLowerCase()) ||
                           seller.company_name.toLowerCase().includes(search.toLowerCase()) ||
                           seller.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : seller.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };

  const filteredSellers = filterSellers();
  const totalPages = Math.ceil(filteredSellers.length / SELLERS_PER_PAGE);
  const paginatedSellers = filteredSellers.slice(
    (currentPage - 1) * SELLERS_PER_PAGE,
    currentPage * SELLERS_PER_PAGE
  );

  return (
    <div className="seller-management">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Manage Sellers</h2>
      {permissions?.sellers?.edit && (
        <button className="add-seller-btn" onClick={openAddSellerModal}>
          Add New Seller
        </button>
      )}
      <div className="filters">
        <input
          type="text"
          placeholder="Search by name, company, or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Blocked">Blocked</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="spinner">Loading sellers...</div>
      ) : paginatedSellers.length === 0 ? (
        <p>No sellers found.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSellers.map(seller => (
                <tr key={seller.id}>
                  <td>{seller.name}</td>
                  <td>{seller.company_name}</td>
                  <td>{seller.email}</td>
                  <td>{seller.phone || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${seller.status.toLowerCase()}`}>
                      {seller.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="view-details-btn"
                      onClick={() => fetchSellerDetails(seller.id)}
                    >
                      View Details
                    </button>
                    {permissions?.sellers?.edit && seller.status === 'Pending' && (
                      <button
                        className="approve-btn"
                        onClick={() => handleAction('approve', seller.id)}
                      >
                        Approve
                      </button>
                    )}
                    {permissions?.sellers?.edit && seller.status === 'Approved' && (
                      <button
                        className="block-btn"
                        onClick={() => openConfirmationModal('block', seller.id, seller.name)}
                      >
                        Block
                      </button>
                    )}
                    {permissions?.sellers?.edit && seller.status === 'Blocked' && (
                      <button
                        className="unblock-btn"
                        onClick={() => openConfirmationModal('unblock', seller.id, seller.name)}
                      >
                        Unblock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        </>
      )}

      {addSellerModal && (
        <div className="modal-overlay">
          <div className="add-seller-modal">
            <h3>Add New Seller</h3>
            <form onSubmit={handleAddSeller}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={newSeller.name}
                  onChange={e => setNewSeller({ ...newSeller, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  value={newSeller.companyName}
                  onChange={e => setNewSeller({ ...newSeller, companyName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={newSeller.email}
                  onChange={e => setNewSeller({ ...newSeller, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="text"
                  value={newSeller.phone}
                  onChange={e => setNewSeller({ ...newSeller, phone: e.target.value })}
                  required
                />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="confirm-btn">Add Seller</button>
                <button type="button" className="cancel-btn" onClick={closeAddSellerModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmationModal.open && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Confirm Action</h3>
            <p>
              Are you sure you want to {confirmationModal.action} seller "{confirmationModal.sellerName}"?
            </p>
            <div className="modal-buttons">
              <button
                className="confirm-btn"
                onClick={() => handleAction(confirmationModal.action, confirmationModal.sellerId)}
              >
                Confirm
              </button>
              <button className="cancel-btn" onClick={closeConfirmationModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {sellerDetailsModal.open && sellerDetailsModal.seller && (
        <div className="modal-overlay">
          <div className="seller-details-modal">
            <h3>Seller Details</h3>
            <div className="seller-info">
              <p><strong>Name:</strong> {sellerDetailsModal.seller.name}</p>
              <p><strong>Company Name:</strong> {sellerDetailsModal.seller.company_name}</p>
              <p><strong>Email:</strong> {sellerDetailsModal.seller.email}</p>
              <p><strong>Phone:</strong> {sellerDetailsModal.seller.phone || 'N/A'}</p>
              <p><strong>Status:</strong> {sellerDetailsModal.seller.status}</p>
              <p><strong>Registered At:</strong> {new Date(sellerDetailsModal.seller.created_at).toLocaleString()}</p>
            </div>
            {permissions?.inventory?.view && sellerDetailsModal.seller.products?.length > 0 ? (
              <div className="seller-products">
                <h4>Products</h4>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Stock</th>
                      <th>Low Stock Threshold</th>
                      <th>Price</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerDetailsModal.seller.products.map(product => (
                      <tr key={product.id} className={product.stock <= product.low_stock_threshold ? 'low-stock' : ''}>
                        <td>{product.id}</td>
                        <td>{product.name}</td>
                        <td>{product.stock} {product.stock <= product.low_stock_threshold && <span>(Low)</span>}</td>
                        <td>{product.low_stock_threshold}</td>
                        <td>₹{product.price}</td>
                        <td>{product.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : permissions?.inventory?.view ? (
              <p>No products associated with this seller.</p>
            ) : (
              <p>Product details not visible due to insufficient permissions.</p>
            )}
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={closeSellerDetailsModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerManagement;