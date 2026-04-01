const React = require('react');
const { useState, useRef, useEffect } = React;
const {
  View, Text, Image, Pressable, ScrollView,
  StyleSheet, Animated, PanResponder, Dimensions,
} = require('react-native');

const { SCREEN_WIDTH } = require('../constants');

/* ═══════════════════════════════════════════════════
   CONSTANTES DU CARROUSEL
═══════════════════════════════════════════════════ */
const IMAGE_SIZE     = SCREEN_WIDTH * 0.68;  // taille image active
const ITEM_WIDTH     = SCREEN_WIDTH * 0.72;  // espace par item (image + marges)
const SIDE_SCALE     = 0.60;                 // scale items non-actifs
const SIDE_OPACITY   = 0.40;                 // opacité items non-actifs
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.15; // distance min pour changer d'item
const SPRING_CONFIG  = {
  tension:   60,   // rigidité du ressort (plus élevé = plus rapide)
  friction:  10,   // amortissement (plus élevé = moins de rebond)
  useNativeDriver: true,
};

/* ═══════════════════════════════════════════════════
   COMPOSANT CARROUSEL INTERNE
   Utilise PanResponder pour un contrôle total du swipe
   + Animated.spring pour le snap fluide
═══════════════════════════════════════════════════ */
const Carousel = ({ items, currentIndex, setCurrentIndex, onIndexChange }) => {
  // Position X animée — représente le décalage horizontal total
  const translateX = useRef(new Animated.Value(-currentIndex * ITEM_WIDTH)).current;
  const currentIndexRef = useRef(currentIndex);

  // Sync si currentIndex change depuis l'extérieur
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    snapTo(currentIndex, false);
  }, [currentIndex]);

  const snapTo = (index, animated = true) => {
    const toValue = -index * ITEM_WIDTH;
    if (animated) {
      Animated.spring(translateX, {
        toValue,
        ...SPRING_CONFIG,
      }).start();
    } else {
      translateX.setValue(toValue);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      // On capture le geste horizontal
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 5,
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 5,

      onPanResponderGrant: () => {
        // Stoppe toute animation en cours et récupère la position réelle
        translateX.stopAnimation();
        translateX.setOffset(translateX._value);
        translateX.setValue(0);
      },

      onPanResponderMove: (_, gs) => {
        // Résistance aux bords (premier et dernier item)
        const idx   = currentIndexRef.current;
        const total = items.length;
        let dx = gs.dx;
        if ((idx === 0 && dx > 0) || (idx === total - 1 && dx < 0)) {
          dx = dx * 0.25; // friction élastique aux bords
        }
        translateX.setValue(dx);
      },

      onPanResponderRelease: (_, gs) => {
        translateX.flattenOffset();
        const idx   = currentIndexRef.current;
        const total = items.length;

        let nextIndex = idx;
        if (gs.dx < -SWIPE_THRESHOLD && idx < total - 1) {
          nextIndex = idx + 1;
        } else if (gs.dx > SWIPE_THRESHOLD && idx > 0) {
          nextIndex = idx - 1;
        }

        currentIndexRef.current = nextIndex;
        onIndexChange(nextIndex);
        snapTo(nextIndex, true);
      },

      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        snapTo(currentIndexRef.current, true);
      },
    })
  ).current;

  return (
    <View style={styles.carouselViewport} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.carouselTrack,
          {
            width: ITEM_WIDTH * items.length,
            transform: [{ translateX }],
          },
        ]}
      >
        {items.map((item, index) => {
          // Calcul des animations basé sur l'index relatif au currentIndex
          // On utilise une interpolation "manuelle" via la position translateX
          // pour scale et opacity de chaque card
          const distance = index - currentIndex;

          // Scale et opacité basés sur la distance à l'item actif
          // (effet smooth car currentIndex change à chaque snap)
          const isActive  = index === currentIndex;
          const scale     = isActive ? 1 : SIDE_SCALE;
          const opacity   = isActive ? 1 : SIDE_OPACITY;

          return (
            <View key={item.id} style={[styles.slideWrapper]}>
              <Animated.View
                style={[
                  styles.cardOuter,
                  {
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              >
                <Image
                  source={{ uri: item.image }}
                  style={styles.itemImage}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════
   COMPOSANT PRINCIPAL : MenuScreen
═══════════════════════════════════════════════════ */
const MenuScreen = ({
  config,
  menuItems,
  sauces,
  garnitures,
  currentIndex,
  setCurrentIndex,
  quantity,
  setQuantity,
  showSaucePicker,
  setShowSaucePicker,
  showGarniturePicker,
  setShowGarniturePicker,
  selectedExtras,
  setSelectedExtras,
  scrollX,
  onAddToCart,
  onAdminPress,
}) => {
  const currentItem = menuItems.length > 0 ? menuItems[currentIndex] : null;
  const extrasPrice = selectedExtras.garnitures.reduce((sum, g) => sum + (g.price || 0), 0);
  const unitPrice   = currentItem ? currentItem.price + extrasPrice : 0;
  const totalPrice  = unitPrice * quantity;

  const updateQuantity = (val) => setQuantity((prev) => Math.max(1, prev + val));

  const toggleExtra = (type, item) => {
    const list   = selectedExtras[type];
    const exists = list.find((i) => i.id === item.id);
    setSelectedExtras({
      ...selectedExtras,
      [type]: exists ? list.filter((i) => i.id !== item.id) : [...list, item],
    });
  };

  const handleIndexChange = (index) => {
    setCurrentIndex(index);
    setQuantity(1);
    setSelectedExtras({ sauces: [], garnitures: [] });
    setShowSaucePicker(false);
    setShowGarniturePicker(false);
  };

  return (
    <>
      {/* ── HAUT : logo + prix ── */}
      <View style={styles.fixedTop}>
        <View style={styles.logoWrapper}>
          {config.logoUrl ? (
            <Image
              source={{ uri: config.logoUrl }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.brandText}>
              NINJA <Text style={{ color: '#f97316' }}>FRIES</Text>
            </Text>
          )}
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

      {/* ── CARROUSEL PanResponder ── */}
      {menuItems.length > 0 && (
        <Carousel
          items={menuItems}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          onIndexChange={handleIndexChange}
        />
      )}

      {/* ── BAS : contrôles ── */}
      <View style={styles.fixedBottom}>
        <View style={styles.controlsWrapper}>

          {/* [-] NOM [+] */}
          <View style={styles.titleRow}>
            <Pressable style={styles.titleQtyBtn} onPress={() => updateQuantity(-1)}>
              <Text style={styles.titleQtyBtnText}>-</Text>
            </Pressable>
            <Text style={styles.itemNameText} numberOfLines={1} adjustsFontSizeToFit>
              {currentItem?.name.toUpperCase()}
            </Text>
            <Pressable style={styles.titleQtyBtn} onPress={() => updateQuantity(1)}>
              <Text style={styles.titleQtyBtnText}>+</Text>
            </Pressable>
          </View>

          {/* [SAUCES] (QTÉ) [GARNITURES] */}
          <View style={styles.selectorsRow}>
            <Pressable
              style={[styles.selectorBtn, { borderColor: '#f97316' }]}
              onPress={() => { setShowSaucePicker(!showSaucePicker); setShowGarniturePicker(false); }}
            >
              <Text style={styles.selectorBtnText}>
                SAUCES ({selectedExtras.sauces.length})
              </Text>
            </Pressable>

            <View style={styles.qtyBadgeCenter}>
              <Text style={styles.qtyBadgeText}>{quantity}</Text>
            </View>

            <Pressable
              style={[styles.selectorBtn, { borderColor: '#f97316' }]}
              onPress={() => { setShowGarniturePicker(!showGarniturePicker); setShowSaucePicker(false); }}
            >
              <Text style={styles.selectorBtnText}>GARNITURES</Text>
            </Pressable>
          </View>

          {/* Extras */}
          {(showSaucePicker || showGarniturePicker) && (
            <View style={styles.extrasDropdown}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(showSaucePicker ? sauces : garnitures).map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => toggleExtra(showSaucePicker ? 'sauces' : 'garnitures', s)}
                    style={[
                      styles.extraItemVertical,
                      selectedExtras[showSaucePicker ? 'sauces' : 'garnitures']
                        .find(x => x.id === s.id) && styles.extraItemActive,
                    ]}
                  >
                    {s.image
                      ? <Image source={{ uri: s.image }} style={styles.extraImageSmall} resizeMode="contain" />
                      : <View style={styles.extraImageFallback}><Text style={{ fontSize: 8, color: '#555' }}>IMG</Text></View>
                    }
                    <Text style={styles.extraItemText}>{s.name.toUpperCase()}</Text>
                    {!showSaucePicker && <Text style={styles.extraPriceText}>+{s.price} F</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <Pressable style={styles.orderBtnBottom} onPress={() => onAddToCart(totalPrice)}>
          <Text style={styles.orderText}>COMMANDER</Text>
        </Pressable>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  /* ── Haut ── */
  fixedTop: { width: '100%', alignItems: 'center', zIndex: 50, paddingBottom: 10 },
  logoWrapper: { width: '100%', alignItems: 'center', marginTop: 10 },
  logo: { width: 150, height: 80, backgroundColor: 'transparent' },
  brandText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', fontStyle: 'italic' },
  adminAccess: { position: 'absolute', top: 20, left: 25, zIndex: 100, padding: 10 },
  priceContainer: { height: 80, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  price: {
    fontSize: 64, fontWeight: '900', color: '#f97316', fontStyle: 'italic',
    textShadowColor: 'rgba(249, 115, 22, 0.4)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 15,
  },
  priceUnit: { fontSize: 20, color: '#f97316' },

  /* ── Carrousel ── */
  carouselViewport: {
    flex: 1,
    width: SCREEN_WIDTH,
    overflow: 'hidden',      // cache les items hors écran
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  carouselTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    // décalage initial pour centrer le premier item
    paddingLeft: (SCREEN_WIDTH - ITEM_WIDTH) / 2,
  },
  slideWrapper: {
    width: ITEM_WIDTH,
    height: IMAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOuter: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    backgroundColor: 'transparent',
  },
  itemImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    backgroundColor: 'transparent',   // PNG sans fond
  },

  /* ── Bas ── */
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
  extraImageSmall: { width: 50, height: 50, backgroundColor: 'transparent' },
  extraImageFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center' },
  extraPriceText: { color: '#f97316', fontSize: 9, fontWeight: '900' },
  orderBtnBottom: { backgroundColor: '#f97316', width: '100%', padding: 18, borderRadius: 50, alignItems: 'center', shadowColor: '#f97316', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  orderText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
});

module.exports = MenuScreen;
        
