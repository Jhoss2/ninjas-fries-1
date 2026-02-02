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

// --- CONFIGURATION GÉOMÉTRIQUE CARROUSEL NINJA ---
// La carte centrale occupe 40% de la largeur écran
const CARD_WIDTH = SCREEN_WIDTH * 0.4; 
// Espacement réduit pour forcer les voisins à déborder de 50%
const SPACING = 10;
const ITEM_SIZE = CARD_WIDTH + SPACING;
// -------------------------------------------------

const DAILY_COLORS = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
  '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
  '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#fb7185',
  '#fb923c','#fbbf24','#a3e635','#4ade80','#34d399','#2dd4bf',
  '#22d3ee','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc'
];

/* ===================== ICÔNES ===================== */
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

  const addToCart = () => {
    if (!currentItem) return;
    Database.addToCart(currentItem.id, currentItem.name, quantity, totalPrice, JSON.stringify(selectedExtras));
    setView('checkout');
  };

  if (splashVisible) {
    return (
      <View style={styles.splashContainer}>
        <Video
          source={require('./assets/lv_0_20260201104716.mp4')}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={false}
          shouldRasterizeIOS={true} 
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

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.tablet}>
        <Pressable style={styles.adminAccess} onPress={() => setShowPassModal(true)}>
          <IconChevronRight size={20} />
        </Pressable>

        <View style={styles.logoWrapper}>
          {config.logoUrl ? (
            <Image source={{ uri: config.logoUrl }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={styles.brandText}>NINJA <Text style={{color: '#f97316'}}>FRIES</Text></Text>
          )}
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            {currentItem ? totalPrice : 0}
            <Text style={styles.priceUnit}> FCFA</Text>
          </Text>
        </View>

        <View style={styles.carouselContainer}>
        
        {/* MASQUES DE BORDURE (EFFET DÉBORDEMENT 50%) */}
        <View style={[styles.fadeEdge, { left: 0 }]} />
        <View style={[styles.fadeEdge, { right: 0 }]} />

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_SIZE} // Aimantage précis sur la taille de l'item
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          contentContainerStyle={{ 
            paddingHorizontal: (SCREEN_WIDTH - ITEM_SIZE) / 2, // Centrage parfait du premier item
            alignItems: 'center' 
          }}
        >
          {menuItems.map((item, index) => {
            const inputRange = [
              (index - 1) * ITEM_SIZE,
              index * ITEM_SIZE,
              (index + 1) * ITEM_SIZE,
            ];

            // ÉCHELLE : 1 au centre, 0.4 sur les côtés (Ratio Ninja)
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });

            // OPACITÉ : Très sombre sur les côtés pour le focus
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
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardPrice}>{item.price} F</Text>
                  </View>
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

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: '#000' },
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  tablet: { width: 390, height: 780, backgroundColor: '#09090b', borderRadius: 48, overflow: 'hidden', paddingVertical: 20 },
  adminAccess: { position: 'absolute', top: 30, left: 20, zIndex: 50 },
  logoWrapper: { alignItems: 'center', marginBottom: 10, backgroundColor: 'transparent' },
  logo: { width: 120, height: 60, backgroundColor: 'transparent' },
  brandText: { color: '#FFF', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
  priceContainer: { alignItems: 'center', height: 80 },
  price: { fontSize: 64, fontWeight: '900', color: '#f97316', fontStyle: 'italic' },
  priceUnit: { fontSize: 22 },

  // --- AJUSTEMENTS CARROUSEL NINJA ---
  carouselContainer: { height: 350, justifyContent: 'center', overflow: 'visible', width: SCREEN_WIDTH },
  fadeEdge: { position: 'absolute', top: 0, bottom: 0, width: SCREEN_WIDTH * 0.25, backgroundColor: 'transparent', zIndex: 10 },
  card: { width: CARD_WIDTH, height: 300, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  cardInfo: { alignItems: 'center', marginTop: 10 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '900', fontStyle: 'italic', textAlign: 'center' },
  cardPrice: { color: '#f97316', fontSize: 18, fontWeight: '900', marginTop: 5 },
  
  swipeItem: { width: SCREEN_WIDTH * 0.8, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  itemImage: { width: 220, height: 220, shadowColor: "#f97316", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 30, backgroundColor: 'transparent' },
  infoSection: { alignItems: 'center', marginTop: 10 },
  itemNameText: { color: '#f97316', fontWeight: '900', fontSize: 34, fontStyle: 'italic', textAlign: 'center' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, marginTop: 15 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: '#f97316', fontSize: 24, fontWeight: 'bold' },
  qtyBadgeText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  dot: { height: 8, borderRadius: 4 },
  pickers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 30 },
  pickerBtn: { flex: 1, height: 45, borderWidth: 1, borderColor: '#fff', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  pickerBtnWide: { flex: 1.2, height: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 15, borderRadius: 30, marginLeft: 10 },
  pickerText: { color: '#fff', fontWeight: '900', fontSize: 12, fontStyle: 'italic' },
  extrasDropdown: { marginTop: 15, paddingHorizontal: 20 },
  extraItemVertical: { alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 20, backgroundColor: 'transparent', marginRight: 15, width: 100, overflow: 'visible' },
  extraItemActive: { borderColor: '#f97316', borderWidth: 2 },
  extraItemText: { color: '#fff', fontSize: 11, textAlign: 'center', fontWeight: '900', marginTop: 5 },
  extraImageSmall: { width: 60, height: 60, shadowColor: "#f97316", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, backgroundColor: 'transparent' },
  extraImageFallback: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center' },
  extraPriceText: { color: '#f97316', fontSize: 10, fontWeight: '900' },
  orderBtn: { backgroundColor: '#f97316', padding: 20, borderRadius: 30, marginHorizontal: 40, marginTop: 20, alignItems: 'center' },
  orderText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 1, fontStyle: 'italic' },
  overlay: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  closeButton: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 25, marginRight: 20, marginTop: 10 },
  scrollContent: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 },
  headerSection: { width: '100%', marginVertical: 30, alignItems: 'center' },
  checkoutTitleText: { color: '#f97316', fontSize: 22, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
  headerSeparator: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', width: '100%', marginTop: 15 },
  itemsList: { width: '100%', marginBottom: 25 },
  itemRow: { marginBottom: 15, width: '100%' },
  itemMainLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1, marginRight: 15 },
  itemNameContainer: { flexDirection: 'row' },
  orangeText: { color: '#f97316', fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
  whiteText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
  itemPrice: { color: '#f97316', fontSize: 18, fontWeight: '900', fontStyle: 'italic' },
  removeRowButton: { backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: 8, borderRadius: 20 },
  extrasContainer: { marginTop: 6, paddingLeft: 10 },
  extraDetailText: { color: '#FFFFFF', fontSize: 13, fontStyle: 'italic' },
  orangeExtraValue: { color: '#f97316' },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12 },
  whiteCard: { backgroundColor: '#FFFFFF', width: SCREEN_WIDTH * 0.85, borderRadius: 35, padding: 25, alignItems: 'center', marginBottom: 30 },
  qrWrapper: { width: 140, height: 140, backgroundColor: '#f0f0f0', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  qrImage: { width: '100%', height: '100%' },
  totalSection: { alignItems: 'center' },
  totalLabel: { color: '#888888', fontSize: 13, fontWeight: '700' },
  totalValue: { color: '#f97316', fontSize: 32, fontWeight: '900', fontStyle: 'italic' },
  confirmButton: { backgroundColor: '#f97316', width: '100%', padding: 20, borderRadius: 50, alignItems: 'center' },
  confirmButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  successScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  successIconContainer: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  successTitle: { fontSize: 32, fontWeight: '900', color: '#fff', fontStyle: 'italic' },
  successSubtitle: { fontSize: 14, fontWeight: '900', color: '#fff', marginTop: 10 },
  modal:{ flex:1, backgroundColor:'rgba(0,0,0,0.9)', justifyContent:'center', padding:20 },
  passBox:{ backgroundColor:'#18181b', padding:35, borderRadius:45, alignItems: 'center' },
  passInput:{ backgroundColor:'#27272a', color:'#fff', padding:16, borderRadius:25, marginVertical:25, textAlign:'center', width: '100%', fontSize: 18, fontWeight:'900', fontStyle: 'italic' },
  passActions:{ flexDirection:'row', gap:15 },
  cancelBtn:{ flex:1, backgroundColor:'#27272a', padding:16, borderRadius:25, alignItems:'center' },
  confirmBtn:{ flex:1, backgroundColor:'#f97316', padding:16, borderRadius:25, alignItems:'center' },
  adminRoot:{ ...StyleSheet.absoluteFillObject, backgroundColor:'#09090b', zIndex:100 },
  adminContainer:{ padding:25, gap:25 },
  adminHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  adminTitle:{ color:'#f97316', fontWeight:'900', fontSize:22, fontStyle: 'italic' },
  iconBtn:{ padding:10 },
  adminMenu:{ gap:15, marginTop:25 },
  adminBtn:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#18181b', padding:18, borderRadius:25 },
  adminBtnText:{ color:'#fff', fontWeight:'900', fontSize:14, fontStyle: 'italic' },
  exportBtn:{ backgroundColor:'#f97316', padding:18, borderRadius:25, marginTop:15, alignItems:'center' },
  exportText:{ color:'#000', fontWeight:'900', fontSize:14 },
  adminFormWrapper:{ marginTop:25 },
  backBtn:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:15 },
  backText:{ color:'#777', fontWeight:'900', fontSize: 16 },
  formCard:{ backgroundColor:'#18181b', padding:25, borderRadius:30 },
  formTitle:{ color:'#f97316', fontWeight:'900', fontSize:16, marginBottom:15, fontStyle: 'italic' },
  imagePicker:{ width:100, height:100, borderRadius:20, backgroundColor:'#27272a', justifyContent:'center', alignItems:'center', marginBottom:15 },
  imagePreview:{ width:100, height:100, borderRadius:20, resizeMode:'contain' },
  logoPicker:{ width:100, height:100, borderRadius:20, backgroundColor:'#27272a', justifyContent:'center', alignItems:'center', marginBottom:15 },
  logoPreview:{ width:100, height:100, borderRadius:20, resizeMode:'contain' },
  qrPicker:{ width:100, height:100, borderRadius:20, backgroundColor:'#27272a', justifyContent:'center', alignItems:'center', marginBottom:15 },
  qrPreview:{ width:100, height:100, borderRadius:20, resizeMode:'contain' },
  input:{ backgroundColor:'#27272a', color:'#fff', padding:16, borderRadius:25, marginBottom:15, fontSize: 16 },
  saveBtn:{ backgroundColor:'#f97316', padding:18, borderRadius:25, marginTop:15, alignItems:'center' },
  saveText:{ fontWeight:'900', color:'#000', textAlign:'center', fontSize: 16 },
  historyCard:{ backgroundColor:'#18181b', borderLeftWidth:6, borderRadius:15, padding:15, marginVertical:8 },
  historyHeader:{ flexDirection:'row', justifyContent:'space-between', marginBottom:10 },
  historyDate:{ color:'#fff', fontWeight:'900', fontSize:12 },
  historyTotal:{ color:'#f97316', fontWeight:'900', fontSize:14 },
  historyItem:{ marginBottom:6 },
  historyItemText:{ color:'#fff', fontSize:12, fontWeight: '700' },
  adminHorizontalCard: { flexDirection: 'row', backgroundColor: '#18181b', borderRadius: 20, padding: 15, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#27272a', marginBottom: 12 },
  cardLeftContent: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cardSmallThumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#000', resizeMode: 'contain' },
  cardMainText: { color: '#fff', fontWeight: '900', fontSize: 16, fontStyle: 'italic' },
  cardSubText: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  actionEdit: { backgroundColor: '#27272a', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6' },
  actionBtnText: { color: '#3b82f6', fontSize: 12, fontWeight: '900' },
  emptyHistory:{ color:'#777', textAlign:'center', fontStyle:'italic', marginTop:30, fontSize: 16 }
});
module.exports = App;
