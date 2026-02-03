/**
 * Database.js - Version Ultra-Safe pour CI/CD (Codemagic)
 * Utilise uniquement CommonJS pour éviter l'erreur "Unexpected token export"
 */

let _db = null;

const getDb = () => {
  // Empêche le chargement de SQLite pendant le build Expo/Codemagic
  if (typeof global !== 'undefined' && (global.__METRO_GLOBAL_PREFIX__ || !global.expo)) {
     // On est en phase de build ou hors environnement mobile
     return null;
  }

  if (!_db) {
    try {
      const SQLite = require('expo-sqlite');
      _db = SQLite.openDatabaseSync('ninjas_fries.db');
    } catch (e) {
      return null;
    }
  }
  return _db;
};

const Database = {
  init: () => {
    const db = getDb();
    if (!db) return;
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER, image TEXT, type TEXT);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, time TEXT, items TEXT, total INTEGER);
        CREATE TABLE IF NOT EXISTS cart_table (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER, name TEXT, quantity INTEGER, totalPrice INTEGER, extras TEXT);
      `);
    } catch (error) {}
  },

  getDailyColor: () => {
    const db = getDb();
    if (!db) return '#f97316';
    try {
      const today = new Date().toLocaleDateString('fr-FR');
      const result = db.getFirstSync('SELECT value FROM settings WHERE key = ?', [`color_${today}`]);
      if (result) return result.value;
      return '#f97316';
    } catch (e) { return '#f97316'; }
  },

  getProducts: (type) => {
    const db = getDb();
    if (!db) return [];
    try { return db.getAllSync('SELECT * FROM products WHERE type = ?', [type]); } catch (e) { return []; }
  },

  saveProduct: (name, price, image, type) => {
    const db = getDb();
    if (!db) return;
    try { db.runSync('INSERT INTO products (name, price, image, type) VALUES (?, ?, ?, ?)', [name, price, image, type]); } catch (e) {}
  },

  deleteProduct: (id) => {
    const db = getDb();
    if (!db) return;
    try { db.runSync('DELETE FROM products WHERE id = ?', [id]); } catch (e) {}
  },

  addToCart: (productId, name, quantity, totalPrice, extras) => {
    const db = getDb();
    if (!db) return;
    try { db.runSync('INSERT INTO cart_table (productId, name, quantity, totalPrice, extras) VALUES (?, ?, ?, ?, ?)', [productId, name, quantity, totalPrice, extras]); } catch (e) {}
  },

  getCartItems: () => {
    const db = getDb();
    if (!db) return [];
    try { return db.getAllSync('SELECT * FROM cart_table'); } catch (e) { return []; }
  },

  clearCart: () => {
    const db = getDb();
    if (!db) return;
    try { db.runSync('DELETE FROM cart_table'); } catch (e) {}
  }
};

module.exports = { Database };
