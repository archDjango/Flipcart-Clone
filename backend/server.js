// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const WebSocket = require('ws');
const NodeCache = require('node-cache');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'Uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'flipkart',
});

db.getConnection()
  .then(() => console.log('MySQL connected'))
  .catch(err => console.error('MySQL connection error:', err));

const SECRET = process.env.JWT_SECRET || 'your-secret-key';
const COHERE_API_KEY = process.env.COHERE_API_KEY;

if (!SECRET) {
  console.error('JWT_SECRET is not defined in .env file');
  process.exit(1);
}
if (!COHERE_API_KEY) {
  console.error('COHERE_API_KEY is not defined in .env file');
  process.exit(1);
}

const cache = new NodeCache({ stdTTL: 300 });

const wss = new WebSocket.Server({ port: 5001 });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

function broadcast(data) {
  console.log('Broadcasting:', data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Middleware to check permissions
const checkPermission = (module, action) => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;

    const permissionColumn = `${module}_${action}`;
    const [roles] = await db.execute(
      `SELECT r.${permissionColumn} FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [decoded.id]
    );

    console.log(`Checking ${module}.${action} for user ${decoded.id}:`, roles);

    if (!roles.length) {
      console.warn(`No roles assigned to user ${decoded.id}`);
      return res.status(403).json({ message: 'No roles assigned' });
    }

    const hasPermission = roles.some(role => role[permissionColumn] === 1 || role[permissionColumn] === true);

    if (!hasPermission) {
      console.warn(`Permission denied for ${module}.${action} to user ${decoded.id}`);
      return res.status(403).json({ message: `No ${action} permission for ${module}` });
    }
    next();
  } catch (err) {
    console.error('Permission check failed:', err.message);
    res.status(401).json({ message: 'Invalid token or permission error' });
  }
};

// Auth middleware
const auth = (roles) => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (roles && !roles.includes(decoded.role)) {
      console.warn(`Unauthorized role ${decoded.role} for user ${decoded.id}`);
      return res.status(403).json({ message: 'Unauthorized' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// User Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password, roleCode, phone, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }
  let role = 'user';
  if (roleCode === 'ADMIN123') role = 'admin';
  else if (roleCode === 'MANAGER456') role = 'manager';
  else if (roleCode === 'STAFF789') role = 'staff';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, phone || null, address || null]
    );
    if (role === 'admin') {
      await db.execute(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [result.insertId, 1]
      );
    }
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(400).json({ message: 'Email already registered' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin Login
app.post('/api/admin-login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Admin login req.body:', req.body);
  if (!email || !password) {
    console.error('Admin login error: Missing email or password', { email, password });
    return res.status(400).json({ message: 'Email and password are required' });
  }
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND role IN ("admin", "manager", "staff")',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Admin login error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Users (Admin Only)
app.get('/api/users', auth(['admin']), checkPermission('users', 'view'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT name, email, role FROM users');
    res.json(rows);
  } catch (err) {
    console.error('Get users error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete User (Admin Only)
app.delete('/api/users/:email', auth(['admin']), checkPermission('users', 'delete'), async (req, res) => {
  const { email } = req.params;
  if (req.user.email === email) return res.status(403).json({ message: 'Cannot delete yourself' });
  try {
    await db.execute('DELETE FROM users WHERE email = ?', [email]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Orders (Admin and Manager)
app.get('/api/orders', auth(['admin', 'manager']), checkPermission('orders', 'view'), async (req, res) => {
  try {
    let query = `
      SELECT o.id, o.user_id, u.email AS userEmail, o.total_price, o.status, o.created_at,
             oi.product_name AS item_name, oi.price AS item_price, oi.quantity
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `;
    const params = [];
    const conditions = [];

    if (req.query.since) {
      conditions.push('o.created_at >= ?');
      params.push(req.query.since);
    }
    if (req.query.status) {
      conditions.push('o.status = ?');
      params.push(req.query.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const [orders] = await db.execute(query, params);
    const orderMap = {};
    orders.forEach(row => {
      if (!orderMap[row.id]) {
        orderMap[row.id] = {
          id: row.id,
          userId: row.user_id,
          userEmail: row.userEmail || 'Unknown',
          totalPrice: Number(row.total_price),
          status: row.status,
          createdAt: row.created_at,
          items: []
        };
      }
      if (row.item_name) {
        orderMap[row.id].items.push({
          name: row.item_name,
          price: Number(row.item_price),
          quantity: row.quantity
        });
      }
    });
    res.json(Object.values(orderMap));
  } catch (err) {
    console.error('Get orders error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error fetching orders' });
  }
});

// Update Order Status (Admin and Manager)
app.put('/api/orders/:id', auth(['admin', 'manager']), checkPermission('orders', 'edit'), async (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }
  try {
    await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    const [rows] = await db.execute('SELECT id, user_id, total_price, status, created_at FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const updatedOrder = rows[0];
    broadcast({ type: 'orderStatusUpdate', id: updatedOrder.id, status: updatedOrder.status });
    res.json(updatedOrder);
  } catch (err) {
    console.error('Update order error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error updating order' });
  }
});

// Get User Orders (User Only)
app.get('/api/user/orders', auth(['user']), async (req, res) => {
  try {
    const [orders] = await db.execute(
      `SELECT o.id, o.total_price, o.status, o.created_at,
              oi.product_name AS item_name, oi.price AS item_price, oi.quantity
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = ?`,
      [req.user.id]
    );
    const orderMap = {};
    orders.forEach(row => {
      if (!orderMap[row.id]) {
        orderMap[row.id] = {
          id: row.id,
          totalPrice: row.total_price,
          status: row.status,
          createdAt: row.created_at,
          items: []
        };
      }
      if (row.item_name) {
        orderMap[row.id].items.push({
          name: row.item_name,
          price: row.item_price,
          quantity: row.quantity
        });
      }
    });
    res.json(Object.values(orderMap));
  } catch (err) {
    console.error('Get user orders error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Order (User Only)
app.post('/api/orders', auth(['user']), async (req, res) => {
  const { items, totalPrice, paymentMethod } = req.body;
  if (!items || !Array.isArray(items) || typeof totalPrice !== 'number' || !paymentMethod) {
    return res.status(400).json({ message: 'Invalid order data or missing payment method' });
  }
  try {
    const [orderResult] = await db.execute(
      'INSERT INTO orders (user_id, total_price, status, payment_method) VALUES (?, ?, "Pending", ?)',
      [req.user.id, totalPrice, paymentMethod]
    );
    const orderId = orderResult.insertId;
    for (const item of items) {
      if (!item.name || !item.price || !item.quantity) {
        throw new Error('Invalid item data');
      }
      await db.execute(
        'INSERT INTO order_items (order_id, product_name, price, quantity) VALUES (?, ?, ?, ?)',
        [orderId, item.name, item.price, item.quantity]
      );
      await db.execute(
        'UPDATE products SET stock = stock - ? WHERE name = ?',
        [item.quantity, item.name]
      );
    }
    const [orders] = await db.execute(
      'SELECT id, user_id, total_price, status, created_at FROM orders WHERE id = ?',
      [orderId]
    );
    const newOrder = orders[0];
    broadcast({ type: 'newOrder', order: newOrder });

    const [products] = await db.execute('SELECT id, name, stock FROM products');
    const lowStockProducts = products.filter(p => p.stock < 10);
    if (lowStockProducts.length > 0) {
      broadcast({ type: 'lowStock', products: lowStockProducts });
    }

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Error saving order:', err.message, err.stack);
    res.status(500).json({ message: 'Failed to save order' });
  }
});

// Get All Products (Admin and Manager)
app.get('/api/products', auth(['admin', 'manager']), checkPermission('products', 'view'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, price, stock, category, created_at, rating, image, description FROM products'
    );
    const lowStockProducts = rows.filter(p => p.stock < 10);
    if (lowStockProducts.length > 0) {
      broadcast({ type: 'lowStock', products: lowStockProducts });
    }
    res.json(rows);
  } catch (err) {
    console.error('Get products error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Public Products (No Auth)
// server.js (replace the /api/public/products endpoint)
app.get('/api/public/products', async (req, res) => {
  const limit = parseInt(req.query.limit) || 8;
  const offset = parseInt(req.query.offset) || 0;

  // Validate parameters
  if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0) {
    return res.status(400).json({ message: 'Invalid limit or offset' });
  }

  try {
    // Ensure the products table exists
    const [rows] = await db.execute(
      `SELECT id, name, price, stock, category, description, image, created_at, rating 
       FROM products LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [countResult] = await db.execute('SELECT COUNT(*) as total FROM products');
    res.json({ 
      products: rows.map(row => ({
        ...row,
        price: Number(row.price),
        stock: Number(row.stock),
        rating: Number(row.rating) || 0,
        image: row.image || '/default-product-image.jpg'
      })),
      total: countResult[0].total 
    });
  } catch (err) {
    console.error('Get public products error:', {
      message: err.message,
      stack: err.stack,
      sqlMessage: err.sqlMessage,
      sql: err.sql
    });
    res.status(500).json({ message: 'Server error fetching products', error: err.message });
  }
});

// Public endpoint to get a single product by ID
app.get('/api/public/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      'SELECT id, name, price, stock, category, description, image, created_at FROM products WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({
      ...rows[0],
      image: rows[0].image || '/default-product-image.jpg',
    });
  } catch (err) {
    console.error('Get product error:', err.message);
    res.status(500).json({ message: 'Server error fetching product' });
  }
});

// Add Product (Admin and Manager)
app.post('/api/products', auth(['admin', 'manager']), checkPermission('products', 'create'), upload.single('image'), async (req, res) => {
  const { name, price, stock, category, description } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO products (name, price, stock, category, description, image) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, stock, category, description || null, image]
    );
    const [newProduct] = await db.execute(
      'SELECT id, name, price, stock, category, created_at, rating, image, description FROM products WHERE id = ?',
      [result.insertId]
    );
    broadcast(newProduct[0]);
    res.status(201).json(newProduct[0]);
  } catch (err) {
    console.error('Add product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Product (Admin and Manager)
app.put('/api/products/:id', auth(['admin', 'manager']), checkPermission('products', 'edit'), upload.single('image'), async (req, res) => {
  const { name, price, stock, category, description } = req.body;
  const { id } = req.params;
  const image = req.file ? `/Uploads/${req.file.filename}` : req.body.image;

  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }

  try {
    await db.execute(
      'UPDATE products SET name = ?, price = ?, stock = ?, category = ?, description = ?, image = ? WHERE id = ?',
      [name, price, stock, category, description || null, image || null, id]
    );
    const [updatedProduct] = await db.execute(
      'SELECT id, name, price, stock, category, created_at, rating, image, description FROM products WHERE id = ?',
      [id]
    );
    if (updatedProduct.length === 0) return res.status(404).json({ message: 'Product not found' });
    broadcast(updatedProduct[0]);
    res.json(updatedProduct[0]);
  } catch (err) {
    console.error('Update product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Product (Admin and Manager)
app.delete('/api/products/:id', auth(['admin', 'manager']), checkPermission('products', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    broadcast({ id, deleted: true });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk Delete Products (Admin and Manager)
app.delete('/api/products/bulk', auth(['admin', 'manager']), checkPermission('products', 'delete'), async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'No product IDs provided' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    await db.execute(`DELETE FROM products WHERE id IN (${placeholders})`, ids);
    ids.forEach(id => broadcast({ id, deleted: true }));
    res.json({ message: `${ids.length} products deleted` });
  } catch (err) {
    console.error('Bulk delete product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate Product Description with Cohere (Admin and Manager)
app.post('/api/products/generate-description', auth(['admin', 'manager']), checkPermission('products', 'create'), async (req, res) => {
  const { title, category, keywords } = req.body;

  if (!title || !category) {
    return res.status(400).json({ message: 'Title and category are required' });
  }

  try {
    const prompt = `Generate a concise and engaging product description (max 100 words) for a ${category} item named "${title}"${
      keywords ? ` with the following features: ${keywords}` : ''
    }. Highlight its benefits and appeal to potential buyers.`;

    const response = await axios.post(
      'https://api.cohere.ai/v1/generate',
      {
        model: 'command',
        prompt: prompt,
        max_tokens: 100,
        temperature: 0.7,
        truncate: 'END',
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const description = response.data.generations[0].text.trim();

    await db.execute(
      'INSERT INTO ai_descriptions (title, category, keywords, description) VALUES (?, ?, ?, ?)',
      [title, category, keywords || null, description]
    );

    res.json({ description });
  } catch (err) {
    console.error('Generate description error:', err.response ? err.response.data : err.message);
    res.status(500).json({
      message: 'Failed to generate description',
      error: err.response ? err.response.data.message : err.message
    });
  }
});

// Admin Endpoints
app.get('/api/admins', auth(['admin']), checkPermission('admins', 'view'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, role, status FROM users WHERE role IN ("admin", "manager", "staff")'
    );
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role === 'admin' ? 'Super Admin' : row.role === 'manager' ? 'Product Manager' : 'Order Manager',
      status: row.status || 'Active'
    })));
  } catch (err) {
    console.error('Get admins error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admins', auth(['admin']), checkPermission('admins', 'create'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const validRoles = ['Super Admin', 'Product Manager', 'Order Manager'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const mappedRole = role === 'Super Admin' ? 'admin' : role === 'Product Manager' ? 'manager' : 'staff';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, mappedRole, 'Active']
    );
    const newAdmin = {
      id: result.insertId,
      name,
      email,
      role,
      status: 'Active'
    };
    broadcast({ type: 'newAdmin', admin: newAdmin });
    res.status(201).json(newAdmin);
  } catch (err) {
    console.error('Add admin error:', err.message);
    res.status(400).json({ message: 'Email already registered' });
  }
});

app.put('/api/admins/:id', auth(['admin']), checkPermission('admins', 'edit'), async (req, res) => {
  const { role, status } = req.body;
  const { id } = req.params;

  const validRoles = ['Super Admin', 'Product Manager', 'Order Manager'];
  const validStatuses = ['Active', 'Inactive'];

  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const mappedRole = role === 'Super Admin' ? 'admin' : role === 'Product Manager' ? 'manager' : 'staff';

  try {
    const [current] = await db.execute('SELECT email, role FROM users WHERE id = ?', [id]);
    if (current.length === 0) return res.status(404).json({ message: 'Admin not found' });
    if (req.user.email === current[0].email && status === 'Inactive') {
      return res.status(403).json({ message: 'Cannot deactivate yourself' });
    }

    await db.execute(
      'UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?',
      [role ? mappedRole : null, status || null, id]
    );
    const [updated] = await db.execute(
      'SELECT id, name, email, role, status FROM users WHERE id = ?',
      [id]
    );
    const updatedAdmin = {
      id: updated[0].id,
      name: updated[0].name,
      email: updated[0].email,
      role: updated[0].role === 'admin' ? 'Super Admin' : updated[0].role === 'manager' ? 'Product Manager' : 'Order Manager',
      status: updated[0].status
    };
    broadcast({ type: 'adminUpdated', admin: updatedAdmin });
    res.json(updatedAdmin);
  } catch (err) {
    console.error('Update admin error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public endpoint to get approved reviews for a specific product
app.get('/api/public/reviews', async (req, res) => {
  const { productId } = req.query;
  if (!productId) return res.status(400).json({ message: 'Product ID is required' });

  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.product_id, u.name as customerName, r.rating, r.comment, r.created_at, r.admin_response
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ? AND r.status = 'Approved'`,
      [productId]
    );
    res.json(rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      customerName: row.customerName,
      rating: row.rating,
      comment: row.comment,
      dateSubmitted: row.created_at,
      adminResponse: row.admin_response
    })));
  } catch (err) {
    console.error('Get public reviews error:', err.message);
    res.status(500).json({ message: 'Server error fetching reviews' });
  }
});

// Submit a review (authenticated users only)
app.post('/api/reviews', auth(['user']), async (req, res) => {
  const { productId, rating, comment, name } = req.body;
  if (!productId || !rating || !comment || !name) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO reviews (product_id, user_id, rating, comment, status, customer_name) VALUES (?, ?, ?, ?, "Pending", ?)',
      [productId, req.user.id, rating, comment, name]
    );
    res.status(201).json({ message: 'Review submitted for approval', reviewId: result.insertId });
  } catch (err) {
    console.error('Submit review error:', err.message);
    res.status(500).json({ message: 'Server error submitting review' });
  }
});

// Get all reviews
app.get('/api/reviews', auth(['admin', 'manager']), checkPermission('reviews', 'view'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.product_id, p.name as productName, u.name as customerName,
              r.rating, r.comment, r.status, r.created_at, r.admin_response
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       JOIN users u ON r.user_id = u.id`
    );
    res.json(rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      productName: row.productName,
      customerName: row.customerName,
      rating: row.rating,
      comment: row.comment,
      status: row.status || 'Pending',
      dateSubmitted: row.created_at,
      adminResponse: row.admin_response
    })));
  } catch (err) {
    console.error('Get reviews error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update review status
app.put('/api/reviews/:id/status', auth(['admin', 'manager']), checkPermission('reviews', 'edit'), async (req, res) => {
  const { status } = req.body;
  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    await db.execute('UPDATE reviews SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error('Update review status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete review
app.delete('/api/reviews/:id', auth(['admin', 'manager']), checkPermission('reviews', 'delete'), async (req, res) => {
  try {
    await db.execute('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error('Delete review error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add admin response
app.post('/api/reviews/:id/respond', auth(['admin', 'manager']), checkPermission('reviews', 'edit'), async (req, res) => {
  const { response } = req.body;
  if (!response) return res.status(400).json({ message: 'Response text required' });
  try {
    await db.execute('UPDATE reviews SET admin_response = ? WHERE id = ?', [response, req.params.id]);
    res.json({ message: 'Response added' });
  } catch (err) {
    console.error('Add response error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Role Management Endpoints
app.get('/api/roles', auth(['admin']), checkPermission('roles', 'view'), async (req, res) => {
  try {
    console.log('GET /api/roles called by user:', req.user);
    const [rows] = await db.execute(
      `SELECT id, name, description,
              products_view, products_create, products_edit, products_delete,
              orders_view, orders_create, orders_edit, orders_delete,
              reviews_view, reviews_create, reviews_edit, reviews_delete,
              users_view, users_create, users_edit, users_delete,
              admins_view, admins_create, admins_edit, admins_delete,
              analytics_view, analytics_create, analytics_edit, analytics_delete,
              roles_view, roles_create, roles_edit, roles_delete
       FROM roles`
    );
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      permissions: {
        products: {
          view: row.products_view,
          create: row.products_create,
          edit: row.products_edit,
          delete: row.products_delete,
        },
        orders: {
          view: row.orders_view,
          create: row.orders_create,
          edit: row.orders_edit,
          delete: row.orders_delete,
        },
        reviews: {
          view: row.reviews_view,
          create: row.reviews_create,
          edit: row.reviews_edit,
          delete: row.reviews_delete,
        },
        users: {
          view: row.users_view,
          create: row.users_create,
          edit: row.users_edit,
          delete: row.users_delete,
        },
        admins: {
          view: row.admins_view,
          create: row.admins_create,
          edit: row.admins_edit,
          delete: row.admins_delete,
        },
        analytics: {
          view: row.analytics_view,
          create: row.analytics_create,
          edit: row.analytics_edit,
          delete: row.analytics_delete,
        },
        roles: {
          view: row.roles_view,
          create: row.roles_create,
          edit: row.roles_edit,
          delete: row.roles_delete,
        },
      }
    })));
  } catch (err) {
    console.error('Get roles error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/roles', auth(['admin']), checkPermission('roles', 'create'), async (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name || !permissions) return res.status(400).json({ message: 'Name and permissions are required' });

  try {
    const [result] = await db.execute(
      `INSERT INTO roles (
        name, description,
        products_view, products_create, products_edit, products_delete,
        orders_view, orders_create, orders_edit, orders_delete,
        reviews_view, reviews_create, reviews_edit, reviews_delete,
        users_view, users_create, users_edit, users_delete,
        admins_view, admins_create, admins_edit, admins_delete,
        analytics_view, analytics_create, analytics_edit, analytics_delete,
        roles_view, roles_create, roles_edit, roles_delete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || null,
        permissions.products.view || false,
        permissions.products.create || false,
        permissions.products.edit || false,
        permissions.products.delete || false,
        permissions.orders.view || false,
        permissions.orders.create || false,
        permissions.orders.edit || false,
        permissions.orders.delete || false,
        permissions.reviews.view || false,
        permissions.reviews.create || false,
        permissions.reviews.edit || false,
        permissions.reviews.delete || false,
        permissions.users.view || false,
        permissions.users.create || false,
        permissions.users.edit || false,
        permissions.users.delete || false,
        permissions.admins.view || false,
        permissions.admins.create || false,
        permissions.admins.edit || false,
        permissions.admins.delete || false,
        permissions.analytics.view || false,
        permissions.analytics.create || false,
        permissions.analytics.edit || false,
        permissions.analytics.delete || false,
        permissions.roles.view || false,
        permissions.roles.create || false,
        permissions.roles.edit || false,
        permissions.roles.delete || false,
      ]
    );
    const [newRole] = await db.execute(
      `SELECT id, name, description,
              products_view, products_create, products_edit, products_delete,
              orders_view, orders_create, orders_edit, orders_delete,
              reviews_view, reviews_create, reviews_edit, reviews_delete,
              users_view, users_create, users_edit, users_delete,
              admins_view, admins_create, admins_edit, admins_delete,
              analytics_view, analytics_create, analytics_edit, analytics_delete,
              roles_view, roles_create, roles_edit, roles_delete
       FROM roles WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json({
      id: newRole[0].id,
      name: newRole[0].name,
      description: newRole[0].description,
      permissions: {
        products: {
          view: newRole[0].products_view,
          create: newRole[0].products_create,
          edit: newRole[0].products_edit,
          delete: newRole[0].products_delete,
        },
        orders: {
          view: newRole[0].orders_view,
          create: newRole[0].orders_create,
          edit: newRole[0].orders_edit,
          delete: newRole[0].orders_delete,
        },
        reviews: {
          view: newRole[0].reviews_view,
          create: newRole[0].reviews_create,
          edit: newRole[0].reviews_edit,
          delete: newRole[0].reviews_delete,
        },
        users: {
          view: newRole[0].users_view,
          create: newRole[0].users_create,
          edit: newRole[0].users_edit,
          delete: newRole[0].users_delete,
        },
        admins: {
          view: newRole[0].admins_view,
          create: newRole[0].admins_create,
          edit: newRole[0].admins_edit,
          delete: newRole[0].admins_delete,
        },
        analytics: {
          view: newRole[0].analytics_view,
          create: newRole[0].analytics_create,
          edit: newRole[0].analytics_edit,
          delete: newRole[0].analytics_delete,
        },
        roles: {
          view: newRole[0].roles_view,
          create: newRole[0].roles_create,
          edit: newRole[0].roles_edit,
          delete: newRole[0].roles_delete,
        },
      }
    });
  } catch (err) {
    console.error('Create role error:', err.message);
    res.status(400).json({ message: err.code === 'ER_DUP_ENTRY' ? 'Role name already exists' : 'Server error' });
  }
});

app.put('/api/roles/:id', auth(['admin']), checkPermission('roles', 'edit'), async (req, res) => {
  const { name, description, permissions } = req.body;
  const { id } = req.params;
  if (!name || !permissions) return res.status(400).json({ message: 'Name and permissions are required' });

  try {
    await db.execute(
      `UPDATE roles SET
        name = ?, description = ?,
        products_view = ?, products_create = ?, products_edit = ?, products_delete = ?,
        orders_view = ?, orders_create = ?, orders_edit = ?, orders_delete = ?,
        reviews_view = ?, reviews_create = ?, reviews_edit = ?, reviews_delete = ?,
        users_view = ?, users_create = ?, users_edit = ?, users_delete = ?,
        admins_view = ?, admins_create = ?, admins_edit = ?, admins_delete = ?,
        analytics_view = ?, analytics_create = ?, analytics_edit = ?, analytics_delete = ?,
        roles_view = ?, roles_create = ?, roles_edit = ?, roles_delete = ?
       WHERE id = ?`,
      [
        name,
        description || null,
        permissions.products.view || false,
        permissions.products.create || false,
        permissions.products.edit || false,
        permissions.products.delete || false,
        permissions.orders.view || false,
        permissions.orders.create || false,
        permissions.orders.edit || false,
        permissions.orders.delete || false,
        permissions.reviews.view || false,
        permissions.reviews.create || false,
        permissions.reviews.edit || false,
        permissions.reviews.delete || false,
        permissions.users.view || false,
        permissions.users.create || false,
        permissions.users.edit || false,
        permissions.users.delete || false,
        permissions.admins.view || false,
        permissions.admins.create || false,
        permissions.admins.edit || false,
        permissions.admins.delete || false,
        permissions.analytics.view || false,
        permissions.analytics.create || false,
        permissions.analytics.edit || false,
        permissions.analytics.delete || false,
        permissions.roles.view || false,
        permissions.roles.create || false,
        permissions.roles.edit || false,
        permissions.roles.delete || false,
        id
      ]
    );
    const [updatedRole] = await db.execute(
      `SELECT id, name, description,
              products_view, products_create, products_edit, products_delete,
              orders_view, orders_create, orders_edit, orders_delete,
              reviews_view, reviews_create, reviews_edit, reviews_delete,
              users_view, users_create, users_edit, users_delete,
              admins_view, admins_create, admins_edit, admins_delete,
              analytics_view, analytics_create, analytics_edit, analytics_delete,
              roles_view, roles_create, roles_edit, roles_delete
       FROM roles WHERE id = ?`,
      [id]
    );
    if (updatedRole.length === 0) return res.status(404).json({ message: 'Role not found' });
    res.json({
      id: updatedRole[0].id,
      name: updatedRole[0].name,
      description: updatedRole[0].description,
      permissions: {
        products: {
          view: updatedRole[0].products_view,
          create: updatedRole[0].products_create,
          edit: updatedRole[0].products_edit,
          delete: updatedRole[0].products_delete,
        },
        orders: {
          view: updatedRole[0].orders_view,
          create: updatedRole[0].orders_create,
          edit: updatedRole[0].orders_edit,
          delete: updatedRole[0].orders_delete,
        },
        reviews: {
          view: updatedRole[0].reviews_view,
          create: updatedRole[0].reviews_create,
          edit: updatedRole[0].reviews_edit,
          delete: updatedRole[0].reviews_delete,
        },
        users: {
          view: updatedRole[0].users_view,
          create: updatedRole[0].users_create,
          edit: updatedRole[0].users_edit,
          delete: updatedRole[0].users_delete,
        },
        admins: {
          view: updatedRole[0].admins_view,
          create: updatedRole[0].admins_create,
          edit: updatedRole[0].admins_edit,
          delete: updatedRole[0].admins_delete,
        },
        analytics: {
          view: updatedRole[0].analytics_view,
          create: updatedRole[0].analytics_create,
          edit: updatedRole[0].analytics_edit,
          delete: updatedRole[0].analytics_delete,
        },
        roles: {
          view: updatedRole[0].roles_view,
          create: updatedRole[0].roles_create,
          edit: updatedRole[0].roles_edit,
          delete: updatedRole[0].roles_delete,
        },
      }
    });
  } catch (err) {
    console.error('Update role error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/roles/:id', auth(['admin']), checkPermission('roles', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM roles WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Role not found' });
    await db.execute('DELETE FROM user_roles WHERE role_id = ?', [id]);
    res.json({ message: 'Role deleted' });
  } catch (err) {
    console.error('Delete role error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/users/:id/role', auth(['admin']), checkPermission('roles', 'edit'), async (req, res) => {
  const { roleId } = req.body;
  const { id } = req.params;
  if (!roleId) return res.status(400).json({ message: 'Role ID is required' });

  try {
    const [roleCheck] = await db.execute('SELECT id FROM roles WHERE id = ?', [roleId]);
    if (roleCheck.length === 0) return res.status(404).json({ message: 'Role not found' });

    await db.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);
    await db.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, roleId]);

    const [users] = await db.execute(
      `SELECT u.id, u.name, u.email, r.name as role_name
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    console.error('Assign role error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch user roles and permissions
app.get('/api/users/:id/roles', auth(['admin', 'manager', 'staff']), async (req, res) => {
  const { id } = req.params;
  if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized to view other users\' roles' });
  }
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.name, r.description,
              r.products_view, r.products_create, r.products_edit, r.products_delete,
              r.orders_view, r.orders_create, r.orders_edit, r.orders_delete,
              r.reviews_view, r.reviews_create, r.reviews_edit, r.reviews_delete,
              r.users_view, r.users_create, r.users_edit, r.users_delete,
              r.admins_view, r.admins_create, r.admins_edit, r.admins_delete,
              r.analytics_view, r.analytics_create, r.analytics_edit, r.analytics_delete,
              r.roles_view, r.roles_create, r.roles_edit, r.roles_delete
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [id]
    );
    if (rows.length === 0) {
      console.log(`No roles found for user_id: ${id}`);
      return res.json({ roles: [], permissions: {} });
    }
    console.log('Raw permissions data:', rows[0]);
    const permissions = {
      products: {
        view: rows[0].products_view,
        create: rows[0].products_create,
        edit: rows[0].products_edit,
        delete: rows[0].products_delete,
      },
      orders: {
        view: rows[0].orders_view,
        create: rows[0].orders_create,
        edit: rows[0].orders_edit,
        delete: rows[0].orders_delete,
      },
      reviews: {
        view: rows[0].reviews_view,
        create: rows[0].reviews_create,
        edit: rows[0].reviews_edit,
        delete: rows[0].reviews_delete,
      },
      users: {
        view: rows[0].users_view,
        create: rows[0].users_create,
        edit: rows[0].users_edit,
        delete: rows[0].users_delete,
      },
      admins: {
        view: rows[0].admins_view,
        create: rows[0].admins_create,
        edit: rows[0].admins_edit,
        delete: rows[0].admins_delete,
      },
      analytics: {
        view: rows[0].analytics_view,
        create: rows[0].analytics_create,
        edit: rows[0].analytics_edit,
        delete: rows[0].analytics_delete,
      },
      roles: {
        view: rows[0].roles_view,
        create: rows[0].roles_create,
        edit: rows[0].roles_edit,
        delete: rows[0].roles_delete,
      },
    };
    res.json({
      roles: rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
      })),
      permissions
    });
  } catch (err) {
    console.error('Get user roles error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// New Payment Methods Analytics Endpoint
// In server.js, replace the existing /api/payment-methods-analytics endpoint

app.get('/api/payment-methods-analytics', auth(['admin', 'manager']), checkPermission('analytics', 'view'), async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    let query = `
      SELECT 
        payment_method AS paymentMethod, 
        COUNT(*) AS orderCount, 
        SUM(total_price) AS totalRevenue
      FROM orders
      WHERE payment_method IS NOT NULL
    `;
    const params = [];

    // Apply filters
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' GROUP BY payment_method';

    // Fetch analytics data
    const [rows] = await db.execute(query, params);

    // Calculate totals
    const totalOrders = rows.reduce((sum, row) => sum + Number(row.orderCount), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0);

    // Map analytics with percentageShare
    const analytics = rows.map(row => ({
      paymentMethod: row.paymentMethod,
      orderCount: Number(row.orderCount),
      totalRevenue: Number(row.totalRevenue || 0),
      percentageShare: totalOrders > 0 ? ((Number(row.orderCount) / totalOrders) * 100).toFixed(2) : 0,
    }));

    res.json({
      analytics,
      totals: {
        totalOrders,
        totalRevenue,
      },
    });
  } catch (err) {
    console.error('Get payment methods analytics error:', err.message);
    res.status(500).json({ message: 'Server error fetching payment analytics' });
  }
});


// server.js (add after existing endpoints)

// Order Activity Heatmap Analytics
app.get('/api/analytics/order-activity', auth(['admin', 'manager']), checkPermission('analytics', 'view'), async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    let query = `
      SELECT 
        DAYOFWEEK(created_at) AS day,
        HOUR(created_at) AS hour,
        COUNT(*) AS orderCount
      FROM orders
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' GROUP BY DAYOFWEEK(created_at), HOUR(created_at)';

    const [rows] = await db.execute(query, params);

    // Transform data into heatmap format
    const heatmapData = [];
    for (let day = 1; day <= 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const entry = rows.find(row => 
          row.day === day && row.hour === hour
        );
        heatmapData.push({
          day: day - 1, // 0-based for chart (Monday=0)
          hour,
          orderCount: entry ? Number(entry.orderCount) : 0,
        });
      }
    }

    res.json(heatmapData);
  } catch (err) {
    console.error('Get order activity heatmap error:', err.message);
    res.status(500).json({ message: 'Server error fetching heatmap data' });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));