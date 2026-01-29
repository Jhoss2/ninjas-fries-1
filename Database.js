import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

// Ouverture de la connexion physique (Fichier ninjas_fries.db)
const db = SQLite.openDatabaseSync('ninjas_fries.db');

export const Database = {
  // 1. INITIALISATION DES TABLES
  init: () => {
    db.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, 
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT NOT NULL, 
        type TEXT NOT NULL, 
        image_uri TEXT
      );
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        total REAL, 
        details TEXT, 
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  // 2. GESTION DES PARAMÈTRES (Logo, Couleur)
  saveSetting: (key, value) => {
    db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  getSetting: (key) => {
    const result = db.getFirstSync('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
  },

  // 3. LOGIQUE COHÉRENTE DE LA COULEUR DU JOUR
  // (Change seulement si on change de date)
  getDailyColor: () => {
    const today = new Date().toDateString();
    const lastDate = Database.getSetting('last_color_date');
    const currentColor = Database.getSetting('daily_color');

    if (lastDate !== today || !currentColor) {
      // Génère une nouvelle couleur aléatoire
      const newColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
      Database.saveSetting('daily_color', newColor);
      Database.saveSetting('last_color_date', today);
      return newColor;
    }
    return currentColor;
  },

  // 4. SAUVEGARDE PRODUIT (SAUCE/GARNITURE) AVEC IMAGE PHYSIQUE
  saveProduct: async (name, type, tempUri) => {
    try {
      let finalPath = null;
      if (tempUri) {
        // On extrait l'extension et on crée un nom unique
        const extension = tempUri.split('.').pop();
        const fileName = `img_${type}_${Date.now()}.${extension}`;
        finalPath = `${FileSystem.documentDirectory}${fileName}`;
        
        // COPIE PHYSIQUE : L'image ne dépend plus du cache temporaire
        await FileSystem.copyAsync({ from: tempUri, to: finalPath });
      }

      db.runSync(
        'INSERT INTO products (name, type, image_uri) VALUES (?, ?, ?)',
        [name, type, finalPath]
      );
      return true;
    } catch (e) {
      console.error("Erreur SQL lors de l'ajout produit:", e);
      return false;
    }
  },

  // 5. RÉCUPÉRATION DES PRODUITS
  getProducts: (type) => {
    // type doit être 'sauce' ou 'garniture'
    return db.getAllSync('SELECT * FROM products WHERE type = ?', [type]);
  },

  // 6. HISTORIQUE DES VENTES
  saveSale: (total, items) => {
    db.runSync(
      'INSERT INTO sales (total, details) VALUES (?, ?)',
      [total, JSON.stringify(items)]
    );
  },

  getSales: () => {
    return db.getAllSync('SELECT * FROM sales ORDER BY date DESC');
  },

  // 7. SUPPRESSION (Optionnel - pour la maintenance)
  deleteProduct: (id) => {
    db.runSync('DELETE FROM products WHERE id = ?', [id]);
  }
};
