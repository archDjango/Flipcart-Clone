import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';
import ManageProducts from '../ManageProducts/ManageProducts';
import ManageUsers from '../../components/ManageUsers/ManageUsers';
import ManageOrders from '../../components/ManageOrders/ManageOrders';
import './AdminDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalOrders: 0, totalRevenue: 0, totalProducts: 0 });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      alert('Please log in as an admin to access the dashboard');
      return;
    }
    fetchData();
    // Setup WebSocket for real-time order updates
    const ws = new WebSocket('ws://localhost:5000');
    ws.onmessage = (event) => {
      const updatedOrder = JSON.parse(event.data);
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    };
    return () => ws.close();
  }, [filter]);

  const fetchData = async () => {
    console.log('Fetching dashboard data with token:', token);
    try {
      // Fetch users
      const usersRes = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Users:', usersRes.data);
      setUsers(usersRes.data);

      // Fetch products
      const productsRes = await axios.get('http://localhost:5000/api/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Products:', productsRes.data);
      setProducts(productsRes.data);

      // Fetch orders with filter
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
      console.log('Orders fetched:', ordersRes.data);
      const fetchedOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      setOrders(fetchedOrders);

      // Calculate stats
      const totalOrders = fetchedOrders.length;
      const totalRevenue = fetchedOrders.reduce((sum, order) => {
        const price = Number(order.totalPrice) || 0;
        console.log(`Order ${order.id} totalPrice: ${order.totalPrice}, Converted: ${price}`);
        return sum + price;
      }, 0);
      console.log('Calculated totalOrders:', totalOrders, 'totalRevenue:', totalRevenue);

      setStats({
        totalUsers: usersRes.data.length,
        totalOrders,
        totalRevenue,
        totalProducts: productsRes.data.length,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err.response?.data || err.message);
      if (err.response?.status === 401) {
        alert('Unauthorized: Please log in again as an admin.');
        localStorage.removeItem('token');
      } else {
        setError('Failed to load dashboard data: ' + (err.response?.data?.message || 'Unknown error'));
      }
    }
  };

  // Order Status Chart (Bar)
  const orderStatusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const orderChartData = {
    labels: Object.keys(orderStatusCounts),
    datasets: [
      {
        label: 'Order Status',
        data: Object.values(orderStatusCounts),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
      },
    ],
  };

  // Category-wise Sales Chart (Pie)
  const categorySales = orders.reduce((acc, order) => {
    order.items.forEach(item => {
      const product = products.find(p => p.name === item.name);
      if (product) {
        const salesValue = Number(item.price) * Number(item.quantity);
        acc[product.category] = (acc[product.category] || 0) + salesValue;
      }
    });
    return acc;
  }, {});
  console.log('Category sales:', categorySales);
  const categoryChartData = {
    labels: Object.keys(categorySales),
    datasets: [
      {
        label: 'Sales by Category (₹)',
        data: Object.values(categorySales),
        backgroundColor: ['#FF9F40', '#4BC0C0', '#9966FF', '#FF6384', '#36A2EB'],
        borderWidth: 1,
      },
    ],
  };

  // Sales Trend Line Chart (Monthly)
  const salesTrend = orders.reduce((acc, order) => {
    const month = new Date(order.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' });
    acc[month] = (acc[month] || 0) + Number(order.totalPrice);
    return acc;
  }, {});
  const salesTrendData = {
    labels: Object.keys(salesTrend),
    datasets: [
      {
        label: 'Monthly Sales (₹)',
        data: Object.values(salesTrend),
        fill: false,
        borderColor: '#36A2EB',
        tension: 0.1,
      },
    ],
  };

  // Top-Selling and Least-Performing Products
  const productSales = orders.reduce((acc, order) => {
    order.items.forEach(item => {
      acc[item.name] = (acc[item.name] || 0) + (Number(item.price) * Number(item.quantity));
    });
    return acc;
  }, {});
  const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
  const topSelling = sortedProducts.slice(0, 5);
  const leastPerforming = sortedProducts.slice(-5).reverse();

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true },
    },
  };

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      {error && <p className="error">{error}</p>}

      <div className="tab-navigation">
        <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
          Analytics
        </button>
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
          Manage Users
        </button>
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
          Manage Orders
        </button>
        <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>
          Manage Products
        </button>
      </div>

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
            <div className="stat-card"><h3>Total Users</h3><p>{stats.totalUsers}</p></div>
            <div className="stat-card"><h3>Total Orders</h3><p>{stats.totalOrders}</p></div>
            <div className="stat-card"><h3>Total Revenue</h3><p>₹{stats.totalRevenue.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Total Products</h3><p>{stats.totalProducts}</p></div>
          </div>
          <div className="charts-container">
            <div className="chart">
              <Bar
                data={orderChartData}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Order Status Distribution' } } }}
              />
            </div>
            <div className="chart">
              <Pie
                data={categoryChartData}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Sales by Category' } } }}
              />
            </div>
            <div className="chart">
              <Line
                data={salesTrendData}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Sales Trend (Monthly)' } } }}
              />
            </div>
          </div>
          <div className="product-performance">
            <div className="performance-section">
              <h3>Top-Selling Products</h3>
              <ul>
                {topSelling.map(([name, sales]) => (
                  <li key={name}>{name}: ₹{sales.toFixed(2)}</li>
                ))}
              </ul>
            </div>
            <div className="performance-section">
              <h3>Least-Performing Products</h3>
              <ul>
                {leastPerforming.map(([name, sales]) => (
                  <li key={name}>{name}: ₹{sales.toFixed(2)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && <ManageUsers />}
      {activeTab === 'orders' && <ManageOrders />}
      {activeTab === 'products' && <ManageProducts />}
    </div>
  );
};

export default AdminDashboard;