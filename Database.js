import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ninjas_fries.db');

export const Database = {
  /**
   * Initialise les tables de la base de données si elles n'existent pas.
   */
  init: () => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        image TEXT,
        type TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        items TEXT NOT NULL,
        total INTEGER NOT NULL
      );
    `);
  },

  /**
   * Récupère la couleur du jour ou en génère une nouvelle si elle n'existe pas pour aujourd'hui.
   */
  getDailyColor: () => {
    const today = new Date().toLocaleDateString('fr-FR');
    const result = db.getFirstSync('SELECT value FROM settings WHERE key = ?', [`color_${today}`]);
    
    if (result) {
      return result.value;
    } else {
      const colors = [
        '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
        '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
        '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#fb7185',
        '#fb923c','#fbbf24','#a3e635','#4ade80','#34d399','#2dd4bf',
        '#22d3ee','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc'
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`color_${today}`, randomColor]);
      return randomColor;
    }
  },

  /**
   * Gère les paramètres (settings) comme logoUrl, qrCodeUrl, etc.
   */
  getSetting: (key) => {
    const result = db.getFirstSync('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
  },

  saveSetting: (key, value) => {
    db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  /**
   * Gestion des produits (plats, sauces, garnitures).
   */
  getProducts: (type) => {
    return db.getAllSync('SELECT * FROM products WHERE type = ?', [type]);
  },

  saveProduct: (name, price, image, type) => {
    db.runSync('INSERT INTO products (name, price, image, type) VALUES (?, ?, ?, ?)', [name, price, image, type]);
  },

  updateProduct: (id, name, price, image) => {
    db.runSync('UPDATE products SET name = ?, price = ?, image = ? WHERE id = ?', [name, price, image, id]);
  },

  deleteProduct: (id) => {
    db.runSync('DELETE FROM products WHERE id = ?', [id]);
  },

  /**
   * Gestion des commandes (orders).
   */
  getOrders: () => {
    return db.getAllSync('SELECT * FROM orders ORDER BY id DESC');
  },

  getSales: () => {
    return db.getAllSync('SELECT * FROM orders ORDER BY id DESC');
  },

  insertOrder: (itemsJson, total, date, time) => {
    db.runSync('INSERT INTO orders (items, total, date, time) VALUES (?, ?, ?, ?)', [itemsJson, total, date, time]);
  }
};
