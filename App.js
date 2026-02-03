const React = require('react');
const { useState, useEffect, useRef } = React;
const {
  View, Text, Image, Pressable, TextInput, ScrollView,
  Modal, StyleSheet, Platform, useWindowDimensions, Alert,
  Animated, SafeAreaView, Dimensions
} = require('react-native');
const Svg = require('react-native-svg').default;
const { Line, Polyline, Rect, Path, Circle } = require('react-native-svg');
const ImagePicker = require('expo-image-picker');
const { BleManager } = require('react-native-ble-plx');
const FileSystem = require('expo-file-system');
const Sharing = require('expo-sharing');
const { Buffer } = require('buffer');
const { Video, ResizeMode } = require('expo-av');
const { BlurView } = require('expo-blur');

// IMPORT UNIQUE POUR LA PERSISTANCE
const { Database } = require('./Database');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/* ===================== CONSTANTES ===================== */
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

// --- CONFIGURATION GÉOMÉTRIQUE AJUSTÉE (PRODUIT AGRANDI) ---
// On augmente la largeur de base de la carte (0.55) pour l'effet Vanta Black
const CARD_WIDTH = SCREEN_WIDTH * 0.55; 
const SPACING = 0;
const ITEM_SIZE = CARD_WIDTH + SPACING;
// -----------------------------------------------------------

const DAILY_COLORS = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
  '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
  '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#fb7185',
  '#fb923c','#fbbf24','#a3e635','#4ade80','#34d399','#2dd4bf',
  '#22d3ee','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc'
];

/*  ICÔNES ===================== */
const IconPlus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Line x1="12" y1="5" x2="12" y2="19" stroke="white" strokeWidth="3" />
    <Line x1="5" y1="12" x2="19" y2="12" stroke="white" strokeWidth="3" />
  </Svg>
);

const IconX = ({ size = 20, color = "white" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth="2.5" />
    <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth="2.5" />
  </Svg>
);

const IconCamera = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path
      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8 a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
      stroke="white"
      strokeWidth="2"
      fill="none"
    />
    <Circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2" />
  </Svg>
);

const IconChevronLeft = ({ size = 24, color = "white" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Polyline points="15 18 9 12 15 6" stroke={color} strokeWidth="2.5" fill="none"/>
  </Svg>
);

const IconChevronRight = ({ size = 24, color = "white" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth="2.5" fill="none"/>
  </Svg>
);

const IconLock = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24">
    <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="white" strokeWidth="2" fill="none"/>
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" fill="none"/>
  </Svg>
);

const IconCheck = () => (
  <Svg width={80} height={80} viewBox="0 0 24 24">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="white" strokeWidth="2" fill="none"/>
    <Polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none"/>
  </Svg>
);

/* ===================== MODULES UTILITAIRES ===================== */
const bleManager = new BleManager();

const buildEscPosTicket = (order) => {
  let ticket = '';
  ticket += '\x1B\x40'; // init
  ticket += '\x1B\x61\x01'; // center
  ticket += "NINJA'S FRIES\n\n";
  ticket += '\x1B\x61\x00'; // left
  order.items.forEach(item => {
    ticket += `${item.quantity}x ${item.name.toUpperCase()}\n`;
    const extras = item.extras || {};
    const sauces = Array.isArray(extras.sauces) ? extras.sauces : [];
    const garnitures = Array.isArray(extras.garnitures) ? extras.garnitures : [];
    sauces.forEach(s => {
      if (s?.name) ticket += ` - Sauce: ${s.name.toUpperCase()}\n`;
    });
    garnitures.forEach(g => {
      if (g?.name) ticket += ` - Garniture: ${g.name.toUpperCase()}\n`;
    });
  });
  ticket += '\n--------------------------\n';
  ticket += `TOTAL: ${order.total} FCFA\n\n`;
  ticket += '\x1D\x56\x00'; // cut
  return ticket;
};

const exportOrdersToCSV = async (orderHistory) => {
  let csv = 'Date;Heure;Articles;Total\n';
  orderHistory.forEach(o => {
    const items = o.items.map(i => `${i.quantity}x ${i.name}`).join(' | ');
    csv += `${o.date};${o.time};${items};${o.total}\n`;
  });
  const fileUri = FileSystem.documentDirectory + `historique_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(fileUri);
};

/* ===================== COMPOSANT CHECKOUT (SQLITE) ===================== */
const CheckoutScreen = ({ config, onConfirm, onClose, onRemoveItem }) => {
  const [cartItems, setCartItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    refreshCart();
  }, []);

  const refreshCart = () => {
    try {
      const items = Database.getCartItems();
      const total = Database.getCartTotal(); 
      setCartItems(items || []);
      setTotalAmount(total || 0);
    } catch (e) {
      console.error("Erreur refreshCart SQL:", e);
    }
  };

  const handleRemove = (id) => {
    Database.removeFromCart(id);
    refreshCart();
    onRemoveItem(id);
  };

  return (
    <View style={styles.overlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.container}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <IconX size={24} color="white" />
        </Pressable>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <Text style={styles.checkoutTitleText}>VÉRIFIEZ VOTRE COMMANDE</Text>
            <View style={styles.headerSeparator} />
          </View>

          <View style={styles.itemsList}>
            {cartItems.map((item, index) => {
              const extras = JSON.parse(item.extras || '{}');
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemMainLine}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemNameContainer}>
                        <Text style={styles.orangeText}>{item.quantity}X </Text>
                        <Text style={styles.whiteText}>{item.name.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.itemPrice}>{item.totalPrice} F</Text>
                    </View>
                    <Pressable style={styles.removeRowButton} onPress={() => handleRemove(item.id)}>
                      <IconX size={14} color="white" />
                    </Pressable>
                  </View>
                  <View style={styles.extrasContainer}>
                    {extras.sauces?.length > 0 && (
                      <Text style={styles.extraDetailText}>
                        SAUCES: <Text style={styles.orangeExtraValue}>{extras.sauces.map(s => s.name.toUpperCase()).join(', ')}</Text>
                      </Text>
                    )}
                    {extras.garnitures?.length > 0 && (
                      <Text style={styles.extraDetailText}>
                        GARNITURES: <Text style={styles.orangeExtraValue}>{extras.garnitures.map(g => g.name.toUpperCase()).join(', ')}</Text>
                      </Text>
                    )}
                  </View>
                  {index < cartItems.length - 1 && <View style={styles.separator} />}
                </View>
              );
            })}
          </View>

          <View style={styles.whiteCard}>
            <View style={styles.qrWrapper}>
              {config.qrCodeUrl ? (
                <Image source={{ uri: config.qrCodeUrl }} style={styles.qrImage} resizeMode="contain" />
              ) : (
                <Text style={{color: '#ccc', fontSize: 12}}>QR CODE</Text>
              )}
            </View>
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
              <Text style={styles.totalValue}>{totalAmount} FCFA</Text>
            </View>
          </View>

          <Pressable style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.confirmButtonText}>VALIDER LA COMMANDE</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

/* ===================== COMPOSANT PRINCIPAL (APP) ===================== */
function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [view, setView] = useState('menu');
  const [config, setConfig] = useState({ logoUrl: '', qrCodeUrl: '' });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showSaucePicker, setShowSaucePicker] = useState(false);
  const [showGarniturePicker, setShowGarniturePicker] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [garnitures, setGarnitures] = useState([]);
  const [selectedExtras, setSelectedExtras] = useState({ sauces: [], garnitures: [] });
  const [orderHistory, setOrderHistory] = useState([]);
  const [activeForm, setActiveForm] = useState(null);

  const scrollX = useRef(new Animated.Value(0)).current;

  // 1. SPLASH SCREEN ÉCLAIR : Timeout de secours (1.5s)
  useEffect(() => {
    const splashTimeout = setTimeout(() => {
      if (splashVisible) {
        setSplashVisible(false);
      }
    }, 1500); 
    return () => clearTimeout(splashTimeout);
  }, [splashVisible]);

  // 2. INITIALISATION SQLITE SÉCURISÉE
  useEffect(() => {
    const initApp = async () => {
      try {
        Database.init();
        const savedLogo = Database.getSetting('logoUrl');
        const savedQr = Database.getSetting('qrCodeUrl');
        setConfig({ logoUrl: savedLogo || '', qrCodeUrl: savedQr || '' });
        setMenuItems(Database.getProducts('plat') || []);
        setSauces(Database.getProducts('sauce') || []);
        setGarnitures(Database.getProducts('garniture') || []);
        setOrderHistory(Database.getSales() || []);
      } catch (e) {
        console.error("Erreur d'initialisation SQL :", e);
      }
    };
    initApp();
  }, []);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / (SCREEN_WIDTH * 0.8));
        if (index !== currentIndex && index >= 0 && index < menuItems.length) {
          setCurrentIndex(index);
          setQuantity(1);
          resetExtras();
        }
      },
    }
  );

  const updateQuantity = (val) => setQuantity((prev) => Math.max(1, prev + val));
  const resetExtras = () => {
    setSelectedExtras({ sauces: [], garnitures: [] });
    setShowSaucePicker(false);
    setShowGarniturePicker(false);
  };

  const handleImageUpload = async (callback) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { alert('Permission nécessaire'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true });
    if (!result.canceled) callback(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const toggleExtra = (type, item) => {
    const list = selectedExtras[type];
    const exists = list.find((i) => i.id === item.id);
    setSelectedExtras({ ...selectedExtras, [type]: exists ? list.filter((i) => i.id !== item.id) : [...list, item] });
  };

  const checkAdminAccess = () => {
    if (passwordInput === "NINJA'S CORPORATION") {
      setView('settings'); setShowPassModal(false); setPasswordInput('');
    } else console.warn('Mot de passe incorrect');
  };

  const currentItem = menuItems.length > 0 ? menuItems[currentIndex] : null;
  const extrasPrice = selectedExtras.garnitures.reduce((sum, g) => sum + (g.price || 0), 0);
  const unitPrice = currentItem ? currentItem.price + extrasPrice : 0;
  const totalPrice = unitPrice * quantity;

  const validateOrder = async () => {
    const cartItems = Database.getCartItems();
    if (cartItems.length === 0) return;
    const total = Database.getCartTotal();
    const orderData = {
      id: Date.now(),
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      items: cartItems,
      total: total,
      status: 'payé'
    };
    try {
      Database.insertOrder(JSON.stringify(orderData.items), orderData.total, orderData.date, orderData.time);
      setOrderHistory(Database.getOrders());
      Database.clearCart();
      setOrderSent(true);
      
      setTimeout(() => {
        setOrderSent(false);
        setView('menu');
      }, 3000);
    } catch (sqlError) {
      console.error("Erreur critique SQL:", sqlError);
    }
  };

    // --- LOGIQUE DU PANIER ---
  const addToCart = () => {
    if (!currentItem) return;
    Database.addToCart(currentItem.id, currentItem.name, quantity, totalPrice, JSON.stringify(selectedExtras));
    setView('checkout');
  };

  // --- RENDU DU SPLASH SCREEN (VIDÉO) ---
  if (splashVisible) {
    return (
      <View style={styles.splashContainer}>
        <Video
          source={require('./assets/lv_0_20260201104716.mp4')}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) {
              setSplashVisible(false);
            }
          }}
          onError={() => setSplashVisible(false)}
        />
      </View>
    );
  }

  // --- RENDU DU MENU PRINCIPAL ---
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.tablet}>
        
        {/* BOUTON ACCÈS ADMIN */}
        <Pressable style={styles.adminAccess} onPress={() => setShowPassModal(true)}>
          <Text style={{color: '#f97316', fontSize: 18}}>⚙</Text>
        </Pressable>

        {/* LOGO */}
        <View style={styles.logoWrapper}>
          <Text style={styles.brandText}>NINJA <Text style={{color: '#f97316'}}>FRIES</Text></Text>
        </View>

        {/* PRIX FIXE (HAUT) */}
        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            {currentItem ? currentItem.price : 0}
            <Text style={styles.priceUnit}> FCFA</Text>
          </Text>
        </View>

        {/* SECTION CARROUSEL (IMAGES NUES) */}
        <View style={styles.carouselContainer}>
          {/* MASQUES DE BORDURE (EFFET DÉBORDEMENT) */}
          <View style={[styles.fadeEdge, { left: 0 }]} />
          <View style={[styles.fadeEdge, { right: 0 }]} />

          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_SIZE} 
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            contentContainerStyle={{ 
              paddingHorizontal: (SCREEN_WIDTH - ITEM_SIZE) / 2,
              alignItems: 'center' 
            }}
          >
            {menuItems.map((item, index) => {
              const inputRange = [
                (index - 1) * ITEM_SIZE,
                index * ITEM_SIZE,
                (index + 1) * ITEM_SIZE,
              ];

              const scale = scrollX.interpolate({
                inputRange,
                outputRange: [0.4, 1.25, 0.4],
                extrapolate: 'clamp',
              });

              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });

              return (
                <View key={item.id} style={{ width: ITEM_SIZE, alignItems: 'center' }}>
                  <Animated.View style={[
                    styles.card, 
                    { transform: [{ scale }], opacity }
                  ]}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.itemImage}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </View>
              );
            })}
          </Animated.ScrollView>
        </View>

        {/* NOM DU PRODUIT FIXE (BAS) */}
        <View style={styles.bottomInfoSection}>
          <Text style={styles.itemNameText}>
            {currentItem.name || ""}
          </Text>
          <Pressable style={styles.orderButton} onPress={addToCart}>
            <Text style={styles.orderButtonText}>COMMANDER</Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_SIZE} 
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          contentContainerStyle={{ 
            paddingHorizontal: (SCREEN_WIDTH - ITEM_SIZE) / 2,
            alignItems: 'center' 
          }}
        >
          {menuItems.map((item, index) => {
            const inputRange = [
              (index - 1) * ITEM_SIZE,
              index * ITEM_SIZE,
              (index + 1) * ITEM_SIZE,
            ];

            // ÉCHELLE : 1.25 au centre pour agrandir le plat, 0.4 sur les côtés
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.4, 1.25, 0.4],
              extrapolate: 'clamp',
            });

            // OPACITÉ : Focus total sur l'élément central
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <View key={item.id} style={{ width: ITEM_SIZE, alignItems: 'center' }}>
                <Animated.View style={[
                  styles.card, 
                  { transform: [{ scale }], opacity }
                ]}>
                  {/* IMAGE SEULE : Le titre et le prix sous l'image ont été supprimés */}
                  <Image
                    source={{ uri: item.image }}
                    style={styles.itemImage}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>
          
        <View style={styles.infoSection}>
          <Text style={styles.itemNameText}>{currentItem?.name.toUpperCase()}</Text>
          <View style={styles.quantityRow}>
            <Pressable style={styles.qtyBtn} onPress={() => updateQuantity(-1)}><Text style={styles.qtyBtnText}>-</Text></Pressable>
            <Text style={styles.qtyBadgeText}>{quantity}</Text>
            <Pressable style={styles.qtyBtn} onPress={() => updateQuantity(1)}><Text style={styles.qtyBtnText}>+</Text></Pressable>
          </View>
        </View>

        <View style={styles.pagination}>
          {menuItems.map((_, i) => (
            <View key={i} style={[styles.dot, { width: currentIndex === i ? 24 : 8, backgroundColor: currentIndex === i ? '#f97316' : '#27272a' }]} />
          ))}
        </View>

        {currentItem && (
          <View style={styles.pickers}>
            <Pressable style={styles.pickerBtn} onPress={() => { setShowSaucePicker(!showSaucePicker); setShowGarniturePicker(false); }}>
              <Text style={styles.pickerText}>SAUCES ({selectedExtras.sauces.length})</Text>
            </Pressable>
            <Pressable style={styles.pickerBtnWide} onPress={() => { setShowGarniturePicker(!showGarniturePicker); setShowSaucePicker(false); }}>
              <Text style={styles.pickerText}>GARNITURES</Text>
              <IconPlus />
            </Pressable>
          </View>
        )}

        {(showSaucePicker || showGarniturePicker) && (
          <View style={styles.extrasDropdown}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(showSaucePicker ? sauces : garnitures).map((s) => (
                <Pressable key={s.id} onPress={() => toggleExtra(showSaucePicker ? 'sauces' : 'garnitures', s)} style={[styles.extraItemVertical, selectedExtras[showSaucePicker ? 'sauces' : 'garnitures'].find(x => x.id === s.id) && styles.extraItemActive]}>
                  {s.image ? <Image source={{ uri: s.image }} style={styles.extraImageSmall} resizeMode="contain" /> : <View style={styles.extraImageFallback}><Text style={{fontSize:8, color:'#555'}}>IMAGE</Text></View>}
                  <Text style={styles.extraItemText}>{s.name.toUpperCase()}</Text>
                  {!showSaucePicker && <Text style={styles.extraPriceText}>+{s.price} F</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Pressable style={styles.orderBtn} onPress={addToCart}>
          <Text style={styles.orderText}>COMMANDER</Text>
        </Pressable>

        <Modal visible={view === 'checkout'} animationType="slide" transparent>
          <CheckoutScreen config={config} onConfirm={validateOrder} onClose={() => setView('menu')} onRemoveItem={() => {}} />
        </Modal>

        {orderSent && (
          <Pressable style={styles.successScreen} onPress={() => { setOrderSent(false); setView('menu'); }}>
            <View style={styles.successIconContainer}><IconCheck /></View>
            <Text style={styles.successTitle}>COMMANDE ENVOYÉE</Text>
            <Text style={styles.successSubtitle}>VEUILLEZ RETIRER VOTRE TICKET</Text>
          </Pressable>
        )}

        <Modal visible={showPassModal} transparent>
          <View style={styles.modal}><View style={styles.passBox}><IconLock />
            <TextInput secureTextEntry style={styles.passInput} value={passwordInput} onChangeText={setPasswordInput} placeholder="Code Corporation" placeholderTextColor="#777" />
            <View style={styles.passActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowPassModal(false)}><Text style={{color: 'white'}}>ANNULER</Text></Pressable>
              <Pressable style={styles.confirmBtn} onPress={checkAdminAccess}><Text style={{color: 'black'}}>ENTRER</Text></Pressable>
            </View>
          </View></View>
        </Modal>

        {view === 'settings' && (
          <AdminPanel 
            styles={styles} config={config} setConfig={setConfig} 
            menuItems={menuItems} setMenuItems={setMenuItems} 
            sauces={sauces} setSauces={setSauces} 
            garnitures={garnitures} setGarnitures={setGarnitures} 
            activeForm={activeForm} setActiveForm={setActiveForm} 
            setView={setView} orderHistory={orderHistory} 
            handleExportCSV={exportOrdersToCSV} handleImageUpload={handleImageUpload} 
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const AdminPanel = ({ styles, config, setConfig, menuItems, setMenuItems, sauces, setSauces, garnitures, setGarnitures, activeForm, setActiveForm, setView, orderHistory, handleExportCSV, handleImageUpload }) => {
  const [formItem, setFormItem] = useState({ name: '', price: '', image: '', type: 'plat' });
  const [editingId, setEditingId] = useState(null);

  const handleAddItem = () => {
    if (!formItem.name) return;
    try {
      if (editingId) {
        Database.updateProduct(editingId, formItem.name.toUpperCase(), parseInt(formItem.price) || 0, formItem.image);
        setEditingId(null);
      } else {
        Database.saveProduct(formItem.name.toUpperCase(), parseInt(formItem.price) || 0, formItem.image, activeForm);
      }
      setMenuItems(Database.getProducts('plat') || []);
      setSauces(Database.getProducts('sauce') || []);
      setGarnitures(Database.getProducts('garniture') || []);
      setActiveForm(null);
      setFormItem({ name: '', price: '', image: '', type: 'plat' });
    } catch (error) { console.error("Erreur SQL:", error); }
  };

  return (
    <View style={styles.adminRoot}>
      <ScrollView contentContainerStyle={styles.adminContainer}>
        <View style={styles.adminHeader}>
          <Text style={styles.adminTitle}>PANNEAU DE CONFIGURATION</Text>
          <Pressable onPress={() => { setView('menu'); setActiveForm(null); }} style={styles.iconBtn}><IconX size={16} /></Pressable>
        </View>
        {!activeForm && (
          <View style={styles.adminMenu}>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('plat')}><Text style={styles.adminBtnText}>AJOUTER UN PLAT</Text><IconChevronRight size={14} /></Pressable>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('sauce')}><Text style={styles.adminBtnText}>AJOUTER UNE SAUCE</Text><IconChevronRight size={14} /></Pressable>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('garniture')}><Text style={styles.adminBtnText}>AJOUTER UNE GARNITURE</Text><IconChevronRight size={14} /></Pressable>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('list_plats')}><Text style={styles.adminBtnText}>LISTE DES PLATS</Text><IconChevronRight size={14} color="#f97316" /></Pressable>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('list_sauces')}><Text style={styles.adminBtnText}>LISTE DES SAUCES</Text><IconChevronRight size={14} color="#f97316" /></Pressable>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('list_garnitures')}><Text style={styles.adminBtnText}>LISTE DES GARNITURES</Text><IconChevronRight size={14} color="#f97316" /></Pressable>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('logo')}><Text style={styles.adminBtnText}>LOGOS & QR</Text><IconChevronRight size={14} /></Pressable>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('history')}><Text style={styles.adminBtnText}>HISTORIQUE DES VENTES</Text><IconChevronRight size={14} /></Pressable>
            <Pressable style={styles.exportBtn} onPress={() => handleExportCSV(orderHistory)}><Text style={styles.exportText}>EXPORTER L’HISTORIQUE (CSV)</Text></Pressable>
          </View>
        )}
        {activeForm && (
          <View style={styles.adminFormWrapper}>
            <Pressable style={styles.backBtn} onPress={() => setActiveForm(null)}><IconChevronLeft size={14} color="#777" /><Text style={styles.backText}>RETOUR</Text></Pressable>
            <View style={styles.formCard}>
              {(activeForm === 'plat' || activeForm === 'sauce' || activeForm === 'garniture') && (
                <>
                  <Text style={styles.formTitle}>NOUVEAU {activeForm.toUpperCase()}</Text>
                  <Pressable style={styles.imagePicker} onPress={() => handleImageUpload((res) => setFormItem({ ...formItem, image: res, type: activeForm }))}>
                    {formItem.image ? <Image source={{ uri: formItem.image }} style={styles.imagePreview} /> : <IconCamera />}
                  </Pressable>
                  <TextInput placeholder="Nom" placeholderTextColor="#777" style={styles.input} value={formItem.name} onChangeText={(t) => setFormItem({ ...formItem, name: t })} />
                  {activeForm !== 'sauce' && <TextInput placeholder="Prix (FCFA)" placeholderTextColor="#777" keyboardType="numeric" style={styles.input} value={formItem.price} onChangeText={(t) => setFormItem({ ...formItem, price: t })} />}
                  <Pressable style={styles.saveBtn} onPress={handleAddItem}><Text style={styles.saveText}>ENREGISTRER</Text></Pressable>
                </>
              )}
              {activeForm === 'logo' && (
                <View style={{ gap: 20 }}>
                  <Text style={styles.formTitle}>LOGO PRINCIPAL</Text>
                  <Pressable style={styles.logoPicker} onPress={() => handleImageUpload((res) => { Database.saveSetting('logoUrl', res); setConfig(prev => ({ ...prev, logoUrl: res })); })}>
                    {config.logoUrl ? <Image source={{ uri: config.logoUrl }} style={styles.logoPreview} /> : <IconCamera />}
                  </Pressable>
                  <Text style={styles.formTitle}>IMAGE QR CODE</Text>
                  <Pressable style={styles.qrPicker} onPress={() => handleImageUpload((res) => { Database.saveSetting('qrCodeUrl', res); setConfig(prev => ({ ...prev, qrCodeUrl: res })); })}>
                    {config.qrCodeUrl ? <Image source={{ uri: config.qrCodeUrl }} style={styles.qrPreview} /> : <IconCamera />}
                  </Pressable>
                </View>
              )}
              {activeForm === 'history' && (
                <ScrollView style={{ maxHeight: 400 }}>
                  {orderHistory.length === 0 ? <Text style={styles.emptyHistory}>AUCUNE COMMANDE ENREGISTRÉE</Text> : 
                    orderHistory.map(order => (
                      <View key={order.id} style={[styles.historyCard, { borderLeftColor: DAILY_COLORS[parseInt(order.date.split('/')[0]) % 30] || '#f97316' }]}>
                        <View style={styles.historyHeader}>
                          <Text style={styles.historyDate}>{order.date} - {order.time}</Text>
                          <Text style={styles.historyTotal}>{order.total} F</Text>
                        </View>
                        {JSON.parse(order.items).map((it, idx) => <View key={idx} style={styles.historyItem}><Text style={styles.historyItemText}>{it.quantity}x {it.name.toUpperCase()}</Text></View>)}
                      </View>
                    ))
                  }
                </ScrollView>
              )}
              {(activeForm === 'list_plats' || activeForm === 'list_sauces' || activeForm === 'list_garnitures') && (
                <ScrollView style={{ maxHeight: 400, marginTop: 10 }}>
                  {(activeForm === 'list_plats' ? menuItems : activeForm === 'list_sauces' ? sauces : garnitures).map((item) => (
                    <View key={item.id} style={styles.adminHorizontalCard}>
                      <View style={styles.cardLeftContent}><Image source={{ uri: item.image }} style={styles.cardSmallThumb} /><View><Text style={styles.cardMainText}>{item.name.toUpperCase()}</Text>{activeForm !== 'list_sauces' && <Text style={styles.cardSubText}>{item.price} FCFA</Text>}</View></View>
                      <View style={styles.cardActions}>
                        <Pressable style={styles.actionEdit} onPress={() => { setEditingId(item.id); setFormItem({ name: item.name, price: item.price.toString(), image: item.image, type: activeForm.replace('list_', '').replace(/s$/, '') }); setActiveForm(activeForm.replace('list_', '').replace(/s$/, '')); }}><Text style={styles.actionBtnText}>MODIFIER</Text></Pressable>
                        <Pressable onPress={() => { Database.deleteProduct(item.id); setMenuItems(Database.getProducts('plat') || []); setSauces(Database.getProducts('sauce') || []); setGarnitures(Database.getProducts('garniture') || []); }}><IconX size={20} color="#ef4444" /></Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

    
    const React = require('react');
const { useState, useEffect, useRef } = React;
const {
  View, Text, Image, Pressable, TextInput, 
  Modal, StyleSheet, Alert, Animated, SafeAreaView, Dimensions
} = require('react-native');
const { Video, ResizeMode } = require('expo-av');

// IMPORT POUR LA PERSISTANCE
const { Database } = require('./Database');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- CONFIGURATION GÉOMÉTRIQUE ---
const CARD_WIDTH = SCREEN_WIDTH * 0.6; 
const ITEM_SIZE = CARD_WIDTH; 

const App = () => {
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0); 
  const [showPassModal, setShowPassModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  useEffect(() => {
    Database.init();
    const products = Database.getProducts('NINJA FRIES');
    setMenuItems(products);
  }, []);

  useEffect(() => {
    const listenerId = scrollX.addListener(({ value }) => {
      const index = Math.round(value / ITEM_SIZE);
      if (index !== currentIndex && index >= 0 && index < menuItems.length) {
        setCurrentIndex(index);
      }
    });
    return () => scrollX.removeListener(listenerId);
  }, [currentIndex, menuItems.length]);

  const currentItem = menuItems[currentIndex] || {};

  if (splashVisible) {
    return (
      <View style={styles.splashContainer}>
        <Video
          source={require('./assets/lv_0_20260201104716.mp4')}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          onPlaybackStatusUpdate={(status) => {
            if (status.didJustFinish) setSplashVisible(false);
          }}
          onError={() => setSplashVisible(false)}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* LOGO FIXE EN HAUT */}
      <View style={styles.logoWrapper}>
        <Image source={require('./assets/logo.png')} style={styles.logo} />
      </View>

      <Pressable style={styles.adminAccess} onPress={() => setShowPassModal(true)}>
        <Text style={{color: '#f97316', fontSize: 24, opacity: 0.3}}>⚙</Text>
      </Pressable>

      {/* PRIX FIXE */}
      <View style={styles.priceContainer}>
        <Text style={styles.price}>
          {currentItem.price || 0}
          <Text style={styles.priceUnit}> F</Text>
        </Text>
      </View>

      {/* CARROUSEL CENTRAL */}
      <View style={styles.carouselContainer}>
        {/* MASQUES LATÉRAUX POUR EFFET ESTOMPÉ */}
        <View style={[styles.fadeEdge, { left: 0 }]} />
        <View style={[styles.fadeEdge, { right: 0 }]} />

        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_SIZE}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          contentContainerStyle={{
            paddingHorizontal: (SCREEN_WIDTH - ITEM_SIZE) / 2,
            alignItems: 'center'
          }}
        >
          {menuItems.map((item, index) => {
            const inputRange = [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE];
            const scale = scrollX.interpolate({ inputRange, outputRange: [0.4, 1.2, 0.4], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' });

            return (
              <View key={item.id} style={{ width: ITEM_SIZE, alignItems: 'center' }}>
                <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
                  <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="contain" />
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>

      {/* INFOS BAS (FIXE) */}
      <View style={styles.bottomSection}>
        <Text style={styles.itemNameText}>{currentItem.name || ""}</Text>
        <Pressable style={styles.orderButton} onPress={() => Alert.alert("Panier", `${currentItem.name} ajouté`)}>
          <Text style={styles.orderButtonText}>COMMANDER</Text>
        </Pressable>
      </View>

      {/* MODALE ADMIN */}
      <Modal visible={showPassModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.passBox}>
            <Text style={styles.modalTitle}>ADMINISTRATION</Text>
            <TextInput
              style={styles.passInput}
              placeholder="CODE"
              placeholderTextColor="#444"
              secureTextEntry
              value={passwordInput}
              onChangeText={setPasswordInput}
            />
            <View style={styles.modalActions}>
               <Pressable style={[styles.orderButton, {backgroundColor: '#333', flex: 1, marginRight: 10}]} onPress={() => setShowPassModal(false)}>
                <Text style={styles.orderButtonText}>ANNULER</Text>
              </Pressable>
              <Pressable style={[styles.orderButton, {flex: 1}]} onPress={() => { if(passwordInput === '1234') setShowPassModal(false); }}>
                <Text style={styles.orderButtonText}>VALIDER</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // CONFIGURATION RACINE
  root: { 
    flex: 1, 
    backgroundColor: '#000000', 
    justifyContent: 'space-between' 
  },
  splashContainer: { 
    flex: 1, 
    backgroundColor: '#000000' 
  },
  
  // LOGO (POSITION ABSOLUE POUR NE PAS POUSSER LE RESTE)
  logoWrapper: { 
    position: 'absolute', 
    top: 40, 
    width: '100%', 
    alignItems: 'center', 
    zIndex: 50 
  },
  logo: { 
    width: 200, 
    height: 100, 
    resizeMode: 'contain' 
  },
  adminAccess: { 
    position: 'absolute', 
    top: 40, 
    left: 20, 
    zIndex: 60, 
    padding: 10 
  },

  // PRIX (EN HAUT SOUS LE LOGO)
  priceContainer: { 
    marginTop: 140, 
    alignItems: 'center' 
  },
  price: { 
    fontSize: 80, 
    fontWeight: '900', 
    color: '#f97316', 
    fontStyle: 'italic',
    textShadowColor: 'rgba(249,115,22,0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10
  },
  priceUnit: { 
    fontSize: 26 
  },

  // CARROUSEL (CENTRE)
  carouselContainer: { 
    height: SCREEN_HEIGHT * 0.45,
    justifyContent: 'center',
    position: 'relative'
  },
  card: { 
    width: CARD_WIDTH, 
    height: CARD_WIDTH,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
  },
  itemImage: { 
    width: '100%', 
    height: '100%' 
  },
  fadeEdge: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.2,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
    pointerEvents: 'none'
  },

  // INFOS PRODUIT ET BOUTON (BAS)
  bottomSection: { 
    alignItems: 'center', 
    paddingBottom: 50,
    width: '100%'
  },
  itemNameText: { 
    color: '#FFF', 
    fontSize: 42, 
    fontWeight: '900', 
    fontStyle: 'italic', 
    marginBottom: 25, 
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  orderButton: { 
    backgroundColor: '#f97316', 
    paddingVertical: 20, 
    paddingHorizontal: 60, 
    borderRadius: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  orderButtonText: { 
    color: '#FFF', 
    fontWeight: '900', 
    fontSize: 20, 
    fontStyle: 'italic' 
  },

  // MODALE ADMINISTRATION
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  passBox: { 
    width: '85%', 
    backgroundColor: '#111', 
    padding: 30, 
    borderRadius: 30, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  modalTitle: {
    color: '#f97316',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 20,
    fontStyle: 'italic'
  },
  passInput: { 
    backgroundColor: '#000', 
    color: '#f97316', 
    width: '100%', 
    padding: 15, 
    borderRadius: 15, 
    marginBottom: 20, 
    textAlign: 'center', 
    fontSize: 24, 
    fontWeight: '900',
    borderWidth: 1,
    borderColor: '#333'
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%'
  }
});

export default App;
