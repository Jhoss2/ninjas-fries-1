const React = require('react');
const { useState, useEffect, useRef } = React;
const {
  View, Text, Pressable, TextInput, ImageBackground,
  Modal, StyleSheet, SafeAreaView, Animated,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} = require('react-native');

const ImagePicker = require('expo-image-picker');

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
function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [view, setView]                   = useState('menu');
  const [config, setConfig]               = useState({ logoUrl: '', qrCodeUrl: '', backgroundUrl: '' });
  const [cartId, setCartId]               = useState(null);

  // Menu
  const [currentIndex, setCurrentIndex]         = useState(0);
  const [quantity, setQuantity]                 = useState(1);
  const [showSaucePicker, setShowSaucePicker]   = useState(false);
  const [showGarniturePicker, setShowGarniturePicker] = useState(false);
  const [selectedExtras, setSelectedExtras]     = useState({ sauces: [], garnitures: [] });

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

  const scrollX = useRef(new Animated.Value(0)).current;

  /* ── Splash timeout de secours ── */
  useEffect(() => {
    const t = setTimeout(() => { if (splashVisible) setSplashVisible(false); }, 1500);
    return () => clearTimeout(t);
  }, [splashVisible]);

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
  const resetControls = () => {
    setQuantity(1);
    setSelectedExtras({ sauces: [], garnitures: [] });
    setShowSaucePicker(false);
    setShowGarniturePicker(false);
  };

  const handleImageUpload = async (callback) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { alert('Permission nécessaire'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) callback(`data:image/jpeg;base64,${result.assets[0].base64}`);
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

  /* ── Ajout au panier ── */
  const addToCart = (totalPrice) => {
    const currentItem = menuItems.length > 0 ? menuItems[currentIndex] : null;
    if (!currentItem) return;
    Database.addToCart(currentItem.id, currentItem.name, quantity, totalPrice, JSON.stringify(selectedExtras));
    setView('checkout');
    resetControls();
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
      resetControls();
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
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          quantity={quantity}
          setQuantity={setQuantity}
          showSaucePicker={showSaucePicker}
          setShowSaucePicker={setShowSaucePicker}
          showGarniturePicker={showGarniturePicker}
          setShowGarniturePicker={setShowGarniturePicker}
          selectedExtras={selectedExtras}
          setSelectedExtras={setSelectedExtras}
          scrollX={scrollX}
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

        {/* Modal mot de passe — clavier stable */}
        <Modal
          visible={showPassModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPassModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalOverlay}>
                <Pressable
                  style={styles.passBox}
                  onPress={() => {}}
                >
                  <IconLock />
                  <TextInput
                    secureTextEntry
                    style={styles.passInput}
                    value={passwordInput}
                    onChangeText={setPasswordInput}
                    placeholder="Code Corporation"
                    placeholderTextColor="#777"
                    returnKeyType="done"
                    onSubmitEditing={checkAdminAccess}
                    autoFocus={false}
                    blurOnSubmit={false}
                  />
                  <View style={styles.passActions}>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowPassModal(false);
                        setPasswordInput('');
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700' }}>ANNULER</Text>
                    </Pressable>
                    <Pressable style={styles.confirmBtn} onPress={checkAdminAccess}>
                      <Text style={{ color: 'black', fontWeight: '700' }}>ENTRER</Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>

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
