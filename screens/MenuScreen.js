const React = require('react');
const { useRef, useState, useCallback, memo } = React;
const {
  View, Text, Image, Pressable,
  ScrollView, StyleSheet, Animated
} = require('react-native');

const { SCREEN_WIDTH, CARD_WIDTH, ITEM_SIZE } = require('../constants');

/* ═══════════════════════════════════════════════════════
   CARROUSEL — composant totalement isolé et mémorisé.
   Gère son propre scrollX et son propre currentIndex.
   Ne reçoit que la liste des plats et un callback
   onItemChange → zéro re-render depuis l'extérieur.
═══════════════════════════════════════════════════════ */
const Carousel = memo(({ items, onItemChange }) => {
  const scrollX = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (event) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_SIZE);
        if (index >= 0 && index < items.length) {
          onItemChange(index);
        }
      },
    }
  );

  return (
    <View style={styles.carouselContainer}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        snapToInterval={ITEM_SIZE}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: (SCREEN_WIDTH - ITEM_SIZE) / 2 }}
      >
        {items.map((item, index) => {
          const scale = scrollX.interpolate({
            inputRange: [
              (index - 1) * ITEM_SIZE,
              index * ITEM_SIZE,
              (index + 1) * ITEM_SIZE,
            ],
            outputRange: [0.4, 1.25, 0.4],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange: [
              (index - 1) * ITEM_SIZE,
              index * ITEM_SIZE,
              (index + 1) * ITEM_SIZE,
            ],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <View
              key={item.id}
              style={{ width: ITEM_SIZE, alignItems: 'center', justifyContent: 'center' }}
            >
              <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
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
  );
});

/* ═══════════════════════════════════════════════════════
   EXTRAS PICKER — mémorisé pour ne pas bouger le carrousel
═══════════════════════════════════════════════════════ */
const ExtrasPicker = memo(({ items, selected, onToggle, showPrice }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    {items.map((s) => (
      <Pressable
        key={s.id}
        onPress={() => onToggle(s)}
        style={[
          styles.extraItemVertical,
          selected.find(x => x.id === s.id) && styles.extraItemActive,
        ]}
      >
        {s.image
          ? <Image source={{ uri: s.image }} style={styles.extraImageSmall} resizeMode="contain" />
          : <View style={styles.extraImageFallback}><Text style={{ fontSize: 8, color: '#555' }}>IMAGE</Text></View>
        }
        <Text style={styles.extraItemText}>{s.name.toUpperCase()}</Text>
        {showPrice && <Text style={styles.extraPriceText}>+{s.price} F</Text>}
      </Pressable>
    ))}
  </ScrollView>
));

/* ═══════════════════════════════════════════════════════
   MENU SCREEN PRINCIPAL
═══════════════════════════════════════════════════════ */
const MenuScreen = ({
  config,
  menuItems,
  sauces,
  garnitures,
  onAddToCart,
  onAdminPress,
}) => {
  // Tous les états locaux ici — aucun ne remonte vers App
  const [currentIndex, setCurrentIndex]     = useState(0);
  const [quantity, setQuantity]             = useState(1);
  const [showSaucePicker, setShowSaucePicker]         = useState(false);
  const [showGarniturePicker, setShowGarniturePicker] = useState(false);
  const [selectedSauces, setSelectedSauces]       = useState([]);
  const [selectedGarnitures, setSelectedGarnitures] = useState([]);

  const currentItem   = menuItems.length > 0 ? menuItems[currentIndex] : null;
  const extrasPrice   = selectedGarnitures.reduce((sum, g) => sum + (g.price || 0), 0);
  const unitPrice     = currentItem ? currentItem.price + extrasPrice : 0;
  const totalPrice    = unitPrice * quantity;

  const updateQuantity = useCallback((val) => {
    setQuantity((prev) => Math.max(1, prev + val));
  }, []);

  // Appelé par le Carousel — mémorisé pour ne PAS recréer le composant
  const handleItemChange = useCallback((index) => {
    setCurrentIndex(index);
    setQuantity(1);
    setSelectedSauces([]);
    setSelectedGarnitures([]);
    setShowSaucePicker(false);
    setShowGarniturePicker(false);
  }, []);

  const toggleSauce = useCallback((item) => {
    setSelectedSauces(prev => {
      const exists = prev.find(i => i.id === item.id);
      return exists ? prev.filter(i => i.id !== item.id) : [...prev, item];
    });
  }, []);

  const toggleGarniture = useCallback((item) => {
    setSelectedGarnitures(prev => {
      const exists = prev.find(i => i.id === item.id);
      return exists ? prev.filter(i => i.id !== item.id) : [...prev, item];
    });
  }, []);

  const handleOrder = useCallback(() => {
    onAddToCart(totalPrice, {
      sauces: selectedSauces,
      garnitures: selectedGarnitures,
    }, currentIndex);
    setQuantity(1);
    setSelectedSauces([]);
    setSelectedGarnitures([]);
    setShowSaucePicker(false);
    setShowGarniturePicker(false);
  }, [totalPrice, selectedSauces, selectedGarnitures, currentIndex]);

  return (
    <>
      {/* HAUT */}
      <View style={styles.fixedTop}>
        <View style={styles.logoWrapper}>
          {config.logoUrl
            ? <Image source={{ uri: config.logoUrl }} style={styles.logo} />
            : <Text style={styles.brandText}>NINJA <Text style={{ color: '#f97316' }}>FRIES</Text></Text>
          }
        </View>
        <Pressable style={styles.adminAccess} onPress={onAdminPress}>
          <Text style={{ color: '#f97316', fontSize: 24 }}>⚙</Text>
        </Pressable>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            {currentItem ? totalPrice : 0}
            <Text style={styles.priceUnit}> FCFA</Text>
          </Text>
        </View>
      </View>

      {/* CARROUSEL — composant isolé */}
      <Carousel items={menuItems} onItemChange={handleItemChange} />

      {/* BAS */}
      <View style={styles.fixedBottom}>
        <View style={styles.controlsWrapper}>

          {/* [-] NOM [+] */}
          <View style={styles.titleRow}>
            <Pressable style={styles.titleQtyBtn} onPress={() => updateQuantity(-1)}>
              <Text style={styles.titleQtyBtnText}>-</Text>
            </Pressable>
            <Text style={styles.itemNameText}>{currentItem?.name.toUpperCase()}</Text>
            <Pressable style={styles.titleQtyBtn} onPress={() => updateQuantity(1)}>
              <Text style={styles.titleQtyBtnText}>+</Text>
            </Pressable>
          </View>

          {/* [SAUCES] (QTÉ) [GARNITURES] */}
          <View style={styles.selectorsRow}>
            <Pressable
              style={[styles.selectorBtn, { borderColor: '#f97316' }]}
              onPress={() => { setShowSaucePicker(v => !v); setShowGarniturePicker(false); }}
            >
              <Text style={styles.selectorBtnText}>SAUCES ({selectedSauces.length})</Text>
            </Pressable>

            <View style={styles.qtyBadgeCenter}>
              <Text style={styles.qtyBadgeText}>{quantity}</Text>
            </View>

            <Pressable
              style={[styles.selectorBtn, { borderColor: '#f97316' }]}
              onPress={() => { setShowGarniturePicker(v => !v); setShowSaucePicker(false); }}
            >
              <Text style={styles.selectorBtnText}>GARNITURES</Text>
            </Pressable>
          </View>

          {/* EXTRAS */}
          {showSaucePicker && (
            <View style={styles.extrasDropdown}>
              <ExtrasPicker
                items={sauces}
                selected={selectedSauces}
                onToggle={toggleSauce}
                showPrice={false}
              />
            </View>
          )}
          {showGarniturePicker && (
            <View style={styles.extrasDropdown}>
              <ExtrasPicker
                items={garnitures}
                selected={selectedGarnitures}
                onToggle={toggleGarniture}
                showPrice={true}
              />
            </View>
          )}
        </View>

        <Pressable style={styles.orderBtnBottom} onPress={handleOrder}>
          <Text style={styles.orderText}>COMMANDER</Text>
        </Pressable>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  fixedTop: { width: '100%', alignItems: 'center', zIndex: 50, paddingBottom: 10 },
  logoWrapper: { width: '100%', alignItems: 'center', marginTop: 10 },
  logo: { width: 150, height: 80, resizeMode: 'contain', backgroundColor: 'transparent' },
  brandText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  adminAccess: { position: 'absolute', top: 20, left: 25, zIndex: 100, padding: 10 },
  priceContainer: { height: 80, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  price: { fontSize: 64, fontWeight: '900', color: '#f97316', fontStyle: 'italic', textShadowColor: 'rgba(249, 115, 22, 0.4)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 15 },
  priceUnit: { fontSize: 20, color: '#f97316' },
  carouselContainer: { flex: 1, width: SCREEN_WIDTH, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  card: { width: CARD_WIDTH, height: CARD_WIDTH, justifyContent: 'center', alignItems: 'center', shadowColor: '#f97316', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 30, backgroundColor: 'transparent' },
  itemImage: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  fixedBottom: { width: '100%', paddingHorizontal: 20, paddingBottom: 20, zIndex: 50 },
  controlsWrapper: { width: '100%', marginBottom: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  titleQtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000', borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  titleQtyBtnText: { color: '#f97316', fontSize: 24, fontWeight: 'bold' },
  itemNameText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', fontStyle: 'italic', textAlign: 'center', textTransform: 'uppercase', flex: 1 },
  selectorsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 },
  selectorBtn: { flex: 1, height: 45, borderWidth: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  selectorBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, fontStyle: 'italic' },
  qtyBadgeCenter: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' },
  qtyBadgeText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  extrasDropdown: { marginTop: 10, width: '100%', height: 100 },
  extraItemVertical: { alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 20, backgroundColor: 'transparent', marginRight: 15, width: 80, height: 100 },
  extraItemActive: { borderColor: '#f97316', borderWidth: 2 },
  extraItemText: { color: '#fff', fontSize: 10, textAlign: 'center', fontWeight: '900', marginTop: 5 },
  extraImageSmall: { width: 50, height: 50, backgroundColor: 'transparent', shadowColor: '#f97316', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  extraImageFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center' },
  extraPriceText: { color: '#f97316', fontSize: 9, fontWeight: '900' },
  orderBtnBottom: { backgroundColor: '#f97316', width: '100%', padding: 18, borderRadius: 50, alignItems: 'center', shadowColor: '#f97316', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  orderText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
});

module.exports = MenuScreen;
  
