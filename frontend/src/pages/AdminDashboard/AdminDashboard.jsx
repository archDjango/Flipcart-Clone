import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';
import { AuthContext } from '../../context/AuthContext';
import { NavLink, Routes, Route } from 'react-router-dom';
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
import CouponManagement from '../CouponManagement/CouponManagement';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './AdminDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

const AdminDashboard = () => {
  const { role, permissions, logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalOrders: 0, totalRevenue: 0, totalProducts: 0 });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // For mobile toggle
  const [sidebarRetracted, setSidebarRetracted] = useState(false); // For retract/expand
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      setError('Please log in to access the dashboard');
      setLoading(false);
      return;
    }
    if (permissions === null) return;
    console.log('Permissions:', permissions, 'Role:', role);
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
          } else if (data.type === 'couponApplied') {
            toast.info(`Coupon ${data.coupon_code} applied to order #${data.order_id}`);
            fetchData();
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

  const hasVisibleSections = (
    permissions?.analytics?.view ||
    permissions?.users?.view ||
    permissions?.orders?.view ||
    permissions?.products?.view ||
    permissions?.reviews?.view ||
    permissions?.admins?.view ||
    permissions?.roles?.view ||
    permissions?.returns?.view ||
    permissions?.sellers?.view ||
    permissions?.inventory?.view ||
    permissions?.coupons?.view
  );

  const handleRetractToggle = () => {
    console.log('Toggling sidebar retraction. Current state:', sidebarRetracted);
    setSidebarRetracted(!sidebarRetracted);
  };

  return (
    <div className="admin-dashboard">
      <ToastContainer position="top-right" autoClose={5000} />
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✖' : '☰'}
      </button>
      <button className="sidebar-retract" onClick={handleRetractToggle}>
        {sidebarRetracted ? '→' : '←'}
      </button>
      <div className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarRetracted ? 'retracted' : ''}`}>
        <h2>{sidebarRetracted ? 'Admin' : 'Admin Dashboard'}</h2>
        <nav>
          {permissions?.analytics?.view && (
            <NavLink to="/admin" end className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '📊' : 'Analytics'}</span>
            </NavLink>
          )}
          {permissions?.users?.view && (
            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '👥' : 'Manage Users'}</span>
            </NavLink>
          )}
          {permissions?.orders?.view && (
            <NavLink to="/admin/orders" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '📦' : 'Manage Orders'}</span>
            </NavLink>
          )}
          {permissions?.products?.view && (
            <NavLink to="/admin/manage-products" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '🛒' : 'Manage Products'}</span>
            </NavLink>
          )}
          {permissions?.reviews?.view && (
            <NavLink to="/admin/manage-reviews" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '⭐' : 'Manage Reviews'}</span>
            </NavLink>
          )}
          {permissions?.admins?.view && (
            <NavLink to="/admin/manage-admins" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '🛡️' : 'Manage Admins'}</span>
            </NavLink>
          )}
          {permissions?.roles?.view && (
            <NavLink to="/admin/manage-roles" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '🔐' : 'Manage Roles'}</span>
            </NavLink>
          )}
          {permissions?.analytics?.view && (
            <NavLink to="/admin/payment-methods" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '💳' : 'Payment Methods'}</span>
            </NavLink>
          )}
          {permissions?.analytics?.view && (
            <NavLink to="/admin/order-heatmap" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '🌍' : 'Order Heatmap'}</span>
            </NavLink>
          )}
          {permissions?.returns?.view && (
            <NavLink to="/admin/returns" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '🔄' : 'Returns'}</span>
            </NavLink>
          )}
          {permissions?.sellers?.view && (
            <NavLink to="/admin/sellers" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '🏪' : 'Sellers'}</span>
            </NavLink>
          )}
          {permissions?.inventory?.view && (
            <NavLink to="/admin/inventory" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '📋' : 'Inventory'}</span>
            </NavLink>
          )}
          {permissions?.coupons?.view && (
            <NavLink to="/admin/coupons" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{sidebarRetracted ? '🎟️' : 'Manage Coupons'}</span>
            </NavLink>
          )}
        </nav>
      </div>
      <div className={`content ${sidebarRetracted ? 'retracted' : ''}`}>
        <h1>{role.charAt(0).toUpperCase() + role.slice(1)} Dashboard</h1>
        {error && <p className="error">{error}</p>}
        {!wsConnected && !error && <p className="warning">Connecting to real-time updates...</p>}

        {hasVisibleSections ? (
          <>
            {loading ? (
              <div className="spinner">Loading...</div>
            ) : (
              <Routes>
                <Route path="/" element={
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
                } />
                <Route path="/users/*" element={<ManageUsers />} />
                <Route path="/orders/*" element={<ManageOrders />} />
                <Route path="/manage-products/*" element={<ManageProducts />} />
                <Route path="/manage-reviews/*" element={<ManageReviews />} />
                <Route path="/manage-admins/*" element={<ManageAdmins />} />
                <Route path="/manage-roles/*" element={<ManageRoles />} />
                <Route path="/payment-methods/*" element={<PaymentMethodsAnalytics />} />
                <Route path="/order-heatmap/*" element={<OrderHeatmap />} />
                <Route path="/returns/*" element={<ReturnRequests />} />
                <Route path="/sellers/*" element={<SellerManagement />} />
                <Route path="/inventory/*" element={<InventoryManagement />} />
                <Route path="/coupons/*" element={<CouponManagement />} />
              </Routes>
            )}
          </>
        ) : (
          <p className="error">No permissions available. Please contact an administrator.</p>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;