import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  STORES,
  INITIAL_PRODUCTS,
  calculateBundleTotal,
  calculateEffectiveUnitPrice,
} from './src/data/products';
import {
  CartItem,
  ProductItem,
  PromoType,
  StoreId,
  StorePriceInfo,
} from './src/types/product';
import {
  loadAllProducts,
  saveOrUpdateProductPrice,
  lookupUnknownBarcodeExternally,
  getPromoBadgeStyle,
} from './src/services/productService';
import { BarcodeScannerBox } from './src/components/BarcodeScannerBox';
import { ProductPriceCard } from './src/components/ProductPriceCard';
import { PriceRegisterModal } from './src/components/PriceRegisterModal';

type ActiveTab = 'SCAN' | 'CART' | 'CATALOG';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0D0D0F', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>앱 화면 구성 중 오류가 발생했습니다</Text>
          <Text style={{ color: '#FF453A', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>{this.state.error?.message || '알 수 없는 오류'}</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#0A84FF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>화면 새로고침</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainAppContent />
    </ErrorBoundary>
  );
}

function MainAppContent() {
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [selectedStoreId, setSelectedStoreId] = useState<StoreId>('GS25');
  const [activeTab, setActiveTab] = useState<ActiveTab>('SCAN');

  // 현재 스캔된 바코드 (초기 실행 시 GS25 1+1 대표 상품 예시 표시)
  const [scannedBarcode, setScannedBarcode] = useState<string>('8801056154011');
  const [externalLookupLoading, setExternalLookupLoading] = useState(false);
  const [externalSuggestion, setExternalSuggestion] = useState<{
    barcode: string;
    name?: string;
    brand?: string;
  } | null>(null);

  // 장바구니 상태
  const [cart, setCart] = useState<CartItem[]>([
    {
      product: INITIAL_PRODUCTS[0],
      storeId: 'GS25',
      quantity: 2,
    },
  ]);

  // 도감/검색 탭 필터
  const [catalogPromoFilter, setCatalogPromoFilter] = useState<'ALL' | PromoType>('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');

  // 가격 등록/수정 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [modalBarcode, setModalBarcode] = useState('');
  const [modalStoreId, setModalStoreId] = useState<StoreId>('GS25');
  const [modalExistingProduct, setModalExistingProduct] =
    useState<ProductItem | null>(null);

  const selectedStore = useMemo(
    () => STORES.find((s) => s.id === selectedStoreId) || STORES[0],
    [selectedStoreId]
  );

  useEffect(() => {
    loadAllProducts().then((loaded) => {
      setProducts(loaded);
    });
  }, []);

  const currentScannedProduct = useMemo(
    () => products.find((p) => p.barcode === scannedBarcode) || null,
    [products, scannedBarcode]
  );

  // 바코드 스캔 또는 수동 입력 처리
  const handleBarcodeDetected = async (barcode: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }

    setScannedBarcode(barcode);
    setExternalSuggestion(null);

    const foundLocal = products.find((p) => p.barcode === barcode);
    if (!foundLocal) {
      setExternalLookupLoading(true);
      const ext = await lookupUnknownBarcodeExternally(barcode);
      setExternalLookupLoading(false);
      if (ext.found) {
        setExternalSuggestion({
          barcode,
          name: ext.name,
          brand: ext.brand,
        });
      }
    }
  };

  // 장바구니 담기
  const handleAddToCart = (product: ProductItem, addQty: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.barcode === product.barcode);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          product,
          quantity: next[idx].quantity + addQty,
        };
        return next;
      }
      return [...prev, { product, storeId: selectedStoreId, quantity: addQty }];
    });
  };

  const handleUpdateCartQty = (barcode: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.barcode === barcode
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // 가격 수정/등록 모달 열기
  const openEditModal = (product: ProductItem | null, barcode: string, storeId: StoreId) => {
    setModalExistingProduct(product);
    setModalBarcode(barcode);
    setModalStoreId(storeId);
    setModalVisible(true);
  };

  const handleSavePrice = async (data: {
    barcode: string;
    name: string;
    brand: string;
    category: string;
    volumeOrWeight?: string;
    imageEmoji?: string;
    storeId: StoreId;
    priceInfo: StorePriceInfo;
  }) => {
    const updated = await saveOrUpdateProductPrice({
      ...data,
      currentProducts: products,
    });
    setProducts(updated);
    setScannedBarcode(data.barcode);
  };

  // 현재 선택된 매장 기준 장바구니 총액 계산
  const cartSummary = useMemo(() => {
    let rawSum = 0;
    let finalPayable = 0;
    const tips: string[] = [];

    for (const item of cart) {
      const latestProduct =
        products.find((p) => p.barcode === item.product.barcode) || item.product;
      const sp = latestProduct.stores[selectedStoreId];
      if (!sp) continue;

      rawSum += sp.price * item.quantity;
      const bundle = calculateBundleTotal(sp.price, sp.promoType, item.quantity);
      finalPayable += bundle.totalPayable;
      if (bundle.promoTip) {
        tips.push(`[${latestProduct.name}] ${bundle.promoTip}`);
      }
    }

    return {
      rawSum,
      finalPayable,
      savedAmount: rawSum - finalPayable,
      tips,
    };
  }, [cart, products, selectedStoreId]);

  // 행사 도감 필터링 목록
  const filteredCatalog = useMemo(() => {
    return products.filter((p) => {
      const sp = p.stores[selectedStoreId];
      if (catalogPromoFilter !== 'ALL') {
        if (!sp || sp.promoType !== catalogPromoFilter) return false;
      }
      if (catalogSearch.trim()) {
        const q = catalogSearch.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.barcode.includes(q)
        );
      }
      return true;
    });
  }, [products, selectedStoreId, catalogPromoFilter, catalogSearch]);

  const totalCartCount = cart.reduce((acc, c) => acc + c.quantity, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0F" />

      {/* 상단 앱 타이틀 & 현재 매장 선택 바 */}
      <View style={styles.topHeader}>
        <View style={styles.brandTitleRow}>
          <View>
            <Text style={styles.appTitle}>얼마야 🔍 바코드 가격스캐너</Text>
            <Text style={styles.appSubtitle}>
              매장 선택 후 바코드를 찍으면 가격 · 1+1 행사가 바로 나옵니다
            </Text>
          </View>
          <TouchableOpacity
            style={styles.newBarcodeBtn}
            onPress={() => openEditModal(null, '', selectedStoreId)}
          >
            <Text style={styles.newBarcodeBtnText}>+ 가격제보</Text>
          </TouchableOpacity>
        </View>

        {/* 편의점 & 대형마트 선택 가로 스크롤 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storeSelectorContainer}
        >
          {STORES.map((store) => {
            const isSelected = store.id === selectedStoreId;
            return (
              <TouchableOpacity
                key={store.id}
                onPress={() => setSelectedStoreId(store.id)}
                style={[
                  styles.storePill,
                  isSelected && {
                    backgroundColor: store.primaryColor,
                    borderColor: store.accentColor,
                  },
                ]}
              >
                <View style={styles.storePillInner}>
                  <Text
                    style={[
                      styles.storeCategoryMini,
                      isSelected && { color: store.textColor, opacity: 0.85 },
                    ]}
                  >
                    {store.category}
                  </Text>
                  <Text
                    style={[
                      styles.storePillTitle,
                      isSelected && { color: store.textColor, fontWeight: '900' },
                    ]}
                  >
                    {store.shortName}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 메인 콘텐츠 영역 */}
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'SCAN' && (
          <>
            <BarcodeScannerBox
              selectedStore={selectedStore}
              products={products}
              onBarcodeDetected={handleBarcodeDetected}
              lastScannedBarcode={scannedBarcode}
            />

            {/* 스캔 결과 카드 */}
            {currentScannedProduct ? (
              <ProductPriceCard
                product={currentScannedProduct}
                selectedStore={selectedStore}
                onSelectStore={(storeId) => setSelectedStoreId(storeId)}
                onAddToCart={handleAddToCart}
                onEditPrice={(prod, stId) =>
                  openEditModal(prod, prod.barcode, stId)
                }
              />
            ) : (
              <View style={styles.unknownBarcodeCard}>
                <Text style={styles.unknownEmoji}>🧐</Text>
                <Text style={styles.unknownTitle}>
                  바코드 [{scannedBarcode}] 상품
                </Text>
                {externalLookupLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#0A84FF" />
                    <Text style={styles.loadingText}>
                      오픈 바코드 DB 및 행사 서버에서 상품명 조회 중...
                    </Text>
                  </View>
                ) : externalSuggestion?.name ? (
                  <View style={styles.extSuggestionBox}>
                    <Text style={styles.extSuggestionLabel}>
                      🌐 오픈 바코드 DB에서 상품명을 찾았습니다!
                    </Text>
                    <Text style={styles.extSuggestionName}>
                      {externalSuggestion.name} ({externalSuggestion.brand})
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.unknownDesc}>
                    아직 {selectedStore.name} 가격 정보가 등록되지 않은 바코드입니다.
                  </Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.registerUnknownBtn,
                    { backgroundColor: selectedStore.primaryColor },
                  ]}
                  onPress={() =>
                    openEditModal(null, scannedBarcode, selectedStoreId)
                  }
                >
                  <Text
                    style={[
                      styles.registerUnknownBtnText,
                      { color: selectedStore.textColor },
                    ]}
                  >
                    ➕ 5초 만에 {selectedStore.name} 가격·행사 등록하기
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {activeTab === 'CART' && (
          <View style={styles.cartSection}>
            <View
              style={[
                styles.cartSummaryBanner,
                { borderColor: selectedStore.primaryColor },
              ]}
            >
              <Text style={styles.cartStoreLabel}>
                📍 {selectedStore.name} 카운터 예상 결제금액
              </Text>
              <Text style={styles.cartFinalPrice}>
                {cartSummary.finalPayable.toLocaleString()}원
              </Text>
              {cartSummary.savedAmount > 0 && (
                <Text style={styles.cartSavedBadge}>
                  🎉 1+1 · 2+1 행사 자동 적용으로{' '}
                  {cartSummary.savedAmount.toLocaleString()}원 절약! (정가 합계{' '}
                  {cartSummary.rawSum.toLocaleString()}원)
                </Text>
              )}
            </View>

            {/* 1+1 / 2+1 놓침 방지 꿀팁 알림 */}
            {cartSummary.tips.map((tip, idx) => (
              <View key={idx} style={styles.cartTipBox}>
                <Text style={styles.cartTipText}>{tip}</Text>
              </View>
            ))}

            {cart.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <Text style={styles.emptyCartText}>
                  장바구니가 비어 있습니다.{'\n'}바코드 스캔 후 [담기]를 누르면 1+1·2+1이 적용된 카운터 총 결제금액을 미리 계산해 드려요!
                </Text>
              </View>
            ) : (
              cart.map((item) => {
                const latestProd =
                  products.find((p) => p.barcode === item.product.barcode) ||
                  item.product;
                const sp = latestProd.stores[selectedStoreId];
                const bundle = sp
                  ? calculateBundleTotal(sp.price, sp.promoType, item.quantity)
                  : null;
                const badge = sp ? getPromoBadgeStyle(sp.promoType) : null;

                return (
                  <View key={item.product.barcode} style={styles.cartItemCard}>
                    <View style={styles.cartItemTop}>
                      <Text style={styles.cartItemEmoji}>
                        {latestProd.imageEmoji}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartItemName}>{latestProd.name}</Text>
                        {sp ? (
                          <View style={styles.cartItemMetaRow}>
                            <Text style={styles.cartItemUnitPrice}>
                              단품 {sp.price.toLocaleString()}원
                            </Text>
                            {sp.promoType !== 'NONE' && badge && (
                              <View
                                style={[
                                  styles.cartPromoTag,
                                  { backgroundColor: badge.bg },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.cartPromoTagText,
                                    { color: badge.text },
                                  ]}
                                >
                                  {sp.promoType}
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <Text style={styles.cartMissingPrice}>
                            {selectedStore.name} 가격 미등록
                          </Text>
                        )}
                      </View>

                      <View style={styles.qtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            handleUpdateCartQty(item.product.barcode, -1)
                          }
                        >
                          <Text style={styles.qtyBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            handleUpdateCartQty(item.product.barcode, 1)
                          }
                        >
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {bundle && (
                      <View style={styles.cartItemBottom}>
                        <Text style={styles.cartBundleDetail}>
                          {bundle.freeCount > 0
                            ? `🎁 행사 무료 증정 ${bundle.freeCount}개 포함`
                            : `일반 단품 ${item.quantity}개`}
                        </Text>
                        <Text style={styles.cartItemSubtotal}>
                          결제 {bundle.totalPayable.toLocaleString()}원
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {/* 장바구니 전체 매장별 총액 비교 */}
            {cart.length > 0 && (
              <View style={styles.cartStoreCompareBox}>
                <Text style={styles.cartStoreCompareTitle}>
                  🏪 똑같은 장바구니를 다른 매장에서 산다면?
                </Text>
                {STORES.map((st) => {
                  let stTotal = 0;
                  let missingCount = 0;
                  for (const item of cart) {
                    const p =
                      products.find(
                        (prod) => prod.barcode === item.product.barcode
                      ) || item.product;
                    const sp = p.stores[st.id];
                    if (!sp) {
                      missingCount++;
                    } else {
                      stTotal += calculateBundleTotal(
                        sp.price,
                        sp.promoType,
                        item.quantity
                      ).totalPayable;
                    }
                  }
                  return (
                    <TouchableOpacity
                      key={st.id}
                      onPress={() => setSelectedStoreId(st.id)}
                      style={[
                        styles.cartCompareRow,
                        st.id === selectedStoreId && styles.cartCompareRowActive,
                      ]}
                    >
                      <Text style={styles.cartCompareStoreName}>
                        {st.name} ({st.category})
                      </Text>
                      <Text style={styles.cartCompareTotalText}>
                        {missingCount > 0
                          ? `${stTotal.toLocaleString()}원 (${missingCount}건 미등록)`
                          : `${stTotal.toLocaleString()}원`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activeTab === 'CATALOG' && (
          <View style={styles.catalogSection}>
            <Text style={styles.catalogHeaderTitle}>
              📋 {selectedStore.name} 상품 가격 & 이달의 행사 목록
            </Text>

            <TextInput
              style={styles.catalogSearchInput}
              value={catalogSearch}
              onChangeText={setCatalogSearch}
              placeholder="상품명, 브랜드 또는 바코드 번호 검색..."
              placeholderTextColor="#6E6E73"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
            >
              {(
                [
                  { id: 'ALL', label: '전체 상품' },
                  { id: '1+1', label: '🔥 1+1 행사' },
                  { id: '2+1', label: '🎁 2+1 행사' },
                  { id: 'DISCOUNT', label: '⚡ 할인특가' },
                ] as const
              ).map((f) => {
                const active = catalogPromoFilter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setCatalogPromoFilter(f.id)}
                    style={[
                      styles.filterChip,
                      active && {
                        backgroundColor: selectedStore.primaryColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active && {
                          color: selectedStore.textColor,
                          fontWeight: '800',
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filteredCatalog.map((item) => {
              const sp = item.stores[selectedStoreId];
              const badge = sp ? getPromoBadgeStyle(sp.promoType) : null;
              const unit = sp
                ? calculateEffectiveUnitPrice(sp.price, sp.promoType)
                : null;

              return (
                <TouchableOpacity
                  key={item.barcode}
                  style={styles.catalogItemCard}
                  onPress={() => {
                    setScannedBarcode(item.barcode);
                    setActiveTab('SCAN');
                  }}
                >
                  <Text style={styles.catalogEmoji}>{item.imageEmoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogBrand}>
                      {item.brand} · #{item.barcode}
                    </Text>
                    <Text style={styles.catalogName}>{item.name}</Text>
                    {sp?.promoLabel && (
                      <Text style={styles.catalogPromoNote}>
                        {sp.promoLabel}
                      </Text>
                    )}
                  </View>

                  {sp ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      {sp.promoType !== 'NONE' && badge && (
                        <View
                          style={[
                            styles.catalogBadge,
                            { backgroundColor: badge.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.catalogBadgeText,
                              { color: badge.text },
                            ]}
                          >
                            {sp.promoType}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.catalogPrice}>
                        {sp.price.toLocaleString()}원
                      </Text>
                      {unit !== null && unit < sp.price && (
                        <Text style={styles.catalogUnitPrice}>
                          체감 {unit.toLocaleString()}원
                        </Text>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.catalogAddPriceBtn}
                      onPress={() =>
                        openEditModal(item, item.barcode, selectedStoreId)
                      }
                    >
                      <Text style={styles.catalogAddPriceText}>+ 가격입력</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 하단 탭 내비게이션 */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('SCAN')}
        >
          <Text style={styles.navIcon}>📷</Text>
          <Text
            style={[
              styles.navLabel,
              activeTab === 'SCAN' && styles.navLabelActive,
            ]}
          >
            바코드 스캔
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('CART')}
        >
          <View>
            <Text style={styles.navIcon}>🛒</Text>
            {totalCartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navLabel,
              activeTab === 'CART' && styles.navLabelActive,
            ]}
          >
            카운터 계산기 ({cartSummary.finalPayable.toLocaleString()}원)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('CATALOG')}
        >
          <Text style={styles.navIcon}>📋</Text>
          <Text
            style={[
              styles.navLabel,
              activeTab === 'CATALOG' && styles.navLabelActive,
            ]}
          >
            1+1 행사·목록
          </Text>
        </TouchableOpacity>
      </View>

      {/* 현장 가격·행사 등록 모달 */}
      <PriceRegisterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialBarcode={modalBarcode}
        initialStoreId={modalStoreId}
        existingProduct={modalExistingProduct}
        externalSuggestedName={externalSuggestion?.name}
        externalSuggestedBrand={externalSuggestion?.brand}
        onSave={handleSavePrice}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D0F',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    marginHorizontal: Platform.OS === 'web' ? 'auto' : undefined,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#262629',
  },
  topHeader: {
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#141417',
    borderBottomWidth: 1,
    borderBottomColor: '#262629',
  },
  brandTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  appSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  newBarcodeBtn: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  newBarcodeBtnText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '800',
  },
  storeSelectorContainer: {
    paddingVertical: 2,
    gap: 8,
  },
  storePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#222226',
    borderWidth: 1.5,
    borderColor: '#323236',
    marginRight: 8,
  },
  storePillInner: {
    alignItems: 'center',
  },
  storeCategoryMini: {
    color: '#8E8E93',
    fontSize: 9,
    fontWeight: '700',
  },
  storePillTitle: {
    color: '#E5E5EA',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 14,
    paddingBottom: 32,
  },
  unknownBarcodeCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  unknownEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  unknownTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  unknownDesc: {
    color: '#AEAEB2',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  loadingText: {
    color: '#AEAEB2',
    fontSize: 13,
  },
  extSuggestionBox: {
    backgroundColor: '#242429',
    padding: 12,
    borderRadius: 12,
    marginVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  extSuggestionLabel: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '700',
  },
  extSuggestionName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  registerUnknownBtn: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  registerUnknownBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cartSection: {
    gap: 10,
  },
  cartSummaryBanner: {
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
    alignItems: 'center',
  },
  cartStoreLabel: {
    color: '#D1D1D6',
    fontSize: 13,
    fontWeight: '700',
  },
  cartFinalPrice: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    marginVertical: 4,
  },
  cartSavedBadge: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  cartTipBox: {
    backgroundColor: 'rgba(255, 214, 10, 0.14)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.4)',
  },
  cartTipText: {
    color: '#FFD60A',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyCartBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  emptyCartText: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  cartItemCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cartItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  cartItemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cartItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  cartItemUnitPrice: {
    color: '#AEAEB2',
    fontSize: 12,
  },
  cartPromoTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cartPromoTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cartMissingPrice: {
    color: '#FF453A',
    fontSize: 12,
    marginTop: 3,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  qtyValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 8,
  },
  cartItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  cartBundleDetail: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '700',
  },
  cartItemSubtotal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  cartStoreCompareBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 14,
    marginTop: 6,
  },
  cartStoreCompareTitle: {
    color: '#EBEBF5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  cartCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#242426',
  },
  cartCompareRowActive: {
    borderWidth: 1,
    borderColor: '#0A84FF',
    backgroundColor: '#2C2C34',
  },
  cartCompareStoreName: {
    color: '#D1D1D6',
    fontSize: 13,
    fontWeight: '600',
  },
  cartCompareTotalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  catalogSection: {
    gap: 10,
  },
  catalogHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  catalogSearchInput: {
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  filterChipsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  filterChip: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  filterChipText: {
    color: '#AEAEB2',
    fontSize: 13,
    fontWeight: '600',
  },
  catalogItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  catalogEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  catalogBrand: {
    color: '#8E8E93',
    fontSize: 11,
  },
  catalogName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  catalogPromoNote: {
    color: '#FFD60A',
    fontSize: 11,
    marginTop: 3,
  },
  catalogBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  catalogBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  catalogPrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  catalogUnitPrice: {
    color: '#FF6482',
    fontSize: 11,
    fontWeight: '700',
  },
  catalogAddPriceBtn: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  catalogAddPriceText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#141417',
    borderTopWidth: 1,
    borderTopColor: '#262629',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cartBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: '#FF2D55',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
