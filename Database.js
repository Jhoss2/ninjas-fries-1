import * as SQLite from 'expo-sqlite';

/**
 * Ouverture de la base de données de manière synchrone.
 * Note : 'import' doit être en minuscule.
 */
const db = SQLite.openDatabaseSync('ninjas_fries.db');

const Database = {
  /**
   * Initialise les tables de la base de données si elles n'existent pas.
   */
  init: () => {
    try {
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
        CREATE TABLE IF NOT EXISTS cart_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER,
          name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          totalPrice INTEGER NOT NULL,
          extras TEXT
        );
      `);
    } catch (error) {
      console.error("Erreur lors de l'initialisation de la base :", error);
    }
  },

  /**
   * Gestion de la couleur du jour.
   */
  getDailyColor: () => {
    const today = new Date().toLocaleDateString('fr-FR');
    try {
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
    } catch (e) {
      return '#f97316'; // Repli sur la couleur orange ninja par défaut
    }
  },

  /**
   * Gestion des paramètres (settings).
   */
  getSetting: (key) => {
    try {
      const result = db.getFirstSync('SELECT value FROM settings WHERE key = ?', [key]);
      return result ? result.value : null;
    } catch (e) { return null; }
  },

  saveSetting: (key, value) => {
    try {
      db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    } catch (e) {}
  },

  /**
   * Gestion des produits.
   */
  getProducts: (type) => {
    try {
      return db.getAllSync('SELECT * FROM products WHERE type = ?', [type]);
    } catch (e) { return []; }
  },

  saveProduct: (name, price, image, type) => {
    try {
      db.runSync('INSERT INTO products (name, price, image, type) VALUES (?, ?, ?, ?)', [name, price, image, type]);
    } catch (e) {}
  },

  updateProduct: (id, name, price, image) => {
    try {
      db.runSync('UPDATE products SET name = ?, price = ?, image = ? WHERE id = ?', [name, price, image, id]);
    } catch (e) {}
  },

  deleteProduct: (id) => {
    try {
      db.runSync('DELETE FROM products WHERE id = ?', [id]);
    } catch (e) {}
  },

  /**
   * Gestion du PANIER (cart_table).
   */
  addToCart: (productId, name, quantity, totalPrice, extrasJson) => {
    try {
      db.runSync(
        'INSERT INTO cart_table (productId, name, quantity, totalPrice, extras) VALUES (?, ?, ?, ?, ?)',
        [productId, name, quantity, totalPrice, extrasJson]
      );
    } catch (e) {}
  },

  getCartItems: () => {
    try {
      return db.getAllSync('SELECT * FROM cart_table');
    } catch (e) { return []; }
  },

  getCartTotal: () => {
    try {
      const result = db.getFirstSync('SELECT SUM(totalPrice) as grandTotal FROM cart_table');
      return result ? (result.grandTotal || 0) : 0;
    } catch (e) { return 0; }
  },

  removeFromCart: (id) => {
    try {
      db.runSync('DELETE FROM cart_table WHERE id = ?', [id]);
    } catch (e) {}
  },

  clearCart: () => {
    try {
      db.runSync('DELETE FROM cart_table');
    } catch (e) {}
  },

  /**
   * Gestion des commandes (orders).
   */
  getOrders: () => {
    try {
      return db.getAllSync('SELECT * FROM orders ORDER BY id DESC');
    } catch (e) { return []; }
  },

  getSales: () => {
    try {
      return db.getAllSync('SELECT * FROM orders ORDER BY id DESC');
    } catch (e) { return []; }
  },

  insertOrder: (itemsJson, total, date, time) => {
    try {
      db.runSync('INSERT INTO orders (items, total, date, time) VALUES (?, ?, ?, ?)', [itemsJson, total, date, time]);
    } catch (e) {}
  }
};

// Exportation nommée
export { Database };
