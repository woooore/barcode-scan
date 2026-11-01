import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ProductItem, StoreId, StoreInfo } from '../types/product';
import { STORES, calculateEffectiveUnitPrice } from '../data/products';
import { getPromoBadgeStyle } from '../services/productService';

interface ProductPriceCardProps {
  product: ProductItem;
  selectedStore: StoreInfo;
  onSelectStore: (storeId: StoreId) => void;
  onAddToCart: (product: ProductItem, quantity: number) => void;
  onEditPrice: (product: ProductItem, storeId: StoreId) => void;
}

export const ProductPriceCard: React.FC<ProductPriceCardProps> = ({
  product,
  selectedStore,
  onSelectStore,
  onAddToCart,
  onEditPrice,
}) => {
  const currentStorePrice = product.stores[selectedStore.id];

  // 전 매장 중 최저 체감단가 매장 계산
  let lowestUnitPrice = Infinity;
  let lowestStoreId: StoreId | null = null;
  for (const s of STORES) {
    const info = product.stores[s.id];
    if (info) {
      const unit = calculateEffectiveUnitPrice(info.price, info.promoType);
      if (unit < lowestUnitPrice) {
        lowestUnitPrice = unit;
        lowestStoreId = s.id;
      }
    }
  }

  const badge = currentStorePrice
    ? getPromoBadgeStyle(currentStorePrice.promoType)
    : { bg: '#3A3A3C', text: '#AEAEB2', label: '미등록 매장' };

  const effectiveUnit = currentStorePrice
    ? calculateEffectiveUnitPrice(currentStorePrice.price, currentStorePrice.promoType)
    : null;

  return (
    <View style={styles.card}>
      {/* 상단 상품 기본 정보 */}
      <View style={styles.productHeader}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{product.imageEmoji || '📦'}</Text>
        </View>
        <View style={styles.titleBox}>
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>
              {product.brand} · {product.category}
            </Text>
            <Text style={styles.barcodeText}>#{product.barcode}</Text>
          </View>
          <Text style={styles.productName}>{product.name}</Text>
        </View>
      </View>

      {/* 선택한 매장 핵심 가격 & 행사 영역 */}
      <View
        style={[
          styles.mainPriceBanner,
          { borderColor: selectedStore.primaryColor },
        ]}
      >
        <View style={styles.bannerTopRow}>
          <View
            style={[
              styles.storeBadge,
              { backgroundColor: selectedStore.primaryColor },
            ]}
          >
            <Text style={[styles.storeBadgeText, { color: selectedStore.textColor }]}>
              현재 매장: {selectedStore.name}
            </Text>
          </View>

          <View style={[styles.promoPill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.promoPillText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {currentStorePrice ? (
          <>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>카운터 단품 스캔 가격</Text>
                <View style={styles.priceNumberWrap}>
                  <Text style={styles.priceValue}>
                    {currentStorePrice.price.toLocaleString()}
                  </Text>
                  <Text style={styles.priceUnit}>원</Text>
                  {currentStorePrice.originalPrice && (
                    <Text style={styles.originalPrice}>
                      {currentStorePrice.originalPrice.toLocaleString()}원
                    </Text>
                  )}
                </View>
              </View>

              {effectiveUnit !== null &&
                effectiveUnit < currentStorePrice.price && (
                  <View style={styles.effectiveBox}>
                    <Text style={styles.effectiveLabel}>
                      {currentStorePrice.promoType} 행사 체감가
                    </Text>
                    <Text style={styles.effectiveValue}>
                      개당 {effectiveUnit.toLocaleString()}원!
                    </Text>
                  </View>
                )}
            </View>

            {currentStorePrice.promoLabel && (
              <View style={styles.promoNoticeBox}>
                <Text style={styles.promoNoticeText}>
                  ✨ {currentStorePrice.promoLabel}
                </Text>
              </View>
            )}

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.addCartBtn,
                  { backgroundColor: selectedStore.primaryColor },
                ]}
                onPress={() => onAddToCart(product, 1)}
              >
                <Text
                  style={[styles.addCartBtnText, { color: selectedStore.textColor }]}
                >
                  🛒 1개 담기
                </Text>
              </TouchableOpacity>

              {(currentStorePrice.promoType === '1+1' ||
                currentStorePrice.promoType === '2+1') && (
                <TouchableOpacity
                  style={styles.bundleAddBtn}
                  onPress={() =>
                    onAddToCart(
                      product,
                      currentStorePrice.promoType === '1+1' ? 2 : 3
                    )
                  }
                >
                  <Text style={styles.bundleAddBtnText}>
                    🎁 {currentStorePrice.promoType} 세트(
                    {currentStorePrice.promoType === '1+1' ? '2개' : '3개'}) 바로 담기
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.editPriceBtn}
                onPress={() => onEditPrice(product, selectedStore.id)}
              >
                <Text style={styles.editPriceBtnText}>가격수정</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.unregisteredBox}>
            <Text style={styles.unregisteredTitle}>
              아직 {selectedStore.name} 매장 가격이 등록되지 않았어요
            </Text>
            <TouchableOpacity
              style={styles.registerNowBtn}
              onPress={() => onEditPrice(product, selectedStore.id)}
            >
              <Text style={styles.registerNowBtnText}>
                ➕ {selectedStore.name} 가격·행사 직접 입력하기
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 타 편의점 & 대형마트 가격/행사 한눈에 비교 */}
      <View style={styles.compareSection}>
        <View style={styles.compareHeader}>
          <Text style={styles.compareTitle}>
            📊 편의점 4사 · 대형마트 가격 & 1+1 비교
          </Text>
          <Text style={styles.compareSubtitle}>터치하면 해당 매장으로 전환</Text>
        </View>

        {STORES.map((store) => {
          const sp = product.stores[store.id];
          const isCurrent = store.id === selectedStore.id;
          const isLowest = store.id === lowestStoreId && sp !== undefined;
          const unitPrice = sp
            ? calculateEffectiveUnitPrice(sp.price, sp.promoType)
            : null;
          const pBadge = sp ? getPromoBadgeStyle(sp.promoType) : null;

          return (
            <TouchableOpacity
              key={store.id}
              onPress={() => onSelectStore(store.id)}
              style={[
                styles.compareRow,
                isCurrent && styles.compareRowActive,
              ]}
            >
              <View style={styles.compareStoreLeft}>
                <View
                  style={[
                    styles.storeDot,
                    { backgroundColor: store.primaryColor },
                  ]}
                />
                <Text
                  style={[
                    styles.compareStoreName,
                    isCurrent && styles.compareStoreNameActive,
                  ]}
                >
                  {store.name}
                </Text>
                <Text style={styles.compareCategoryTag}>{store.category}</Text>
                {isLowest && (
                  <View style={styles.lowestTag}>
                    <Text style={styles.lowestTagText}>최저체감가</Text>
                  </View>
                )}
              </View>

              {sp ? (
                <View style={styles.comparePriceRight}>
                  {sp.promoType !== 'NONE' && pBadge && (
                    <View
                      style={[
                        styles.miniPromoBadge,
                        { backgroundColor: pBadge.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.miniPromoText,
                          { color: pBadge.text },
                        ]}
                      >
                        {sp.promoType}
                      </Text>
                    </View>
                  )}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.comparePriceText}>
                      {sp.price.toLocaleString()}원
                    </Text>
                    {unitPrice !== null && unitPrice < sp.price && (
                      <Text style={styles.compareUnitSubtext}>
                        체감 {unitPrice.toLocaleString()}원
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => onEditPrice(product, store.id)}
                  style={styles.miniRegisterBtn}
                >
                  <Text style={styles.miniRegisterText}>+ 가격등록</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  emojiBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 30,
  },
  titleBox: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  brandText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  barcodeText: {
    color: '#636366',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  mainPriceBanner: {
    backgroundColor: '#141416',
    borderRadius: 16,
    padding: 15,
    borderWidth: 2,
    marginBottom: 16,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  storeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  promoPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },
  promoPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceLabel: {
    color: '#AEAEB2',
    fontSize: 12,
    marginBottom: 2,
  },
  priceNumberWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  priceUnit: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 2,
  },
  originalPrice: {
    color: '#636366',
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  effectiveBox: {
    backgroundColor: 'rgba(255, 45, 85, 0.16)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.4)',
  },
  effectiveLabel: {
    color: '#FF6482',
    fontSize: 11,
    fontWeight: '700',
  },
  effectiveValue: {
    color: '#FF375F',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  promoNoticeBox: {
    marginTop: 12,
    backgroundColor: '#242426',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  promoNoticeText: {
    color: '#FFD60A',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
    flexWrap: 'wrap',
  },
  addCartBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCartBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  bundleAddBtn: {
    flex: 1,
    backgroundColor: '#FF2D55',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  editPriceBtn: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPriceBtnText: {
    color: '#D1D1D6',
    fontSize: 12,
    fontWeight: '600',
  },
  unregisteredBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  unregisteredTitle: {
    color: '#AEAEB2',
    fontSize: 14,
    marginBottom: 10,
  },
  registerNowBtn: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  registerNowBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  compareSection: {
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    paddingTop: 14,
  },
  compareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  compareTitle: {
    color: '#EBEBF5',
    fontSize: 14,
    fontWeight: '800',
  },
  compareSubtitle: {
    color: '#636366',
    fontSize: 11,
  },
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: '#242426',
  },
  compareRowActive: {
    backgroundColor: '#2C2C34',
    borderWidth: 1,
    borderColor: '#0A84FF',
  },
  compareStoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  compareStoreName: {
    color: '#D1D1D6',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  compareStoreNameActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  compareCategoryTag: {
    color: '#636366',
    fontSize: 11,
    marginRight: 6,
  },
  lowestTag: {
    backgroundColor: 'rgba(48, 209, 88, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#30D158',
  },
  lowestTagText: {
    color: '#30D158',
    fontSize: 10,
    fontWeight: '800',
  },
  comparePriceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniPromoBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniPromoText: {
    fontSize: 11,
    fontWeight: '800',
  },
  comparePriceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  compareUnitSubtext: {
    color: '#FF6482',
    fontSize: 11,
    fontWeight: '600',
  },
  miniRegisterBtn: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  miniRegisterText: {
    color: '#AEAEB2',
    fontSize: 11,
    fontWeight: '600',
  },
});
