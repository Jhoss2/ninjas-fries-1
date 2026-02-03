const SQLite = require('expo-sqlite');

const db = SQLite.openDatabase('ninja_fries.db');

const Database = {
  init: () => {
    db.transaction(tx => {
      // Table des produits (plats, sauces, garnitures)
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER DEFAULT 0,
          image TEXT,
          type TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
      );

      // Table du panier
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS cart (
          id INTEGER PRIMARY KEY,
          product_id INTEGER,
          name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          totalPrice INTEGER NOT NULL,
          extras TEXT,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
      );

      // Table des commandes
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY,
          items TEXT NOT NULL,
          total INTEGER NOT NULL,
          date TEXT,
          time TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
      );

      // Table des paramètres
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );`
      );
    });
  },

  // Produits
  saveProduct: (name, price, image, type) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO products (name, price, image, type) VALUES (?, ?, ?, ?)',
          [name, price, image, type],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  getProducts: (type) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM products WHERE type = ? ORDER BY created_at DESC',
          [type],
          (_, { rows }) => resolve(rows._array),
          (_, error) => reject(error)
        );
      });
    });
  },

  updateProduct: (id, name, price, image) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'UPDATE products SET name = ?, price = ?, image = ? WHERE id = ?',
          [name, price, image, id],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  deleteProduct: (id) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM products WHERE id = ?',
          [id],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  // Panier
  addToCart: (productId, name, quantity, totalPrice, extras) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO cart (product_id, name, quantity, totalPrice, extras) VALUES (?, ?, ?, ?, ?)',
          [productId, name, quantity, totalPrice, extras],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  getCartItems: () => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM cart ORDER BY added_at DESC',
          [],
          (_, { rows }) => resolve(rows._array),
          (_, error) => reject(error)
        );
      });
    });
  },

  getCartTotal: () => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT SUM(totalPrice) as total FROM cart',
          [],
          (_, { rows }) => {
            const total = rows._array[0]?.total || 0;
            resolve(total);
          },
          (_, error) => reject(error)
        );
      });
    });
  },

  removeFromCart: (id) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM cart WHERE id = ?',
          [id],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  clearCart: () => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM cart',
          [],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  // Commandes
  insertOrder: (items, total, date, time) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO orders (items, total, date, time) VALUES (?, ?, ?, ?)',
          [items, total, date, time],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  getOrders: () => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM orders ORDER BY created_at DESC',
          [],
          (_, { rows }) => resolve(rows._array),
          (_, error) => reject(error)
        );
      });
    });
  },

  getSales: () => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100',
          [],
          (_, { rows }) => resolve(rows._array),
          (_, error) => reject(error)
        );
      });
    });
  },

  // Paramètres
  saveSetting: (key, value) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, value],
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      });
    });
  },

  getSetting: (key) => {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT value FROM settings WHERE key = ?',
          [key],
          (_, { rows }) => {
            const value = rows._array[0]?.value || null;
            resolve(value);
          },
          (_, error) => reject(error)
        );
      });
    });
  }
};

module.exports = { Database };
