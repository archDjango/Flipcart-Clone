import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import './CouponManagement.css';

const CouponManagement = () => {
  const { permissions } = useContext(AuthContext);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'flat',
    discount_value: '',
    min_order_amount: '',
    expiry_date: '',
    status: 'active',
  });

  useEffect(() => {
    if (!permissions.coupons?.view) {
      setError('You do not have permission to view coupons.');
      setLoading(false);
      return;
    }
    fetchCoupons();
  }, [permissions]);

  const fetchCoupons = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/coupons', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCoupons(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch coupons: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddCoupon = async () => {
    if (!permissions.coupons?.create) {
      toast.error('You do not have permission to create coupons.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/coupons', form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Coupon created successfully!');
      fetchCoupons();
      resetForm();
      setModalOpen(false);
    } catch (err) {
      toast.error('Failed to create coupon: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleEditCoupon = async () => {
    if (!permissions.coupons?.edit) {
      toast.error('You do not have permission to edit coupons.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/coupons/${editingCoupon.id}`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Coupon updated successfully!');
      fetchCoupons();
      resetForm();
      setModalOpen(false);
      setEditingCoupon(null);
    } catch (err) {
      toast.error('Failed to update coupon: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!permissions.coupons?.delete) {
      toast.error('You do not have permission to delete coupons.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/coupons/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Coupon deleted successfully!');
      fetchCoupons();
    } catch (err) {
      toast.error('Failed to delete coupon: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount,
      expiry_date: coupon.expiry_date.split('T')[0], // Format for input
      status: coupon.status,
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setForm({
      code: '',
      discount_type: 'flat',
      discount_value: '',
      min_order_amount: '',
      expiry_date: '',
      status: 'active',
    });
    setEditingCoupon(null);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="coupon-management">
      <h2>Manage Coupons</h2>
      {permissions.coupons?.create && (
        <button className="add-coupon-btn" onClick={() => setModalOpen(true)}>
          Add New Coupon
        </button>
      )}
      <table className="coupon-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Value</th>
            <th>Min Order</th>
            <th>Expiry Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {coupons.length === 0 ? (
            <tr>
              <td colSpan="7">No coupons found.</td>
            </tr>
          ) : (
            coupons.map(coupon => (
              <tr key={coupon.id}>
                <td>{coupon.code}</td>
                <td>{coupon.discount_type}</td>
                <td>{coupon.discount_type === 'flat' ? `₹${coupon.discount_value}` : `${coupon.discount_value}%`}</td>
                <td>₹{coupon.min_order_amount}</td>
                <td>{new Date(coupon.expiry_date).toLocaleDateString()}</td>
                <td>{coupon.status}</td>
                <td>
                  {permissions.coupons?.edit && (
                    <button className="edit-btn" onClick={() => openEditModal(coupon)}>
                      Edit
                    </button>
                  )}
                  {permissions.coupons?.delete && (
                    <button className="delete-btn" onClick={() => handleDeleteCoupon(coupon.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingCoupon ? 'Edit Coupon' : 'Add Coupon'}</h3>
            <input
              type="text"
              name="code"
              placeholder="Coupon Code"
              value={form.code}
              onChange={handleFormChange}
              required
            />
            <select name="discount_type" value={form.discount_type} onChange={handleFormChange}>
              <option value="flat">Flat</option>
              <option value="percentage">Percentage</option>
            </select>
            <input
              type="number"
              name="discount_value"
              placeholder="Discount Value"
              value={form.discount_value}
              onChange={handleFormChange}
              required
            />
            <input
              type="number"
              name="min_order_amount"
              placeholder="Minimum Order Amount"
              value={form.min_order_amount}
              onChange={handleFormChange}
              required
            />
            <input
              type="date"
              name="expiry_date"
              value={form.expiry_date}
              onChange={handleFormChange}
              required
            />
            <select name="status" value={form.status} onChange={handleFormChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="modal-actions">
              <button
                onClick={editingCoupon ? handleEditCoupon : handleAddCoupon}
                className="save-btn"
              >
                Save
              </button>
              <button onClick={() => { setModalOpen(false); resetForm(); }} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;