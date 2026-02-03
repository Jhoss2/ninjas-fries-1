const SQLite = require('expo-sqlite');

let db = null;

const Database = {
  init: () => {
    try {
      db = SQLite.openDatabase('ninja_fries.db');
      
      if (!db) {
        console.error('Impossible d\'ouvrir la base de données');
        return false;
      }

      db.transaction(tx => {
        // Table des produits
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            price INTEGER DEFAULT 0,
            image TEXT,
            type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );`,
          [],
          () => console.log('Table products créée'),
          (_, error) => console.error('Erreur création table products:', error)
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
          );`,
          [],
          () => console.log('Table cart créée'),
          (_, error) => console.error('Erreur création table cart:', error)
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
          );`,
          [],
          () => console.log('Table orders créée'),
          (_, error) => console.error('Erreur création table orders:', error)
        );

        // Table des paramètres
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
          );`,
          [],
          () => console.log('Table settings créée'),
          (_, error) => console.error('Erreur création table settings:', error)
        );
      });

      return true;
    } catch (error) {
      console.error('Erreur initialisation DB:', error);
      return false;
    }
  },

  // Produits
  saveProduct: (name, price, image, type) => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO products (name, price, image, type) VALUES (?, ?, ?, ?)',
          [name, price || 0, image || '', type || 'plat'],
          () => console.log('Produit sauvegardé'),
          (_, error) => console.error('Erreur saveProduct:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur saveProduct:', error);
      return false;
    }
  },

  getProducts: (type) => {
    if (!db) return [];
    let result = [];
    try {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM products WHERE type = ? ORDER BY created_at DESC',
          [type || 'plat'],
          (_, { rows }) => {
            result = rows._array || [];
          },
          (_, error) => {
            console.error('Erreur getProducts:', error);
            result = [];
          }
        );
      });
    } catch (error) {
      console.error('Erreur getProducts:', error);
      result = [];
    }
    return result;
  },

  updateProduct: (id, name, price, image) => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'UPDATE products SET name = ?, price = ?, image = ? WHERE id = ?',
          [name || '', price || 0, image || '', id],
          () => console.log('Produit mis à jour'),
          (_, error) => console.error('Erreur updateProduct:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur updateProduct:', error);
      return false;
    }
  },

  deleteProduct: (id) => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM products WHERE id = ?',
          [id],
          () => console.log('Produit supprimé'),
          (_, error) => console.error('Erreur deleteProduct:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur deleteProduct:', error);
      return false;
    }
  },

  // Panier
  addToCart: (productId, name, quantity, totalPrice, extras) => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO cart (product_id, name, quantity, totalPrice, extras) VALUES (?, ?, ?, ?, ?)',
          [productId || 0, name || '', quantity || 1, totalPrice || 0, extras || '{}'],
          () => console.log('Article ajouté au panier'),
          (_, error) => console.error('Erreur addToCart:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur addToCart:', error);
      return false;
    }
  },

  getCartItems: () => {
    if (!db) return [];
    let result = [];
    try {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM cart ORDER BY added_at DESC',
          [],
          (_, { rows }) => {
            result = rows._array || [];
          },
          (_, error) => {
            console.error('Erreur getCartItems:', error);
            result = [];
          }
        );
      });
    } catch (error) {
      console.error('Erreur getCartItems:', error);
      result = [];
    }
    return result;
  },

  getCartTotal: () => {
    if (!db) return 0;
    let total = 0;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT SUM(totalPrice) as total FROM cart',
          [],
          (_, { rows }) => {
            total = rows._array[0]?.total || 0;
          },
          (_, error) => {
            console.error('Erreur getCartTotal:', error);
            total = 0;
          }
        );
      });
    } catch (error) {
      console.error('Erreur getCartTotal:', error);
      total = 0;
    }
    return total;
  },

  removeFromCart: (id) => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM cart WHERE id = ?',
          [id],
          () => console.log('Article supprimé du panier'),
          (_, error) => console.error('Erreur removeFromCart:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur removeFromCart:', error);
      return false;
    }
  },

  clearCart: () => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM cart',
          [],
          () => console.log('Panier vidé'),
          (_, error) => console.error('Erreur clearCart:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur clearCart:', error);
      return false;
    }
  },

  // Commandes
  insertOrder: (items, total, date, time) => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO orders (items, total, date, time) VALUES (?, ?, ?, ?)',
          [items || '[]', total || 0, date || '', time || ''],
          () => console.log('Commande enregistrée'),
          (_, error) => console.error('Erreur insertOrder:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur insertOrder:', error);
      return false;
    }
  },

  getOrders: () => {
    if (!db) return [];
    let result = [];
    try {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM orders ORDER BY created_at DESC',
          [],
          (_, { rows }) => {
            result = rows._array || [];
          },
          (_, error) => {
            console.error('Erreur getOrders:', error);
            result = [];
          }
        );
      });
    } catch (error) {
      console.error('Erreur getOrders:', error);
      result = [];
    }
    return result;
  },

  getSales: () => {
    if (!db) return [];
    let result = [];
    try {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100',
          [],
          (_, { rows }) => {
            result = rows._array || [];
          },
          (_, error) => {
            console.error('Erreur getSales:', error);
            result = [];
          }
        );
      });
    } catch (error) {
      console.error('Erreur getSales:', error);
      result = [];
    }
    return result;
  },

  // Paramètres
  saveSetting: (key, value) => {
    if (!db) return false;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key || '', value || ''],
          () => console.log('Paramètre sauvegardé'),
          (_, error) => console.error('Erreur saveSetting:', error)
        );
      });
      return true;
    } catch (error) {
      console.error('Erreur saveSetting:', error);
      return false;
    }
  },

  getSetting: (key) => {
    if (!db) return null;
    let value = null;
    try {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT value FROM settings WHERE key = ?',
          [key || ''],
          (_, { rows }) => {
            value = rows._array[0]?.value || null;
          },
          (_, error) => {
            console.error('Erreur getSetting:', error);
            value = null;
          }
        );
      });
    } catch (error) {
      console.error('Erreur getSetting:', error);
      value = null;
    }
    return value;
  }
};

module.exports = { Database };
