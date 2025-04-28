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
// Create a new order (User only)
app.post('/api/orders', auth(['user']), async (req, res) => {
  const { items, total_Price, shippingAddress, payment_method, coupon_code } = req.body;
  if (!items || !shippingAddress || !payment_method) {
    return res.status(400).json({ message: 'Items, shipping address, and payment method are required' });
  }
  try {
    let order_total = 0;
    const itemDetails = [];

    // Calculate total and validate items
    for (const item of items) {
      const [products] = await db.execute(
        `SELECT id, price, stock FROM products WHERE id = ?`,
        [item.productId]
      );
      if (products.length === 0) {
        return res.status(404).json({ message: `Product ID ${item.productId} not found` });
      }
      const product = products[0];
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for product ID ${item.productId}` });
      }
      const subtotal = product.price * item.quantity;
      order_total += subtotal;
      itemDetails.push({ product_id: item.productId, quantity: item.quantity, price: product.price, subtotal });
    }

    // Apply coupon if provided
    let discount = 0;
    let coupon_id = null;
    if (coupon_code) {
      const [coupons] = await db.execute(
        `SELECT id, discount_type, discount_value, min_order_amount
         FROM coupons
         WHERE code = ? AND status = 'active' AND expiry_date > NOW()`,
        [coupon_code]
      );
      if (coupons.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired coupon' });
      }
      const coupon = coupons[0];
      if (order_total < coupon.min_order_amount) {
        return res.status(400).json({
          message: `Order total must be at least ${coupon.min_order_amount}`
        });
      }
      if (coupon.discount_type === 'flat') {
        discount = coupon.discount_value;
      } else if (coupon.discount_type === 'percentage') {
        discount = (coupon.discount_value / 100) * order_total;
      }
      coupon_id = coupon.id;
    }

    const final_total = Number(order_total) - Number(discount);

    // Validate frontend-provided totalPrice
    if (total_Price == null || Math.abs(total_Price - final_total) > 0.01) {
      return res.status(400).json({ message: 'Provided totalPrice does not match calculated total' });
    }

    // Create order
    const [orderResult] = await db.execute(
      `INSERT INTO orders (user_id, total_Price, shipping_address, payment_method, coupon_id)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, final_total, shippingAddress, payment_method, coupon_id]
    );
    const order_id = orderResult.insertId;

    // Insert order items
    for (const item of itemDetails) {
      await db.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [order_id, item.product_id, item.quantity, item.price]
      );
      // Update product stock
      await db.execute(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    // Log coupon usage if coupon was applied
    if (coupon_id) {
      await db.execute(
        `INSERT INTO coupon_usage (coupon_id, order_id, user_id)
         VALUES (?, ?, ?)`,
        [coupon_id, order_id, req.user.id]
      );
    }

    // Broadcast order creation
    broadcast({ type: 'newOrder', order_id, user_id: req.user.id, final_total });

    res.status(201).json({
      id: order_id,
      user_id: req.user.id,
      total_price: Number(final_total),
      shippingAddress,
      payment_method,
      coupon_id,
      items: itemDetails,
      discount: Number(discount)
    });
  } catch (err) {
    console.error('Create order error:', err.message);
    res.status(500).json({ message: 'Server error creating order', error: err.message });
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
// Create a new order (User only)
app.post('/api/orders', auth(['user']), async (req, res) => {
  const { items, shipping_address, payment_method, coupon_code } = req.body;
  if (!items || !shipping_address || !payment_method) {
    return res.status(400).json({ message: 'Items, shipping address, and payment method are required' });
  }
  try {
    let order_total = 0;
    const itemDetails = [];

    // Calculate total and validate items
    for (const item of items) {
      const [products] = await db.execute(
        `SELECT id, price, stock FROM products WHERE id = ?`,
        [item.product_id]
      );
      if (products.length === 0) {
        return res.status(404).json({ message: `Product ID ${item.product_id} not found` });
      }
      const product = products[0];
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for product ID ${item.product_id}` });
      }
      const subtotal = product.price * item.quantity;
      order_total += subtotal;
      itemDetails.push({ product_id: item.product_id, quantity: item.quantity, price: product.price, subtotal });
    }

    // Apply coupon if provided
    let discount = 0;
    let coupon_id = null;
    if (coupon_code) {
      const [coupons] = await db.execute(
        `SELECT id, discount_type, discount_value, min_order_amount
         FROM coupons
         WHERE code = ? AND status = 'active' AND expiry_date > NOW()`,
        [coupon_code]
      );
      if (coupons.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired coupon' });
      }
      const coupon = coupons[0];
      if (order_total < coupon.min_order_amount) {
        return res.status(400).json({
          message: `Order total must be at least ${coupon.min_order_amount}`
        });
      }
      if (coupon.discount_type === 'flat') {
        discount = coupon.discount_value;
      } else if (coupon.discount_type === 'percentage') {
        discount = (coupon.discount_value / 100) * order_total;
      }
      coupon_id = coupon.id;
    }

    const final_total = Number(order_total) - Number(discount);

    // Create order
    const [orderResult] = await db.execute(
      `INSERT INTO orders (user_id, total, shipping_address, payment_method, coupon_id)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, final_total, shipping_address, payment_method, coupon_id]
    );
    const order_id = orderResult.insertId;

    // Insert order items
    for (const item of itemDetails) {
      await db.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [order_id, item.product_id, item.quantity, item.price]
      );
      // Update product stock
      await db.execute(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    // Log coupon usage if coupon was applied
    if (coupon_id) {
      await db.execute(
        `INSERT INTO coupon_usage (coupon_id, order_id, user_id)
         VALUES (?, ?, ?)`,
        [coupon_id, order_id, req.user.id]
      );
    }

    // Broadcast order creation
    broadcast({ type: 'newOrder', order_id, user_id: req.user.id, final_total });

    res.status(201).json({
      id: order_id,
      user_id: req.user.id,
      total: Number(final_total),
      shipping_address,
      payment_method,
      coupon_id,
      items: itemDetails,
      discount: Number(discount)
    });
  } catch (err) {
    console.error('Create order error:', err.message);
    res.status(500).json({ message: 'Server error creating order' });
  }
});

app.get('/api/products', auth(['admin', 'manager']), checkPermission('products', 'view'), async (req, res) => {
  const { low_stock } = req.query;
  try {
    let query = `
      SELECT p.id, p.name, p.price, p.stock, p.category, p.created_at, p.rating, p.image, p.description,
             p.low_stock_threshold, p.seller_id, s.company_name AS seller_name,
             lsa.id AS alert_id, lsa.status AS alert_status
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      LEFT JOIN low_stock_alerts lsa ON p.id = lsa.product_id
    `;
    const params = [];

    if (low_stock === 'true') {
      query += ' WHERE lsa.status = ?';
      params.push('active');
    }

    const [rows] = await db.execute(query, params);
    const lowStockProducts = rows.filter(p => p.stock <= p.low_stock_threshold && (!p.alert_id || p.alert_status === 'active'));
    if (lowStockProducts.length > 0) {
      for (const product of lowStockProducts) {
        const [existingAlerts] = await db.execute(
          'SELECT id FROM low_stock_alerts WHERE product_id = ? AND status = ?',
          [product.id, 'active']
        );
        if (existingAlerts.length === 0) {
          await db.execute(
            'INSERT INTO low_stock_alerts (product_id, threshold, status, created_at) VALUES (?, ?, ?, NOW())',
            [product.id, product.low_stock_threshold, 'active']
          );
          broadcast({ type: 'lowStock', product });
        }
      }
    }
    res.json(rows.map(row => ({
      ...row,
      price: Number(row.price),
      stock: Number(row.stock),
      rating: Number(row.rating) || 0,
      low_stock_threshold: Number(row.low_stock_threshold),
      seller_id: row.seller_id || null,
      seller_name: row.seller_name || 'N/A',
      alert_id: row.alert_id || null,
      alert_status: row.alert_status || null
    })));
  } catch (err) {
    console.error('Get products error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Updated: Get Public Products (No Auth)
app.get('/api/public/products', async (req, res) => {
  let limit, offset;

  try {
    limit = parseInt(req.query.limit, 10) || 8;
    offset = parseInt(req.query.offset, 10) || 0;

    if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0) {
      return res.status(400).json({
        message: 'Invalid limit or offset parameters',
        received: { limit: req.query.limit, offset: req.query.offset },
      });
    }

    if (limit > 1000) {
      limit = 1000;
    }

    console.log('Fetching products with:', { limit, offset });

    const query = `
      SELECT p.id, p.name, p.price, p.stock, p.category, p.description, p.image, p.created_at, p.rating,
             p.low_stock_threshold, p.seller_id, s.company_name AS seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const [rows] = await db.query(query);

    const [countResult] = await db.query('SELECT COUNT(*) as total FROM products');

    res.json({
      products: rows.map(row => ({
        ...row,
        price: Number(row.price),
        stock: Number(row.stock),
        rating: Number(row.rating) || 0,
        image: row.image || '/default-product-image.jpg',
        low_stock_threshold: Number(row.low_stock_threshold),
        seller_id: row.seller_id || null,
        seller_name: row.seller_name || 'N/A'
      })),
      total: Number(countResult[0].total),
    });
  } catch (err) {
    console.error('Get public products error:', {
      message: err.message,
      sqlMessage: err.sqlMessage,
      sql: err.sql,
      stack: err.stack,
    });
    res.status(500).json({
      message: 'Failed to fetch products',
      error: err.sqlMessage || err.message,
    });
  }
});

// Updated: Get Single Product by ID (Public)
app.get('/api/public/products/:id', async (req, res) => {
  const { id } = req.params;

  const productId = parseInt(id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ message: 'Invalid product ID' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT p.id, p.name, p.price, p.stock, p.category, p.description, p.image, p.created_at, p.rating,
              p.low_stock_threshold, p.seller_id, s.company_name AS seller_name
       FROM products p
       LEFT JOIN sellers s ON p.seller_id = s.id
       WHERE p.id = ?`,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      ...rows[0],
      price: Number(rows[0].price),
      stock: Number(rows[0].stock),
      rating: Number(rows[0].rating) || 0,
      image: rows[0].image || '/default-product-image.jpg',
      low_stock_threshold: Number(rows[0].low_stock_threshold),
      seller_id: rows[0].seller_id || null,
      seller_name: rows[0].seller_name || 'N/A'
    });
  } catch (err) {
    console.error('Get product error:', {
      message: err.message,
      sqlMessage: err.sqlMessage,
      sql: err.sql,
      stack: err.stack,
    });
    res.status(500).json({
      message: 'Failed to fetch product',
      error: err.sqlMessage || err.message,
    });
  }
});

// Add Product
app.post('/api/products', auth(['admin', 'manager']), checkPermission('products', 'create'), upload.single('image'), async (req, res) => {
  const { name, price, stock, category, description, low_stock_threshold, seller_id } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }

  try {
    if (seller_id) {
      const [seller] = await db.execute('SELECT id FROM sellers WHERE id = ? AND status = ?', [seller_id, 'Approved']);
      if (seller.length === 0) {
        return res.status(400).json({ message: 'Invalid or unapproved seller' });
      }
    }

    const [result] = await db.execute(
      `INSERT INTO products (name, price, stock, category, description, image, low_stock_threshold, seller_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        price,
        stock,
        category,
        description || null,
        image,
        low_stock_threshold || 10,
        seller_id || null
      ]
    );
    const [newProduct] = await db.execute(
      `SELECT p.id, p.name, p.price, p.stock, p.category, p.created_at, p.rating, p.image, p.description,
              p.low_stock_threshold, p.seller_id, s.company_name AS seller_name
       FROM products p
       LEFT JOIN sellers s ON p.seller_id = s.id
       WHERE p.id = ?`,
      [result.insertId]
    );

    await db.execute(
      'INSERT INTO inventory_transactions (product_id, quantity, transaction_type, user_id, created_at) VALUES (?, ?, ?, ?, NOW())',
      [result.insertId, stock, 'initial_stock', req.user.id]
    );

    if (newProduct[0].stock <= newProduct[0].low_stock_threshold) {
      await db.execute(
        'INSERT INTO low_stock_alerts (product_id, threshold, status, created_at) VALUES (?, ?, ?, NOW())',
        [newProduct[0].id, newProduct[0].low_stock_threshold, 'active']
      );
      broadcast({ type: 'lowStock', product: newProduct[0] });
    }

    broadcast(newProduct[0]);
    res.status(201).json({
      ...newProduct[0],
      price: Number(newProduct[0].price),
      stock: Number(newProduct[0].stock),
      rating: Number(newProduct[0].rating) || 0,
      low_stock_threshold: Number(newProduct[0].low_stock_threshold),
      seller_id: newProduct[0].seller_id || null,
      seller_name: newProduct[0].seller_name || 'N/A'
    });
  } catch (err) {
    console.error('Add product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Product
app.put('/api/products/:id', auth(['admin', 'manager']), checkPermission('products', 'edit'), upload.single('image'), async (req, res) => {
  const { name, price, stock, category, description, low_stock_threshold, seller_id } = req.body;
  const { id } = req.params;
  const image = req.file ? `/Uploads/${req.file.filename}` : req.body.image;

  if (!name || !price || !stock || !category) {
    return res.status(400).json({ message: 'Name, price, stock, and category are required' });
  }

  try {
    if (seller_id) {
      const [seller] = await db.execute('SELECT id FROM sellers WHERE id = ? AND status = ?', [seller_id, 'Approved']);
      if (seller.length === 0) {
        return res.status(400).json({ message: 'Invalid or unapproved seller' });
      }
    }

    const [currentProduct] = await db.execute('SELECT stock FROM products WHERE id = ?', [id]);
    if (currentProduct.length === 0) return res.status(404).json({ message: 'Product not found' });

    const stockDifference = Number(stock) - Number(currentProduct[0].stock);
    if (stockDifference !== 0) {
      await db.execute(
        'INSERT INTO inventory_transactions (product_id, quantity, transaction_type, user_id, created_at) VALUES (?, ?, ?, ?, NOW())',
        [id, Math.abs(stockDifference), stockDifference > 0 ? 'restock' : 'adjustment', req.user.id]
      );
    }

    await db.execute(
      `UPDATE products SET
       name = ?, price = ?, stock = ?, category = ?, description = ?, image = ?,
       low_stock_threshold = ?, seller_id = ?
       WHERE id = ?`,
      [
        name,
        price,
        stock,
        category,
        description || null,
        image || null,
        low_stock_threshold || 10,
        seller_id || null,
        id
      ]
    );
    const [updatedProduct] = await db.execute(
      `SELECT p.id, p.name, p.price, p.stock, p.category, p.created_at, p.rating, p.image, p.description,
              p.low_stock_threshold, p.seller_id, s.company_name AS seller_name
       FROM products p
       LEFT JOIN sellers s ON p.seller_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (updatedProduct.length === 0) return res.status(404).json({ message: 'Product not found' });

    if (updatedProduct[0].stock <= updatedProduct[0].low_stock_threshold) {
      const [existingAlerts] = await db.execute(
        'SELECT id FROM low_stock_alerts WHERE product_id = ? AND status = ?',
        [id, 'active']
      );
      if (existingAlerts.length === 0) {
        await db.execute(
          'INSERT INTO low_stock_alerts (product_id, threshold, status, created_at) VALUES (?, ?, ?, NOW())',
          [id, updatedProduct[0].low_stock_threshold, 'active']
        );
        broadcast({ type: 'lowStock', product: updatedProduct[0] });
      }
    } else {
      await db.execute('UPDATE low_stock_alerts SET status = ?, resolved_at = NOW() WHERE product_id = ? AND status = ?', ['resolved', id, 'active']);
    }

    broadcast(updatedProduct[0]);
    res.json({
      ...updatedProduct[0],
      price: Number(updatedProduct[0].price),
      stock: Number(updatedProduct[0].stock),
      rating: Number(updatedProduct[0].rating) || 0,
      low_stock_threshold: Number(updatedProduct[0].low_stock_threshold),
      seller_id: updatedProduct[0].seller_id || null,
      seller_name: updatedProduct[0].seller_name || 'N/A'
    });
  } catch (err) {
    console.error('Update product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Product
app.delete('/api/products/:id', auth(['admin', 'manager']), checkPermission('products', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    const [product] = await db.execute('SELECT id FROM products WHERE id = ?', [id]);
    if (product.length === 0) return res.status(404).json({ message: 'Product not found' });

    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    await db.execute('DELETE FROM inventory_transactions WHERE product_id = ?', [id]);
    await db.execute('DELETE FROM low_stock_alerts WHERE product_id = ?', [id]);

    broadcast({ id, deleted: true });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk Delete Products
app.delete('/api/products/bulk', auth(['admin', 'manager']), checkPermission('products', 'delete'), async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'No product IDs provided' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    await db.execute(`DELETE FROM products WHERE id IN (${placeholders})`, ids);
    await db.execute(`DELETE FROM inventory_transactions WHERE product_id IN (${placeholders})`, ids);
    await db.execute(`DELETE FROM low_stock_alerts WHERE product_id IN (${placeholders})`, ids);

    ids.forEach(id => broadcast({ id, deleted: true }));
    res.json({ message: `${ids.length} products deleted` });
  } catch (err) {
    console.error('Bulk delete product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// New: Restock Product (Admin and Manager)
app.post('/api/products/:id/restock', auth(['admin', 'manager']), checkPermission('inventory', 'restock'), async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ message: 'Valid quantity is required' });
  }

  try {
    const [product] = await db.execute('SELECT id, stock, low_stock_threshold FROM products WHERE id = ?', [id]);
    if (product.length === 0) return res.status(404).json({ message: 'Product not found' });

    const newStock = Number(product[0].stock) + Number(quantity);
    await db.execute('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);

    await db.execute(
      'INSERT INTO inventory_transactions (product_id, quantity, transaction_type, user_id, created_at) VALUES (?, ?, ?, ?, NOW())',
      [id, quantity, 'restock', req.user.id]
    );

    const [updatedProduct] = await db.execute(
      `SELECT p.id, p.name, p.price, p.stock, p.category, p.created_at, p.rating, p.image, p.description,
              p.low_stock_threshold, p.seller_id, s.company_name AS seller_name
       FROM products p
       LEFT JOIN sellers s ON p.seller_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (newStock > updatedProduct[0].low_stock_threshold) {
      await db.execute('UPDATE low_stock_alerts SET status = ?, resolved_at = NOW() WHERE product_id = ? AND status = ?', ['resolved', id, 'active']);
    }

    broadcast({ type: 'restock', product: updatedProduct[0] });
    res.json({
      ...updatedProduct[0],
      price: Number(updatedProduct[0].price),
      stock: Number(updatedProduct[0].stock),
      rating: Number(updatedProduct[0].rating) || 0,
      low_stock_threshold: Number(updatedProduct[0].low_stock_threshold),
      seller_id: updatedProduct[0].seller_id || null,
      seller_name: updatedProduct[0].seller_name || 'N/A'
    });
  } catch (err) {
    console.error('Restock product error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// New: Get Inventory Transactions (Admin and Manager)
app.get('/api/inventory/transactions', auth(['admin', 'manager']), checkPermission('inventory', 'transactions_view'), async (req, res) => {
  const { product_id, start_date, end_date, transaction_type } = req.query;
  try {
    let query = `
      SELECT it.id, it.product_id, p.name AS product_name, it.quantity, it.transaction_type, it.created_at, u.name AS user_name
      FROM inventory_transactions it
      JOIN products p ON it.product_id = p.id
      JOIN users u ON it.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      query += ' AND it.product_id = ?';
      params.push(product_id);
    }
    if (start_date) {
      query += ' AND it.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND it.created_at <= ?';
      params.push(end_date);
    }
    if (transaction_type) {
      query += ' AND it.transaction_type = ?';
      params.push(transaction_type);
    }

    const [rows] = await db.execute(query, params);
    res.json(rows.map(row => ({
      id: row.id,
      product_id: row.product_id,
      product_name: row.product_name,
      quantity: Number(row.quantity),
      transaction_type: row.transaction_type,
      created_at: row.created_at,
      user_name: row.user_name
    })));
  } catch (err) {
    console.error('Get inventory transactions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// New: Get Low Stock Alerts (Admin and Manager)
app.get('/api/inventory/low-stock-alerts', auth(['admin', 'manager']), checkPermission('inventory', 'view'), async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT lsa.id, lsa.product_id, p.name AS product_name, p.stock, lsa.threshold, lsa.status, lsa.created_at
      FROM low_stock_alerts lsa
      JOIN products p ON lsa.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND lsa.status = ?';
      params.push(status);
    } else {
      query += ' AND lsa.status = ?';
      params.push('active');
    }

    const [rows] = await db.execute(query, params);
    res.json(rows.map(row => ({
      id: row.id,
      product_id: row.product_id,
      product_name: row.product_name,
      stock: Number(row.stock),
      threshold: Number(row.threshold),
      status: row.status,
      created_at: row.created_at,
      acknowledged: row.status === 'resolved'
    })));
  } catch (err) {
    console.error('Get low stock alerts error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// New: Acknowledge Low Stock Alert (Admin and Manager)
app.put('/api/inventory/low-stock-alerts/:id/acknowledge', auth(['admin', 'manager']), checkPermission('inventory', 'edit'), async (req, res) => {
  const { id } = req.params;
  try {
    const [alert] = await db.execute('SELECT id, product_id FROM low_stock_alerts WHERE id = ?', [id]);
    if (alert.length === 0) return res.status(404).json({ message: 'Low stock alert not found' });

    await db.execute('UPDATE low_stock_alerts SET status = ?, resolved_at = NOW() WHERE id = ?', ['resolved', id]);
    broadcast({ type: 'lowStockAcknowledged', alert_id: Number(id), product_id: alert[0].product_id });
    res.json({ message: 'Low stock alert acknowledged' });
  } catch (err) {
    console.error('Acknowledge low stock alert error:', err.message);
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

// Seller Management Endpoints
// Add a new seller (Admin only)
app.post('/api/sellers', auth(['admin']), checkPermission('sellers', 'edit'), async (req, res) => {
  const { name, company_name, email, phone } = req.body;
  if (!name || !company_name || !email) {
    return res.status(400).json({ message: 'Name, company name, and email are required' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO sellers (name, company_name, email, phone, status) VALUES (?, ?, ?, ?, ?)',
      [name, company_name, email, phone || null, 'Pending']
    );
    const [newSeller] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers WHERE id = ?',
      [result.insertId]
    );
    broadcast({ type: 'newSeller', seller: newSeller[0] });
    res.status(201).json({
      id: newSeller[0].id,
      name: newSeller[0].name,
      companyName: newSeller[0].company_name,
      email: newSeller[0].email,
      phone: newSeller[0].phone,
      status: newSeller[0].status,
      createdAt: newSeller[0].created_at
    });
  } catch (err) {
    console.error('Add seller error:', err.message);
    res.status(400).json({ message: err.code === 'ER_DUP_ENTRY' ? 'Email already registered' : 'Server error' });
  }
});

// Get all sellers (Admin only)
app.get('/api/sellers', auth(['admin']), checkPermission('sellers', 'view'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers'
    );
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      companyName: row.company_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.created_at
    })));
  } catch (err) {
    console.error('Get sellers error:', err.message);
    res.status(500).json({ message: 'Server error fetching sellers' });
  }
});

// Get seller details by ID (Admin only)
app.get('/api/sellers/:id', auth(['admin']), checkPermission('sellers', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Seller not found' });
    }
    res.json({
      id: rows[0].id,
      name: rows[0].name,
      companyName: rows[0].company_name,
      email: rows[0].email,
      phone: rows[0].phone,
      status: rows[0].status,
      createdAt: rows[0].created_at
    });
  } catch (err) {
    console.error('Get seller details error:', err.message);
    res.status(500).json({ message: 'Server error fetching seller details' });
  }
});

// Approve a seller (Admin only)
app.put('/api/sellers/:id/approve', auth(['admin']), checkPermission('sellers', 'edit'), async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.execute('SELECT status FROM sellers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Seller not found' });
    }
    if (existing[0].status !== 'Pending') {
      return res.status(400).json({ message: 'Seller is not in pending status' });
    }
    await db.execute('UPDATE sellers SET status = ? WHERE id = ?', ['Approved', id]);
    const [updated] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers WHERE id = ?',
      [id]
    );
    broadcast({ type: 'sellerStatusUpdate', id: Number(id), status: 'Approved', seller: updated[0] });
    res.json({ message: 'Seller approved', seller: updated[0] });
  } catch (err) {
    console.error('Approve seller error:', err.message);
    res.status(500).json({ message: 'Server error approving seller' });
  }
});

// Block a seller (Admin only)
app.put('/api/sellers/:id/block', auth(['admin']), checkPermission('sellers', 'edit'), async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.execute('SELECT status FROM sellers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Seller not found' });
    }
    if (existing[0].status !== 'Approved') {
      return res.status(400).json({ message: 'Seller is not in approved status' });
    }
    await db.execute('UPDATE sellers SET status = ? WHERE id = ?', ['Blocked', id]);
    const [updated] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers WHERE id = ?',
      [id]
    );
    broadcast({ type: 'sellerStatusUpdate', id: Number(id), status: 'Blocked', seller: updated[0] });
    res.json({ message: 'Seller blocked', seller: updated[0] });
  } catch (err) {
    console.error('Block seller error:', err.message);
    res.status(500).json({ message: 'Server error blocking seller' });
  }
});

// Unblock a seller (Admin only)
app.put('/api/sellers/:id/unblock', auth(['admin']), checkPermission('sellers', 'edit'), async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.execute('SELECT status FROM sellers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Seller not found' });
    }
    if (existing[0].status !== 'Blocked') {
      return res.status(400).json({ message: 'Seller is not in blocked status' });
    }
    await db.execute('UPDATE sellers SET status = ? WHERE id = ?', ['Approved', id]);
    const [updated] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers WHERE id = ?',
      [id]
    );
    broadcast({ type: 'sellerStatusUpdate', id: Number(id), status: 'Approved', seller: updated[0] });
    res.json({ message: 'Seller unblocked', seller: updated[0] });
  } catch (err) {
    console.error('Unblock seller error:', err.message);
    res.status(500).json({ message: 'Server error unblocking seller' });
  }
});

// Role Management Endpoints
// Fetch user roles and permissions
app.get('/api/users/:id/roles', auth(['admin', 'manager', 'staff']), checkPermission('users', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [userRoles] = await db.execute('SELECT role_id FROM user_roles WHERE user_id = ?', [id]);
    if (!userRoles.length) {
      return res.status(404).json({ message: 'No roles assigned to user' });
    }

    const roleId = userRoles[0].role_id;
    const [roles] = await db.execute('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!roles.length) {
      return res.status(404).json({ message: 'Role not found for user' });
    }

    const role = roles[0];
    const permissions = {
      products: {
        view: role.products_view,
        create: role.products_create,
        edit: role.products_edit,
        delete: role.products_delete,
      },
      orders: {
        view: role.orders_view,
        create: role.orders_create,
        edit: role.orders_edit,
        delete: role.orders_delete,
      },
      reviews: {
        view: role.reviews_view,
        create: role.reviews_create,
        edit: role.reviews_edit,
        delete: role.reviews_delete,
      },
      users: {
        view: role.users_view,
        create: role.users_create,
        edit: role.users_edit,
        delete: role.users_delete,
      },
      admins: {
        view: role.admins_view,
        create: role.admins_create,
        edit: role.admins_edit,
        delete: role.admins_delete,
      },
      analytics: {
        view: role.analytics_view,
        create: role.analytics_create,
        edit: role.analytics_edit,
        delete: role.analytics_delete,
      },
      roles: {
        view: role.roles_view,
        create: role.roles_create,
        edit: role.roles_edit,
        delete: role.roles_delete,
      },
      returns: {
        view: role.returns_view,
        edit: role.returns_edit,
      },
      sellers: {
        view: role.sellers_view,
        edit: role.sellers_edit,
      },
      inventory: {
        view: role.inventory_view,
        edit: role.inventory_edit,
        restock: role.inventory_restock,
        transactions_view: role.inventory_transactions_view,
      },
      coupons: {
        view: role.coupons_view,
        create: role.coupons_create,
        edit: role.coupons_edit,
        delete: role.coupons_delete,
      },
      customers: {
        view: role.customers_view,
        edit: role.customers_edit,
      },
    };

    res.json({ role: role.name, permissions });
  } catch (err) {
    console.error('Error in /api/users/:id/roles:', err);
    res.status(500).json({ message: 'Server error while fetching roles', error: err.message });
  }
});


// Get all roles
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
              roles_view, roles_create, roles_edit, roles_delete,
              returns_view, returns_edit,
              sellers_view, sellers_edit,
              inventory_view, inventory_edit, inventory_restock, inventory_transactions_view,
              coupons_view, coupons_create, coupons_edit, coupons_delete,
              customers_view, customers_edit
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
        returns: {
          view: row.returns_view,
          edit: row.returns_edit,
        },
        sellers: {
          view: row.sellers_view,
          edit: row.sellers_edit,
        },
        inventory: {
          view: row.inventory_view,
          edit: row.inventory_edit,
          restock: row.inventory_restock,
          transactions_view: row.inventory_transactions_view,
        },
        coupons: {
          view: row.coupons_view,
          create: row.coupons_create,
          edit: row.coupons_edit,
          delete: row.coupons_delete,
        },
        customers: {
          view: row.customers_view,
          edit: row.customers_edit,
        },
      }
    })));
  } catch (err) {
    console.error('Get roles error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Role
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
        roles_view, roles_create, roles_edit, roles_delete,
        returns_view, returns_edit,
        sellers_view, sellers_edit,
        inventory_view, inventory_edit, inventory_restock, inventory_transactions_view,
        coupons_view, coupons_create, coupons_edit, coupons_delete,
        customers_view, customers_edit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        permissions.returns.view || false,
        permissions.returns.edit || false,
        permissions.sellers.view || false,
        permissions.sellers.edit || false,
        permissions.inventory.view || false,
        permissions.inventory.edit || false,
        permissions.inventory.restock || false,
        permissions.inventory.transactions_view || false,
        permissions.coupons.view || false,
        permissions.coupons.create || false,
        permissions.coupons.edit || false,
        permissions.coupons.delete || false,
        permissions.customers.view || false,
        permissions.customers.edit || false
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
              roles_view, roles_create, roles_edit, roles_delete,
              returns_view, returns_edit,
              sellers_view, sellers_edit,
              inventory_view, inventory_edit, inventory_restock, inventory_transactions_view,
              coupons_view, coupons_create, coupons_edit, coupons_delete,
              customers_view, customers_edit
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
        returns: {
          view: newRole[0].returns_view,
          edit: newRole[0].returns_edit,
        },
        sellers: {
          view: newRole[0].sellers_view,
          edit: newRole[0].sellers_edit,
        },
        inventory: {
          view: newRole[0].inventory_view,
          edit: newRole[0].inventory_edit,
          restock: newRole[0].inventory_restock,
          transactions_view: newRole[0].inventory_transactions_view,
        },
        coupons: {
          view: newRole[0].coupons_view,
          create: newRole[0].coupons_create,
          edit: newRole[0].coupons_edit,
          delete: newRole[0].coupons_delete,
        },
        customers: {
          view: newRole[0].customers_view,
          edit: newRole[0].customers_edit,
        },
      }
    });
  } catch (err) {
    console.error('Create role error:', err.message);
    res.status(400).json({ message: err.code === 'ER_DUP_ENTRY' ? 'Role name already exists' : 'Server error' });
  }
});

// Update Role
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
        roles_view = ?, roles_create = ?, roles_edit = ?, roles_delete = ?,
        returns_view = ?, returns_edit = ?,
        sellers_view = ?, sellers_edit = ?,
        inventory_view = ?, inventory_edit = ?, inventory_restock = ?, inventory_transactions_view = ?,
        coupons_view = ?, coupons_create = ?, coupons_edit = ?, coupons_delete = ?,
        customers_view = ?, customers_edit = ?
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
        permissions.returns.view || false,
        permissions.returns.edit || false,
        permissions.sellers.view || false,
        permissions.sellers.edit || false,
        permissions.inventory.view || false,
        permissions.inventory.edit || false,
        permissions.inventory.restock || false,
        permissions.inventory.transactions_view || false,
        permissions.coupons.view || false,
        permissions.coupons.create || false,
        permissions.coupons.edit || false,
        permissions.coupons.delete || false,
        permissions.customers.view || false,
        permissions.customers.edit || false,
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
              roles_view, roles_create, roles_edit, roles_delete,
              returns_view, returns_edit,
              sellers_view, sellers_edit,
              inventory_view, inventory_edit, inventory_restock, inventory_transactions_view,
              coupons_view, coupons_create, coupons_edit, coupons_delete,
              customers_view, customers_edit
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
        returns: {
          view: updatedRole[0].returns_view,
          edit: updatedRole[0].returns_edit,
        },
        sellers: {
          view: updatedRole[0].sellers_view,
          edit: updatedRole[0].sellers_edit,
        },
        inventory: {
          view: updatedRole[0].inventory_view,
          edit: updatedRole[0].inventory_edit,
          restock: updatedRole[0].inventory_restock,
          transactions_view: updatedRole[0].inventory_transactions_view,
        },
        coupons: {
          view: updatedRole[0].coupons_view,
          create: updatedRole[0].coupons_create,
          edit: updatedRole[0].coupons_edit,
          delete: updatedRole[0].coupons_delete,
        },
        customers: {
          view: updatedRole[0].customers_view,
          edit: updatedRole[0].customers_edit,
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


// ... other routes and server setup ...
// New Payment Methods Analytics Endpoint
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

    const [rows] = await db.execute(query, params);

    const totalOrders = rows.reduce((sum, row) => sum + Number(row.orderCount), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0);

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

    const heatmapData = [];
    for (let day = 1; day <= 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const entry = rows.find(row => 
          row.day === day && row.hour === hour
        );
        heatmapData.push({
          day: day - 1,
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

// Submit a return request (authenticated users only)
app.post('/api/returns', auth(['user']), async (req, res) => {
  const { orderId, productName, reason } = req.body;
  if (!orderId || !productName || !reason) {
    return res.status(400).json({ message: 'Order ID, product name, and reason are required' });
  }

  try {
    // Verify order exists and belongs to user
    const [orders] = await db.execute(
      `SELECT o.id, oi.product_name
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = ? AND o.user_id = ? AND oi.product_name = ?`,
      [orderId, req.user.id, productName]
    );
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order or product not found' });
    }

    const [result] = await db.execute(
      'INSERT INTO returns (order_id, user_id, product_name, reason, status) VALUES (?, ?, ?, ?, ?)',
      [orderId, req.user.id, productName, reason, 'Pending']
    );

    const [newReturn] = await db.execute(
      `SELECT r.id, r.order_id, r.user_id, u.name as customerName, r.product_name, r.reason, r.status, r.created_at
       FROM returns r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [result.insertId]
    );

    broadcast({ type: 'newReturn', return: newReturn[0] });
    res.status(201).json({ message: 'Return request submitted', returnId: result.insertId });
  } catch (err) {
    console.error('Submit return error:', err.message);
    res.status(500).json({ message: 'Server error submitting return request' });
  }
});

// Get all return requests (Admin and Manager)
app.get('/api/returns', auth(['admin', 'manager']), checkPermission('returns', 'view'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.order_id, r.user_id, u.name as customerName, r.product_name, r.reason, r.status, r.created_at
       FROM returns r
       JOIN users u ON r.user_id = u.id`
    );
    res.json(rows.map(row => ({
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      customerName: row.customerName,
      productName: row.product_name,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at
    })));
  } catch (err) {
    console.error('Get return requests error:', err.message);
    res.status(500).json({ message: 'Server error fetching return requests' });
  }
});

// Get single return request by ID (Admin and Manager)
app.get('/api/returns/:id', auth(['admin', 'manager']), checkPermission('returns', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.order_id, r.user_id, u.name as customerName, r.product_name, r.reason, r.status, r.created_at
       FROM returns r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Return request not found' });
    }
    res.json({
      id: rows[0].id,
      orderId: rows[0].order_id,
      userId: rows[0].user_id,
      customerName: rows[0].customerName,
      productName: rows[0].product_name,
      reason: rows[0].reason,
      status: rows[0].status,
      createdAt: rows[0].created_at
    });
  } catch (err) {
    console.error('Get return request error:', err.message);
    res.status(500).json({ message: 'Server error fetching return request' });
  }
});

// Approve a return request (Admin and Manager)
app.put('/api/returns/:id/approve', auth(['admin', 'manager']), checkPermission('returns', 'edit'), async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.execute('SELECT status, product_name FROM returns WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Return request not found' });
    }
    if (existing[0].status !== 'Pending') {
      return res.status(400).json({ message: 'Return request is not in pending status' });
    }

    await db.execute('UPDATE returns SET status = ? WHERE id = ?', ['Approved', id]);

    const [product] = await db.execute('SELECT id, stock, low_stock_threshold FROM products WHERE name = ?', [existing[0].product_name]);
    if (product.length > 0) {
      await db.execute(
        'UPDATE products SET stock = stock + 1 WHERE id = ?',
        [product[0].id]
      );

      await db.execute(
        'INSERT INTO inventory_transactions (product_id, quantity, type, user_id, created_at) VALUES (?, ?, ?, ?, NOW())',
        [product[0].id, 1, 'return', req.user.id]
      );

      if (product[0].stock + 1 > product[0].low_stock_threshold) {
        await db.execute('UPDATE low_stock_alerts SET acknowledged = ? WHERE product_id = ? AND acknowledged = ?', [true, product[0].id, false]);
      }
    }

    broadcast({ type: 'returnStatusUpdate', id: Number(id), status: 'Approved' });
    res.json({ message: 'Return request approved' });
  } catch (err) {
    console.error('Approve return error:', err.message);
    res.status(500).json({ message: 'Server error approving return request' });
  }
});

// Reject a return request (Admin and Manager)
app.put('/api/returns/:id/reject', auth(['admin', 'manager']), checkPermission('returns', 'edit'), async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.execute('SELECT status FROM returns WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Return request not found' });
    }
    if (existing[0].status !== 'Pending') {
      return res.status(400).json({ message: 'Return request is not in pending status' });
    }

    await db.execute('UPDATE returns SET status = ? WHERE id = ?', ['Rejected', id]);
    broadcast({ type: 'returnStatusUpdate', id: Number(id), status: 'Rejected' });
    res.json({ message: 'Return request rejected' });
  } catch (err) {
    console.error('Reject return error:', err.message);
    res.status(500).json({ message: 'Server error rejecting return request' });
  }
});


// Add a new seller (Admin only)
app.post('/api/sellers', auth(['admin']), checkPermission('sellers', 'edit'), async (req, res) => {
  const { name, company_name, email, phone } = req.body;
  if (!name || !company_name || !email) {
    return res.status(400).json({ message: 'Name, company name, and email are required' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO sellers (name, company_name, email, phone, status) VALUES (?, ?, ?, ?, ?)',
      [name, company_name, email, phone || null, 'Pending']
    );
    const [newSeller] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers WHERE id = ?',
      [result.insertId]
    );
    broadcast({ type: 'newSeller', seller: newSeller[0] });
    res.status(201).json({
      id: newSeller[0].id,
      name: newSeller[0].name,
      companyName: newSeller[0].company_name,
      email: newSeller[0].email,
      phone: newSeller[0].phone,
      status: newSeller[0].status,
      createdAt: newSeller[0].created_at
    });
  } catch (err) {
    console.error('Add seller error:', err.message);
    res.status(400).json({ message: err.code === 'ER_DUP_ENTRY' ? 'Email already registered' : 'Server error' });
  }
});

// Get seller details by ID (Admin only)
app.get('/api/sellers/:id', auth(['admin']), checkPermission('sellers', 'view'), async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      'SELECT id, name, company_name, email, phone, status, created_at FROM sellers WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Seller not found' });
    }
    res.json({
      id: rows[0].id,
      name: rows[0].name,
      companyName: rows[0].company_name,
      email: rows[0].email,
      phone: rows[0].phone,
      status: rows[0].status,
      createdAt: rows[0].created_at
    });
  } catch (err) {
    console.error('Get seller details error:', err.message);
    res.status(500).json({ message: 'Server error fetching seller details' });
  }
});

// Get active coupons (Public)
app.get('/api/public/coupons', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, code, discount_type, discount_value, min_order_amount, expiry_date
       FROM coupons
       WHERE status = 'active' AND expiry_date > NOW()`
    );
    res.json(rows.map(row => ({
      id: row.id,
      code: row.code,
      discount_type: row.discount_type,
      discount_value: Number(row.discount_value),
      min_order_amount: Number(row.min_order_amount),
      expiry_date: row.expiry_date
    })));
  } catch (err) {
    console.error('Get public coupons error:', err.message);
    res.status(500).json({ message: 'Server error fetching coupons' });
  }
});

// Create a new coupon (Admin only)
app.post('/api/coupons', auth(['admin']), checkPermission('coupons', 'create'), async (req, res) => {
  const { code, discount_type, discount_value, min_order_amount, expiry_date, status } = req.body;
  if (!code || !discount_type || !discount_value || !min_order_amount || !expiry_date) {
    return res.status(400).json({ message: 'Code, discount type, discount value, minimum order amount, and expiry date are required' });
  }
  if (!['flat', 'percentage'].includes(discount_type)) {
    return res.status(400).json({ message: 'Invalid discount type' });
  }
  if (!['active', 'inactive'].includes(status || 'active')) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const [result] = await db.execute(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, expiry_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code, discount_type, discount_value, min_order_amount, expiry_date, status || 'active']
    );
    const [newCoupon] = await db.execute(
      `SELECT id, code, discount_type, discount_value, min_order_amount, expiry_date, status, created_at
       FROM coupons WHERE id = ?`,
      [result.insertId]
    );
    broadcast({ type: 'newCoupon', coupon: newCoupon[0] });
    res.status(201).json({
      id: newCoupon[0].id,
      code: newCoupon[0].code,
      discount_type: newCoupon[0].discount_type,
      discount_value: Number(newCoupon[0].discount_value),
      min_order_amount: Number(newCoupon[0].min_order_amount),
      expiry_date: newCoupon[0].expiry_date,
      status: newCoupon[0].status,
      created_at: newCoupon[0].created_at
    });
  } catch (err) {
    console.error('Create coupon error:', err.message);
    res.status(400).json({ message: err.code === 'ER_DUP_ENTRY' ? 'Coupon code already exists' : 'Server error' });
  }
});

// Get all coupons (Admin only)
app.get('/api/coupons', auth(['admin']), checkPermission('coupons', 'view'), async (req, res) => {
  const { status, search } = req.query;
  try {
    let query = `SELECT id, code, discount_type, discount_value, min_order_amount, expiry_date, status, created_at
                 FROM coupons`;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('code LIKE ?');
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows.map(row => ({
      id: row.id,
      code: row.code,
      discount_type: row.discount_type,
      discount_value: Number(row.discount_value),
      min_order_amount: Number(row.min_order_amount),
      expiry_date: row.expiry_date,
      status: row.status,
      created_at: row.created_at
    })));
  } catch (err) {
    console.error('Get coupons error:', err.message);
    res.status(500).json({ message: 'Server error fetching coupons' });
  }
});

// Update a coupon (Admin only)
app.put('/api/coupons/:id', auth(['admin']), checkPermission('coupons', 'edit'), async (req, res) => {
  const { code, discount_type, discount_value, min_order_amount, expiry_date, status } = req.body;
  const { id } = req.params;
  if (!code || !discount_type || !discount_value || !min_order_amount || !expiry_date) {
    return res.status(400).json({ message: 'Code, discount type, discount value, minimum order amount, and expiry date are required' });
  }
  if (!['flat', 'percentage'].includes(discount_type)) {
    return res.status(400).json({ message: 'Invalid discount type' });
  }
  if (!['active', 'inactive'].includes(status || 'active')) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const [result] = await db.execute(
      `UPDATE coupons
       SET code = ?, discount_type = ?, discount_value = ?, min_order_amount = ?, expiry_date = ?, status = ?
       WHERE id = ?`,
      [code, discount_type, discount_value, min_order_amount, expiry_date, status || 'active', id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    const [updatedCoupon] = await db.execute(
      `SELECT id, code, discount_type, discount_value, min_order_amount, expiry_date, status, created_at
       FROM coupons WHERE id = ?`,
      [id]
    );
    broadcast({ type: 'couponUpdated', coupon: updatedCoupon[0] });
    res.json({
      id: updatedCoupon[0].id,
      code: updatedCoupon[0].code,
      discount_type: updatedCoupon[0].discount_type,
      discount_value: Number(updatedCoupon[0].discount_value),
      min_order_amount: Number(updatedCoupon[0].min_order_amount),
      expiry_date: updatedCoupon[0].expiry_date,
      status: updatedCoupon[0].status,
      created_at: updatedCoupon[0].created_at
    });
  } catch (err) {
    console.error('Update coupon error:', err.message);
    res.status(400).json({ message: err.code === 'ER_DUP_ENTRY' ? 'Coupon code already exists' : 'Server error' });
  }
});

// Update coupon status (Admin only)
app.put('/api/coupons/:id/status', auth(['admin']), checkPermission('coupons', 'edit'), async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const [result] = await db.execute(
      `UPDATE coupons SET status = ? WHERE id = ?`,
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    broadcast({ type: 'couponStatusUpdate', id: Number(id), status });
    res.json({ message: 'Coupon status updated' });
  } catch (err) {
    console.error('Update coupon status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a coupon (Admin only)
app.delete('/api/coupons/:id', auth(['admin']), checkPermission('coupons', 'delete'), async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute(`DELETE FROM coupons WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    await db.execute(`DELETE FROM coupon_usage WHERE coupon_id = ?`, [id]);
    broadcast({ type: 'couponDeleted', id: Number(id) });
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    console.error('Delete coupon error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply coupon to an order (User only)
app.post('/api/coupons/apply', auth(['user']), async (req, res) => {
  const { code, order_total, order_id } = req.body;
  if (!code || !order_total || !order_id) {
    return res.status(400).json({ message: 'Coupon code, order total, and order ID are required' });
  }
  try {
    const [orders] = await db.execute(
      `SELECT id, user_id FROM orders WHERE id = ? AND user_id = ?`,
      [order_id, req.user.id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }
    const [coupons] = await db.execute(
      `SELECT id, discount_type, discount_value, min_order_amount
       FROM coupons
       WHERE code = ? AND status = 'active' AND expiry_date > NOW()`,
      [code]
    );
    if (coupons.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired coupon' });
    }
    const coupon = coupons[0];
    if (order_total < coupon.min_order_amount) {
      return res.status(400).json({
        message: `Order total must be at least ${coupon.min_order_amount}`
      });
    }
    let discount = 0;
    if (coupon.discount_type === 'flat') {
      discount = coupon.discount_value;
    } else if (coupon.discount_type === 'percentage') {
      discount = (coupon.discount_value / 100) * order_total;
    }
    await db.execute(
      `INSERT INTO coupon_usage (coupon_id, order_id, user_id)
       VALUES (?, ?, ?)`,
      [coupon.id, order_id, req.user.id]
    );
    broadcast({ type: 'couponApplied', coupon_id: coupon.id, order_id });
    res.json({
      coupon_id: coupon.id,
      discount: Number(discount),
      final_total: Number(order_total) - Number(discount)
    });
  } catch (err) {
    console.error('Apply coupon error:', err.message);
    res.status(500).json({ message: 'Server error applying coupon' });
  }
});


// Get all customers (Admin and Manager)
app.get('/api/customers', auth(['admin', 'manager']), checkPermission('customers', 'view'), async (req, res) => {
  try {
    const { search } = req.query;
    let query = `SELECT id, name, email, phone, status, created_at FROM customers`;
    const params = [];

    if (search) {
      query += ` WHERE name LIKE ? OR email LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC`;

    const [rows] = await db.execute(query, params);
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.created_at
    })));
  } catch (err) {
    console.error('Get customers error:', err.message);
    res.status(500).json({ message: 'Server error fetching customers' });
  }
});

// Update customer status (Admin and Manager)
app.put('/api/customers/:id/status', auth(['admin', 'manager']), checkPermission('customers', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Active', 'Blocked'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const [existing] = await db.execute('SELECT id FROM customers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await db.execute('UPDATE customers SET status = ? WHERE id = ?', [status, id]);
    const [updated] = await db.execute(
      'SELECT id, name, email, phone, status, created_at FROM customers WHERE id = ?',
      [id]
    );

    broadcast({ type: 'customerStatusUpdate', id: Number(id), status, customer: updated[0] });
    res.json({
      id: updated[0].id,
      name: updated[0].name,
      email: updated[0].email,
      phone: updated[0].phone,
      status: updated[0].status,
      createdAt: updated[0].created_at
    });
  } catch (err) {
    console.error('Update customer status error:', err.message);
    res.status(500).json({ message: 'Server error updating customer status' });
  }
});


// Get Product Recommendations for a User
app.get('/recommendations/:user_id', auth(['user', 'admin', 'manager']), async (req, res) => {
  const { user_id } = req.params;

  if (isNaN(user_id) || user_id <= 0) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    // Check if user exists
    const [users] = await db.execute('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch recommendations from product_recommendations table
    const [recommendations] = await db.execute(
      `SELECT pr.id, pr.recommended_product_id, pr.reason, p.name, p.price, p.category, p.image, p.description
       FROM product_recommendations pr
       JOIN products p ON pr.recommended_product_id = p.id
       WHERE pr.user_id = ?`,
      [user_id]
    );

    res.json(recommendations.map(row => ({
      id: row.id,
      productId: row.recommended_product_id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      image: row.image || '/default-product-image.jpg',
      description: row.description,
      reason: row.reason,
    })));
  } catch (err) {
    console.error('Get recommendations error:', err.message);
    res.status(500).json({ message: 'Server error fetching recommendations' });
  }
});

// Log User Activity
app.post('/user-activity', auth(['user']), async (req, res) => {
  const { product_id, activity_type } = req.body;

  if (!product_id || !activity_type) {
    return res.status(400).json({ message: 'Product ID and activity type are required' });
  }

  if (!['view', 'purchase', 'add_to_cart'].includes(activity_type)) {
    return res.status(400).json({ message: 'Invalid activity type' });
  }

  try {
    // Verify product exists
    const [products] = await db.execute('SELECT id FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Insert user activity
    const [result] = await db.execute(
      'INSERT INTO user_activity (user_id, product_id, activity_type) VALUES (?, ?, ?)',
      [req.user.id, product_id, activity_type]
    );

    // Broadcast activity for real-time updates
    broadcast({ type: 'userActivity', user_id: req.user.id, product_id, activity_type });

    res.status(201).json({ message: 'Activity logged', activityId: result.insertId });
  } catch (err) {
    console.error('Log user activity error:', err.message);
    res.status(500).json({ message: 'Server error logging activity' });
  }
});

// Get Recommended Products for Homepage
app.get('/products/recommendations', async (req, res) => {
  try {
    // Simple recommendation logic: Top products based on user activity (e.g., most viewed or purchased)
    const [recommendations] = await db.execute(
      `SELECT p.id, p.name, p.price, p.category, p.image, p.description, COUNT(ua.id) as activity_count
       FROM products p
       LEFT JOIN user_activity ua ON p.id = ua.product_id
       WHERE ua.activity_type IN ('view', 'purchase', 'add_to_cart')
       GROUP BY p.id
       ORDER BY activity_count DESC
       LIMIT 10`
    );

    res.json(recommendations.map(row => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      image: row.image || '/default-product-image.jpg',
      description: row.description,
    })));
  } catch (err) {
    console.error('Get homepage recommendations error:', err.message);
    res.status(500).json({ message: 'Server error fetching homepage recommendations' });
  }
});

// Add this endpoint to server.js
app.post('/generate-recommendations/:user_id', auth(['user', 'admin', 'manager']), async (req, res) => {
  const { user_id } = req.params;

  if (isNaN(user_id) || user_id <= 0) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    // Fetch user's most viewed categories
    const [activities] = await db.execute(
      `SELECT p.category, COUNT(ua.id) as activity_count
       FROM user_activity ua
       JOIN products p ON ua.product_id = p.id
       WHERE ua.user_id = ? AND ua.activity_type = 'view'
       GROUP BY p.category
       ORDER BY activity_count DESC
       LIMIT 2`,
      [user_id]
    );

    if (activities.length === 0) {
      return res.status(200).json({ message: 'No activities found for recommendations' });
    }

    // Get products from top categories, excluding already interacted products
    const topCategories = activities.map(a => a.category);
    const [products] = await db.execute(
      `SELECT p.id, p.name, p.price, p.category, p.image, p.description
       FROM products p
       WHERE p.category IN (?)
       AND p.id NOT IN (
         SELECT product_id FROM user_activity WHERE user_id = ? AND activity_type IN ('view', 'add_to_cart', 'purchase')
       )
       LIMIT 10`,
      [topCategories, user_id]
    );

    // Clear existing recommendations for the user
    await db.execute('DELETE FROM product_recommendations WHERE user_id = ?', [user_id]);

    // Insert new recommendations
    for (const product of products) {
      await db.execute(
        'INSERT INTO product_recommendations (user_id, recommended_product_id, reason) VALUES (?, ?, ?)',
        [user_id, product.id, `Based on your interest in ${product.category} products`]
      );
    }

    res.status(200).json({ message: 'Recommendations generated successfully' });
  } catch (err) {
    console.error('Generate recommendations error:', err.message);
    res.status(500).json({ message: 'Server error generating recommendations' });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));