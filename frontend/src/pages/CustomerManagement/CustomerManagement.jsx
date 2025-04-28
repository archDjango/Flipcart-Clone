import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CustomerManagement = () => {
  const { customers, fetchCustomers, updateCustomerStatus, permissions } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (permissions?.customers?.view) {
      handleFetchCustomers();
    }
  }, [permissions]);

  const handleFetchCustomers = async () => {
    setLoading(true);
    try {
      await fetchCustomers(localStorage.getItem('token'), searchTerm);
    } catch (err) {
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    handleFetchCustomers();
  };

  const handleStatusChange = async (customerId, newStatus) => {
    setLoading(true);
    try {
      const result = await updateCustomerStatus(customerId, newStatus);
      if (result.success) {
        toast.success(`Customer ${newStatus.toLowerCase()} successfully`);
      } else {
        toast.error(result.message || 'Failed to update customer status');
      }
    } catch (err) {
      toast.error('Failed to update customer status');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (statusFilter !== 'All' && customer.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (!permissions?.customers?.view) {
    return <div className="text-red-500 text-center mt-4">You do not have permission to view customers.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Customer Management</h1>

      {/* Search and Filter */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, email, or phone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>
        <button
          onClick={handleSearch}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
          disabled={loading}
        >
          Search
        </button>
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Customer Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Phone</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Created Date</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 && !loading ? (
              <tr>
                <td colSpan="7" className="p-2 text-center">No customers found</td>
              </tr>
            ) : (
              filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{customer.id}</td>
                  <td className="p-2 border">{customer.name}</td>
                  <td className="p-2 border">{customer.email}</td>
                  <td className="p-2 border">{customer.phone || 'N/A'}</td>
                  <td className="p-2 border">
                    <span
                      className={`px-2 py-1 rounded text-white ${
                        customer.status === 'Active' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="p-2 border">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">
                    {permissions?.customers?.edit ? (
                      <select
                        value={customer.status}
                        onChange={(e) => handleStatusChange(customer.id, e.target.value)}
                        className="p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                      >
                        <option value="Active">Active</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    ) : (
                      <span className="text-gray-500">No edit permission</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Toast Notifications */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
};

export default CustomerManagement;