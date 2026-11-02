import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_PRODUCTS } from '../data/products';
import { ProductItem, PromoType, StoreId, StorePriceInfo } from '../types/product';

const STORAGE_KEY_PRODUCTS = '@convenience_scanner_products_v1';
const STORAGE_KEY_HISTORY = '@convenience_scanner_history_v1';

// 웹에서는 현재 접속 주소의 /api 호출 (단일 서버 연동), 네이티브에서는 포트 4000 또는 클라우드 API 호출
const CRAWLER_API_BASE_URL =
  typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/api`
    : 'http://localhost:4000/api';

export interface ExternalBarcodeLookupResult {
  found: boolean;
  barcode: string;
  name?: string;
  brand?: string;
  category?: string;
  volumeOrWeight?: string;
  imageUrl?: string;
  stores?: Partial<Record<StoreId, StorePriceInfo>>;
}

/**
 * 저장된 상품 목록, 크롤링된 행사 DB, 기본 DB를 병합하여 불러옵니다.
 */
export async function loadAllProducts(): Promise<ProductItem[]> {
  const map = new Map<string, ProductItem>();

  // 1. 기본 내장 인기 상품
  for (const item of INITIAL_PRODUCTS) {
    map.set(item.barcode, item);
  }

  // 2. 로컬 크롤러 백엔드 서버(이달의 편의점 행사 DB) 동기화 시도 (1.5초 제한)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${CRAWLER_API_BASE_URL}/events`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (!item.barcode) continue;
          const existing = map.get(item.barcode);
          if (existing) {
            map.set(item.barcode, {
              ...existing,
              stores: {
                ...existing.stores,
                ...item.stores,
              },
            });
          } else {
            map.set(item.barcode, {
              barcode: item.barcode,
              name: item.name,
              brand: item.brand || '편의점 행사상품',
              category: item.category || '편의점 행사상품',
              imageEmoji: '🏪',
              imageUrl: item.imageUrl,
              stores: item.stores || {},
            });
          }
        }
      }
    }
  } catch (err) {
    // 백엔드 미실행 시 조용히 통과
  }

  // 3. 로컬 사용자 제보 저장소 (최우선 순위)
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (raw) {
      const savedProducts: ProductItem[] = JSON.parse(raw);
      for (const item of savedProducts) {
        const existing = map.get(item.barcode);
        if (existing) {
          map.set(item.barcode, {
            ...existing,
            ...item,
            stores: {
              ...existing.stores,
              ...item.stores,
            },
          });
        } else {
          map.set(item.barcode, item);
        }
      }
    }
  } catch (err) {
    console.warn('사용자 제보 상품 DB 로드 중 오류 발생:', err);
  }

  return Array.from(map.values());
}

/**
 * 새 상품 또는 특정 매장의 가격/행사 정보를 저장합니다.
 */
export async function saveOrUpdateProductPrice(params: {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  volumeOrWeight?: string;
  imageEmoji?: string;
  storeId: StoreId;
  priceInfo: StorePriceInfo;
  currentProducts: ProductItem[];
}): Promise<ProductItem[]> {
  const {
    barcode,
    name,
    brand,
    category,
    volumeOrWeight,
    imageEmoji,
    storeId,
    priceInfo,
    currentProducts,
  } = params;

  const existingIndex = currentProducts.findIndex((p) => p.barcode === barcode);
  let updatedList: ProductItem[];

  if (existingIndex >= 0) {
    const existing = currentProducts[existingIndex];
    const updatedItem: ProductItem = {
      ...existing,
      name: name.trim() || existing.name,
      brand: brand.trim() || existing.brand,
      category: category.trim() || existing.category,
      volumeOrWeight: volumeOrWeight?.trim() || existing.volumeOrWeight,
      stores: {
        ...existing.stores,
        [storeId]: priceInfo,
      },
    };
    updatedList = [...currentProducts];
    updatedList[existingIndex] = updatedItem;
  } else {
    const newItem: ProductItem = {
      barcode,
      name: name.trim() || `상품 (${barcode})`,
      brand: brand.trim() || '기타 브랜드',
      category: category.trim() || '일반상품',
      volumeOrWeight: volumeOrWeight?.trim() || '',
      imageEmoji: imageEmoji || '📦',
      stores: {
        [storeId]: priceInfo,
      },
      isUserContributed: true,
    };
    updatedList = [newItem, ...currentProducts];
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(updatedList));
  } catch (err) {
    console.warn('상품 저장 중 오류:', err);
  }

  // 크롤러 백엔드 서버가 켜져 있다면 동기화 전송 (비동기, 실패 무시)
  syncPriceToBackend(barcode, name, brand, category, storeId, priceInfo).catch(() => {});

  return updatedList;
}

/**
 * 로컬 DB에 없는 바코드를 스캔했을 때:
 * 1) 자체 크롤러/행사 API 서버 조회 시도
 * 2) 글로벌/한국 오픈 바코드 DB (Open Food Facts API) 조회하여 상품명/브랜드 자동 추출
 */
export async function lookupUnknownBarcodeExternally(
  barcode: string
): Promise<ExternalBarcodeLookupResult> {
  // 1. 로컬 크롤러 API 서버 조회 (1.2초 타임아웃)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${CRAWLER_API_BASE_URL}/products/${barcode}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.name) {
        return {
          found: true,
          barcode,
          name: data.name,
          brand: data.brand || '편의점 행사상품',
          category: data.category || '일반상품',
          volumeOrWeight: data.volumeOrWeight,
          imageUrl: data.imageUrl,
          stores: data.stores,
        };
      }
    }
  } catch {
    // 서버 미실행 시 무시하고 Open Food Facts로 진행
  }

  // 2. Open Food Facts 공개 바코드 API 조회 (한국 880 바코드 다수 등록됨)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      if (json.status === 1 && json.product) {
        const p = json.product;
        const name =
          p.product_name_ko ||
          p.product_name ||
          p.generic_name_ko ||
          p.generic_name ||
          '';
        const brand = p.brands ? String(p.brands).split(',')[0].trim() : '';
        const quantity = p.quantity || '';
        if (name) {
          return {
            found: true,
            barcode,
            name: quantity && !name.includes(quantity) ? `${name} ${quantity}` : name,
            brand: brand || '식음료/공산품',
            category: '식품/음료',
            volumeOrWeight: quantity,
            imageUrl: p.image_front_small_url || p.image_url,
          };
        }
      }
    }
  } catch {
    // 오프라인이거나 타임아웃 시 무시
  }

  return {
    found: false,
    barcode,
  };
}

async function syncPriceToBackend(
  barcode: string,
  name: string,
  brand: string,
  category: string,
  storeId: StoreId,
  priceInfo: StorePriceInfo
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  await fetch(`${CRAWLER_API_BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode, name, brand, category, storeId, priceInfo }),
    signal: controller.signal,
  });
  clearTimeout(timer);
}

export async function loadRecentScanBarcodes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : ['8801056154011', '8801094017200', '8801056091101'];
  } catch {
    return ['8801056154011', '8801094017200', '8801056091101'];
  }
}

export async function saveRecentScanBarcode(
  barcode: string,
  existing: string[]
): Promise<string[]> {
  const next = [barcode, ...existing.filter((b) => b !== barcode)].slice(0, 15);
  try {
    await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function getPromoBadgeStyle(promoType: PromoType): {
  bg: string;
  text: string;
  label: string;
} {
  switch (promoType) {
    case '1+1':
      return { bg: '#FF2D55', text: '#FFFFFF', label: '1+1 행사중' };
    case '2+1':
      return { bg: '#FF9500', text: '#FFFFFF', label: '2+1 행사중' };
    case '3+1':
      return { bg: '#AF52DE', text: '#FFFFFF', label: '3+1 행사중' };
    case 'DISCOUNT':
      return { bg: '#00C7BE', text: '#001F1E', label: '할인특가' };
    case 'GIFT':
      return { bg: '#5856D6', text: '#FFFFFF', label: '덤증정' };
    default:
      return { bg: '#2C2C2E', text: '#AEAEB2', label: '일반판매 (행사없음)' };
  }
}
