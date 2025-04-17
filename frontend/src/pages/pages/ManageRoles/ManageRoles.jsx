// src/pages/ManageRoles/ManageRoles.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './ManageRoles.css';

const ManageRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {
      products: { view: false, create: false, edit: false, delete: false },
      orders: { view: false, create: false, edit: false, delete: false },
      reviews: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
      admins: { view: false, create: false, edit: false, delete: false },
      analytics: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
    },
  });
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(res.data);
    } catch (err) {
      console.error('Error fetching roles:', err);
      toast.error(`Failed to load roles: ${err.response?.data?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (role = null) => {
    if (role) {
      setEditRole(role);
      setFormData({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      });
    } else {
      setEditRole(null);
      setFormData({
        name: '',
        description: '',
        permissions: {
          products: { view: false, create: false, edit: false, delete: false },
          orders: { view: false, create: false, edit: false, delete: false },
          reviews: { view: false, create: false, edit: false, delete: false },
          users: { view: false, create: false, edit: false, delete: false },
          admins: { view: false, create: false, edit: false, delete: false },
          analytics: { view: false, create: false, edit: false, delete: false },
          roles: { view: false, create: false, edit: false, delete: false },
        },
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editRole) {
        const res = await axios.put(`http://localhost:5000/api/roles/${editRole.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRoles(roles.map(r => r.id === editRole.id ? res.data : r));
        toast.success('Role updated successfully!');
      } else {
        const res = await axios.post('http://localhost:5000/api/roles', formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRoles([...roles, res.data]);
        toast.success('Role created successfully!');
      }
      setModalOpen(false);
      setEditRole(null);
    } catch (err) {
      console.error('Error saving role:', err);
      toast.error(err.response?.data.message || 'Failed to save role');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/roles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(roles.filter(r => r.id !== id));
      toast.success('Role deleted successfully!');
    } catch (err) {
      console.error('Error deleting role:', err);
      toast.error(err.response?.data.message || 'Failed to delete role');
    }
  };

  const togglePermission = (module, action) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [module]: {
          ...formData.permissions[module],
          [action]: !formData.permissions[module][action],
        },
      },
    });
  };

  return (
    <div className="manage-roles">
      <ToastContainer position="top-right" autoClose={5000} />
      <h2>Manage Roles</h2>
      <button className="add-btn" onClick={() => handleOpenModal()}>Add New Role</button>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <table className="role-table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td>{role.description}</td>
                <td>
                  {Object.entries(role.permissions).map(([module, perms]) => (
                    <div key={module}>
                      <strong>{module.charAt(0).toUpperCase() + module.slice(1)}:</strong>{' '}
                      {Object.entries(perms).filter(([_, enabled]) => enabled).map(([action]) => action).join(', ')}
                    </div>
                  ))}
                </td>
                <td>
                  <span className="action-icon edit" onClick={() => handleOpenModal(role)}>✏️</span>
                  <span className="action-icon delete" onClick={() => handleDelete(role.id)}>🗑️</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editRole ? 'Edit Role' : 'Add New Role'}</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Role Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <textarea
                placeholder="Description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
              <h4>Permissions</h4>
              {Object.keys(formData.permissions).map(module => (
                <div key={module} className="permission-group">
                  <h5>{module.charAt(0).toUpperCase() + module.slice(1)}</h5>
                  {['view', 'create', 'edit', 'delete'].map(action => (
                    <label key={action}>
                      <input
                        type="checkbox"
                        checked={formData.permissions[module][action]}
                        onChange={() => togglePermission(module, action)}
                      />
                      {action.charAt(0).toUpperCase() + action.slice(1)}
                    </label>
                  ))}
                </div>
              ))}
              <button type="submit">{editRole ? 'Update Role' : 'Add Role'}</button>
              <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageRoles;