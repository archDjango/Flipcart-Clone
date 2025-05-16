import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import './ManageWallets.css';

const ManageWallets = () => {
  const { user, customers, fetchCustomers, creditWallet, permissions } = useContext(AuthContext);
  const [form, setForm] = useState({
    user_id: '',
    amount: '',
    reason: '',
    order_id: '',
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (permissions?.customers?.view) {
      const token = localStorage.getItem('token');
      fetchCustomers(token).catch((err) => {
        console.error('Failed to fetch customers:', err);
        toast.error('Failed to load customers');
      });
    }
    fetchAllTransactions();
  }, [fetchCustomers, permissions]);

  const fetchAllTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/wallet/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(
        res.data.map((tx) => ({
          ...tx,
          amount: Number(tx.amount),
          created_at: new Date(tx.created_at).toISOString(),
        }))
      );
    } catch (err) {
      console.error('Error fetching transactions:', err);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.user_id || !form.amount || !form.reason) {
      toast.error('Please fill all required fields');
      return;
    }
    if (isNaN(form.amount) || Number(form.amount) <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    try {
      const creditData = {
        user_id: Number(form.user_id),
        amount: Number(form.amount),
        reason: form.reason,
        order_id: form.order_id || null,
      };
      const result = await creditWallet(creditData);
      if (result.success) {
        toast.success('Cashback credited successfully');
        setForm({ user_id: '', amount: '', reason: '', order_id: '' });
        fetchAllTransactions();
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      console.error('Credit wallet error:', err);
      toast.error('Failed to credit cashback');
    }
  };

  if (!permissions?.wallet?.credit) {
    return <div>Insufficient permissions to manage wallets</div>;
  }

  return (
    <div className="manage-wallets">
      <h2>💸 Manage Wallets</h2>
      <div className="credit-form card">
        <h3>Credit Cashback</h3>
        <form onSubmit={handleSubmit}>
          <select name="user_id" value={form.user_id} onChange={handleChange} required>
            <option value="">Select User</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.email})
              </option>
            ))}
          </select>
          <input
            type="number"
            name="amount"
            placeholder="Amount (₹)"
            value={form.amount}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="reason"
            placeholder="Reason (e.g., Cashback, Refund)"
            value={form.reason}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="order_id"
            placeholder="Order ID (optional)"
            value={form.order_id}
            onChange={handleChange}
          />
          <button type="submit" disabled={loading}>
            Credit Cashback
          </button>
        </form>
      </div>
      <div className="transactions-section">
        <h3>All Transactions</h3>
        {loading ? (
          <p>Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p>No transactions found.</p>
        ) : (
          <div className="transactions-table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Order ID</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.created_at).toLocaleString()}</td>
                    <td>{tx.user_name || tx.user_id}</td>
                    <td className={tx.type === 'credit' ? 'credit' : 'debit'}>
                      {tx.type === 'credit' ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</td>
                    <td>{tx.reason}</td>
                    <td>{tx.order_id || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageWallets;