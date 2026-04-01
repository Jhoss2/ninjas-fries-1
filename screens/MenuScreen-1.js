const React = require('react');
const { useState, useRef, useCallback } = React;
const {
  View, Text, Image, Pressable, ScrollView,
  StyleSheet, Animated, Platform
} = require('react-native');

const { SCREEN_WIDTH, CARD_WIDTH, ITEM_SIZE } = require('../constants');

/* ─────────────────────────────────────────────────
   CONSTANTES CARROUSEL
   - IMAGE_SIZE  : taille du PNG affiché (plus grand que CARD_WIDTH)
   - PARALLAX_FACTOR : vitesse des éléments flottants (< 1 = plus lent = effet profondeur)
───────────────────────────────────────────────── */
const IMAGE_SIZE    = SCREEN_WIDTH * 0.72;
const SIDE_SCALE    = 0.65;   // taille des items non-actifs
const SIDE_OPACITY  = 0.45;   // transparence des items non-actifs
const PARALLAX_FACTOR = 0.35; // décalage parallax (0 = aucun, 1 = même vitesse)

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
  const currentItem  = menuItems.length > 0 ? menuItems[currentIndex] : null;
  const extrasPrice  = selectedExtras.garnitures.reduce((sum, g) => sum + (g.price || 0), 0);
  const unitPrice    = currentItem ? currentItem.price + extrasPrice : 0;
  const totalPrice   = unitPrice * quantity;

  const updateQuantity = (val) => setQuantity((prev) => Math.max(1, prev + val));

  const toggleExtra = (type, item) => {
    const list   = selectedExtras[type];
    const exists = list.find((i) => i.id === item.id);
    setSelectedExtras({
      ...selectedExtras,
      [type]: exists ? list.filter((i) => i.id !== item.id) : [...list, item],
    });
  };

  /* ── Scroll handler ── */
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (event) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_SIZE);
        if (index !== currentIndex && index >= 0 && index < menuItems.length) {
          setCurrentIndex(index);
          setQuantity(1);
          setSelectedExtras({ sauces: [], garnitures: [] });
          setShowSaucePicker(false);
          setShowGarniturePicker(false);
        }
      },
    }
  );

  return (
    <>
      {/* ══════════════════════════════════════
          ZONE HAUTE : logo + prix
      ══════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════
          CARROUSEL SMART ANIMATE
          - overflow: hidden → les images ne débordent pas
          - parallax sur translateX de l'image (vitesse différente du conteneur)
          - scale + opacity smooth sur les items non-actifs
      ══════════════════════════════════════ */}
      <View style={styles.carouselContainer}>
        <Animated.ScrollView
          horizontal
          pagingEnabled={false}
          snapToInterval={ITEM_SIZE}
          snapToAlignment="center"
          decelerationRate={Platform.OS === 'ios' ? 0 : 0.98}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={1}
          contentContainerStyle={{
            paddingHorizontal: (SCREEN_WIDTH - ITEM_SIZE) / 2,
            alignItems: 'center',
          }}
        >
          {menuItems.map((item, index) => {
            /* ── Animations interpolées depuis scrollX ── */
            const inputRange = [
              (index - 1) * ITEM_SIZE,
              index       * ITEM_SIZE,
              (index + 1) * ITEM_SIZE,
            ];

            // Scale : items latéraux rétrécissent
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [SIDE_SCALE, 1, SIDE_SCALE],
              extrapolate: 'clamp',
            });

            // Opacité : items latéraux s'estompent
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [SIDE_OPACITY, 1, SIDE_OPACITY],
              extrapolate: 'clamp',
            });

            // Parallax : l'image se déplace plus lentement que le conteneur
            // → effet de profondeur / "smart animate"
            const translateX = scrollX.interpolate({
              inputRange,
              outputRange: [
                -ITEM_SIZE * PARALLAX_FACTOR,
                0,
                ITEM_SIZE * PARALLAX_FACTOR,
              ],
              extrapolate: 'clamp',
            });

            // Élévation douce : l'item actif "monte" légèrement
            const translateY = scrollX.interpolate({
              inputRange,
              outputRange: [8, 0, 8],
              extrapolate: 'clamp',
            });

            return (
              <View
                key={item.id}
                style={[styles.slideWrapper, { width: ITEM_SIZE }]}
              >
                <Animated.View
                  style={[
                    styles.cardOuter,
                    {
                      transform: [{ scale }, { translateY }],
                      opacity,
                    },
                  ]}
                >
                  {/* overflow:hidden sur le conteneur = les fruits "entrent" proprement */}
                  <View style={styles.cardInner}>
                    {/* Image principale — PNG sans fond */}
                    <Animated.Image
                      source={{ uri: item.image }}
                      style={[
                        styles.itemImage,
                        { transform: [{ translateX }] },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>

      {/* ══════════════════════════════════════
          ZONE BASSE : nom, sauces, garnitures, commander
      ══════════════════════════════════════ */}
      <View style={styles.fixedBottom}>
        <View style={styles.controlsWrapper}>

          {/* Ligne 1 : [-] NOM [+] */}
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

          {/* Ligne 2 : [SAUCES] (QTÉ) [GARNITURES] */}
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

          {/* Extras dépliés */}
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
  fixedTop: {
    width: '100%',
    alignItems: 'center',
    zIndex: 50,
    paddingBottom: 10,
  },
  logoWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  logo: {
    width: 150,
    height: 80,
    // PAS de backgroundColor → PNG affiché sans fond
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  adminAccess: {
    position: 'absolute',
    top: 20,
    left: 25,
    zIndex: 100,
    padding: 10,
  },
  priceContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  price: {
    fontSize: 64,
    fontWeight: '900',
    color: '#f97316',
    fontStyle: 'italic',
    textShadowColor: 'rgba(249, 115, 22, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  priceUnit: { fontSize: 20, color: '#f97316' },

  /* ── Carrousel ── */
  carouselContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    // overflow hidden = les images ne débordent pas sur les côtés
    overflow: 'hidden',
  },
  slideWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: IMAGE_SIZE,
  },
  cardOuter: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // Ombre orange sous le plat actif
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  cardInner: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // AUCUN backgroundColor → fond transparent pour les PNG
    backgroundColor: 'transparent',
  },
  itemImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    // backgroundColor transparent → pas de fond blanc/noir derrière le PNG
    backgroundColor: 'transparent',
  },

  /* ── Bas ── */
  fixedBottom: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 50,
  },
  controlsWrapper: { width: '100%', marginBottom: 15 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  titleQtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleQtyBtnText: { color: '#f97316', fontSize: 24, fontWeight: 'bold' },
  itemNameText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    textTransform: 'uppercase',
    flex: 1,
  },
  selectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  selectorBtn: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selectorBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    fontStyle: 'italic',
  },
  qtyBadgeCenter: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  extrasDropdown: { marginTop: 10, width: '100%', height: 100 },
  extraItemVertical: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginRight: 15,
    width: 80,
    height: 100,
  },
  extraItemActive: { borderColor: '#f97316', borderWidth: 2 },
  extraItemText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '900',
    marginTop: 5,
  },
  extraImageSmall: {
    width: 50,
    height: 50,
    backgroundColor: 'transparent', // PNG sans fond
  },
  extraImageFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#18181b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extraPriceText: { color: '#f97316', fontSize: 9, fontWeight: '900' },
  orderBtnBottom: {
    backgroundColor: '#f97316',
    width: '100%',
    padding: 18,
    borderRadius: 50,
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  orderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
});

module.exports = MenuScreen;
