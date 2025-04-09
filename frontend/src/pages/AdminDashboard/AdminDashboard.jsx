import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';
import { AuthContext } from '../../context/AuthContext';
import ManageProducts from '../ManageProducts/ManageProducts';
import ManageUsers from '../../components/ManageUsers/ManageUsers';
import ManageOrders from '../../components/ManageOrders/ManageOrders';
import ManageAdmins from '../ManageAdmins/ManageAdmins';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './AdminDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

const AdminDashboard = () => {
  const { role } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalOrders: 0, totalRevenue: 0, totalProducts: 0 });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      setError('Please log in to access the dashboard');
      setLoading(false);
      return;
    }
    fetchData();

    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        setError('Max WebSocket reconnection attempts reached. Real-time updates unavailable.');
        return;
      }

      ws = new WebSocket('ws://localhost:5001');

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setWsConnected(true);
        setError('');
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        if (data.type === 'newOrder') {
          toast.success(`New order received: #${data.order.id}`);
          fetchData();
        } else if (data.type === 'lowStock') {
          data.products.forEach(p => toast.warn(`Low stock: ${p.name} (${p.stock} left)`));
        } else if (data.type === 'orderStatusUpdate') {
          setOrders(prev => prev.map(o => o.id === data.id ? { ...o, status: data.status } : o));
          toast.info(`Order #${data.id} status updated to ${data.status}`);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed. Attempting to reconnect...');
        setWsConnected(false);
        reconnectAttempts++;
        setTimeout(connectWebSocket, 2000);
      };
    };

    const wsTimeout = setTimeout(connectWebSocket, 1000);
    return () => {
      clearTimeout(wsTimeout);
      if (ws) ws.close();
    };
  }, [filter, role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let usersRes = null;
      if (role === 'admin') {
        usersRes = await axios.get('http://localhost:5000/api/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(usersRes.data);
      }

      const productsRes = await axios.get('http://localhost:5000/api/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(productsRes.data);

      let query = 'http://localhost:5000/api/orders';
      if (filter !== 'all') {
        const days = filter === '7days' ? 7 : 30;
        const dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - days);
        query += `?since=${dateFilter.toISOString()}`;
      }
      const ordersRes = await axios.get(query, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fetchedOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      setOrders(fetchedOrders);

      setStats({
        totalUsers: role === 'admin' && usersRes ? usersRes.data.length : 0,
        totalOrders: fetchedOrders.length,
        totalRevenue: fetchedOrders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0),
        totalProducts: productsRes.data.length,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err.response?.data || err.message);
      setError('Failed to load dashboard data: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const orderStatusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const orderChartData = {
    labels: Object.keys(orderStatusCounts),
    datasets: [{ label: 'Order Status', data: Object.values(orderStatusCounts), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'] }],
  };

  const categorySales = orders.reduce((acc, order) => {
    order.items.forEach(item => {
      const product = products.find(p => p.name === item.name);
      if (product) acc[product.category] = (acc[product.category] || 0) + Number(item.price) * Number(item.quantity);
    });
    return acc;
  }, {});
  const categoryChartData = {
    labels: Object.keys(categorySales),
    datasets: [{ label: 'Sales by Category (₹)', data: Object.values(categorySales), backgroundColor: ['#FF9F40', '#4BC0C0', '#9966FF', '#FF6384', '#36A2EB'], borderWidth: 1 }],
  };

  const salesTrend = orders.reduce((acc, order) => {
    const month = new Date(order.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' });
    acc[month] = (acc[month] || 0) + Number(order.totalPrice || 0);
    return acc;
  }, {});
  const salesTrendData = {
    labels: Object.keys(salesTrend),
    datasets: [{ label: 'Monthly Sales (₹)', data: Object.values(salesTrend), fill: false, borderColor: '#36A2EB', tension: 0.1 }],
  };

  const productSales = orders.reduce((acc, order) => {
    order.items.forEach(item => {
      acc[item.name] = (acc[item.name] || 0) + (Number(item.price) * Number(item.quantity));
    });
    return acc;
  }, {});
  const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
  const topSelling = sortedProducts.slice(0, 5);
  const leastPerforming = sortedProducts.slice(-5).reverse();

  const chartOptions = { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true } } };

  return (
    <div className="admin-dashboard">
      <ToastContainer position="top-right" autoClose={5000} />
      <h1>{role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Staff'} Dashboard</h1>
      {error && <p className="error">{error}</p>}
      {!wsConnected && !error && <p className="warning">Connecting to real-time updates...</p>}

      <div className="tab-navigation">
        <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
          Analytics
        </button>
        {role === 'admin' && (
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
            Manage Users
          </button>
        )}
        {(role === 'admin' || role === 'manager') && (
          <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
            Manage Orders
          </button>
        )}
        {(role === 'admin' || role === 'manager') && (
          <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>
            Manage Products
          </button>
        )}
        {role === 'admin' && (
          <button className={activeTab === 'admins' ? 'active' : ''} onClick={() => setActiveTab('admins')}>
            Manage Admins
          </button>
        )}
      </div>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <>
          {activeTab === 'analytics' && (
            <div className="analytics-section">
              <h2>Analytics</h2>
              <div className="filter-options">
                <label>Filter by Time:</label>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
              </div>
              <div className="stats-grid">
                {role === 'admin' && <div className="stat-card"><h3>Total Users</h3><p>{stats.totalUsers}</p></div>}
                <div className="stat-card"><h3>Total Orders</h3><p>{stats.totalOrders}</p></div>
                <div className="stat-card"><h3>Total Revenue</h3><p>₹{stats.totalRevenue.toFixed(2)}</p></div>
                {(role === 'admin' || role === 'manager') && <div className="stat-card"><h3>Total Products</h3><p>{stats.totalProducts}</p></div>}
              </div>
              <div className="charts-container">
                <div className="chart">
                  <Bar data={orderChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Order Status Distribution' } } }} />
                </div>
                {(role === 'admin' || role === 'manager') && (
                  <>
                    <div className="chart">
                      <Pie data={categoryChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Sales by Category' } } }} />
                    </div>
                    <div className="chart">
                      <Line data={salesTrendData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Sales Trend (Monthly)' } } }} />
                    </div>
                  </>
                )}
              </div>
              {(role === 'admin' || role === 'manager') && (
                <div className="product-performance">
                  <div className="performance-section">
                    <h3>Top-Selling Products</h3>
                    <ul>{topSelling.map(([name, sales]) => <li key={name}>{name}: ₹{sales.toFixed(2)}</li>)}</ul>
                  </div>
                  <div className="performance-section">
                    <h3>Least-Performing Products</h3>
                    <ul>{leastPerforming.map(([name, sales]) => <li key={name}>{name}: ₹{sales.toFixed(2)}</li>)}</ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && role === 'admin' && <ManageUsers />}
          {activeTab === 'orders' && (role === 'admin' || role === 'manager') && <ManageOrders />}
          {activeTab === 'products' && (role === 'admin' || role === 'manager') && <ManageProducts />}
          {activeTab === 'admins' && role === 'admin' && <ManageAdmins />}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;