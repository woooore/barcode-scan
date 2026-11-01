export type StoreId =
  | 'GS25'
  | 'CU'
  | 'SEVEN'
  | 'EMART24'
  | 'EMART'
  | 'HOMEPLUS'
  | 'LOTTEMART';

export type StoreCategory = '편의점' | '대형마트';

export type PromoType = 'NONE' | '1+1' | '2+1' | '3+1' | 'DISCOUNT' | 'GIFT';

export interface StoreInfo {
  id: StoreId;
  name: string;
  shortName: string;
  category: StoreCategory;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  description: string;
}

export interface StorePriceInfo {
  price: number;
  originalPrice?: number;
  promoType: PromoType;
  promoLabel?: string;
  updatedAt: string;
}

export interface ProductItem {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  volumeOrWeight?: string;
  imageEmoji: string;
  imageUrl?: string;
  stores: Partial<Record<StoreId, StorePriceInfo>>;
  isUserContributed?: boolean;
}

export interface CartItem {
  product: ProductItem;
  storeId: StoreId;
  quantity: number;
}
