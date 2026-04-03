const { initializeApp, getApps } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const { getDatabase }  = require('firebase/database');

const firebaseConfig = {
  apiKey:            "AIzaSyDJS5sgI7rFyAQAOZNgJsZ1nkWwjFI-cDE",
  authDomain:        "ninja-s-fries.firebaseapp.com",
  projectId:         "ninja-s-fries",
  storageBucket:     "ninja-s-fries.firebasestorage.app",
  messagingSenderId: "187217291987",
  appId:             "1:187217291987:web:f15c681cb2db7a1af28226",
  measurementId:     "G-6RZ70ZWBPN",
  databaseURL:       "https://ninja-s-fries-default-rtdb.firebaseio.com",
};

// Évite de réinitialiser si déjà fait (hot reload Expo)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db   = getFirestore(app);
const rtdb = getDatabase(app);  // Realtime DB pour signalisation WebRTC

// Storage désactivé (forfait Blaze requis) — sera activé à la phase caméras
// const storage = getStorage(app);

module.exports = { app, db, rtdb };
