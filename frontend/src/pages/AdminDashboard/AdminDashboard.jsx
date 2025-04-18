import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';
import { AuthContext } from '../../context/AuthContext';
import ManageProducts from '../ManageProducts/ManageProducts';
import ManageUsers from '../../components/ManageUsers/ManageUsers';
import ManageOrders from '../../components/ManageOrders/ManageOrders';
import ManageAdmins from '../ManageAdmins/ManageAdmins';
import ManageReviews from '../ManageReviews/ManageReviews';
import ManageRoles from '../ManageRoles/ManageRoles';
import PaymentMethodsAnalytics from '../PaymentMethodsAnalytics/PaymentMethodsAnalytics';
import OrderHeatmap from '../OrderHeatmap/OrderHeatmap';
import ReturnRequests from '../ReturnRequests/ReturnRequests';
import SellerManagement from '../SellerManagement/SellerManagement';
import InventoryManagement from '../InventoryManagement/InventoryManagement';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './AdminDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

const AdminDashboard = () => {
  const { role, permissions, logout } = useContext(AuthContext);
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
    if (permissions === null) return;
    console.log('Permissions:', permissions, 'Role:', role); // Debug permissions
    fetchData();
  }, [filter, role, permissions, token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('Fetching dashboard data with role:', role, 'permissions:', permissions);
      let usersData = [];
      let ordersData = [];
      let productsData = [];

      if (permissions?.users?.view) {
        const usersRes = await axios.get('http://localhost:5000/api/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        usersData = usersRes.data;
        setUsers(usersData);
        console.log('Users fetched:', usersData);
      }

      if (permissions?.products?.view) {
        const productsRes = await axios.get('http://localhost:5000/api/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        productsData = productsRes.data;
        setProducts(productsData);
        console.log('Products fetched:', productsData);
      }

      if (permissions?.orders?.view) {
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
        ordersData = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        setOrders(ordersData);
        console.log('Orders fetched:', ordersData);
      }

      setStats({
        totalUsers: permissions?.users?.view ? usersData.length : 0,
        totalOrders: permissions?.orders?.view ? ordersData.length : 0,
        totalRevenue: permissions?.analytics?.view ? ordersData.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0) : 0,
        totalProducts: permissions?.products?.view ? productsData.length : 0,
      });
      console.log('Stats updated:', {
        totalUsers: usersData.length,
        totalOrders: ordersData.length,
        totalRevenue: ordersData.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0),
        totalProducts: productsData.length,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err.response?.data || err.message);
      setError('Failed to load dashboard data: ' + (err.response?.data?.message || 'Unknown error'));
      if (err.response?.status === 401) {
        console.warn('Unauthorized access, logging out');
        logout();
        window.location.href = '/admin-login';
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          if (data.type === 'newOrder') {
            toast.success(`New order received: #${data.order.id}`);
            fetchData();
          } else if (data.type === 'lowStock') {
            data.products.forEach(p => toast.warn(`Low stock: ${p.name} (${p.stock} left)`));
          } else if (data.type === 'restock') {
            toast.info(`Product ${data.product.name} restocked to ${data.product.stock}`);
            setProducts(prev => prev.map(p => p.id === data.product.id ? { ...p, stock: data.product.stock, alert_status: data.product.stock > p.low_stock_threshold ? null : p.alert_status } : p));
          } else if (data.type === 'lowStockAcknowledged') {
            toast.success(`Low stock alert for product #${data.product_id} acknowledged`);
            setProducts(prev => prev.map(p => p.id === data.product_id ? { ...p, alert_status: 'resolved' } : p));
          } else if (data.type === 'orderStatusUpdate') {
            setOrders(prev => prev.map(o => o.id === data.id ? { ...o, status: data.status } : o));
            toast.info(`Order #${data.id} status updated to ${data.status}`);
          } else if (data.type === 'newReturn') {
            toast.success(`New return request received: #${data.return.id}`);
          } else if (data.type === 'returnStatusUpdate') {
            toast.info(`Return request #${data.id} updated to ${data.status}`);
          } else if (data.type === 'newSeller') {
            toast.success(`New seller added: ${data.seller.name}`);
          } else if (data.type === 'sellerStatusUpdate') {
            toast.info(`Seller ${data.seller.name} status updated to ${data.status}`);
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
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
  }, []);

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

  if (permissions === null) {
    return <div className="spinner">Loading permissions...</div>;
  }

  // Check if any tabs are visible
  const hasVisibleTabs = (
    permissions?.analytics?.view ||
    permissions?.users?.view ||
    permissions?.orders?.view ||
    permissions?.products?.view ||
    permissions?.reviews?.view ||
    permissions?.admins?.view ||
    permissions?.roles?.view ||
    permissions?.analytics?.view ||
    permissions?.returns?.view ||
    permissions?.sellers?.view ||
    permissions?.inventory?.view
  );

  return (
    <div className="admin-dashboard">
      <ToastContainer position="top-right" autoClose={5000} />
      <h1>{role.charAt(0).toUpperCase() + role.slice(1)} Dashboard</h1>
      {error && <p className="error">{error}</p>}
      {!wsConnected && !error && <p className="warning">Connecting to real-time updates...</p>}

      {hasVisibleTabs ? (
        <div className="tab-navigation">
          {permissions?.analytics?.view && (
            <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
              Analytics
            </button>
          )}
          {permissions?.users?.view && (
            <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
              Manage Users
            </button>
          )}
          {permissions?.orders?.view && (
            <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
              Manage Orders
            </button>
          )}
          {permissions?.products?.view && (
            <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>
              Manage Products
            </button>
          )}
          {permissions?.reviews?.view && (
            <button className={activeTab === 'reviews' ? 'active' : ''} onClick={() => setActiveTab('reviews')}>
              Manage Reviews
            </button>
          )}
          {permissions?.admins?.view && (
            <button className={activeTab === 'admins' ? 'active' : ''} onClick={() => setActiveTab('admins')}>
              Manage Admins
            </button>
          )}
          {permissions?.roles?.view && (
            <button className={activeTab === 'roles' ? 'active' : ''} onClick={() => setActiveTab('roles')}>
              Manage Roles
            </button>
          )}
          {permissions?.analytics?.view && (
            <button className={activeTab === 'payment-methods' ? 'active' : ''} onClick={() => setActiveTab('payment-methods')}>
              Payment Methods
            </button>
          )}
          {permissions?.analytics?.view && (
            <button className={activeTab === 'heatmap' ? 'active' : ''} onClick={() => setActiveTab('heatmap')}>
              Order Heatmap
            </button>
          )}
          {permissions?.returns?.view && (
            <button className={activeTab === 'returns' ? 'active' : ''} onClick={() => setActiveTab('returns')}>
              Returns
            </button>
          )}
          {permissions?.sellers?.view && (
            <button className={activeTab === 'sellers' ? 'active' : ''} onClick={() => setActiveTab('sellers')}>
              Sellers
            </button>
          )}
          {permissions?.inventory?.view && (
  <button
    className={activeTab === 'inventory' ? 'active' : ''}
    onClick={() => setActiveTab('inventory')}
  >
    Inventory
  </button>
)}
        </div>
      ) : (
        <p className="error">No permissions available. Please contact an administrator.</p>
      )}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <>
          {activeTab === 'analytics' && permissions?.analytics?.view && (
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
                {permissions?.users?.view && (
                  <div className="stat-card"><h3>Total Users</h3><p>{stats.totalUsers}</p></div>
                )}
                {permissions?.orders?.view && (
                  <div className="stat-card"><h3>Total Orders</h3><p>{stats.totalOrders}</p></div>
                )}
                {permissions?.analytics?.view && (
                  <div className="stat-card"><h3>Total Revenue</h3><p>₹{stats.totalRevenue.toFixed(2)}</p></div>
                )}
                {permissions?.products?.view && (
                  <div className="stat-card"><h3>Total Products</h3><p>{stats.totalProducts}</p></div>
                )}
              </div>
              <div className="charts-container">
                {permissions?.orders?.view && (
                  <div className="chart">
                    <Bar data={orderChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Order Status Distribution' } } }} />
                  </div>
                )}
                {permissions?.analytics?.view && (
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
              {permissions?.analytics?.view && (
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

          {activeTab === 'users' && permissions?.users?.view && <ManageUsers />}
          {activeTab === 'orders' && permissions?.orders?.view && <ManageOrders />}
          {activeTab === 'products' && permissions?.products?.view && <ManageProducts />}
          {activeTab === 'reviews' && permissions?.reviews?.view && <ManageReviews />}
          {activeTab === 'admins' && permissions?.admins?.view && <ManageAdmins />}
          {activeTab === 'roles' && permissions?.roles?.view && <ManageRoles />}
          {activeTab === 'payment-methods' && permissions?.analytics?.view && <PaymentMethodsAnalytics />}
          {activeTab === 'heatmap' && permissions?.analytics?.view && <OrderHeatmap />}
          {activeTab === 'returns' && permissions?.returns?.view && <ReturnRequests />}
          {activeTab === 'sellers' && permissions?.sellers?.view && <SellerManagement />}
          {activeTab === 'inventory' && permissions?.inventory?.view && <InventoryManagement />}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;