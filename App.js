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
const FileSystem = require('expo-file-system');
const Sharing = require('expo-sharing');
const { Buffer } = require('buffer');
const { BlurView } = require('expo-blur');
const { Database } = require('./Database');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/* ===================== CONSTANTES ===================== */
const CARD_WIDTH = SCREEN_WIDTH * 0.55;
const ITEM_SIZE = CARD_WIDTH;
const DAILY_COLORS = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
  '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
  '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#fb7185',
  '#fb923c','#fbbf24','#a3e635','#4ade80','#34d399','#2dd4bf',
  '#22d3ee','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc'
];

/* ===================== ICÔNES ===================== */
const IconPlus = () => React.createElement(
  Svg,
  { width: 20, height: 20, viewBox: '0 0 24 24' },
  React.createElement(Line, { x1: '12', y1: '5', x2: '12', y2: '19', stroke: 'white', strokeWidth: '3' }),
  React.createElement(Line, { x1: '5', y1: '12', x2: '19', y2: '12', stroke: 'white', strokeWidth: '3' })
);

const IconX = ({ size = 20, color = 'white' }) => React.createElement(
  Svg,
  { width: size, height: size, viewBox: '0 0 24 24' },
  React.createElement(Line, { x1: '18', y1: '6', x2: '6', y2: '18', stroke: color, strokeWidth: '2.5' }),
  React.createElement(Line, { x1: '6', y1: '6', x2: '18', y2: '18', stroke: color, strokeWidth: '2.5' })
);

const IconCamera = () => React.createElement(
  Svg,
  { width: 24, height: 24, viewBox: '0 0 24 24' },
  React.createElement(Path, {
    d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
    stroke: 'white',
    strokeWidth: '2',
    fill: 'none'
  }),
  React.createElement(Circle, { cx: '12', cy: '13', r: '4', stroke: 'white', strokeWidth: '2' })
);

const IconChevronLeft = ({ size = 24, color = 'white' }) => React.createElement(
  Svg,
  { width: size, height: size, viewBox: '0 0 24 24' },
  React.createElement(Polyline, { points: '15 18 9 12 15 6', stroke: color, strokeWidth: '2.5', fill: 'none' })
);

const IconChevronRight = ({ size = 24, color = 'white' }) => React.createElement(
  Svg,
  { width: size, height: size, viewBox: '0 0 24 24' },
  React.createElement(Polyline, { points: '9 18 15 12 9 6', stroke: color, strokeWidth: '2.5', fill: 'none' })
);

const IconLock = () => React.createElement(
  Svg,
  { width: 30, height: 30, viewBox: '0 0 24 24' },
  React.createElement(Rect, { x: '3', y: '11', width: '18', height: '11', rx: '2', ry: '2', stroke: 'white', strokeWidth: '2', fill: 'none' }),
  React.createElement(Path, { d: 'M7 11V7a5 5 0 0 1 10 0v4', stroke: 'white', strokeWidth: '2', fill: 'none' })
);

const IconCheck = () => React.createElement(
  Svg,
  { width: 80, height: 80, viewBox: '0 0 24 24' },
  React.createElement(Path, { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14', stroke: 'white', strokeWidth: '2', fill: 'none' }),
  React.createElement(Polyline, { points: '22 4 12 14.01 9 11.01', stroke: 'white', strokeWidth: '2', fill: 'none' })
);

/* ===================== MODULES UTILITAIRES ===================== */
const exportOrdersToCSV = async (orderHistory) => {
  let csv = 'Date;Heure;Articles;Détails Extras;Total\n';
  orderHistory.forEach(o => {
    const itemsList = JSON.parse(o.items || '[]');
    const itemsNames = itemsList.map(i => `${i.quantity}x ${i.name.toUpperCase()}`).join(' | ');
    const extrasDetails = itemsList.map(i => {
      const extras = JSON.parse(i.extras || '{}');
      const sauces = (extras.sauces || []).map(s => `${s.name.toUpperCase()} (0F)`).join(', ');
      const garnitures = (extras.garnitures || []).map(g => `${g.name.toUpperCase()} (${g.price}F)`).join(', ');
      return `[${i.name.toUpperCase()}: Sauces: ${sauces || 'Aucune'} | Garnitures: ${garnitures || 'Aucune'}]`;
    }).join(' ; ');
    csv += `${o.date};${o.time};${itemsNames};${extrasDetails};${o.total}\n`;
  });
  const fileUri = FileSystem.documentDirectory + `historique_${Date.now()}.csv`;
  try {
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri);
  } catch (error) {
    console.error("Erreur export CSV:", error);
    Alert.alert("Erreur", "Impossible d'exporter l'historique.");
  }
};

/* ===================== COMPOSANT CHECKOUT ===================== */
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
      setCartItems(Array.isArray(items) ? items : []);
      setTotalAmount(typeof total === 'number' ? total : 0);
    } catch (e) {
      console.error("Erreur refreshCart:", e);
      setCartItems([]);
      setTotalAmount(0);
    }
  };

  const handleRemove = (id) => {
    Database.removeFromCart(id);
    refreshCart();
    onRemoveItem(id);
  };

  return React.createElement(
    View,
    { style: styles.overlay },
    React.createElement(BlurView, { intensity: 90, tint: 'dark', style: StyleSheet.absoluteFill }),
    React.createElement(
      SafeAreaView,
      { style: styles.container },
      React.createElement(
        Pressable,
        { style: styles.closeButton, onPress: onClose },
        React.createElement(IconX, { size: 24, color: 'white' })
      ),
      React.createElement(
        ScrollView,
        { contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false },
        React.createElement(
          View,
          { style: styles.headerSection },
          React.createElement(Text, { style: styles.checkoutTitleText }, 'VÉRIFIEZ VOTRE COMMANDE'),
          React.createElement(View, { style: styles.headerSeparator })
        ),
        React.createElement(
          View,
          { style: styles.itemsList },
          cartItems.map((item, index) => {
            const extras = JSON.parse(item.extras || '{}');
            return React.createElement(
              View,
              { key: item.id, style: styles.itemRow },
              React.createElement(
                View,
                { style: styles.itemMainLine },
                React.createElement(
                  View,
                  { style: styles.itemHeader },
                  React.createElement(
                    View,
                    { style: styles.itemNameContainer },
                    React.createElement(Text, { style: styles.orangeText }, `${item.quantity}X `),
                    React.createElement(Text, { style: styles.whiteText }, item.name.toUpperCase())
                  ),
                  React.createElement(Text, { style: styles.itemPrice }, `${item.totalPrice} F`)
                ),
                React.createElement(
                  Pressable,
                  { style: styles.removeRowButton, onPress: () => handleRemove(item.id) },
                  React.createElement(IconX, { size: 14, color: 'white' })
                )
              ),
              React.createElement(
                View,
                { style: styles.extrasContainer },
                extras.sauces && extras.sauces.length > 0 && React.createElement(
                  Text,
                  { style: styles.extraDetailText },
                  'SAUCES: ',
                  React.createElement(Text, { style: styles.orangeExtraValue }, extras.sauces.map(s => s.name.toUpperCase()).join(', '))
                ),
                extras.garnitures && extras.garnitures.length > 0 && React.createElement(
                  Text,
                  { style: styles.extraDetailText },
                  'GARNITURES: ',
                  React.createElement(Text, { style: styles.orangeExtraValue }, extras.garnitures.map(g => g.name.toUpperCase()).join(', '))
                )
              ),
              index < cartItems.length - 1 && React.createElement(View, { style: styles.separator })
            );
          })
        ),
        React.createElement(
          View,
          { style: styles.whiteCard },
          React.createElement(
            View,
            { style: styles.qrWrapper },
            config.qrCodeUrl
              ? React.createElement(Image, { source: { uri: config.qrCodeUrl }, style: styles.qrImage, resizeMode: 'contain' })
              : React.createElement(Text, { style: { color: '#ccc', fontSize: 12 } }, 'QR CODE')
          ),
          React.createElement(
            View,
            { style: styles.totalSection },
            React.createElement(Text, { style: styles.totalLabel }, 'TOTAL À PAYER'),
            React.createElement(Text, { style: styles.totalValue }, `${totalAmount} FCFA`)
          )
        ),
        React.createElement(
          Pressable,
          { style: styles.confirmButton, onPress: onConfirm },
          React.createElement(Text, { style: styles.confirmButtonText }, 'VALIDER LA COMMANDE')
        )
      )
    )
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

  useEffect(() => {
    const splashTimeout = setTimeout(() => {
      setSplashVisible(false);
    }, 1500);
    return () => clearTimeout(splashTimeout);
  }, []);

  useEffect(() => {
    const initApp = () => {
      try {
        const initialized = Database.init();
        if (!initialized) {
          console.warn('Initialisation DB échouée');
        }
        
        const savedLogo = Database.getSetting('logoUrl');
        const savedQr = Database.getSetting('qrCodeUrl');
        setConfig({ 
          logoUrl: savedLogo || '', 
          qrCodeUrl: savedQr || '' 
        });
        
        const products = Database.getProducts('plat');
        setMenuItems(Array.isArray(products) ? products : []);
        
        const saucesData = Database.getProducts('sauce');
        setSauces(Array.isArray(saucesData) ? saucesData : []);
        
        const garnituresData = Database.getProducts('garniture');
        setGarnitures(Array.isArray(garnituresData) ? garnituresData : []);
        
        const orders = Database.getSales();
        setOrderHistory(Array.isArray(orders) ? orders : []);
      } catch (e) {
        console.error("Erreur initialisation:", e);
        setMenuItems([]);
        setSauces([]);
        setGarnitures([]);
        setOrderHistory([]);
      }
    };
    
    initApp();
  }, []);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (event) => {
        try {
          const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_SIZE);
          if (index !== currentIndex && index >= 0 && index < menuItems.length) {
            setCurrentIndex(index);
            resetControls();
          }
        } catch (e) {
          console.error('Erreur onScroll:', e);
        }
      },
    }
  );

  const updateQuantity = (val) => {
    setQuantity((prev) => Math.max(1, prev + val));
  };

  const resetControls = () => {
    setQuantity(1);
    setSelectedExtras({ sauces: [], garnitures: [] });
    setShowSaucePicker(false);
    setShowGarniturePicker(false);
  };

  const handleImageUpload = async (callback) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission nécessaire');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        callback(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.error('Erreur upload image:', e);
    }
  };

  const toggleExtra = (type, item) => {
    const list = selectedExtras[type] || [];
    const exists = list.find((i) => i.id === item.id);
    setSelectedExtras({
      ...selectedExtras,
      [type]: exists ? list.filter((i) => i.id !== item.id) : [...list, item]
    });
  };

  const checkAdminAccess = () => {
    if (passwordInput === "NINJA'S CORPORATION") {
      setView('settings');
      setShowPassModal(false);
      setPasswordInput('');
    } else {
      console.warn('Mot de passe incorrect');
    }
  };

  const currentItem = menuItems.length > 0 ? menuItems[currentIndex] : null;
  const extrasPrice = (selectedExtras.garnitures || []).reduce((sum, g) => sum + (g.price || 0), 0);
  const unitPrice = currentItem ? (currentItem.price || 0) + extrasPrice : 0;
  const totalPrice = unitPrice * quantity;

  const validateOrder = () => {
    try {
      const cartItems = Database.getCartItems();
      if (!cartItems || cartItems.length === 0) return;
      
      const total = Database.getCartTotal();
      const orderData = {
        id: Date.now(),
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        items: JSON.stringify(cartItems),
        total: total,
      };
      
      Database.insertOrder(orderData.items, orderData.total, orderData.date, orderData.time);
      setOrderHistory(Database.getOrders());
      Database.clearCart();
      setOrderSent(true);
      resetControls();
      
      setTimeout(() => {
        setOrderSent(false);
        setView('menu');
      }, 3000);
    } catch (sqlError) {
      console.error("Erreur validation:", sqlError);
    }
  };

  const addToCart = () => {
    try {
      if (!currentItem) return;
      Database.addToCart(
        currentItem.id,
        currentItem.name,
        quantity,
        totalPrice,
        JSON.stringify(selectedExtras)
      );
      setView('checkout');
    } catch (e) {
      console.error('Erreur addToCart:', e);
    }
  };

  if (splashVisible) {
    return React.createElement(
      View,
      { style: styles.splashContainer },
      React.createElement(
        View,
        { style: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' } },
        React.createElement(Text, { style: { color: '#f97316', fontSize: 32, fontWeight: 'bold' } }, 'NINJA FRIES')
      )
    );
  }

  return React.createElement(
    SafeAreaView,
    { style: styles.root },
    React.createElement(
      View,
      { style: styles.tablet },
      React.createElement(
        View,
        { style: styles.logoWrapper },
        config.logoUrl
          ? React.createElement(Image, { source: { uri: config.logoUrl }, style: styles.logo })
          : React.createElement(
              Text,
              { style: styles.brandText },
              'NINJA ',
              React.createElement(Text, { style: { color: '#f97316' } }, 'FRIES')
            )
      ),
      React.createElement(
        Pressable,
        { style: styles.adminAccess, onPress: () => setShowPassModal(true) },
        React.createElement(Text, { style: { color: '#f97316', fontSize: 24 } }, '⚙')
      ),
      React.createElement(
        View,
        { style: styles.priceContainer },
        React.createElement(
          Text,
          { style: styles.price },
          currentItem ? totalPrice : 0,
          React.createElement(Text, { style: styles.priceUnit }, ' FCFA')
        )
      ),
      React.createElement(
        View,
        { style: styles.carouselContainer },
        React.createElement(
          Animated.ScrollView,
          {
            horizontal: true,
            pagingEnabled: true,
            snapToInterval: ITEM_SIZE,
            decelerationRate: 'fast',
            showsHorizontalScrollIndicator: false,
            onScroll: onScroll,
            scrollEventThrottle: 16,
            contentContainerStyle: { paddingHorizontal: (SCREEN_WIDTH - ITEM_SIZE) / 2 }
          },
          menuItems.map((item, index) => {
            const scale = scrollX.interpolate({
              inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE],
              outputRange: [0.4, 1.25, 0.4],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return React.createElement(
              View,
              { key: item.id, style: { width: ITEM_SIZE, alignItems: 'center' } },
              React.createElement(
                Animated.View,
                { style: [styles.card, { transform: [{ scale }], opacity }] },
                React.createElement(Image, { source: { uri: item.image }, style: styles.itemImage, resizeMode: 'contain' })
              )
            );
          })
        )
      ),
      React.createElement(
        View,
        { style: styles.controlsSection },
        React.createElement(
          View,
          { style: styles.titleRow },
          React.createElement(
            Pressable,
            { style: styles.titleQtyBtn, onPress: () => updateQuantity(-1) },
            React.createElement(Text, { style: styles.titleQtyBtnText }, '-')
          ),
          React.createElement(Text, { style: styles.itemNameText }, currentItem ? currentItem.name.toUpperCase() : ''),
          React.createElement(
            Pressable,
            { style: styles.titleQtyBtn, onPress: () => updateQuantity(1) },
            React.createElement(Text, { style: styles.titleQtyBtnText }, '+')
          )
        ),
        React.createElement(
          View,
          { style: styles.selectorsRow },
          React.createElement(
            Pressable,
            {
              style: [styles.selectorBtn, { borderColor: '#f97316' }],
              onPress: () => {
                setShowSaucePicker(!showSaucePicker);
                setShowGarniturePicker(false);
              }
            },
            React.createElement(Text, { style: styles.selectorBtnText }, `SAUCES (${(selectedExtras.sauces || []).length})`)
          ),
          React.createElement(
            View,
            { style: styles.qtyBadgeCenter },
            React.createElement(Text, { style: styles.qtyBadgeText }, quantity)
          ),
          React.createElement(
            Pressable,
            {
              style: [styles.selectorBtn, { borderColor: '#f97316' }],
              onPress: () => {
                setShowGarniturePicker(!showGarniturePicker);
                setShowSaucePicker(false);
              }
            },
            React.createElement(Text, { style: styles.selectorBtnText }, 'GARNITURES')
          )
        ),
        (showSaucePicker || showGarniturePicker) && React.createElement(
          View,
          { style: styles.extrasDropdown },
          React.createElement(
            ScrollView,
            { horizontal: true, showsHorizontalScrollIndicator: false },
            (showSaucePicker ? sauces : garnitures).map((s) => {
              const isSelected = (selectedExtras[showSaucePicker ? 'sauces' : 'garnitures'] || []).find(x => x.id === s.id);
              return React.createElement(
                Pressable,
                {
                  key: s.id,
                  onPress: () => toggleExtra(showSaucePicker ? 'sauces' : 'garnitures', s),
                  style: [styles.extraItemVertical, isSelected && styles.extraItemActive]
                },
                s.image
                  ? React.createElement(Image, { source: { uri: s.image }, style: styles.extraImageSmall, resizeMode: 'contain' })
                  : React.createElement(
                      View,
                      { style: styles.extraImageFallback },
                      React.createElement(Text, { style: { fontSize: 8, color: '#555' } }, 'IMAGE')
                    ),
                React.createElement(Text, { style: styles.extraItemText }, s.name.toUpperCase()),
                !showSaucePicker && React.createElement(Text, { style: styles.extraPriceText }, `+${s.price} F`)
              );
            })
          )
        )
      ),
      React.createElement(
        Pressable,
        { style: styles.orderBtnFixed, onPress: addToCart },
        React.createElement(Text, { style: styles.orderText }, 'COMMANDER')
      ),
      React.createElement(
        Modal,
        { visible: view === 'checkout', animationType: 'slide', transparent: true },
        React.createElement(CheckoutScreen, {
          config: config,
          onConfirm: validateOrder,
          onClose: () => setView('menu'),
          onRemoveItem: () => {}
        })
      ),
      orderSent && React.createElement(
        Pressable,
        {
          style: styles.successScreen,
          onPress: () => {
            setOrderSent(false);
            setView('menu');
          }
        },
        React.createElement(
          View,
          { style: styles.successIconContainer },
          React.createElement(IconCheck)
        ),
        React.createElement(Text, { style: styles.successTitle }, 'COMMANDE ENVOYÉE'),
        React.createElement(Text, { style: styles.successSubtitle }, 'VEUILLEZ RETIRER VOTRE TICKET')
      ),
      React.createElement(
        Modal,
        { visible: showPassModal, transparent: true },
        React.createElement(
          View,
          { style: styles.modalOverlay },
          React.createElement(
            View,
            { style: styles.passBox },
            React.createElement(IconLock),
            React.createElement(TextInput, {
              secureTextEntry: true,
              style: styles.passInput,
              value: passwordInput,
              onChangeText: setPasswordInput,
              placeholder: 'Code Corporation',
              placeholderTextColor: '#777'
            }),
            React.createElement(
              View,
              { style: styles.passActions },
              React.createElement(
                Pressable,
                { style: styles.cancelBtn, onPress: () => setShowPassModal(false) },
                React.createElement(Text, { style: { color: 'white' } }, 'ANNULER')
              ),
              React.createElement(
                Pressable,
                { style: styles.confirmBtn, onPress: checkAdminAccess },
                React.createElement(Text, { style: { color: 'black' } }, 'ENTRER')
              )
            )
          )
        )
      ),
      view === 'settings' && React.createElement(AdminPanel, {
        styles: styles,
        config: config,
        setConfig: setConfig,
        menuItems: menuItems,
        setMenuItems: setMenuItems,
        sauces: sauces,
        setSauces: setSauces,
        garnitures: garnitures,
        setGarnitures: setGarnitures,
        activeForm: activeForm,
        setActiveForm: setActiveForm,
        setView: setView,
        orderHistory: orderHistory,
        handleExportCSV: exportOrdersToCSV,
        handleImageUpload: handleImageUpload
      })
    )
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
    } catch (error) {
      console.error("Erreur SQL:", error);
    }
  };

  return React.createElement(
    View,
    { style: styles.adminRoot },
    React.createElement(
      ScrollView,
      { contentContainerStyle: styles.adminContainer },
      React.createElement(
        View,
        { style: styles.adminHeader },
        React.createElement(Text, { style: styles.adminTitle }, 'PANNEAU DE CONFIGURATION'),
        React.createElement(
          Pressable,
          { onPress: () => { setView('menu'); setActiveForm(null); }, style: styles.iconBtn },
          React.createElement(IconX, { size: 16 })
        )
      ),
      !activeForm && React.createElement(
        View,
        { style: styles.adminMenu },
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('plat') },
          React.createElement(Text, { style: styles.adminBtnText }, 'AJOUTER UN PLAT'),
          React.createElement(IconChevronRight, { size: 14 })
        ),
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('sauce') },
          React.createElement(Text, { style: styles.adminBtnText }, 'AJOUTER UNE SAUCE'),
          React.createElement(IconChevronRight, { size: 14 })
        ),
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('garniture') },
          React.createElement(Text, { style: styles.adminBtnText }, 'AJOUTER UNE GARNITURE'),
          React.createElement(IconChevronRight, { size: 14 })
        ),
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('list_plats') },
          React.createElement(Text, { style: styles.adminBtnText }, 'LISTE DES PLATS'),
          React.createElement(IconChevronRight, { size: 14, color: '#f97316' })
        ),
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('list_sauces') },
          React.createElement(Text, { style: styles.adminBtnText }, 'LISTE DES SAUCES'),
          React.createElement(IconChevronRight, { size: 14, color: '#f97316' })
        ),
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('list_garnitures') },
          React.createElement(Text, { style: styles.adminBtnText }, 'LISTE DES GARNITURES'),
          React.createElement(IconChevronRight, { size: 14, color: '#f97316' })
        ),
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('logo') },
          React.createElement(Text, { style: styles.adminBtnText }, 'LOGOS & QR'),
          React.createElement(IconChevronRight, { size: 14 })
        ),
        React.createElement(
          Pressable,
          { style: styles.adminBtn, onPress: () => setActiveForm('history') },
          React.createElement(Text, { style: styles.adminBtnText }, 'HISTORIQUE DES VENTES'),
          React.createElement(IconChevronRight, { size: 14 })
        ),
        React.createElement(
          Pressable,
          { style: styles.exportBtn, onPress: () => handleExportCSV(orderHistory) },
          React.createElement(Text, { style: styles.exportText }, 'EXPORTER L\'HISTORIQUE (CSV)')
        )
      )
    )
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'space-between' },
  splashContainer: { flex: 1, backgroundColor: '#000000' },
  tablet: { flex: 1, width: '100%', maxWidth: 500, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 10 },
  logoWrapper: { width: '100%', alignItems: 'center', zIndex: 20, marginTop: 10 },
  logo: { width: 150, height: 80, resizeMode: 'contain' },
  brandText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  adminAccess: { position: 'absolute', top: 20, left: 25, zIndex: 100, padding: 10 },
  priceContainer: { height: 80, justifyContent: 'center', alignItems: 'center', zIndex: 10, marginTop: -10 },
  price: { fontSize: 64, fontWeight: '900', color: '#f97316', fontStyle: 'italic', textShadowColor: 'rgba(249, 115, 22, 0.4)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 15 },
  priceUnit: { fontSize: 20, color: '#f97316' },
  carouselContainer: { height: SCREEN_HEIGHT * 0.32, width: SCREEN_WIDTH, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  card: { width: CARD_WIDTH, height: CARD_WIDTH, justifyContent: 'center', alignItems: 'center', shadowColor: '#f97316', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 30 },
  itemImage: { width: '100%', height: '100%' },
  controlsSection: { width: '100%', paddingHorizontal: 20, marginTop: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  titleQtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000', borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  titleQtyBtnText: { color: '#f97316', fontSize: 24, fontWeight: 'bold' },
  itemNameText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', fontStyle: 'italic', textAlign: 'center', textTransform: 'uppercase', flex: 1 },
  selectorsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 },
  selectorBtn: { flex: 1, height: 45, borderWidth: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  selectorBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, fontStyle: 'italic' },
  qtyBadgeCenter: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' },
  qtyBadgeText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  extrasDropdown: { marginTop: 10, width: '100%' },
  extraItemVertical: { alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 20, backgroundColor: 'transparent', marginRight: 15, width: 80, height: 100 },
  extraItemActive: { borderColor: '#f97316', borderWidth: 2 },
  extraItemText: { color: '#fff', fontSize: 10, textAlign: 'center', fontWeight: '900', marginTop: 5 },
  extraImageSmall: { width: 50, height: 50, shadowColor: "#f97316", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  extraImageFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center' },
  extraPriceText: { color: '#f97316', fontSize: 9, fontWeight: '900' },
  orderBtnFixed: { position: 'absolute', bottom: 20, backgroundColor: '#f97316', width: '90%', padding: 18, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  orderText: { color: '#000', fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  successScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  successIconContainer: { marginBottom: 20 },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#f97316', marginBottom: 10, textTransform: 'uppercase' },
  successSubtitle: { fontSize: 14, color: '#fff', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  passBox: { backgroundColor: '#1a1a1a', padding: 30, borderRadius: 20, alignItems: 'center', width: '80%', gap: 20 },
  passInput: { borderWidth: 1, borderColor: '#555', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, color: '#fff', width: '100%' },
  passActions: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelBtn: { flex: 1, backgroundColor: '#555', padding: 12, borderRadius: 10, alignItems: 'center' },
  confirmBtn: { flex: 1, backgroundColor: '#f97316', padding: 12, borderRadius: 10, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { flex: 1, backgroundColor: '#000' },
  closeButton: { position: 'absolute', top: 20, right: 20, zIndex: 100, padding: 10 },
  scrollContent: { paddingBottom: 30 },
  headerSection: { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  checkoutTitleText: { fontSize: 20, fontWeight: '900', color: '#f97316', textTransform: 'uppercase' },
  headerSeparator: { height: 2, backgroundColor: '#f97316', marginTop: 10 },
  itemsList: { paddingHorizontal: 20, paddingVertical: 15 },
  itemRow: { marginBottom: 20 },
  itemMainLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemNameContainer: { flexDirection: 'row', alignItems: 'center' },
  orangeText: { color: '#f97316', fontWeight: '900', fontSize: 14 },
  whiteText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  itemPrice: { color: '#f97316', fontWeight: '900', fontSize: 16 },
  removeRowButton: { marginLeft: 15, padding: 5 },
  extrasContainer: { marginTop: 8, paddingLeft: 20 },
  extraDetailText: { color: '#ccc', fontSize: 11, marginTop: 4 },
  orangeExtraValue: { color: '#f97316', fontWeight: '900' },
  separator: { height: 1, backgroundColor: '#333', marginVertical: 15 },
  whiteCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 15, padding: 20, marginVertical: 20 },
  qrWrapper: { alignItems: 'center', marginBottom: 20 },
  qrImage: { width: 150, height: 150 },
  totalSection: { alignItems: 'center' },
  totalLabel: { fontSize: 12, color: '#666', fontWeight: '600' },
  totalValue: { fontSize: 32, fontWeight: '900', color: '#000', marginTop: 5 },
  confirmButton: { backgroundColor: '#f97316', marginHorizontal: 20, padding: 16, borderRadius: 50, alignItems: 'center', marginBottom: 20 },
  confirmButtonText: { color: '#000', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  adminRoot: { flex: 1, backgroundColor: '#000' },
  adminContainer: { paddingBottom: 30 },
  adminHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  adminTitle: { fontSize: 20, fontWeight: '900', color: '#f97316', textTransform: 'uppercase' },
  iconBtn: { padding: 10 },
  adminMenu: { paddingHorizontal: 20, paddingVertical: 15, gap: 10 },
  adminBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  adminBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  exportBtn: { backgroundColor: '#f97316', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  exportText: { color: '#000', fontWeight: '900', fontSize: 14, textTransform: 'uppercase' }
});

module.exports = App;
