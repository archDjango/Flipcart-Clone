const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const WebSocket = require('ws');
const NodeCache = require('node-cache'); // Added for caching
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root', // Replace with your MySQL password
  database: 'flipkart',
});

db.getConnection()
  .then(() => console.log('MySQL connected'))
  .catch(err => console.error('MySQL connection error:', err));

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error('JWT_SECRET is not defined in .env file');
  process.exit(1);
}

// Initialize NodeCache for caching
const cache = new NodeCache({ stdTTL: 300 }); // 5-minute TTL

// WebSocket Server Setup
const wss = new WebSocket.Server({ port: 5001 });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

const auth = (role) => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (role && decoded.role !== role) return res.status(403).json({ message: 'Unauthorized' });
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// User Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password, adminCode, phone, address } = req.body;
  const isAdmin = adminCode === 'ADMIN123';
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, isAdmin ? 'admin' : 'user', phone || '', address || null]
    );
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(400).json({ message: 'Email already registered' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin Login
app.post('/api/admin-login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND role = "admin"', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: 'admin' }, SECRET, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Users (Admin Only)
app.get('/api/users', auth('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT name, email, role FROM users');
    res.json(rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete User (Admin Only)
app.delete('/api/users/:email', auth('admin'), async (req, res) => {
  const { email } = req.params;
  if (req.user.email === email) return res.status(403).json({ message: 'Cannot delete yourself' });
  try {
    await db.execute('DELETE FROM users WHERE email = ?', [email]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Orders (Admin Only)
app.get('/api/orders', auth('admin'), async (req, res) => {
  try {
    let query = `
      SELECT o.id, o.user_id, u.email AS userEmail, o.total_price, o.status, o.created_at,
             oi.product_name AS item_name, oi.price AS item_price, oi.quantity
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `;
    const params = [];
    if (req.query.since) {
      query += ' WHERE o.created_at >= ?';
      params.push(req.query.since);
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
    const result = Object.values(orderMap);
    res.json(result);
  } catch (err) {
    console.error('Get orders error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error fetching orders', error: err.message });
  }
});

// Update Order Status (Admin Only)
app.put('/api/orders/:id', auth('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }
  try {
    await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    const [rows] = await db.execute('SELECT id, user_id, total_price, status, created_at FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const updatedOrder = rows[0];
    broadcast({ id: updatedOrder.id, status: updatedOrder.status });
    res.json(updatedOrder);
  } catch (err) {
    console.error('Update order error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error updating order', error: err.message });
  }
});

// Get User Orders (User Only)
app.get('/api/user/orders', auth('user'), async (req, res) => {
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
app.post('/api/orders', auth('user'), async (req, res) => {
  const { items, totalPrice } = req.body;
  if (!items || !Array.isArray(items) || typeof totalPrice !== 'number') {
    return res.status(400).json({ message: 'Invalid order data' });
  }
  try {
    const [orderResult] = await db.execute(
      'INSERT INTO orders (user_id, total_price) VALUES (?, ?)',
      [req.user.id, totalPrice]
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
    }
    const [orders] = await db.execute('SELECT id, user_id, total_price, status, created_at FROM orders WHERE id = ?', [orderId]);
    res.status(201).json(orders[0]);
  } catch (err) {
    console.error('Error saving order:', err.message, err.stack);
    res.status(500).json({ message: 'Failed to save order', error: err.message });
  }
});

// Get All Products (Admin Only)
app.get('/api/products', auth('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, price, stock, category, created_at, rating, image FROM products'
    );
    res.json(rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public endpoint to fetch all products
app.get('/api/public/products', async (req, res) => {
  const cacheKey = 'public_products';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const [rows] = await db.execute(
      'SELECT id, name, price, stock, category, created_at AS date, rating, image FROM products'
    );
    cache.set(cacheKey, rows); // Cache the result
    res.json(rows);
  } catch (err) {
    console.error('Get public products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Product (Admin Only)
app.post('/api/products', auth('admin'), async (req, res) => {
  const { name, price, stock, category, rating, image } = req.body;
  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }
  try {
    const [result] = await db.execute(
      'INSERT INTO products (name, price, stock, category, rating, image) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, stock, category, rating || 4.0, image || null]
    );
    const [newProduct] = await db.execute('SELECT id, name, price, stock, category, created_at, rating, image FROM products WHERE id = ?', [result.insertId]);
    broadcast(newProduct[0]);
    res.status(201).json(newProduct[0]);
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Product (Admin Only)
app.delete('/api/products/:id', auth('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const [product] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    broadcast({ id, deleted: true });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Product (Admin Only)
app.put('/api/products/:id', auth('admin'), async (req, res) => {
  const { name, price, stock, category, rating, image } = req.body;
  const { id } = req.params;
  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }
  try {
    await db.execute(
      'UPDATE products SET name = ?, price = ?, stock = ?, category = ?, rating = ?, image = ? WHERE id = ?',
      [name, price, stock, category, rating || 4.0, image || null, id]
    );
    const [updatedProduct] = await db.execute('SELECT id, name, price, stock, category, created_at, rating, image FROM products WHERE id = ?', [id]);
    if (updatedProduct.length === 0) return res.status(404).json({ message: 'Product not found' });
    broadcast(updatedProduct[0]);
    res.json(updatedProduct[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk Delete Products (Admin Only)
app.delete('/api/products/bulk', auth('admin'), async (req, res) => {
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
    console.error('Bulk delete product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));