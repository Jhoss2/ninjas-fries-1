import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, Pressable, TextInput, ScrollView,
  Modal, StyleSheet, Platform, useWindowDimensions, Alert
} from 'react-native';
import Svg, { Line, Polyline, Rect, Path, Circle } from 'react-native-svg';

import * as ImagePicker from 'expo-image-picker';
import { BleManager } from 'react-native-ble-plx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Buffer } from 'buffer';

// IMPORT UNIQUE POUR LA PERSISTANCE
import { Database } from './Database'; 

/* ===================== CONSTANTES ===================== */
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHAR_UUID   = '00002af1-0000-1000-8000-00805f9b34fb';

// Ta liste de couleurs est conservée pour la génération aléatoire
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

const IconMinus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
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
      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8
         a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
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

export const requestBlePermissions = async () => {
  if (Platform.OS === 'android') {
    // Note: Permissions directes pour Android moderne
    console.log("Demande de permissions Bluetooth...");
  }
};

export const scanAndConnectPrinter = async (onConnected) => {
  await requestBlePermissions();
  bleManager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.warn('BLE scan error', error);
      return;
    }
    if (device.name && device.name.toLowerCase().includes('printer')) {
      bleManager.stopDeviceScan();
      device.connect()
        .then(d => d.discoverAllServicesAndCharacteristics())
        .then(d => onConnected(d))
        .catch(err => console.warn('BLE connect error', err));
    }
  });
};

export const buildEscPosTicket = (order) => {
  let ticket = '';
  ticket += '\x1B\x40'; // init
  ticket += '\x1B\x61\x01'; // center
  ticket += "NINJA'S FRIES\n\n";
  ticket += '\x1B\x61\x00'; // left

  order.items.forEach(item => {
    ticket += `${item.quantity}x ${item.name}\n`;

    const extras = item.extras || {};
    const sauces = Array.isArray(extras.sauces) ? extras.sauces : [];
    const garnitures = Array.isArray(extras.garnitures) ? extras.garnitures : [];

    sauces.forEach(s => {
      if (s?.name) ticket += `  - Sauce: ${s.name}\n`;
    });

    garnitures.forEach(g => {
      if (g?.name) ticket += `  - Garniture: ${g.name}\n`;
    });
  });

  ticket += '\n--------------------------\n';
  ticket += `TOTAL: ${order.total} FCFA\n\n`;
  ticket += '\x1D\x56\x00'; // cut
  return ticket;
};
export const sendTicketToPrinter = async (printer, serviceUUID, characteristicUUID, ticket) => {
  const base64Data = Buffer.from(ticket, 'ascii').toString('base64');
  await printer.writeCharacteristicWithResponseForService(serviceUUID, characteristicUUID, base64Data);
};

export const printOrderViaBLE = async (order) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ticket = buildEscPosTicket(order);
      await scanAndConnectPrinter(async (device) => {
        const SERVICE_UUID = PRINTER_SERVICE_UUID;
        const CHARACTERISTIC_UUID = PRINTER_CHAR_UUID;
        await sendTicketToPrinter(device, SERVICE_UUID, CHARACTERISTIC_UUID, ticket);
        resolve(true);
      });
    } catch (err) {
      console.warn('Erreur impression BLE', err);
      reject(err);
    }
  });
};

export const exportOrdersToCSV = async (orderHistory) => {
  let csv = 'Date;Heure;Articles;Total\n';
  orderHistory.forEach(o => {
    const items = o.items.map(i => `${i.quantity}x ${i.name}`).join(' | ');
    csv += `${o.date};${o.time};${items};${o.total}\n`;
  });
  const fileUri = FileSystem.documentDirectory + `historique_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(fileUri);
};

export default function App() {
  /* ===================== ADAPTATION ÉCRAN ===================== */
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  /* ===================== ÉTATS (STATES) ===================== */
  const [view, setView] = useState('menu');
  const [appColor, setAppColor] = useState('#6200ee'); // Couleur persistante du jour
  const [logoUri, setLogoUri] = useState(null);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showSaucePicker, setShowSaucePicker] = useState(false);
  const [showGarniturePicker, setShowGarniturePicker] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const [menuItems, setMenuItems] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [garnitures, setGarnitures] = useState([]);

  const [selectedExtras, setSelectedExtras] = useState({
    sauces: [],
    garnitures: []
  });

  const [cart, setCart] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [editingId, setEditingId] = useState(null);

  /* ===================== PERSISTENCE SQL (Nouveau Bloc) ===================== */
  
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Initialise les tables si elles n'existent pas
        Database.init();

        // 2. Charge la couleur du jour (fixe pour 24h)
        const dailyColor = Database.getDailyColor();
        setAppColor(dailyColor);

        // 3. Charge le logo permanent
        const savedLogo = Database.getSetting('logo_uri');
        if (savedLogo) setLogoUri(savedLogo);

        // 4. Charge les produits depuis SQL
        const dbPlats = Database.getProducts('plat');
        const dbSauces = Database.getProducts('sauce');
        const dbGarnitures = Database.getProducts('garniture');
        
        setMenuItems(dbPlats);
        setSauces(dbSauces);
        setGarnitures(dbGarnitures);

        // 5. Charge l'historique des ventes
        const sales = Database.getSales();
        setOrderHistory(sales);

      } catch (e) {
        console.error("Erreur d'initialisation SQL :", e);
      }
    };

    initApp();
  }, []);

  // NOTE : Les anciens useEffect avec AsyncStorage.setItem ont été supprimés.
  // La sauvegarde se fera désormais par des appels directs à Database.saveProduct()
  // ou Database.saveSale() lors des actions utilisateur.
  /* ===================== NAVIGATION + QUANTITÉ ===================== */
  const nextItem = () => {
    if (menuItems.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % menuItems.length);
    setQuantity(1);
    resetExtras();
  };

  const prevItem = () => {
    if (menuItems.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
    setQuantity(1);
    resetExtras();
  };

  const updateQuantity = (val) => {
    setQuantity((prev) => Math.max(1, prev + val));
  };

  const resetExtras = () => {
    setSelectedExtras({ sauces: [], garnitures: [] });
    setShowSaucePicker(false);
    setShowGarniturePicker(false);
  };

  /* ===================== IMAGE UPLOAD ===================== */
  const handleImageUpload = async (callback) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission nécessaire pour accéder aux photos.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true
    });

    if (!result.canceled) {
      const base64 = result.assets[0].base64;
      callback(`data:image/jpeg;base64,${base64}`);
    }
  };

  /* ===================== EXTRAS ===================== */
  const toggleExtra = (type, item) => {
    const list = selectedExtras[type];
    const exists = list.find((i) => i.id === item.id);
    if (exists) {
      setSelectedExtras({
        ...selectedExtras,
        [type]: list.filter((i) => i.id !== item.id)
      });
    } else {
      setSelectedExtras({
        ...selectedExtras,
        [type]: [...list, item]
      });
    }
  };

  /* ===================== ADMIN ACCESS ===================== */
  const checkAdminAccess = () => {
    if (passwordInput === "NINJA'S CORPORATION") {
      setView('settings');
      setShowPassModal(false);
      setPasswordInput('');
    } else {
      console.warn('Mot de passe incorrect');
    }
  };

  /* ===================== CALCULS ===================== */
  const currentItem = menuItems.length > 0 ? menuItems[activeIndex] : null;

  const extrasPrice = selectedExtras.garnitures.reduce(
    (sum, g) => sum + (g.price || 0),
    0
  );

  const unitPrice = currentItem ? currentItem.price + extrasPrice : 0;
  const totalPrice = unitPrice * quantity;

  /* ===================== VALIDATION COMMANDE ===================== */
  const validateOrder = async () => {
  const orderData = {
    id: Date.now(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    items: [...cart],
    total: cart.reduce((s, i) => s + i.totalPrice, 0),
    status: 'en_attente'
  };

  setOrderHistory([orderData, ...orderHistory]);
  setCart([]);

  try {
    // On envoie le texte généré à ton imprimante
    await printOrderViaBLE(orderData); 
    console.log('Commande imprimée avec succès');
  } catch (err) {
    console.warn('Impossible d\'imprimer la commande', err);
  }

  setOrderSent(true);

  setTimeout(() => {
    setOrderSent(false);
    setView('menu');
  }, 4000);
};

  /* ===================== EXPORT CSV ===================== */
  const handleExportCSV = async () => {
    await exportOrdersToCSV(orderHistory);
  };

  const addToCart = () => {
    if (!currentItem) return;
    const newItem = {
      cartId: Date.now(),
      ...currentItem,
      quantity,
      extras: { ...selectedExtras },
      totalPrice
    };
    setCart([...cart, newItem]);
    setView('checkout');
  };

  /* ===================== ADMIN PANEL ===================== */
  const AdminPanel = ({
    styles,
    config,
    setConfig,
    menuItems,
    setMenuItems,
    sauces,
    setSauces,
    garnitures,
    setGarnitures,
    activeForm,
    setActiveForm,
    setView,
    orderHistory,
    handleExportCSV,
    handleImageUpload
  }) => {
    const [editingId, setEditingId] = useState(null);
    const [formItem, setFormItem] = useState({
      name: '',
      price: '',
      image: '',
      type: 'plat'
    });

    const handleAddItem = () => {
        if (!formItem.name) return;

        try {
            if (editingId) {
                // CAS 1 : MODIFICATION
                Database.updateProduct(
                    editingId,
                    formItem.name,
                    parseInt(formItem.price) || 0,
                    formItem.image
                );
                setEditingId(null);
            } else {
                // CAS 2 : AJOUT
                Database.saveProduct(
                    formItem.name,
                    parseInt(formItem.price) || 0,
                    formItem.image,
                    activeForm // 'plat', 'sauce' ou 'garniture'
                );
            }

            // MISE À JOUR DE L'INTERFACE
            setMenuItems(Database.getProducts('plat'));
            setSauces(Database.getProducts('sauce'));
            setGarnitures(Database.getProducts('garniture'));

            // RESET DU FORMULAIRE
            setActiveForm(null);
            setFormItem({ name: '', price: '', image: '', type: 'plat' });
            
            Alert.alert("Succès", "Base de données mise à jour");

        } catch (error) {
            console.error("Erreur SQL:", error);
            Alert.alert("Erreur", "Impossible d'enregistrer.");
        }
    }; // <--- La fonction handleAddItem se termine ici
    const handleDelete = (item) => {
  Alert.alert(
    "🗑️ SUPPRIMER",
    `Voulez-vous vraiment supprimer "${item.name}" ?`,
    [
      { text: "ANNULER", style: "cancel" },
      { 
        text: "OUI", 
        style: "destructive", 
        onPress: () => {
          try {
            // 1. Suppression physique dans SQLite
            Database.deleteProduct(item.id);

            // 2. Rafraîchissement des listes à l'écran
            setMenuItems(Database.getProducts('plat'));
            setSauces(Database.getProducts('sauce'));
            setGarnitures(Database.getProducts('garniture'));
            
          } catch (error) {
            console.error("Erreur suppression SQL:", error);
            Alert.alert("Erreur", "Impossible de supprimer l'article.");
          }
        } 
      }
    ]
  );
};

    return (
      <View style={styles.adminRoot}>
        <ScrollView contentContainerStyle={styles.adminContainer}>

          <View style={styles.adminHeader}>
            <Text style={styles.adminTitle}>PANNEAU DE CONFIGURATION</Text>
            <Pressable
              onPress={() => { setView('menu'); setActiveForm(null); }}
              style={styles.iconBtn}
            >
              <IconX size={16} />
            </Pressable>
          </View>

          {!activeForm && (
            <View style={styles.adminMenu}>

              <Pressable
                style={styles.adminBtn}
                onPress={() => setActiveForm('plat')}
              >
                <Text style={styles.adminBtnText}>AJOUTER UN PLAT</Text>
                <IconChevronRight size={14} />
              </Pressable>

              <Pressable
                style={styles.adminBtn}
                onPress={() => setActiveForm('sauce')}
              >
                <Text style={styles.adminBtnText}>AJOUTER UNE SAUCE</Text>
                <IconChevronRight size={14} />
              </Pressable>

              <Pressable
                style={styles.adminBtn}
                onPress={() => setActiveForm('garniture')}
              >
                <Text style={styles.adminBtnText}>AJOUTER UNE GARNITURE</Text>
                <IconChevronRight size={14} />
              </Pressable>

              <Pressable style={styles.adminBtn} onPress={() => setActiveForm('list_plats')}>
                <Text style={styles.adminBtnText}>LISTE DES PLATS</Text>
                <IconChevronRight size={14} color="#f97316" />
              </Pressable>

              <Pressable style={styles.adminBtn} onPress={() => setActiveForm('list_sauces')}>
                <Text style={styles.adminBtnText}>LISTE DES SAUCES</Text>
                <IconChevronRight size={14} color="#f97316" />
              </Pressable>

              <Pressable style={styles.adminBtn} onPress={() => setActiveForm('list_garnitures')}>
                <Text style={styles.adminBtnText}>LISTE DES GARNITURES</Text>
                <IconChevronRight size={14} color="#f97316" />
              </Pressable>

              <Pressable
                style={styles.adminBtn}
                onPress={() => setActiveForm('logo')}
              >
                <Text style={styles.adminBtnText}>LOGOS & QR</Text>
                <IconChevronRight size={14} />
              </Pressable>

              <Pressable
                style={styles.adminBtn}
                onPress={() => setActiveForm('history')}
              >
                <Text style={styles.adminBtnText}>HISTORIQUE DES VENTES</Text>
                <IconChevronRight size={14} />
              </Pressable>

              <Pressable
                style={styles.exportBtn}
                onPress={handleExportCSV}
              >
                <Text style={styles.exportText}>
                  EXPORTER L’HISTORIQUE (CSV)
                </Text>
              </Pressable>

            </View>
          )}

          {activeForm && (
            <View style={styles.adminFormWrapper}>

              <Pressable
                style={styles.backBtn}
                onPress={() => setActiveForm(null)}
              >
                <IconChevronLeft size={14} color="#777" />
                <Text style={styles.backText}>RETOUR</Text>
              </Pressable>

              <View style={styles.formCard}>

                {(activeForm === 'plat' ||
                  activeForm === 'sauce' ||
                  activeForm === 'garniture') && (
                  <>
                    <Text style={styles.formTitle}>
                      NOUVEAU {activeForm.toUpperCase()}
                    </Text>

                    <Pressable
                      style={styles.imagePicker}
                      onPress={() =>
                        handleImageUpload((res) =>
                          setFormItem({
                            ...formItem,
                            image: res,
                            type: activeForm
                          })
                        )
                      }
                    >
                      {formItem.image ? (
                        <Image
                          source={{ uri: formItem.image }}
                          style={styles.imagePreview}
                        />
                      ) : (
                        <IconCamera />
                      )}
                    </Pressable>

                    <TextInput
                      placeholder="Nom"
                      placeholderTextColor="#777"
                      style={styles.input}
                      value={formItem.name}
                      onChangeText={(t) =>
                        setFormItem({ ...formItem, name: t })
                      }
                    />

                    {activeForm !== 'sauce' && (
                      <TextInput
                        placeholder="Prix (FCFA)"
                        placeholderTextColor="#777"
                        keyboardType="numeric"
                        style={styles.input}
                        value={formItem.price}
                        onChangeText={(t) =>
                          setFormItem({ ...formItem, price: t })
                        }
                      />
                    )}

                    <Pressable
                      style={styles.saveBtn}
                      onPress={handleAddItem}
                    >
                      <Text style={styles.saveText}>ENREGISTRER</Text>
                    </Pressable>
                  </>
                )}

                {activeForm === 'logo' && (
                  <View style={{ gap: 20 }}>

                    <Text style={styles.formTitle}>LOGO PRINCIPAL</Text>
                    <Pressable
                      style={styles.logoPicker}
                      onPress={() =>
                        handleImageUpload((res) =>
                          setConfig({ ...config, logoUrl: res })
                        )
                      }
                    >
                      {config.logoUrl ? (
                        <Image
                          source={{ uri: config.logoUrl }}
                          style={styles.logoPreview}
                        />
                      ) : (
                        <IconCamera />
                      )}
                    </Pressable>

                    <Text style={styles.formTitle}>IMAGE QR CODE</Text>
                    <Pressable
                      style={styles.qrPicker}
                      onPress={() =>
                        handleImageUpload((res) =>
                          setConfig({ ...config, qrCodeUrl: res })
                        )
                      }
                    >
                      {config.qrCodeUrl ? (
                        <Image
                          source={{ uri: config.qrCodeUrl }}
                          style={styles.qrPreview}
                        />
                      ) : (
                        <IconCamera />
                      )}
                    </Pressable>
                  </View>
                )}

                {activeForm === 'history' && (
                  <ScrollView style={{ maxHeight: 400 }}>
                    {orderHistory.length === 0 ? (
                      <Text style={styles.emptyHistory}>
                        AUCUNE COMMANDE ENREGISTRÉE
                      </Text>
                    ) : (
                      orderHistory.map(order => (
                        <View
                          key={order.id}
                          style={[
                            styles.historyCard,
                            {
                              borderLeftColor:
                                DAILY_COLORS[
                                  parseInt(order.date.split('/')[0]) % 30
                                ] || '#f97316'
                            }
                          ]}
                        >
                          <View style={styles.historyHeader}>
                            <Text style={styles.historyDate}>
                              {order.date} - {order.time}
                            </Text>
                            <Text style={styles.historyTotal}>
                              {order.total} F
                            </Text>
                          </View>

                          {order.items.map((it, idx) => (
                            <View key={idx} style={styles.historyItem}>
                              <Text style={styles.historyItemText}>
                                {it.quantity}x {it.name}
                              </Text>
                              <Text style={styles.historyExtras}>
                                {it.extras.sauces.length > 0 &&
                                  `Sauces: ${it.extras.sauces
                                    .map(s => s.name)
                                    .join(', ')}`}
                                {it.extras.garnitures.length > 0 &&
                                  ` | Garnitures: ${it.extras.garnitures
                                    .map(g => g.name)
                                    .join(', ')}`}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))
                    )}
                  </ScrollView>
                )}

                {(activeForm === 'list_plats' || activeForm === 'list_sauces' || activeForm === 'list_garnitures') && (
                  <ScrollView style={{ maxHeight: 400, marginTop: 10 }}>
                    {(activeForm === 'list_plats' ? menuItems : activeForm === 'list_sauces' ? sauces : garnitures).map((item) => (
                      <View key={item.id} style={styles.adminHorizontalCard}>
                        <View style={styles.cardLeftContent}>
                          <Image source={{ uri: item.image }} style={styles.cardSmallThumb} />
                          <View>
                            <Text style={styles.cardMainText}>{item.name}</Text>
                            {activeForm !== 'list_sauces' && (
                              <Text style={styles.cardSubText}>{item.price} FCFA</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.cardActions}>
                          <Pressable 
                            style={styles.actionEdit} 
                            onPress={() => {
                              setEditingId(item.id);
                              setFormItem({ 
                                name: item.name, 
                                price: item.price ? item.price.toString() : '0', 
                                image: item.image, 
                                type: activeForm.replace('list_', '').replace(/s$/, '') 
                              });
                              setActiveForm(activeForm.replace('list_', '').replace(/s$/, ''));
                            }}
                          >
                            <Text style={styles.actionBtnText}>MODIFIER</Text>
                          </Pressable>
                          <Pressable onPress={() => handleDelete(item)}>
  <IconX size={20} color="#ef4444" />
</Pressable>
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

  return (
    <View style={styles.root}>
      <View style={styles.tablet}>
        <Pressable
          style={styles.adminAccess}
          onPress={() => setShowPassModal(true)}
        >
          <IconChevronRight size={20} />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.logoWrapper}>
            {config.logoUrl ? (
              <Image source={{ uri: config.logoUrl }} style={styles.logo} />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>
                  Ninja's Fries
                </Text>
              </View>
            )}
          </View>

          {currentItem ? (
            <Text style={styles.price}>
              {totalPrice} <Text style={styles.priceUnit}>FCFA</Text>
            </Text>
          ) : (
            <Text style={styles.emptyText}>
              CONFIGUREZ VOTRE INTERFACE 
            </Text>
          )}

          {menuItems.length > 0 && (
            <View style={styles.carousel}>
              <Pressable style={styles.navLeft} onPress={prevItem}>
                <IconChevronLeft size={44} />
              </Pressable>

              <Pressable style={styles.navRight} onPress={nextItem}>
                <IconChevronRight size={44} />
              </Pressable>

              {menuItems.map((item, idx) => {
                let scale = 0;
                let opacity = 0;

                if (idx === activeIndex) {
                  scale = 1.6;
                  opacity = 1;
                } else if (
                  idx === (activeIndex - 1 + menuItems.length) % menuItems.length ||
                  idx === (activeIndex + 1) % menuItems.length
                ) {
                  scale = 0.4;
                  opacity = 0.15;
                }

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.carouselItem,
                      { transform: [{ scale }], opacity }
                    ]}
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.itemImage}
                      />
                    ) : (
                      <View style={styles.imageFallback}>
                        <Text style={styles.imageFallbackText}>VISUEL</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {currentItem && (
            <View style={styles.quantityRow}>
              <Pressable onPress={() => updateQuantity(-1)}>
                <IconMinus />
              </Pressable>

              <Text style={styles.itemName}>
                {currentItem.name}
              </Text>

              <Pressable onPress={() => updateQuantity(1)}>
                <IconPlus />
              </Pressable>
            </View>
          )}

          {currentItem && (
            <View style={styles.pickers}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => {
                  setShowSaucePicker(!showSaucePicker);
                  setShowGarniturePicker(false);
                }}
              >
                <Text style={styles.pickerText}>
                  SAUCES ({selectedExtras.sauces.length})
                </Text>
              </Pressable>

              <Pressable
                style={styles.pickerBtnWide}
                onPress={() => {
                  setShowGarniturePicker(!showGarniturePicker);
                  setShowSaucePicker(false);
                }}
              >
                <Text style={styles.pickerText}>GARNITURES</Text>
                <IconPlus />
              </Pressable>

              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{quantity}</Text>
              </View>
            </View>
          )}

          {showSaucePicker && (
            <View style={styles.extrasDropdown}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {sauces.map((s) => (
                  <Pressable 
                    key={s.id} 
                    onPress={() => toggleExtra('sauces', s)}
                    style={[
                      styles.extraItemVertical, 
                      selectedExtras.sauces.find(x => x.id === s.id) && styles.extraItemActive
                    ]}
                  >
                    {s.image ? (
                      <Image source={{ uri: s.image }} style={styles.extraImageSmall} />
                    ) : (
                      <View style={styles.extraImageFallback}><Text style={{fontSize:8, color:'#555'}}>IMAGE</Text></View>
                    )}
                    <Text style={styles.extraItemText}>{s.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {showGarniturePicker && (
            <View style={styles.extrasDropdown}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {garnitures.map((g) => (
                  <Pressable 
                    key={g.id} 
                    onPress={() => toggleExtra('garnitures', g)}
                    style={[
                      styles.extraItemVertical, 
                      selectedExtras.garnitures.find(x => x.id === g.id) && styles.extraItemActive
                    ]}
                  >
                    {g.image ? (
                      <Image source={{ uri: g.image }} style={styles.extraImageSmall} />
                    ) : (
                      <View style={styles.extraImageFallback}><Text style={{fontSize:8, color:'#555'}}>IMAGE</Text></View>
                    )}
                    <Text style={styles.extraItemText}>{g.name}</Text>
                    <Text style={styles.extraPriceText}>+{g.price} F</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          
          {currentItem && (
            <Pressable style={styles.orderBtn} onPress={addToCart}>
              <Text style={styles.orderText}>AJOUTER AU PANIER</Text>
            </Pressable>
          )}
        </View>

        <Modal visible={view === 'checkout'} animationType="slide" transparent>
          <View style={styles.checkoutOverlay}>
            <View style={styles.checkoutSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>MON PANIER</Text>
                <Pressable onPress={() => setView('menu')} style={styles.closeSheet}>
                  <IconX size={24} />
                </Pressable>
              </View>

              <ScrollView style={styles.checkoutList}>
                {cart.map((item) => (
                  <View key={item.cartId} style={styles.checkoutCard}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardQty}>{item.quantity}x</Text>
                      <View>
                        <Text style={styles.cardName}>{item.name}</Text>
                        <Text style={styles.cardExtras}>
                          {[
                            ...item.extras.sauces.map(s => s.name),
                            ...item.extras.garnitures.map(g => g.name)
                          ].join(' • ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardPrice}>{item.totalPrice} F</Text>
                    <Pressable 
                      onPress={() => setCart(cart.filter(i => i.cartId !== item.cartId))}
                      style={styles.removeItem}
                    >
                      <IconX size={14} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.sheetFooter}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
                  <Text style={styles.totalValue}>
                    {cart.reduce((s, i) => s + i.totalPrice, 0)} FCFA
                  </Text>
                </View>
                
                <Pressable 
                  style={[styles.confirmOrderBtn, cart.length === 0 && { opacity: 0.5 }]} 
                  onPress={validateOrder}
                  disabled={cart.length === 0}
                >
                  <Text style={styles.confirmOrderText}>VALIDER ET IMPRIMER</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {orderSent && (
          <View style={styles.orderSent}>
            <IconCheck />
            <Text style={styles.orderSentTitle}>
              COMMANDE ENVOYÉE
            </Text>
            <Text style={styles.orderSentSubtitle}>
              VEUILLEZ RETIRER VOTRE TICKET
            </Text>
          </View>
        )}

        <Modal visible={showPassModal} transparent>
          <View style={styles.modal}>
            <View style={styles.passBox}>
              <IconLock />
              <TextInput
                secureTextEntry
                style={styles.passInput}
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="Code Corporation"
                placeholderTextColor="#777"
              />
              <View style={styles.passActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setShowPassModal(false)}
                >
                  <Text style={{color: 'white'}}>ANNULER</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmBtn}
                  onPress={checkAdminAccess}
                >
                  <Text style={{color: 'black'}}>ENTRER</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {view === 'settings' && (
          <AdminPanel
            styles={styles}
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
            handleExportCSV={handleExportCSV}
            handleImageUpload={handleImageUpload}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{ flex:1, backgroundColor:'#000', alignItems:'center', justifyContent:'center' },
  tablet:{ width:390, height:780, backgroundColor:'#09090b', borderRadius:48, overflow:'hidden' },
  adminAccess:{ position:'absolute', top:30, left:20, zIndex:50 },
  content:{ flex:1, padding:20, justifyContent:'space-between' },

  logoWrapper:{ alignItems:'center', marginTop:10 },
  logo:{ width:80, height:80, resizeMode:'contain' },
  logoFallback:{ width:80, height:80, borderRadius:40, backgroundColor:'#18181b', justifyContent:'center' },
  logoFallbackText:{ textAlign:'center', color:'#777', fontWeight:'900', fontStyle:'italic' },

  price: { 
    textAlign: 'center', 
    fontSize: 52,
    fontWeight: '900', 
    color: '#f97316',
    textShadowColor: 'rgba(249, 115, 22, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
    marginVertical: 10 
  },
  priceUnit: { 
    fontSize: 18,
    color: '#f97316',
    fontWeight: '700',
    marginLeft: 5
  },

  emptyText:{ textAlign:'center', color:'#444', fontWeight:'900' },

  carousel: { height: 260, justifyContent: 'center', alignItems: 'center' },
  carouselItem: { position: 'absolute' },
  itemImage: { 
    width: 180, 
    height: 180, 
    resizeMode: 'contain',
    backgroundColor: 'transparent',
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10
  },
  imageFallback: { 
    width: 160, 
    height: 160, 
    borderRadius: 80, 
    backgroundColor: 'transparent', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272a' 
  },
  imageFallbackText:{ textAlign:'center', color:'#555', fontWeight:'900' },
  
  navLeft:{ position:'absolute', left:-10, zIndex: 10 },
  navRight:{ position:'absolute', right:-10, zIndex: 10 },
  quantityRow:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12 },
  itemName:{ color:'#fff', fontWeight:'900', fontSize:14, textAlign:'center', maxWidth:200 },
  pickers:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  pickerBtn:{ flex:1, borderWidth:1, borderColor:'#27272a', padding:10, borderRadius:30 },
  pickerBtnWide:{ flex:1.2, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderColor:'#27272a', padding:10, borderRadius:30, marginLeft: 10 },
  pickerText:{ color:'#777', fontWeight:'900', fontSize:10 },
  extrasDropdown: { marginTop: 10 },
  extraItemVertical: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 15,
    backgroundColor: '#27272a',
    marginRight: 12,
    width: 90,
  },
  extraItemActive: { borderColor: '#f97316', borderWidth: 1 },
  extraItemText: { color: '#fff', fontSize: 10, textAlign: 'center' },
  extraImageSmall: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
    marginBottom: 5,
  },
  extraImageFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#18181b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  extraPriceText: {
    color: '#f97316',
    fontSize: 9,
    fontWeight: '900',
  },
  checkoutOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'flex-end' 
  },
  checkoutSheet: { 
    backgroundColor: '#18181b', 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    height: '85%', 
    padding: 25 
  },
  sheetHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  sheetTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  closeSheet: { backgroundColor: '#27272a', padding: 8, borderRadius: 20 },
  checkoutList: { flex: 1 },
  checkoutCard: { 
    backgroundColor: '#27272a', 
    borderRadius: 20, 
    padding: 15, 
    marginBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 },
  cardQty: { color: '#f97316', fontWeight: '900', fontSize: 18 },
  cardName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cardExtras: { color: '#777', fontSize: 12, marginTop: 4 },
  cardPrice: { color: '#fff', fontWeight: '900', fontSize: 16, marginRight: 10 },
  removeItem: { padding: 5 },
  sheetFooter: { borderTopWidth: 1, borderColor: '#27272a', paddingTop: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  totalLabel: { color: '#777', fontWeight: '900' },
  totalValue: { color: '#f97316', fontSize: 24, fontWeight: '900' },
  confirmOrderBtn: { backgroundColor: '#f97316', padding: 20, borderRadius: 20, alignItems: 'center' },
  confirmOrderText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  qtyBadge:{ width:32, height:32, borderRadius:16, backgroundColor:'#18181b', justifyContent:'center', marginLeft: 10 },
  qtyText:{ color:'#f97316', textAlign:'center', fontWeight:'900' },
  orderBtn:{ backgroundColor:'#f97316', padding:16, borderRadius:30, marginTop: 20 },
  orderText:{ textAlign:'center', fontWeight:'900', letterSpacing:3, color: '#000' },
  modal:{ flex:1, backgroundColor:'rgba(0,0,0,0.9)', justifyContent:'center', padding:20 },
  closeModal:{ position:'absolute', top:30, right:20 },
  cartList:{ marginTop:60 },
  cartItem:{ flexDirection:'row', justifyContent:'space-between', borderBottomWidth:1, borderColor:'#27272a', paddingVertical:10 },
  cartItemName:{ color:'#fff', fontWeight:'900', fontSize:10 },
  cartItemPrice:{ color:'#f97316', fontWeight:'900', fontSize:10 },
  validateBtn:{ backgroundColor:'#f97316', padding:18, borderRadius:30, marginTop:20 },
  validateText:{ textAlign:'center', fontWeight:'900' },
  orderSent:{ ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(249,115,22,0.9)', justifyContent:'center', alignItems:'center', zIndex: 200 },
  orderSentTitle:{ fontSize:28, fontWeight:'900', marginTop:20, color: '#000' },
  orderSentSubtitle:{ fontSize:10, fontWeight:'900', marginTop:10, color: '#000' },
  passBox:{ backgroundColor:'#18181b', padding:30, borderRadius:40, alignItems: 'center' },
  passInput:{ backgroundColor:'#27272a', color:'#fff', padding:14, borderRadius:20, marginVertical:20, textAlign:'center', width: '100%' },
  passActions:{ flexDirection:'row', gap:10 },
  cancelBtn:{ flex:1, backgroundColor:'#27272a', padding:14, borderRadius:20, alignItems:'center' },
  confirmBtn:{ flex:1, backgroundColor:'#f97316', padding:14, borderRadius:20, alignItems:'center' },
  adminRoot:{ ...StyleSheet.absoluteFillObject, backgroundColor:'#09090b', zIndex:100 },
  adminContainer:{ padding:20, gap:20 },
  adminHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  adminTitle:{ color:'#f97316', fontWeight:'900', fontSize:20 },
  iconBtn:{ padding:8 },
  adminMenu:{ gap:12, marginTop:20 },
  adminBtn:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#18181b', padding:14, borderRadius:20 },
  adminBtnText:{ color:'#fff', fontWeight:'900', fontSize:12 },
  exportBtn:{ backgroundColor:'#f97316', padding:14, borderRadius:20, marginTop:10, alignItems:'center' },
  exportText:{ color:'#000', fontWeight:'900', fontSize:12 },
  adminFormWrapper:{ marginTop:20 },
  backBtn:{ flexDirection:'row', alignItems:'center', gap:4, marginBottom:10 },
  backText:{ color:'#777', fontWeight:'900' },
  formCard:{ backgroundColor:'#18181b', padding:20, borderRadius:20 },
  formTitle:{ color:'#f97316', fontWeight:'900', fontSize:14, marginBottom:10 },
  imagePicker:{ width:80, height:80, borderRadius:12, backgroundColor:'#27272a', justifyContent:'center', alignItems:'center', marginBottom:10 },
  imagePreview:{ width:80, height:80, borderRadius:12, resizeMode:'contain' },
  logoPicker:{ width:80, height:80, borderRadius:12, backgroundColor:'#27272a', justifyContent:'center', alignItems:'center', marginBottom:10 },
  logoPreview:{ width:80, height:80, borderRadius:12, resizeMode:'contain' },
  qrPicker:{ width:80, height:80, borderRadius:12, backgroundColor:'#27272a', justifyContent:'center', alignItems:'center', marginBottom:10 },
  qrPreview:{ width:80, height:80, borderRadius:12, resizeMode:'contain' },
  input:{ backgroundColor:'#27272a', color:'#fff', padding:14, borderRadius:20, marginBottom:10 },
  saveBtn:{ backgroundColor:'#f97316', padding:14, borderRadius:20, marginTop:10, alignItems:'center' },
  saveText:{ fontWeight:'900', color:'#000', textAlign:'center' },
  historyCard:{ backgroundColor:'#18181b', borderLeftWidth:5, borderRadius:12, padding:10, marginVertical:6 },
  historyHeader:{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  historyDate:{ color:'#fff', fontWeight:'900', fontSize:10 },
  historyTotal:{ color:'#f97316', fontWeight:'900', fontSize:10 },
  historyItem:{ marginBottom:4 },
  historyItemText:{ color:'#fff', fontSize:10 },
  historyExtras:{ color:'#777', fontSize:9 },
  adminHorizontalCard: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 15,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 8,
  },
  cardLeftContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  cardSmallThumb: { 
    width: 50, 
    height: 50, 
    borderRadius: 8, 
    backgroundColor: '#000', 
    resizeMode: 'contain' 
  },
  cardMainText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  cardSubText: { 
    color: '#f97316', 
    fontSize: 12, 
    fontWeight: '900' 
  },
  cardActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 15 
  },
  actionEdit: { 
    backgroundColor: '#27272a', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#3b82f6' 
  },
  actionBtnText: { 
    color: '#3b82f6', 
    fontSize: 10, 
    fontWeight: '900' 
  },
  emptyHistory:{ color:'#777', textAlign:'center', fontStyle:'italic', marginTop:20 }
});
