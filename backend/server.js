const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Database Connection
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root', // Replace with your MySQL root password
  database: 'flipkart',
});

db.getConnection()
  .then(() => console.log('MySQL connected'))
  .catch(err => console.error('MySQL connection error:', err));

const SECRET = 'e6b8f8c9d2a5b7e4f1c3d9a8e7b6f5c2d4a9e8b7f6c5d3a2e9b8f7c6d5a4e3b1'; // Replace with a secure key in production

// Middleware to verify JWT and role
const auth = (role) => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (role && decoded.role !== role) return res.status(403).json({ message: 'Unauthorized' });
    req.user = decoded;
    next();
  } catch (err) {
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
    if (!user || !await bcrypt.compare(password, user.password)) {
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
    if (!user || !await bcrypt.compare(password, user.password)) {
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

// Get Orders (Admin Only)
app.get('/api/orders', auth('admin'), async (req, res) => {
  try {
    const [orders] = await db.execute(`
      SELECT o.id, o.user_id, u.email, o.date, o.total_price, o.status, o.shipping_name, o.shipping_address, o.shipping_phone, o.payment_method, oi.name, oi.price, oi.quantity
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `);
    const orderMap = orders.reduce((acc, row) => {
      if (!acc[row.id]) {
        acc[row.id] = {
          id: row.id,
          userId: row.user_id,
          userEmail: row.email,
          date: row.date,
          totalPrice: row.total_price,
          status: row.status,
          shippingDetails: {
            name: row.shipping_name,
            address: row.shipping_address,
            phone: row.shipping_phone,
            paymentMethod: row.payment_method,
          },
          items: [],
        };
      }
      if (row.name) {
        acc[row.id].items.push({ name: row.name, price: row.price, quantity: row.quantity });
      }
      return acc;
    }, {});
    res.json(Object.values(orderMap));
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Order Status (Admin Only)
app.put('/api/orders/:id', auth('admin'), async (req, res) => {
  const { status } = req.body;
  try {
    await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    const [rows] = await db.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User Orders (User Only)
app.get('/api/user/orders', auth('user'), async (req, res) => {
  try {
    const [orders] = await db.execute(
      `
      SELECT o.id, o.date, o.total_price, o.status, o.shipping_name, o.shipping_address, o.shipping_phone, o.payment_method, oi.name, oi.price, oi.quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ?
    `,
      [req.user.id]
    );
    const orderMap = orders.reduce((acc, row) => {
      if (!acc[row.id]) {
        acc[row.id] = {
          id: row.id,
          date: row.date,
          totalPrice: row.total_price,
          status: row.status,
          shippingDetails: {
            name: row.shipping_name,
            address: row.shipping_address,
            phone: row.shipping_phone,
            paymentMethod: row.payment_method,
          },
          items: [],
        };
      }
      if (row.name) {
        acc[row.id].items.push({ name: row.name, price: row.price, quantity: row.quantity });
      }
      return acc;
    }, {});
    res.json(Object.values(orderMap));
  } catch (err) {
    console.error('Get user orders error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Order (User Only)
app.post('/api/orders', auth('user'), async (req, res) => {
  const { items, totalPrice, shippingDetails } = req.body;
  if (!items || !Array.isArray(items) || typeof totalPrice !== 'number') {
    return res.status(400).json({ message: 'Invalid order data: items (array) and totalPrice (number) required' });
  }
  try {
    const [orderResult] = await db.execute(
      'INSERT INTO orders (user_id, total_price, shipping_name, shipping_address, shipping_phone, payment_method) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        totalPrice,
        shippingDetails?.name || null,
        shippingDetails?.address || null,
        shippingDetails?.phone || null,
        shippingDetails?.paymentMethod || 'Cash on Delivery',
      ]
    );
    const orderId = orderResult.insertId;
    for (const item of items) {
      if (!item.name || !item.price || !item.quantity) {
        throw new Error('Invalid item data');
      }
      await db.execute(
        'INSERT INTO order_items (order_id, name, price, quantity) VALUES (?, ?, ?, ?)',
        [orderId, item.name, item.price, item.quantity]
      );
    }
    const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json(orders[0]);
  } catch (err) {
    console.error('Error saving order:', err);
    res.status(500).json({ message: 'Failed to save order' });
  }
});

// Start Server
app.listen(5000, () => console.log('Server running on port 5000'));