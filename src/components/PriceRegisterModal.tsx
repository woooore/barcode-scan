import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ProductItem, PromoType, StoreId, StorePriceInfo } from '../types/product';
import { STORES } from '../data/products';

interface PriceRegisterModalProps {
  visible: boolean;
  onClose: () => void;
  initialBarcode: string;
  initialStoreId: StoreId;
  existingProduct?: ProductItem | null;
  externalSuggestedName?: string;
  externalSuggestedBrand?: string;
  onSave: (data: {
    barcode: string;
    name: string;
    brand: string;
    category: string;
    volumeOrWeight?: string;
    imageEmoji?: string;
    storeId: StoreId;
    priceInfo: StorePriceInfo;
  }) => void;
}

const PROMO_OPTIONS: { type: PromoType; label: string; desc: string }[] = [
  { type: 'NONE', label: '행사없음', desc: '정가 단품 판매' },
  { type: '1+1', label: '1+1 행사', desc: '1개 사면 1개 무료' },
  { type: '2+1', label: '2+1 행사', desc: '2개 사면 1개 무료' },
  { type: '3+1', label: '3+1 행사', desc: '3개 사면 1개 무료' },
  { type: 'DISCOUNT', label: '할인특가', desc: '단품 가격 할인' },
  { type: 'GIFT', label: '덤증정', desc: '구매 시 증정품 제공' },
];

const EMOJI_OPTIONS = ['🥤', '🍜', '🍌', '🥔', '🔥', '⚡', '🍚', '🍈', '🍺', '🍫', '🥛', '📦'];

export const PriceRegisterModal: React.FC<PriceRegisterModalProps> = ({
  visible,
  onClose,
  initialBarcode,
  initialStoreId,
  existingProduct,
  externalSuggestedName,
  externalSuggestedBrand,
  onSave,
}) => {
  const [barcode, setBarcode] = useState(initialBarcode);
  const [storeId, setStoreId] = useState<StoreId>(initialStoreId);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('음료/간식');
  const [priceText, setPriceText] = useState('');
  const [promoType, setPromoType] = useState<PromoType>('NONE');
  const [promoLabel, setPromoLabel] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🥤');

  useEffect(() => {
    setBarcode(initialBarcode);
    setStoreId(initialStoreId);

    if (existingProduct) {
      setName(existingProduct.name);
      setBrand(existingProduct.brand);
      setCategory(existingProduct.category);
      setSelectedEmoji(existingProduct.imageEmoji || '📦');
      const storePrice = existingProduct.stores[initialStoreId];
      if (storePrice) {
        setPriceText(String(storePrice.price));
        setPromoType(storePrice.promoType);
        setPromoLabel(storePrice.promoLabel || '');
      } else {
        setPriceText('');
        setPromoType('NONE');
        setPromoLabel('');
      }
    } else {
      setName(externalSuggestedName || '');
      setBrand(externalSuggestedBrand || '');
      setCategory('음료/간식');
      setPriceText('');
      setPromoType('NONE');
      setPromoLabel('');
      setSelectedEmoji('📦');
    }
  }, [
    visible,
    initialBarcode,
    initialStoreId,
    existingProduct,
    externalSuggestedName,
    externalSuggestedBrand,
  ]);

  const handleSelectStoreInModal = (nextStore: StoreId) => {
    setStoreId(nextStore);
    if (existingProduct && existingProduct.stores[nextStore]) {
      const sp = existingProduct.stores[nextStore]!;
      setPriceText(String(sp.price));
      setPromoType(sp.promoType);
      setPromoLabel(sp.promoLabel || '');
    }
  };

  const handleSubmit = () => {
    const parsedPrice = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
    if (!barcode.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    onSave({
      barcode: barcode.trim(),
      name: name.trim() || `미등록 상품 (${barcode.trim()})`,
      brand: brand.trim() || '기타 제조사',
      category: category.trim() || '일반상품',
      imageEmoji: selectedEmoji,
      storeId,
      priceInfo: {
        price: parsedPrice,
        promoType,
        promoLabel:
          promoLabel.trim() ||
          (promoType === '1+1'
            ? `1+1 행사 (개당 ${Math.round(parsedPrice / 2).toLocaleString()}원)`
            : promoType === '2+1'
            ? `2+1 행사 (개당 ${Math.round((parsedPrice * 2) / 3).toLocaleString()}원)`
            : undefined),
        updatedAt: today,
      },
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {existingProduct ? '✏️ 매장 가격 · 행사 정보 수정' : '➕ 새 바코드 상품 가격 등록'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            <Text style={styles.label}>1. 어느 매장의 가격인가요?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.storeChipsRow}
            >
              {STORES.map((s) => {
                const active = s.id === storeId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => handleSelectStoreInModal(s.id)}
                    style={[
                      styles.storeChip,
                      active && { backgroundColor: s.primaryColor, borderColor: s.accentColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.storeChipText,
                        active && { color: s.textColor, fontWeight: '800' },
                      ]}
                    >
                      {s.shortName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>2. 바코드 번호</Text>
            <TextInput
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="예: 8801056154011"
              placeholderTextColor="#6E6E73"
              keyboardType="number-pad"
            />

            <Text style={styles.label}>3. 상품명 & 아이콘</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="예: 칠성사이다 제로 355ml"
              placeholderTextColor="#6E6E73"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.emojiRow}
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => setSelectedEmoji(emoji)}
                  style={[
                    styles.emojiBtn,
                    selectedEmoji === emoji && styles.emojiBtnSelected,
                  ]}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>제조사/브랜드</Text>
                <TextInput
                  style={styles.input}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="예: 롯데칠성"
                  placeholderTextColor="#6E6E73"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>카테고리</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="예: 음료/스낵"
                  placeholderTextColor="#6E6E73"
                />
              </View>
            </View>

            <Text style={styles.label}>
              4. {STORES.find((s) => s.id === storeId)?.name} 판매 가격 (원)
            </Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={priceText}
              onChangeText={setPriceText}
              placeholder="예: 2000"
              placeholderTextColor="#6E6E73"
              keyboardType="number-pad"
            />
            <View style={styles.quickPriceRow}>
              {[1000, 1500, 1800, 2000, 2200, 2500, 3000].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.quickPriceChip}
                  onPress={() => setPriceText(String(p))}
                >
                  <Text style={styles.quickPriceText}>{p.toLocaleString()}원</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>5. 진행 중인 행사 (1+1 / 2+1 등)</Text>
            <View style={styles.promoGrid}>
              {PROMO_OPTIONS.map((opt) => {
                const selected = promoType === opt.type;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    onPress={() => setPromoType(opt.type)}
                    style={[styles.promoCard, selected && styles.promoCardSelected]}
                  >
                    <Text
                      style={[styles.promoCardTitle, selected && styles.promoCardTitleSelected]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={styles.promoCardDesc}>{opt.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>6. 행사 메모 (선택)</Text>
            <TextInput
              style={styles.input}
              value={promoLabel}
              onChangeText={setPromoLabel}
              placeholder="예: 오리지널/제로 교차증정 가능"
              placeholderTextColor="#6E6E73"
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>저장하고 가격 바로 반영하기</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#2C2C2E',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
  },
  closeBtnText: {
    color: '#D1D1D6',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollBody: {
    paddingBottom: 24,
  },
  label: {
    color: '#EBEBF5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  storeChipsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  storeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  storeChipText: {
    color: '#AEAEB2',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  priceInput: {
    fontSize: 20,
    fontWeight: '800',
    color: '#30D158',
  },
  quickPriceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  quickPriceChip: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  quickPriceText: {
    color: '#D1D1D6',
    fontSize: 12,
    fontWeight: '600',
  },
  emojiRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emojiBtnSelected: {
    backgroundColor: '#0A84FF',
  },
  emojiText: {
    fontSize: 20,
  },
  twoCol: {
    flexDirection: 'row',
  },
  promoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  promoCard: {
    width: '48%',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#3A3A3C',
  },
  promoCardSelected: {
    borderColor: '#FF2D55',
    backgroundColor: 'rgba(255, 45, 85, 0.16)',
  },
  promoCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  promoCardTitleSelected: {
    color: '#FF375F',
  },
  promoCardDesc: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: '#0A84FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
