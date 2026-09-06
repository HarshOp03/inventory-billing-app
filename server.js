// StockPro - Node.js & Express Server with SQLite Authentication & Products API
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./database');
const { initialProducts } = require('./mockData');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'stockpro-super-secret-jwt-key-2026';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend assets from current directory
app.use(express.static(path.join(__dirname)));

/**
 * Authentication Middleware: Validates Bearer JWT tokens.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // When login is disabled, allow unauthenticated requests with a default user
  if (!token) {
    req.user = { id: 'default_admin', name: 'Admin', role: 'admin' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    req.user = { id: 'default_admin', name: 'Admin', role: 'admin' };
    next();
  }
}

// --- AUTHENTICATION ROUTES [COMMENTED OUT: Login disabled] ---
//
// app.post('/api/auth/register', (req, res) => {
//   try {
//     const { name, email, password } = req.body;
//     if (!name || !name.trim()) return res.status(400).json({ error: 'Full name is required.' });
//     if (!email || !email.trim() || !email.includes('@')) return res.status(400).json({ error: 'A valid email address is required.' });
//     if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
//     const cleanEmail = email.trim().toLowerCase();
//     const existing = db.findUserByEmail(cleanEmail);
//     if (existing) return res.status(409).json({ error: 'An account with this email address already exists.' });
//     const saltRounds = 10;
//     const passwordHash = bcrypt.hashSync(password, saltRounds);
//     const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
//     const user = db.createUser({ id: userId, name: name.trim(), email: cleanEmail, passwordHash, role: 'admin' });
//     if (Array.isArray(initialProducts) && initialProducts.length > 0) db.seedProducts(userId, initialProducts);
//     const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
//     res.status(201).json({ message: 'Registration successful', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
//   } catch (error) {
//     console.error('Registration error:', error);
//     res.status(500).json({ error: 'An internal server error occurred during registration.' });
//   }
// });
//
// app.post('/api/auth/login', (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) return res.status(400).json({ error: 'Please provide both email and password.' });
//     const cleanEmail = email.trim().toLowerCase();
//     const user = db.findUserByEmail(cleanEmail);
//     if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
//     const isValid = bcrypt.compareSync(password, user.password_hash);
//     if (!isValid) return res.status(401).json({ error: 'Invalid email or password.' });
//     const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
//     res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ error: 'An internal server error occurred during login.' });
//   }
// });
//
// app.get('/api/auth/me', authenticateToken, (req, res) => {
//   try {
//     const user = db.findUserById(req.user.id);
//     if (!user) return res.status(404).json({ error: 'User profile not found.' });
//     res.json({ user });
//   } catch (error) {
//     console.error('Fetch user error:', error);
//     res.status(500).json({ error: 'Failed to fetch user profile.' });
//   }
// });

// --- INVENTORY PRODUCTS API (PROTECTED) ---

/**
 * GET /api/products
 * Retrieves all inventory products belonging to the logged-in user.
 */
app.get('/api/products', authenticateToken, (req, res) => {
  try {
    const products = db.getProductsByUserId(req.user.id);
    res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Failed to retrieve products from database.' });
  }
});

/**
 * POST /api/products
 * Creates a new product for the authenticated user.
 */
app.post('/api/products', authenticateToken, (req, res) => {
  try {
    const { name, sku, category, price, stock, reorderLevel } = req.body;

    if (!name || !sku || !category) {
      return res.status(400).json({ error: 'Product name, SKU, and category are required.' });
    }

    const cleanSku = sku.trim().toUpperCase();

    // Check SKU uniqueness for this user
    if (db.checkSkuExists(req.user.id, cleanSku)) {
      return res.status(400).json({ error: 'A product with this SKU already exists.' });
    }

    const newId = 'p_' + Date.now();
    const product = db.createProduct({
      id: newId,
      userId: req.user.id,
      name: name.trim(),
      sku: cleanSku,
      category: category.trim(),
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      reorderLevel: parseInt(reorderLevel) || 5
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to save product to database.' });
  }
});

/**
 * PUT /api/products/:id
 * Updates an existing product.
 */
app.put('/api/products/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, category, price, stock, reorderLevel } = req.body;

    const existing = db.getProductById(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const cleanSku = sku.trim().toUpperCase();

    // Check SKU conflict with another product
    if (db.checkSkuExists(req.user.id, cleanSku, id)) {
      return res.status(400).json({ error: 'Another product already uses this SKU code.' });
    }

    const updated = db.updateProduct({
      id,
      userId: req.user.id,
      name: name.trim(),
      sku: cleanSku,
      category: category.trim(),
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      reorderLevel: parseInt(reorderLevel) || 5
    });

    res.json(updated);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

/**
 * DELETE /api/products/:id
 * Deletes a product from the database.
 */
app.delete('/api/products/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const success = db.deleteProduct(id, req.user.id);
    if (!success) {
      return res.status(404).json({ error: 'Product not found or already deleted.' });
    }
    res.json({ message: 'Product deleted successfully', id });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

/**
 * POST /api/products/sync
 * Bulk seeds or imports products (e.g. from JSON backup or initial sync).
 */
app.post('/api/products/sync', authenticateToken, (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Expected products array.' });
    }
    const synced = db.seedProducts(req.user.id, products);
    res.json({ message: 'Products synced successfully', products: synced });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync products.' });
  }
});

// Fallback SPA routing (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`
  ======================================================
  🚀 StockPro Server & SQL Database running at:
     Local: http://localhost:${PORT}
  ======================================================
  `);
});
