const React = require('react');
const { useState, useEffect } = React;
const {
  View, Text, Image, Pressable, ScrollView,
  StyleSheet, SafeAreaView
} = require('react-native');
const { BlurView } = require('expo-blur');

const { Database } = require('../Database');
const { IconX } = require('../components/Icons');
const { SCREEN_WIDTH } = require('../constants');

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
                <Text style={{ color: '#ccc', fontSize: 12 }}>QR CODE</Text>
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

const styles = StyleSheet.create({
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
});

module.exports = CheckoutScreen;
