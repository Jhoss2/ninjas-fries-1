const React = require('react');
const { useState, useEffect, useRef, useCallback, memo } = React;
const {
  View, Text, Pressable, TextInput, ImageBackground,
  Modal, StyleSheet, SafeAreaView, Animated,
} = require('react-native');

const ImagePicker = require('expo-image-picker');
const FileSystem  = require('expo-file-system');

const { Database }          = require('./Database');
const { FirestoreService }  = require('./firebase/firestoreService');
const { exportOrdersToCSV } = require('./utils/export');
const { IconLock, IconCheck } = require('./components/Icons');
const { SCREEN_WIDTH }      = require('./constants');

const SplashScreen    = require('./screens/SplashScreen');
const MenuScreen      = require('./screens/MenuScreen');
const CheckoutScreen  = require('./screens/CheckoutScreen');
const AdminPanel      = require('./screens/AdminPanel');

/* ═══════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   MODAL MOT DE PASSE — composant mémorisé
   Isolé pour éviter le re-render du TextInput
   qui fait perdre le focus du clavier Android
═══════════════════════════════════════════ */
const PasswordModal = memo(({ visible, onClose, onConfirm }) => {
  const [input, setInput] = React.useState('');

  const handleClose = useCallback(() => {
    setInput('');
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm(input);
    setInput('');
  }, [input, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={passStyles.overlay}>
        <View style={passStyles.box}>
          <IconLock />
          <TextInput
            secureTextEntry
            style={passStyles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Code Corporation"
            placeholderTextColor="#777"
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <View style={passStyles.actions}>
            <Pressable style={passStyles.cancelBtn} onPress={handleClose}>
              <Text style={{ color: 'white', fontWeight: '700' }}>ANNULER</Text>
            </Pressable>
            <Pressable style={passStyles.confirmBtn} onPress={handleConfirm}>
              <Text style={{ color: 'black', fontWeight: '700' }}>ENTRER</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const passStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  box:     { width: '85%', backgroundColor: '#18181b', padding: 30, borderRadius: 30, borderWidth: 1, borderColor: '#27272a', alignItems: 'center' },
  input:   { backgroundColor: '#000', color: '#f97316', padding: 20, borderRadius: 15, fontSize: 24, textAlign: 'center', marginVertical: 20, fontWeight: '900', width: '100%' },
  actions: { flexDirection: 'row', gap: 15 },
  cancelBtn: { flex: 1, backgroundColor: '#27272a', padding: 16, borderRadius: 25, alignItems: 'center' },
  confirmBtn: { flex: 1, backgroundColor: '#f97316', padding: 16, borderRadius: 25, alignItems: 'center' },
});

function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [view, setView]                   = useState('menu');
  const [config, setConfig]               = useState({ logoUrl: '', qrCodeUrl: '', backgroundUrl: '' });
  const [cartId, setCartId]               = useState(null);

  // Menu — états gérés localement dans MenuScreen

  // Données
  const [menuItems, setMenuItems]       = useState([]);
  const [sauces, setSauces]             = useState([]);
  const [garnitures, setGarnitures]     = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);

  // Admin
  const [orderSent, setOrderSent]           = useState(false);
  const [showPassModal, setShowPassModal]   = useState(false);
  const [passwordInput, setPasswordInput]   = useState('');
  const [activeForm, setActiveForm]         = useState(null);


  /* ── Splash : pas de timeout forcé, on laisse la vidéo se terminer ── */
  // Le fallback onError() dans SplashScreen gère les cas d'échec de lecture

  /* ── Init BDD + Firebase ── */
  useEffect(() => {
    const initApp = async () => {
      try {
        Database.init();

        // Lecture settings locaux
        const savedLogo       = Database.getSetting('logoUrl');
        const savedQr         = Database.getSetting('qrCodeUrl');
        const savedBackground = Database.getSetting('backgroundUrl');
        const savedCartId     = Database.getSetting('cartId');

        setConfig({
          logoUrl:       savedLogo       || '',
          qrCodeUrl:     savedQr         || '',
          backgroundUrl: savedBackground || '',
        });

        if (savedCartId) {
          setCartId(savedCartId);
          // Initialiser le cart dans Firestore si besoin
          await FirestoreService.initCart(savedCartId);
          // Re-syncer les commandes en attente
          await Database.retryPendingSync(savedCartId);
        }

        setMenuItems(Database.getProducts('plat')        || []);
        setSauces(Database.getProducts('sauce')          || []);
        setGarnitures(Database.getProducts('garniture')  || []);
        setOrderHistory(Database.getSales()              || []);
      } catch (e) {
        console.error("Erreur d'initialisation :", e);
      }
    };
    initApp();
  }, []);

  /* ── Helpers ── */
  const handleImageUpload = async (callback) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { alert('Permission nécessaire'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: false,   // On n'utilise PAS base64 → pas de conversion JPEG
      allowsEditing: false,
    });
    if (!result.canceled) {
      const asset    = result.assets[0];
      const srcUri   = asset.uri;

      // Détecter l'extension réelle du fichier
      const ext      = srcUri.split('.').pop().toLowerCase() || 'png';

      // Copier le fichier dans le répertoire permanent de l'app
      // → l'URI reste valide même après redémarrage
      const destUri  = FileSystem.documentDirectory
                     + 'img_' + Date.now() + '.' + ext;
      try {
        await FileSystem.copyAsync({ from: srcUri, to: destUri });
        callback(destUri);   // on passe l'URI locale directe
      } catch (e) {
        console.error('Erreur copie image:', e);
        // Fallback : utiliser l'URI originale
        callback(srcUri);
      }
    }
  };

  /* ── Accès admin — lit le mot de passe depuis la DB ── */
  const checkAdminAccess = () => {
    const storedPass = Database.getSetting('adminPassword') || "NINJA'S CORPORATION";
    if (passwordInput === storedPass) {
      setView('settings');
      setShowPassModal(false);
      setPasswordInput('');
    } else {
      console.warn('Mot de passe incorrect');
    }
  };

  /* ── Ajout au panier — reçoit extras et index depuis MenuScreen ── */
  const addToCart = (totalPrice, extras, itemIndex) => {
    const currentItem = menuItems.length > 0 ? menuItems[itemIndex] : null;
    if (!currentItem) return;
    const extrasObj = extras || { sauces: [], garnitures: [] };
    Database.addToCart(currentItem.id, currentItem.name, 1, totalPrice, JSON.stringify(extrasObj));
    setView('checkout');
  };

  /* ── Validation commande ── */
  const validateOrder = async () => {
    const cartItems = Database.getCartItems();
    if (cartItems.length === 0) return;
    const total = Database.getCartTotal();
    const date  = new Date().toLocaleDateString('fr-FR');
    const time  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    try {
      // insertOrder gère la sync Firestore en arrière-plan
      Database.insertOrder(JSON.stringify(cartItems), total, date, time, cartId);
      setOrderHistory(Database.getOrders());
      Database.clearCart();
      setOrderSent(true);
      setTimeout(() => { setOrderSent(false); setView('menu'); }, 3000);
    } catch (e) {
      console.error('Erreur commande:', e);
    }
  };

  /* ════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════ */
  if (splashVisible) {
    return <SplashScreen onFinish={() => setSplashVisible(false)} />;
  }

  // Wrapper : fond noir ou image de background
  const BackgroundWrapper = ({ children }) =>
    config.backgroundUrl ? (
      <ImageBackground source={{ uri: config.backgroundUrl }} style={styles.root} resizeMode="cover">
        {/* Couche sombre pour que le texte reste lisible */}
        <View style={styles.bgOverlay} />
        {children}
      </ImageBackground>
    ) : (
      <View style={styles.root}>{children}</View>
    );

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.safeArea}>

        <MenuScreen
          config={config}
          menuItems={menuItems}
          sauces={sauces}
          garnitures={garnitures}
          onAddToCart={addToCart}
          onAdminPress={() => setShowPassModal(true)}
        />

        {/* Checkout */}
        <Modal visible={view === 'checkout'} animationType="slide" transparent>
          <CheckoutScreen
            config={config}
            onConfirm={validateOrder}
            onClose={() => setView('menu')}
            onRemoveItem={() => {}}
          />
        </Modal>

        {/* Succès commande */}
        {orderSent && (
          <Pressable style={styles.successScreen} onPress={() => { setOrderSent(false); setView('menu'); }}>
            <View style={styles.successIconContainer}><IconCheck /></View>
            <Text style={styles.successTitle}>COMMANDE ENVOYÉE</Text>
            <Text style={styles.successSubtitle}>VEUILLEZ RETIRER VOTRE TICKET</Text>
          </Pressable>
        )}

        {/* Modal mot de passe — composant mémorisé pour stabilité clavier Android */}
        <PasswordModal
          visible={showPassModal}
          onClose={() => setShowPassModal(false)}
          onConfirm={(input) => {
            const storedPass = Database.getSetting('adminPassword') || "NINJA'S CORPORATION";
            if (input === storedPass) {
              setView('settings');
              setShowPassModal(false);
            }
          }}
        />

        {/* Panneau admin */}
        {view === 'settings' && (
          <AdminPanel
            config={config}
            setConfig={setConfig}
            menuItems={menuItems}
            setMenuItems={setMenuItems}
            sauces={sauces}
            setSauces={setSauces}
            garnitures={garnitures}
            setGarnitures={setGarnitures}
            activeForm={activeForm}
            setActiveForm={setActiveForm}
            setView={setView}
            orderHistory={orderHistory}
            setOrderHistory={setOrderHistory}
            handleExportCSV={exportOrdersToCSV}
            handleImageUpload={handleImageUpload}
            cartId={cartId}
            setCartId={setCartId}
          />
        )}

      </SafeAreaView>
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000000' },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  safeArea: { flex: 1 },
  successScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  successIconContainer: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  successTitle:    { fontSize: 32, fontWeight: '900', color: '#fff', fontStyle: 'italic' },
  successSubtitle: { fontSize: 14, fontWeight: '900', color: '#fff', marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  passBox:   { width: '85%', backgroundColor: '#18181b', padding: 30, borderRadius: 30, borderWidth: 1, borderColor: '#27272a', alignItems: 'center' },
  passInput: { backgroundColor: '#000', color: '#f97316', padding: 20, borderRadius: 15, fontSize: 24, textAlign: 'center', marginVertical: 20, fontWeight: '900', width: '100%' },
  passActions: { flexDirection: 'row', gap: 15 },
  cancelBtn: { flex: 1, backgroundColor: '#27272a', padding: 16, borderRadius: 25, alignItems: 'center' },
  confirmBtn: { flex: 1, backgroundColor: '#f97316', padding: 16, borderRadius: 25, alignItems: 'center' },
});

module.exports = App;
    
