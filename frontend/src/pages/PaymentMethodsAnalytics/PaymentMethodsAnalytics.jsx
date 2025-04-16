// src/pages/PaymentMethodsAnalytics/PaymentMethodsAnalytics.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { AuthContext } from '../../context/AuthContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './PaymentMethodsAnalytics.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PaymentMethodsAnalytics = () => {
  const { role, logout } = useContext(AuthContext);
  const [analytics, setAnalytics] = useState([]);
  const [totals, setTotals] = useState({ totalOrders: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
  });
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token || !['admin', 'manager'].includes(role)) {
      setError('Unauthorized access. Please log in as admin or manager.');
      setLoading(false);
      return;
    }
    fetchAnalytics();

    // WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:5001');
    ws.onopen = () => console.log('WebSocket connected for payment analytics');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'newOrder') {
        toast.success(`New order received: #${data.order.id}`);
        fetchAnalytics();
      }
    };
    ws.onerror = (err) => console.error('WebSocket error:', err);
    ws.onclose = () => console.log('WebSocket closed');
    return () => ws.close();
  }, [role, token]);

  // Trigger fetch when filters change, but only if filters are valid
  useEffect(() => {
    if (!loading && token && ['admin', 'manager'].includes(role)) {
      // Validate dates
      if (filters.startDate && filters.endDate && new Date(filters.startDate) > new Date(filters.endDate)) {
        setError('Start date cannot be after end date.');
        return;
      }
      fetchAnalytics();
    }
  }, [filters]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status !== 'all') params.status = filters.status;

      const res = await axios.get('http://localhost:5000/api/payment-methods-analytics', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      console.log('Payment analytics response:', res.data);
      setAnalytics(res.data.analytics || []);
      setTotals(res.data.totals || { totalOrders: 0, totalRevenue: 0 });
      setError('');
    } catch (err) {
      console.error('Error fetching payment analytics:', err.response?.data || err.message);
      let errorMessage = 'Failed to load analytics: ' + (err.response?.data?.message || 'Unknown error');
      if (err.response?.status === 404) {
        errorMessage = 'Analytics endpoint not found. Please check if the backend server is running and the endpoint is configured.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Session expired. Redirecting to login...';
        toast.error(errorMessage);
        setTimeout(() => {
          logout();
          window.location.href = '/admin-login';
        }, 2000);
      }
      setError(errorMessage);
      setAnalytics([]);
      setTotals({ totalOrders: 0, totalRevenue: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleRefresh = () => {
    setError('');
    fetchAnalytics();
  };

  // Prepare chart data with fallback
  const chartData = {
    labels: analytics.length > 0 ? analytics.map(item => item.paymentMethod) : ['No Data'],
    datasets: [
      {
        label: 'Orders by Payment Method',
        data: analytics.length > 0 ? analytics.map(item => item.orderCount) : [1],
        backgroundColor: analytics.length > 0 
          ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
          : ['#CCCCCC'],
        hoverOffset: 20,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (!analytics.length) return 'No data available';
            const item = analytics[context.dataIndex];
            return `${item.paymentMethod}: ${item.orderCount} orders (${item.percentageShare}%)`;
          },
        },
      },
    },
  };

  // Find top payment method
  const topMethod = analytics.reduce((top, item) => 
    item.orderCount > (top.orderCount || 0) ? item : top, 
    { paymentMethod: '', orderCount: 0, percentageShare: 0 }
  );

  return (
    <div className="payment-methods-analytics">
      <ToastContainer position="top-right" autoClose={5000} />
      <h2>Payment Methods Analytics</h2>
      {error && <p className="error">{error}</p>}

      {/* Filter Options */}
      <div className="filter-options">
        <div className="filter-group">
          <label>Start Date:</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>
        <div className="filter-group">
          <label>End Date:</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>
        <div className="filter-group">
          <label>Order Status:</label>
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="all">All</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <button className="refresh-button" onClick={handleRefresh}>
          Refresh Data
        </button>
      </div>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : analytics.length === 0 && !error ? (
        <p>No data available for the selected filters.</p>
      ) : (
        <>
          {/* Summary */}
          <div className="summary">
            <div className="stat-card">
              <h3>Total Orders</h3>
              <p>{totals.totalOrders}</p>
            </div>
            <div className="stat-card">
              <h3>Total Revenue</h3>
              <p>₹{totals.totalRevenue.toFixed(2)}</p>
            </div>
            {topMethod.paymentMethod && (
              <div className="stat-card top-method">
                <h3>Top Payment Method</h3>
                <p>{topMethod.paymentMethod} <span className="badge">{topMethod.percentageShare}%</span></p>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="chart-container">
            <h3>Payment Method Distribution</h3>
            <Pie data={chartData} options={chartOptions} />
          </div>

          {/* Table */}
          {analytics.length > 0 && (
            <div className="table-container">
              <h3>Detailed Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th>Number of Orders</th>
                    <th>Total Revenue (₹)</th>
                    <th>Percentage Share</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((item) => (
                    <tr
                      key={item.paymentMethod}
                      className={item.paymentMethod === topMethod.paymentMethod ? 'highlight' : ''}
                    >
                      <td>{item.paymentMethod}</td>
                      <td>{item.orderCount}</td>
                      <td>{item.totalRevenue.toFixed(2)}</td>
                      <td>{item.percentageShare}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{totals.totalOrders}</strong></td>
                    <td><strong>{totals.totalRevenue.toFixed(2)}</strong></td>
                    <td><strong>100%</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentMethodsAnalytics;