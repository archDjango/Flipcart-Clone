const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const WebSocket = require('ws');
const NodeCache = require('node-cache');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
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

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error('JWT_SECRET is not defined in .env file');
  process.exit(1);
}

const cache = new NodeCache({ stdTTL: 300 });

const wss = new WebSocket.Server({ port: 5001 });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

function broadcast(data) {
  console.log('Broadcasting:', data); // Debug log to confirm broadcasts
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

const auth = (roles) => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (roles && !roles.includes(decoded.role)) return res.status(403).json({ message: 'Unauthorized' });
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
  let role = 'user';
  if (roleCode === 'ADMIN123') role = 'admin';
  else if (roleCode === 'MANAGER456') role = 'manager';
  else if (roleCode === 'STAFF789') role = 'staff';

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, phone || '', address || null]
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
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND role IN ("admin", "manager", "staff")', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Users (Admin Only)
app.get('/api/users', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT name, email, role FROM users');
    res.json(rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete User (Admin Only)
app.delete('/api/users/:email', auth(['admin']), async (req, res) => {
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

// Get All Orders (Admin and Manager)
app.get('/api/orders', auth(['admin', 'manager']), async (req, res) => {
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
    res.status(500).json({ message: 'Server error fetching orders', error: err.message });
  }
});

// Update Order Status (Admin and Manager)
app.put('/api/orders/:id', auth(['admin', 'manager']), async (req, res) => {
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
    res.status(500).json({ message: 'Server error updating order', error: err.message });
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
  const { items, totalPrice } = req.body;
  if (!items || !Array.isArray(items) || typeof totalPrice !== 'number') {
    return res.status(400).json({ message: 'Invalid order data' });
  }
  try {
    const [orderResult] = await db.execute(
      'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, "Pending")',
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

    // Check for low stock after order
    const [products] = await db.execute('SELECT id, name, stock FROM products');
    const lowStockProducts = products.filter(p => p.stock < 10);
    if (lowStockProducts.length > 0) {
      broadcast({ type: 'lowStock', products: lowStockProducts });
    }

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Error saving order:', err.message, err.stack);
    res.status(500).json({ message: 'Failed to save order', error: err.message });
  }
});

// Get All Products (Admin and Manager)
app.get('/api/products', auth(['admin', 'manager']), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, price, stock, category, created_at, rating, image FROM products'
    );
    const lowStockProducts = rows.filter(p => p.stock < 10);
    if (lowStockProducts.length > 0) {
      broadcast({ type: 'lowStock', products: lowStockProducts });
    }
    res.json(rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Public Products (No Auth)
app.get('/api/public/products', async (req, res) => {
  const limit = parseInt(req.query.limit) || 8;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const [rows] = await db.query(`SELECT * FROM products LIMIT ${limit} OFFSET ${offset}`);
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM products');
    res.json({ products: rows, total: countResult[0].total });
  } catch (err) {
    console.error('Get public products error:', err);
    res.status(500).json({ message: 'Server error fetching products', error: err.message });
  }
});

// Add Product (Admin and Manager)
app.post('/api/products', auth(['admin', 'manager']), upload.single('image'), async (req, res) => {
  console.log('POST /api/products - req.body:', req.body);
  console.log('POST /api/products - req.file:', req.file);

  const { name, price, stock, category, rating } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO products (name, price, stock, category, rating, image) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, stock, category, rating || 4.0, image]
    );
    const [newProduct] = await db.execute(
      'SELECT id, name, price, stock, category, created_at, rating, image FROM products WHERE id = ?',
      [result.insertId]
    );
    broadcast(newProduct[0]);
    res.status(201).json(newProduct[0]);
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Product (Admin and Manager)
app.put('/api/products/:id', auth(['admin', 'manager']), upload.single('image'), async (req, res) => {
  console.log('PUT /api/products/:id - req.body:', req.body);
  console.log('PUT /api/products/:id - req.file:', req.file);

  const { name, price, stock, category, rating } = req.body;
  const { id } = req.params;
  const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;

  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }

  try {
    await db.execute(
      'UPDATE products SET name = ?, price = ?, stock = ?, category = ?, rating = ?, image = ? WHERE id = ?',
      [name, price, stock, category, rating || 4.0, image, id]
    );
    const [updatedProduct] = await db.execute(
      'SELECT id, name, price, stock, category, created_at, rating, image FROM products WHERE id = ?',
      [id]
    );
    if (updatedProduct.length === 0) return res.status(404).json({ message: 'Product not found' });
    broadcast(updatedProduct[0]);
    res.json(updatedProduct[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Product (Admin and Manager)
app.delete('/api/products/:id', auth(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    broadcast({ id, deleted: true });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk Delete Products (Admin and Manager)
app.delete('/api/products/bulk', auth(['admin', 'manager']), async (req, res) => {
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

// Add these endpoints to your existing server file

// Get All Admins (Admin Only)
app.get('/api/admins', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, role, status FROM users WHERE role IN ("admin", "manager", "staff")'
    );
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role === 'admin' ? 'Super Admin' : row.role === 'manager' ? 'Product Manager' : 'Order Manager',
      status: row.status || 'Active' // Default to Active if not set
    })));
  } catch (err) {
    console.error('Get admins error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add New Admin (Admin Only)
app.post('/api/admins', auth(['admin']), async (req, res) => {
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
    console.error('Add admin error:', err);
    res.status(400).json({ message: 'Email already registered' });
  }
});

// Update Admin Role/Status (Admin Only)
app.put('/api/admins/:id', auth(['admin']), async (req, res) => {
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
    console.error('Update admin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.listen(5000, () => console.log('Server running on port 5000'));