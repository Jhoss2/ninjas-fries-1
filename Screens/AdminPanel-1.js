const React = require('react');
const { useState, useRef } = React;
const {
  View, Text, Image, Pressable, TextInput,
  ScrollView, StyleSheet, Alert, Animated,
} = require('react-native');

const { Database } = require('../Database');
const { FirestoreService } = require('../firebase/firestoreService');
const { IconX, IconCamera, IconChevronLeft, IconChevronRight } = require('../components/Icons');
const { DAILY_COLORS } = require('../constants');

/* ─────────────────────────────────────────
   COMPOSANT : ligne historique avec appui long
───────────────────────────────────────── */
const HistoryRow = ({ order, onDelete, dailyColor }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressTimer = useRef(null);

  const onPressIn = () => {
    pressTimer.current = setTimeout(() => {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 100, useNativeDriver: true }),
      ]).start();
      Alert.alert(
        'Supprimer cette commande ?',
        `${order.date} à ${order.time} — ${order.total} F\nCette action est irréversible.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(order.id) },
        ]
      );
    }, 600);
  };

  const onPressOut = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const items = JSON.parse(order.items || '[]');
  const isSync = order.synced === 1;
  const isPending = order.synced === 0;

  const extrasTotal = items.reduce((sum, item) => {
    const extras = JSON.parse(item.extras || '{}');
    return sum + (extras.garnitures || []).reduce((s, g) => s + (g.price || 0), 0) * item.quantity;
  }, 0);

  return (
    <Animated.View style={[styles.historyCard, { borderLeftColor: dailyColor, transform: [{ scale: scaleAnim }] }]}>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => {}}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyDate}>{order.date} — {order.time}</Text>
          <View style={styles.historyRightHeader}>
            {isSync  && <Text style={styles.syncBadge}>✓</Text>}
            {isPending && <Text style={styles.pendingBadge}>⟳</Text>}
            <Text style={styles.historyTotal}>{order.total} F</Text>
          </View>
        </View>
        <View style={styles.historyItemsBlock}>
          {items.map((it, idx) => {
            const extras = JSON.parse(it.extras || '{}');
            return (
              <View key={idx} style={styles.historyItem}>
                <Text style={styles.historyItemText}>
                  <Text style={styles.historyQty}>{it.quantity}×</Text>{' '}{it.name.toUpperCase()}
                </Text>
                {(extras.sauces || []).length > 0 && (
                  <Text style={styles.historyExtrasText}>Sauces : {extras.sauces.map(s => s.name).join(', ')}</Text>
                )}
                {(extras.garnitures || []).length > 0 && (
                  <Text style={styles.historyExtrasText}>Garnitures : {extras.garnitures.map(g => `${g.name} (+${g.price}F)`).join(', ')}</Text>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.historyFooter}>
          {extrasTotal > 0 && <Text style={styles.historyExtrasTotal}>dont {extrasTotal} F d'extras</Text>}
          <Text style={styles.longPressHint}>Maintenir pour supprimer</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

/* ─────────────────────────────────────────
   COMPOSANT PRINCIPAL : AdminPanel
───────────────────────────────────────── */
const AdminPanel = ({
  config, setConfig,
  menuItems, setMenuItems,
  sauces, setSauces,
  garnitures, setGarnitures,
  activeForm, setActiveForm,
  setView,
  orderHistory, setOrderHistory,
  handleExportCSV,
  handleImageUpload,
  cartId, setCartId,
}) => {
  const [formItem, setFormItem]     = useState({ name: '', price: '', image: '', type: 'plat' });
  const [editingId, setEditingId]   = useState(null);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass]       = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [cartIdInput, setCartIdInput] = useState(cartId || '');
  const [filterDate, setFilterDate] = useState('');

  /* ── Produits ── */
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
    } catch (e) { console.error('SQL:', e); }
  };

  /* ── Mot de passe ── */
  const handleChangePassword = async () => {
    const stored = Database.getSetting('adminPassword') || "NINJA'S CORPORATION";
    if (currentPass !== stored) { Alert.alert('Erreur', 'Mot de passe actuel incorrect.'); return; }
    if (newPass.length < 4)     { Alert.alert('Erreur', 'Minimum 4 caractères.'); return; }
    if (newPass !== confirmPass) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return; }
    await Database.saveSettingSync(cartId, 'adminPassword', newPass);
    setCurrentPass(''); setNewPass(''); setConfirmPass('');
    Alert.alert('Succès', 'Mot de passe mis à jour.');
  };

  /* ── Cart ID ── */
  const handleSaveCartId = async () => {
    const trimmed = cartIdInput.trim();
    if (!trimmed) { Alert.alert('Erreur', 'L\'identifiant ne peut pas être vide.'); return; }
    await Database.saveSettingSync(null, 'cartId', trimmed);
    await FirestoreService.initCart(trimmed, trimmed);
    setCartId(trimmed);
    Alert.alert('Succès', `Food cart identifié comme "${trimmed}" dans Firebase.`);
  };

  /* ── Background ── */
  const handlePickBackground = () => {
    handleImageUpload(async (uri) => {
      await Database.saveSettingSync(cartId, 'backgroundUrl', uri);
      setConfig(prev => ({ ...prev, backgroundUrl: uri }));
    });
  };

  const handleRemoveBackground = async () => {
    await Database.saveSettingSync(cartId, 'backgroundUrl', '');
    setConfig(prev => ({ ...prev, backgroundUrl: '' }));
  };

  /* ── Suppression commande ── */
  const handleDeleteOrder = async (orderId) => {
    await Database.deleteOrder(orderId, cartId);
    setOrderHistory(Database.getOrders());
  };

  /* ── Historique filtré ── */
  const filteredOrders = filterDate
    ? orderHistory.filter(o => o.date && o.date.includes(filterDate))
    : orderHistory;
  const totalJour = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);

  /* ════════════════════════════════════════ RENDU ════════════════════════════════════════ */
  return (
    <View style={styles.adminRoot}>
      <ScrollView contentContainerStyle={styles.adminContainer} keyboardShouldPersistTaps="handled">

        <View style={styles.adminHeader}>
          <Text style={styles.adminTitle}>CONFIGURATION</Text>
          <Pressable onPress={() => { setView('menu'); setActiveForm(null); }} style={styles.iconBtn}>
            <IconX size={16} />
          </Pressable>
        </View>

        {!activeForm && (
          <View style={styles.adminMenu}>
            <Text style={styles.sectionLabel}>CATALOGUE</Text>
            {[
              { key: 'plat',            label: 'Ajouter un plat' },
              { key: 'sauce',           label: 'Ajouter une sauce' },
              { key: 'garniture',       label: 'Ajouter une garniture' },
              { key: 'list_plats',      label: 'Liste des plats' },
              { key: 'list_sauces',     label: 'Liste des sauces' },
              { key: 'list_garnitures', label: 'Liste des garnitures' },
            ].map(item => (
              <Pressable key={item.key} style={styles.adminBtn} onPress={() => setActiveForm(item.key)}>
                <Text style={styles.adminBtnText}>{item.label.toUpperCase()}</Text>
                <IconChevronRight size={14} />
              </Pressable>
            ))}

            <Text style={styles.sectionLabel}>APPARENCE</Text>
            {[
              { key: 'logo',       label: 'Logos & QR code' },
              { key: 'background', label: "Fond de l'écran d'accueil" },
            ].map(item => (
              <Pressable key={item.key} style={styles.adminBtn} onPress={() => setActiveForm(item.key)}>
                <Text style={styles.adminBtnText}>{item.label.toUpperCase()}</Text>
                <IconChevronRight size={14} />
              </Pressable>
            ))}

            <Text style={styles.sectionLabel}>VENTES</Text>
            <Pressable style={styles.adminBtn} onPress={() => setActiveForm('history')}>
              <Text style={styles.adminBtnText}>HISTORIQUE DES VENTES</Text>
              <IconChevronRight size={14} />
            </Pressable>
            <Pressable style={styles.exportBtn} onPress={() => handleExportCSV(orderHistory)}>
              <Text style={styles.exportText}>EXPORTER L'HISTORIQUE (CSV)</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>SÉCURITÉ & FIREBASE</Text>
            {[
              { key: 'password', label: 'Changer le mot de passe' },
              { key: 'cartid',   label: 'Identifiant food cart (Firebase)' },
            ].map(item => (
              <Pressable key={item.key} style={styles.adminBtn} onPress={() => setActiveForm(item.key)}>
                <Text style={styles.adminBtnText}>{item.label.toUpperCase()}</Text>
                <IconChevronRight size={14} />
              </Pressable>
            ))}
          </View>
        )}

        {activeForm && (
          <View style={styles.adminFormWrapper}>
            <Pressable style={styles.backBtn} onPress={() => setActiveForm(null)}>
              <IconChevronLeft size={14} color="#777" />
              <Text style={styles.backText}>RETOUR</Text>
            </Pressable>
            <View style={styles.formCard}>

              {/* Ajout / modification produit */}
              {(activeForm === 'plat' || activeForm === 'sauce' || activeForm === 'garniture') && (
                <>
                  <Text style={styles.formTitle}>{editingId ? 'MODIFIER' : 'NOUVEAU'} {activeForm.toUpperCase()}</Text>
                  <Pressable style={styles.imagePicker} onPress={() => handleImageUpload((res) => setFormItem({ ...formItem, image: res, type: activeForm }))}>
                    {formItem.image ? <Image source={{ uri: formItem.image }} style={styles.imagePreview} /> : <IconCamera />}
                  </Pressable>
                  <TextInput placeholder="Nom" placeholderTextColor="#777" style={styles.input} value={formItem.name} onChangeText={(t) => setFormItem({ ...formItem, name: t })} />
                  {activeForm !== 'sauce' && (
                    <TextInput placeholder="Prix (FCFA)" placeholderTextColor="#777" keyboardType="numeric" style={styles.input} value={formItem.price} onChangeText={(t) => setFormItem({ ...formItem, price: t })} />
                  )}
                  <Pressable style={styles.saveBtn} onPress={handleAddItem}><Text style={styles.saveText}>ENREGISTRER</Text></Pressable>
                </>
              )}

              {/* Logo & QR */}
              {activeForm === 'logo' && (
                <View style={{ gap: 20 }}>
                  <Text style={styles.formTitle}>LOGO PRINCIPAL</Text>
                  <Pressable style={styles.logoPicker} onPress={() => handleImageUpload((res) => { Database.saveSettingSync(cartId, 'logoUrl', res); setConfig(p => ({ ...p, logoUrl: res })); })}>
                    {config.logoUrl ? <Image source={{ uri: config.logoUrl }} style={styles.logoPreview} /> : <IconCamera />}
                  </Pressable>
                  <Text style={styles.formTitle}>IMAGE QR CODE</Text>
                  <Pressable style={styles.qrPicker} onPress={() => handleImageUpload((res) => { Database.saveSettingSync(cartId, 'qrCodeUrl', res); setConfig(p => ({ ...p, qrCodeUrl: res })); })}>
                    {config.qrCodeUrl ? <Image source={{ uri: config.qrCodeUrl }} style={styles.qrPreview} /> : <IconCamera />}
                  </Pressable>
                </View>
              )}

              {/* Background */}
              {activeForm === 'background' && (
                <View style={{ gap: 16 }}>
                  <Text style={styles.formTitle}>FOND D'ÉCRAN D'ACCUEIL</Text>
                  <Text style={styles.formSubtitle}>Choisissez une image depuis votre galerie. Elle remplacera le fond noir de l'écran principal.</Text>
                  <Pressable style={styles.bgPicker} onPress={handlePickBackground}>
                    {config.backgroundUrl
                      ? <Image source={{ uri: config.backgroundUrl }} style={styles.bgPreview} />
                      : <View style={styles.bgPlaceholder}><IconCamera /><Text style={styles.bgPlaceholderText}>CHOISIR UNE IMAGE</Text></View>}
                  </Pressable>
                  {!!config.backgroundUrl && (
                    <Pressable style={styles.dangerBtn} onPress={handleRemoveBackground}>
                      <Text style={styles.dangerBtnText}>SUPPRIMER LE FOND</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Mot de passe */}
              {activeForm === 'password' && (
                <View>
                  <Text style={styles.formTitle}>CHANGER LE MOT DE PASSE</Text>
                  <Text style={styles.formSubtitle}>Mot de passe par défaut : NINJA'S CORPORATION</Text>
                  <TextInput placeholder="Mot de passe actuel" placeholderTextColor="#777" secureTextEntry style={styles.input} value={currentPass} onChangeText={setCurrentPass} />
                  <TextInput placeholder="Nouveau mot de passe" placeholderTextColor="#777" secureTextEntry style={styles.input} value={newPass} onChangeText={setNewPass} />
                  <TextInput placeholder="Confirmer le nouveau mot de passe" placeholderTextColor="#777" secureTextEntry style={styles.input} value={confirmPass} onChangeText={setConfirmPass} />
                  <Pressable style={styles.saveBtn} onPress={handleChangePassword}><Text style={styles.saveText}>METTRE À JOUR</Text></Pressable>
                </View>
              )}

              {/* Cart ID */}
              {activeForm === 'cartid' && (
                <View>
                  <Text style={styles.formTitle}>IDENTIFIANT DU FOOD CART</Text>
                  <Text style={styles.formSubtitle}>Cet identifiant unique relie ce téléphone à un food cart dans Firebase.{'\n'}Exemple : cart_ouaga_1, cart_centre, cart_01</Text>
                  {cartId ? (
                    <View style={styles.currentCartBadge}>
                      <Text style={styles.currentCartLabel}>ID ACTUEL</Text>
                      <Text style={styles.currentCartValue}>{cartId}</Text>
                    </View>
                  ) : (
                    <View style={styles.warningBadge}>
                      <Text style={styles.warningText}>Aucun ID configuré — commandes non synchronisées</Text>
                    </View>
                  )}
                  <TextInput placeholder="Nouvel identifiant (ex: cart_01)" placeholderTextColor="#777" style={styles.input} value={cartIdInput} onChangeText={setCartIdInput} autoCapitalize="none" />
                  <Pressable style={styles.saveBtn} onPress={handleSaveCartId}><Text style={styles.saveText}>ENREGISTRER ET CONNECTER</Text></Pressable>
                </View>
              )}

              {/* Historique */}
              {activeForm === 'history' && (
                <View>
                  <Text style={styles.formTitle}>HISTORIQUE DES VENTES</Text>
                  <View style={styles.filterRow}>
                    <TextInput placeholder="Filtrer par date (ex: 27/03)" placeholderTextColor="#555" style={[styles.input, { flex: 1, marginBottom: 0 }]} value={filterDate} onChangeText={setFilterDate} />
                    {!!filterDate && <Pressable onPress={() => setFilterDate('')} style={styles.clearFilter}><IconX size={14} color="#777" /></Pressable>}
                  </View>
                  <View style={styles.dayTotalRow}>
                    <Text style={styles.dayTotalLabel}>{filterDate ? `TOTAL DU ${filterDate}` : 'TOTAL GÉNÉRAL'}</Text>
                    <Text style={styles.dayTotalValue}>{totalJour} F</Text>
                  </View>
                  <Text style={styles.dayTotalCount}>{filteredOrders.length} commande(s)</Text>
                  <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
                    {filteredOrders.length === 0
                      ? <Text style={styles.emptyHistory}>AUCUNE COMMANDE{filterDate ? ` LE ${filterDate}` : ''}</Text>
                      : filteredOrders.map(order => (
                        <HistoryRow
                          key={order.id}
                          order={order}
                          onDelete={handleDeleteOrder}
                          dailyColor={DAILY_COLORS[parseInt(order.date?.split('/')[0] || '0') % 30] || '#f97316'}
                        />
                      ))
                    }
                  </ScrollView>
                </View>
              )}

              {/* Listes produits */}
              {(activeForm === 'list_plats' || activeForm === 'list_sauces' || activeForm === 'list_garnitures') && (
                <ScrollView style={{ maxHeight: 400, marginTop: 10 }} nestedScrollEnabled>
                  {(activeForm === 'list_plats' ? menuItems : activeForm === 'list_sauces' ? sauces : garnitures).map((item) => (
                    <View key={item.id} style={styles.adminHorizontalCard}>
                      <View style={styles.cardLeftContent}>
                        <Image source={{ uri: item.image }} style={styles.cardSmallThumb} />
                        <View>
                          <Text style={styles.cardMainText}>{item.name.toUpperCase()}</Text>
                          {activeForm !== 'list_sauces' && <Text style={styles.cardSubText}>{item.price} FCFA</Text>}
                        </View>
                      </View>
                      <View style={styles.cardActions}>
                        <Pressable style={styles.actionEdit} onPress={() => { setEditingId(item.id); setFormItem({ name: item.name, price: item.price.toString(), image: item.image, type: activeForm.replace('list_', '').replace(/s$/, '') }); setActiveForm(activeForm.replace('list_', '').replace(/s$/, '')); }}>
                          <Text style={styles.actionBtnText}>MODIFIER</Text>
                        </Pressable>
                        <Pressable onPress={() => { Database.deleteProduct(item.id); setMenuItems(Database.getProducts('plat') || []); setSauces(Database.getProducts('sauce') || []); setGarnitures(Database.getProducts('garniture') || []); }}>
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

const styles = StyleSheet.create({
  adminRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: '#09090b', zIndex: 100 },
  adminContainer: { padding: 25, gap: 20 },
  adminHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adminTitle: { color: '#f97316', fontWeight: '900', fontSize: 22, fontStyle: 'italic' },
  iconBtn: { padding: 10 },
  sectionLabel: { color: '#444', fontWeight: '900', fontSize: 11, letterSpacing: 2, marginTop: 8, marginBottom: 2 },
  adminMenu: { gap: 10 },
  adminBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#18181b', padding: 18, borderRadius: 25 },
  adminBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, fontStyle: 'italic' },
  exportBtn: { backgroundColor: '#f97316', padding: 18, borderRadius: 25, marginTop: 5, alignItems: 'center' },
  exportText: { color: '#000', fontWeight: '900', fontSize: 14 },
  adminFormWrapper: { marginTop: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  backText: { color: '#777', fontWeight: '900', fontSize: 16 },
  formCard: { backgroundColor: '#18181b', padding: 25, borderRadius: 30 },
  formTitle: { color: '#f97316', fontWeight: '900', fontSize: 16, marginBottom: 10, fontStyle: 'italic' },
  formSubtitle: { color: '#666', fontSize: 13, marginBottom: 18, lineHeight: 20 },
  imagePicker: { width: 100, height: 100, borderRadius: 20, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  imagePreview: { width: 100, height: 100, borderRadius: 20, resizeMode: 'contain' },
  logoPicker: { width: 100, height: 100, borderRadius: 20, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  logoPreview: { width: 100, height: 100, borderRadius: 20, resizeMode: 'contain' },
  qrPicker: { width: 100, height: 100, borderRadius: 20, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  qrPreview: { width: 100, height: 100, borderRadius: 20, resizeMode: 'contain' },
  bgPicker: { width: '100%', height: 180, borderRadius: 20, backgroundColor: '#27272a', overflow: 'hidden', marginBottom: 10 },
  bgPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  bgPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bgPlaceholderText: { color: '#555', fontWeight: '900', fontSize: 12 },
  input: { backgroundColor: '#27272a', color: '#fff', padding: 16, borderRadius: 25, marginBottom: 15, fontSize: 16 },
  saveBtn: { backgroundColor: '#f97316', padding: 18, borderRadius: 25, marginTop: 10, alignItems: 'center' },
  saveText: { fontWeight: '900', color: '#000', textAlign: 'center', fontSize: 16 },
  dangerBtn: { backgroundColor: '#27272a', borderWidth: 1, borderColor: '#ef4444', padding: 16, borderRadius: 25, alignItems: 'center' },
  dangerBtnText: { color: '#ef4444', fontWeight: '900', fontSize: 14 },
  currentCartBadge: { backgroundColor: '#0d1f0d', borderWidth: 1, borderColor: '#22c55e', borderRadius: 15, padding: 14, marginBottom: 18 },
  currentCartLabel: { color: '#22c55e', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  currentCartValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 4 },
  warningBadge: { backgroundColor: '#1f1000', borderWidth: 1, borderColor: '#f97316', borderRadius: 15, padding: 14, marginBottom: 18 },
  warningText: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  clearFilter: { padding: 10 },
  dayTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  dayTotalLabel: { color: '#666', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  dayTotalValue: { color: '#f97316', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  dayTotalCount: { color: '#444', fontSize: 11, marginBottom: 15 },
  historyCard: { backgroundColor: '#111', borderLeftWidth: 4, borderRadius: 15, padding: 14, marginVertical: 6 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyDate: { color: '#aaa', fontWeight: '700', fontSize: 12 },
  historyRightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTotal: { color: '#f97316', fontWeight: '900', fontSize: 16 },
  syncBadge: { color: '#22c55e', fontSize: 12, fontWeight: '900' },
  pendingBadge: { color: '#f59e0b', fontSize: 12, fontWeight: '900' },
  historyItemsBlock: { marginBottom: 8 },
  historyItem: { marginBottom: 6 },
  historyItemText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  historyQty: { color: '#f97316', fontWeight: '900' },
  historyExtrasText: { color: '#666', fontSize: 11, marginLeft: 16, marginTop: 2 },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  historyExtrasTotal: { color: '#555', fontSize: 11, fontStyle: 'italic' },
  longPressHint: { color: '#333', fontSize: 10, fontStyle: 'italic' },
  adminHorizontalCard: { flexDirection: 'row', backgroundColor: '#18181b', borderRadius: 20, padding: 15, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#27272a', marginBottom: 12 },
  cardLeftContent: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cardSmallThumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#000', resizeMode: 'contain' },
  cardMainText: { color: '#fff', fontWeight: '900', fontSize: 16, fontStyle: 'italic' },
  cardSubText: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  actionEdit: { backgroundColor: '#27272a', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6' },
  actionBtnText: { color: '#3b82f6', fontSize: 12, fontWeight: '900' },
  emptyHistory: { color: '#555', textAlign: 'center', fontStyle: 'italic', marginTop: 30, fontSize: 14, paddingBottom: 20 },
});

module.exports = AdminPanel;
