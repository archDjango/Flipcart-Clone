import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../context/AuthContext';
import './InventoryManagement.css';

const TRANSACTIONS_PER_PAGE = 10;

const InventoryManagement = () => {
  const { permissions, restockProduct, fetchInventoryTransactions, fetchLowStockAlerts, acknowledgeLowStockAlert } = useContext(AuthContext);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockForm, setRestockForm] = useState({ productId: null, quantity: '' });
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!permissions?.inventory?.view) {
      setError('You do not have permission to view inventory data');
      setLoading(false);
      return;
    }
    fetchData();
    const ws = new WebSocket('ws://localhost:5001');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'lowStock') {
        setLowStockAlerts(prev => {
          const newAlert = {
            id: Date.now(), // Temporary ID until backend provides
            product_id: data.product.id,
            product_name: data.product.name,
            stock: data.product.stock,
            threshold: data.product.low_stock_threshold,
            status: 'active',
            created_at: new Date(),
            acknowledged: false
          };
          return [...prev, ...[newAlert].filter(p => !prev.some(a => a.product_id === p.product_id && a.status === 'active'))];
        });
      } else if (data.type === 'restock') {
        setTransactions(prev => [
          {
            id: Date.now(),
            product_id: data.product.id,
            product_name: data.product.name,
            transaction_type: 'restock',
            quantity: data.product.stock - prev.find(t => t.product_id === data.product.id)?.stock || data.product.stock,
            created_at: new Date()
          },
          ...prev
        ]);
        setLowStockAlerts(prev => prev.map(a =>
          a.product_id === data.product.id && data.product.stock > a.threshold
            ? { ...a, status: 'resolved', acknowledged: true }
            : a
        ));
        toast.info(`Product ${data.product.name} restocked`);
      } else if (data.type === 'lowStockAcknowledged') {
        setLowStockAlerts(prev => prev.map(a =>
          a.id === data.alert_id ? { ...a, status: 'resolved', acknowledged: true } : a
        ));
        toast.success('Low stock alert acknowledged');
      }
    };
    return () => ws.close();
  }, [permissions]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alerts, transactionsData] = await Promise.all([
        permissions?.inventory?.view ? fetchLowStockAlerts(token, 'active') : [],
        permissions?.inventory?.transactions_view ? fetchInventoryTransactions(token) : [],
      ]);
      setLowStockAlerts(alerts);
      setTransactions(transactionsData);
      setError('');
    } catch (err) {
      setError('Failed to fetch inventory data: ' + (err.message || 'Unknown error'));
      toast.error('Failed to fetch inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    const result = await acknowledgeLowStockAlert(alertId);
    if (result.success) {
      setLowStockAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'resolved', acknowledged: true } : a
      ));
      toast.success('Alert acknowledged');
    } else {
      toast.error(result.message);
    }
  };

  const openRestockModal = (productId, productName) => {
    setRestockForm({ productId, productName, quantity: '' });
    setRestockModalOpen(true);
  };

  const closeRestockModal = () => {
    setRestockModalOpen(false);
    setRestockForm({ productId: null, productName: '', quantity: '' });
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockForm.quantity || isNaN(restockForm.quantity) || restockForm.quantity <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }
    const result = await restockProduct(restockForm.productId, Number(restockForm.quantity));
    if (result.success) {
      toast.success('Product restocked successfully!');
      closeRestockModal();
    } else {
      toast.error(result.message);
    }
  };

  const filterTransactions = () => {
    return transactions.filter(t => {
      const matchesSearch = t.product_name.toLowerCase().includes(search.toLowerCase());
      const matchesType = transactionTypeFilter === 'all' ? true : t.transaction_type === transactionTypeFilter;
      return matchesSearch && matchesType;
    });
  };

  const filteredTransactions = filterTransactions();
  const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * TRANSACTIONS_PER_PAGE,
    currentPage * TRANSACTIONS_PER_PAGE
  );

  return (
    <div className="inventory-management">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Inventory Management</h2>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="spinner">Loading inventory data...</div>
      ) : (
        <>
          {permissions?.inventory?.view && (
            <div className="low-stock-alerts">
              <h3>Low Stock Alerts</h3>
              {lowStockAlerts.length === 0 ? (
                <p>No low stock alerts.</p>
              ) : (
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
                            <button
                              className="acknowledge-btn"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </button>
                          )}
                          {permissions?.inventory?.restock && (
                            <button
                              className="restock-btn"
                              onClick={() => openRestockModal(alert.product_id, alert.product_name)}
                            >
                              Restock
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {permissions?.inventory?.transactions_view && (
            <div className="inventory-transactions">
              <h3>Inventory Transactions</h3>
              <div className="filters">
                <input
                  type="text"
                  placeholder="Search by product name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  value={transactionTypeFilter}
                  onChange={e => setTransactionTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="restock">Restock</option>
                  <option value="sale">Sale</option>
                  <option value="return">Return</option>
                  <option value="initial_stock">Initial Stock</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              {paginatedTransactions.length === 0 ? (
                <p>No transactions found.</p>
              ) : (
                <>
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Product</th>
                        <th>Type</th>
                        <th>Quantity</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTransactions.map(t => (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>{t.product_name}</td>
                          <td>{t.transaction_type}</td>
                          <td>{t.quantity}</td>
                          <td>{new Date(t.created_at).toLocaleString()}</td>
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
            </div>
          )}
        </>
      )}

      {restockModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Restock Product: {restockForm.productName}</h3>
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
    </div>
  );
};

export default InventoryManagement;