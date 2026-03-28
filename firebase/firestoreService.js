/**
 * FIRESTORE SERVICE — NINJA'S FRIES
 * Toutes les opérations cloud sont ici.
 * Les écrans n'appellent jamais Firestore directement.
 */

const {
  collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, query, orderBy, serverTimestamp,
  onSnapshot, updateDoc,
} = require('firebase/firestore');

const { db } = require('./firebaseConfig');

/**
 * ─── STRUCTURE FIRESTORE ───────────────────────────────────
 * carts/{cartId}/
 *   ├── info          (doc)  → nom, mot de passe, background, cartId
 *   ├── orders/       (col)  → une commande par doc
 *   └── settings/     (col)  → clé/valeur (logo, qr, etc.)
 * ───────────────────────────────────────────────────────────
 */

const FirestoreService = {

  /* ═══════════════════════════════════════════
     CART INFO (identité du food cart)
  ═══════════════════════════════════════════ */

  /**
   * Initialise le document du cart dans Firestore si inexistant.
   */
  initCart: async (cartId, cartName = '') => {
    try {
      const ref = doc(db, 'carts', cartId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          cartId,
          cartName: cartName || cartId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('[Firestore] initCart échoué (mode offline ?):', e.message);
    }
  },

  /**
   * Met à jour les infos du cart (nom, background, etc.)
   */
  updateCartInfo: async (cartId, data) => {
    try {
      const ref = doc(db, 'carts', cartId);
      await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn('[Firestore] updateCartInfo échoué:', e.message);
    }
  },

  /* ═══════════════════════════════════════════
     SETTINGS (logo, qr, password, background)
  ═══════════════════════════════════════════ */

  saveSetting: async (cartId, key, value) => {
    try {
      const ref = doc(db, 'carts', cartId, 'settings', key);
      await setDoc(ref, { key, value, updatedAt: serverTimestamp() });
    } catch (e) {
      console.warn('[Firestore] saveSetting échoué:', e.message);
    }
  },

  getSetting: async (cartId, key) => {
    try {
      const ref = doc(db, 'carts', cartId, 'settings', key);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data().value : null;
    } catch (e) {
      console.warn('[Firestore] getSetting échoué:', e.message);
      return null;
    }
  },

  /* ═══════════════════════════════════════════
     COMMANDES
  ═══════════════════════════════════════════ */

  /**
   * Insère une commande dans Firestore.
   * @param {string} cartId
   * @param {object} order - { id, items (JSON), total, date, time }
   */
  insertOrder: async (cartId, order) => {
    try {
      const ref = doc(db, 'carts', cartId, 'orders', String(order.id));
      await setDoc(ref, {
        ...order,
        synced: true,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[Firestore] insertOrder échoué:', e.message);
    }
  },

  /**
   * Supprime une commande dans Firestore.
   */
  deleteOrder: async (cartId, orderId) => {
    try {
      const ref = doc(db, 'carts', cartId, 'orders', String(orderId));
      await deleteDoc(ref);
    } catch (e) {
      console.warn('[Firestore] deleteOrder échoué:', e.message);
    }
  },

  /**
   * Récupère toutes les commandes d'un cart (pour l'app Proprio).
   */
  getOrders: async (cartId) => {
    try {
      const ref = collection(db, 'carts', cartId, 'orders');
      const q = query(ref, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[Firestore] getOrders échoué:', e.message);
      return [];
    }
  },

  /**
   * Écoute en temps réel les nouvelles commandes (pour l'app Proprio).
   * Retourne une fonction unsubscribe.
   */
  listenOrders: (cartId, onData) => {
    try {
      const ref = collection(db, 'carts', cartId, 'orders');
      const q = query(ref, orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snap) => {
        const orders = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        onData(orders);
      });
    } catch (e) {
      console.warn('[Firestore] listenOrders échoué:', e.message);
      return () => {};
    }
  },
};

module.exports = { FirestoreService };
