const SQLite = require('expo-sqlite');

const db = SQLite.openDatabaseSync('ninjas_fries.db');

const Base de données = {
  /**
   * Initialiser les tables de la base de données si elles n'existent pas.
   */
  init: () => {
    db.execSync(`
      CRÉER UNE TABLE SI ELLE N'EXISTE PAS produits (
        id CLÉ PRIMAIRE ENTIÈRE À INCRÉDIT AUTOMATIQUE,
        nom TEXTE NON NUL,
        prix ENTIER NON NUL,
        image TEXTE,
        type TEXTE NON NUL
      );
      CRÉER UNE TABLE SI ELLE N'EXISTE PAS paramètres (
        clé TEXTE CLÉ PRIMAIRE,
        valeur TEXTE
      );
      CRÉER LA TABLE SI ELLE N'EXISTE PAS commandes (
        id CLÉ PRIMAIRE ENTIÈRE À INCRÉDIT AUTOMATIQUE,
        date TEXTE NON NUL,
        heure TEXTE NON NUL,
        éléments TEXTE NON NUL,
        total ENTIER NON NUL
      );
      CRÉER LA TABLE SI ELLE N'EXISTE PAS cart_table (
        id CLÉ PRIMAIRE ENTIÈRE À INCRÉDIT AUTOMATIQUE,
        productId ENTIER,
        nom TEXTE NON NUL,
        quantité ENTIER NON NUL,
        totalPrice ENTIER NON NUL,
        texte supplémentaire
      );
    `);
  },

  /**
   * Gestion de la couleur du jour.
   */
  obtenirCouleurDuJour : () => {
    const aujourd'hui = new Date().toLocaleDateString('fr-FR');
    const result = db.getFirstSync('SELECT value FROM settings WHERE key = ?', [`color_${today}`]);
    
    si (résultat) {
      renvoyer result.value;
    } autre {
      const couleurs = [
        '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
        '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
        '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#fb7185',
        '#fb923c','#fbbf24','#a3e635','#4ade80','#34d399','#2dd4bf',
        '#22d3ee','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc'
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`color_${today}`, randomColor]);
      renvoyer une couleur aléatoire ;
    }
  },

  /**
   * Gestion des paramètres.
   */
  obtenirSetting: (clé) => {
    const result = db.getFirstSync('SELECT value FROM settings WHERE key = ?', [key]);
    retourner le résultat ? résultat.value : null;
  },

  saveSetting: (clé, valeur) => {
    db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  /**
   * Gestion des produits.
   */
  getProducts: (type) => {
    return db.getAllSync('SELECT * FROM products WHERE type = ?', [type]);
  },

  enregistrerProduit: (nom, prix, image, type) => {
    db.runSync('INSERT INTO products (name, price, image, type) VALUES (?, ?, ?, ?)', [name, price, image, type]);
  },

  mettre à jour le produit : (id, nom, prix, image) => {
    db.runSync('UPDATE products SET name = ?, price = ?, image = ? WHERE id = ?', [name, price, image, id]);
  },

  supprimerProduit : (id) => {
    db.runSync('SUPPRIMER DE produits OÙ id = ?', [id]);
  },

  /**
   * Gestion du PANIER (cart_table) - Requis par le nouveau guide.
   */
  ajouterAuPanier: (productId, nom, quantité, prixTotal, extrasJson) => {
    db.runSync(
      'INSERT INTO cart_table (productId, name, quantity, totalPrice, extras) VALUES (?, ?, ?, ?, ?)',
      [productId, nom, quantité, prix total, extrasJson]
    );
  },

  getCartItems: () => {
    retourner db.getAllSync('SELECT * FROM cart_table');
  },

  obtenirTotalDuPanier: () => {
    const result = db.getFirstSync('SELECT SUM(totalPrice) as grandTotal FROM cart_table');
    retourner le résultat ? résultat.grandTotal || 0 : 0 ;
  },

  supprimerDuPanier : (id) => {
    db.runSync('SUPPRIMER DE LA TABLE cart_table OÙ id = ?', [id]);
  },

  effacerPanier: () => {
    db.runSync('SUPPRIMER DE cart_table');
  },

  /**
   * Gestion des commandes.
   */
  obtenirCommandes: () => {
    return db.getAllSync('SELECT * FROM orders ORDER BY id DESC');
  },

  obtenirVentes: () => {
    return db.getAllSync('SELECT * FROM orders ORDER BY id DESC');
  },

  insérerOrder: (itemsJson, total, date, heure) => {
    db.runSync('INSERT INTO orders (items, total, date, time) VALUES (?, ?, ?, ?)', [itemsJson, total, date, time]);
  }
};

module.exports = { Base de données };
