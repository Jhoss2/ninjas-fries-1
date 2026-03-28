/**
 * CONFIGURATION FIREBASE — NINJA'S FRIES
 * ─────────────────────────────────────────────────────────
 * 1. Va sur https://console.firebase.google.com
 * 2. Crée un projet "ninjas-fries"
 * 3. Ajoute une app Web (</>) dans les paramètres du projet
 * 4. Copie les valeurs ci-dessous depuis "firebaseConfig"
 * 5. Dans Firebase Console → Firestore Database → Créer une base (mode test)
 * 6. Dans Firebase Console → Storage → Commencer
 * ─────────────────────────────────────────────────────────
 */

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const { getStorage } = require('firebase/storage');

const firebaseConfig = {
  apiKey:            "REMPLACE_PAR_TON_API_KEY",
  authDomain:        "REMPLACE_PAR_TON_AUTH_DOMAIN",
  projectId:         "REMPLACE_PAR_TON_PROJECT_ID",
  storageBucket:     "REMPLACE_PAR_TON_STORAGE_BUCKET",
  messagingSenderId: "REMPLACE_PAR_TON_MESSAGING_SENDER_ID",
  appId:             "REMPLACE_PAR_TON_APP_ID",
};

// Évite de réinitialiser si déjà fait (hot reload Expo)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db      = getFirestore(app);
const storage = getStorage(app);

module.exports = { app, db, storage };
