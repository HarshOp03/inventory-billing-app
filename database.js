// StockPro - SQLite Database Engine using Node 24 native node:sqlite
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'stockpro.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance and Foreign Keys for relational integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initializes database schemas for Users and Products.
 */
function initDatabase() {
  // 1. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // 2. Products Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, sku)
    );
    CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
  `);

  console.log('✅ SQLite database schema initialized at:', dbPath);
}

// Initialize tables immediately upon module load
initDatabase();

// --- USER QUERIES ---

/**
 * Creates a new user in the database.
 */
function createUser({ id, name, email, passwordHash, role = 'admin' }) {
  const stmt = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, email, passwordHash, role);
  return findUserById(id);
}

/**
 * Finds a user by email address (case-insensitive).
 */
function findUserByEmail(email) {
  const stmt = db.prepare(`SELECT * FROM users WHERE email = ? LIMIT 1`);
  return stmt.get(email.trim().toLowerCase());
}

/**
 * Finds a user by primary key ID.
 */
function findUserById(id) {
  const stmt = db.prepare(`
    SELECT id, name, email, role, created_at, updated_at
    FROM users WHERE id = ? LIMIT 1
  `);
  return stmt.get(id);
}

// --- PRODUCT QUERIES ---

/**
 * Retrieves all products belonging to a specific user.
 */
function getProductsByUserId(userId) {
  const stmt = db.prepare(`
    SELECT id, name, sku, category, price, stock, reorder_level AS reorderLevel, created_at, updated_at
    FROM products
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(userId);
}

/**
 * Retrieves a single product by ID and user ID.
 */
function getProductById(id, userId) {
  const stmt = db.prepare(`
    SELECT id, name, sku, category, price, stock, reorder_level AS reorderLevel
    FROM products
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `);
  return stmt.get(id, userId);
}

/**
 * Checks if a SKU code is already in use by another product for this user.
 */
function checkSkuExists(userId, sku, excludeId = null) {
  if (excludeId) {
    const stmt = db.prepare(`
      SELECT id FROM products WHERE user_id = ? AND UPPER(sku) = UPPER(?) AND id != ? LIMIT 1
    `);
    return !!stmt.get(userId, sku, excludeId);
  } else {
    const stmt = db.prepare(`
      SELECT id FROM products WHERE user_id = ? AND UPPER(sku) = UPPER(?) LIMIT 1
    `);
    return !!stmt.get(userId, sku);
  }
}

/**
 * Inserts a new product for a user.
 */
function createProduct({ id, userId, name, sku, category, price, stock, reorderLevel = 5 }) {
  const stmt = db.prepare(`
    INSERT INTO products (id, user_id, name, sku, category, price, stock, reorder_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, name, sku.toUpperCase(), category, Number(price), Number(stock), Number(reorderLevel));
  return getProductById(id, userId);
}

/**
 * Updates an existing product.
 */
function updateProduct({ id, userId, name, sku, category, price, stock, reorderLevel = 5 }) {
  const stmt = db.prepare(`
    UPDATE products
    SET name = ?, sku = ?, category = ?, price = ?, stock = ?, reorder_level = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `);
  stmt.run(name, sku.toUpperCase(), category, Number(price), Number(stock), Number(reorderLevel), id, userId);
  return getProductById(id, userId);
}

/**
 * Deletes a product by ID.
 */
function deleteProduct(id, userId) {
  const stmt = db.prepare(`DELETE FROM products WHERE id = ? AND user_id = ?`);
  const result = stmt.run(id, userId);
  return (result && result.changes ? result.changes > 0 : true);
}

/**
 * Seeds a list of default or imported products for a new user.
 */
function seedProducts(userId, productsList) {
  if (!Array.isArray(productsList) || productsList.length === 0) return [];
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO products (id, user_id, name, sku, category, price, stock, reorder_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of productsList) {
    const prodId = p.id || ('p_' + Math.random().toString(36).substring(2, 9));
    insert.run(
      prodId,
      userId,
      p.name,
      p.sku.toUpperCase(),
      p.category,
      Number(p.price) || 0,
      Number(p.stock) || 0,
      Number(p.reorderLevel || p.reorder_level) || 5
    );
  }

  return getProductsByUserId(userId);
}

module.exports = {
  db,
  initDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  getProductsByUserId,
  getProductById,
  checkSkuExists,
  createProduct,
  updateProduct,
  deleteProduct,
  seedProducts
};
