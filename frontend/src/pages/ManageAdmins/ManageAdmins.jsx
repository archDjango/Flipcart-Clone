import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './ManageAdmins.css';

const ManageAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', role: 'Super Admin' });
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdmins(res.data);
    } catch (err) {
      console.error('Error fetching admins:', err.response?.status, err.response?.data || err.message);
      toast.error(`Failed to load admins: ${err.response?.data?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/admins', newAdmin, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdmins([...admins, res.data]);
      setModalOpen(false);
      setNewAdmin({ name: '', email: '', password: '', role: 'Super Admin' });
      toast.success('Admin added successfully!');
    } catch (err) {
      console.error('Error adding admin:', err);
      toast.error(err.response?.data.message || 'Failed to add admin');
    }
  };

  const handleUpdateAdmin = async (id, updates) => {
    try {
      const res = await axios.put(`http://localhost:5000/api/admins/${id}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdmins(admins.map(admin => admin.id === id ? res.data : admin));
      toast.success('Admin updated successfully!');
    } catch (err) {
      console.error('Error updating admin:', err);
      toast.error(err.response?.data.message || 'Failed to update admin');
    }
  };

  return (
    <div className="manage-admins">
      <ToastContainer position="top-right" autoClose={5000} />
      <h2>Manage Admins</h2>
      <button className="add-btn" onClick={() => setModalOpen(true)}>Add New Admin</button>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id}>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td>
                  {admin.role}{' '}
                  {admin.role === 'Super Admin' && <span className="super-admin-badge">Super</span>}
                </td>
                <td>{admin.status}</td>
                <td>
                  <span
                    className="action-icon edit"
                    title="Edit Role/Status"
                    onClick={() => {
                      const newRole = prompt('Enter new role (Super Admin, Product Manager, Order Manager):', admin.role);
                      const newStatus = prompt('Enter new status (Active, Inactive):', admin.status);
                      if (newRole || newStatus) {
                        handleUpdateAdmin(admin.id, { role: newRole || admin.role, status: newStatus || admin.status });
                      }
                    }}
                  >
                    ✏️
                  </span>
                  <span
                    className="action-icon deactivate"
                    title={admin.status === 'Active' ? 'Deactivate' : 'Activate'}
                    onClick={() => handleUpdateAdmin(admin.id, { status: admin.status === 'Active' ? 'Inactive' : 'Active' })}
                  >
                    {admin.status === 'Active' ? '⛔' : '✅'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>Add New Admin</h3>
            <form onSubmit={handleAddAdmin}>
              <input
                type="text"
                placeholder="Name"
                value={newAdmin.name}
                onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newAdmin.email}
                onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newAdmin.password}
                onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
                required
              />
              <select
                value={newAdmin.role}
                onChange={e => setNewAdmin({ ...newAdmin, role: e.target.value })}
              >
                <option value="Super Admin">Super Admin</option>
                <option value="Product Manager">Product Manager</option>
                <option value="Order Manager">Order Manager</option>
              </select>
              <button type="submit">Add Admin</button>
              <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAdmins;