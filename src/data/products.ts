import { ProductItem, StoreInfo, StoreId, PromoType } from '../types/product';

export const STORES: StoreInfo[] = [
  {
    id: 'GS25',
    name: 'GS25',
    shortName: 'GS25',
    category: '편의점',
    primaryColor: '#0072BC',
    accentColor: '#00B5E2',
    textColor: '#FFFFFF',
    description: '우리동네GS · 매월 1+1 / 2+1 / 덤증정 행사',
  },
  {
    id: 'CU',
    name: 'CU (씨유)',
    shortName: 'CU',
    category: '편의점',
    primaryColor: '#652D90',
    accentColor: '#8CC63F',
    textColor: '#FFFFFF',
    description: '포켓CU · +1 증정 및 아침/밤 타임할인',
  },
  {
    id: 'SEVEN',
    name: '세븐일레븐',
    shortName: '7-ELEVEn',
    category: '편의점',
    primaryColor: '#008061',
    accentColor: '#F58220',
    textColor: '#FFFFFF',
    description: '세븐일레븐 · 이달의 1+1 / 2+1 행사',
  },
  {
    id: 'EMART24',
    name: '이마트24',
    shortName: 'emart24',
    category: '편의점',
    primaryColor: '#FFB81C',
    accentColor: '#4D4D4F',
    textColor: '#1A1A1A',
    description: '이마트24 · 노브랜드 상품 및 이달의 행사',
  },
  {
    id: 'EMART',
    name: '이마트',
    shortName: '이마트',
    category: '대형마트',
    primaryColor: '#F9B612',
    accentColor: '#231F20',
    textColor: '#1A1A1A',
    description: '대형마트 표준 행사가 · 묶음/단품 상시할인',
  },
  {
    id: 'HOMEPLUS',
    name: '홈플러스',
    shortName: '홈플러스',
    category: '대형마트',
    primaryColor: '#E60012',
    accentColor: '#FF4D58',
    textColor: '#FFFFFF',
    description: '홈플러스 마트 · 물가안정 프로젝트 행사가',
  },
  {
    id: 'LOTTEMART',
    name: '롯데마트',
    shortName: '롯데마트',
    category: '대형마트',
    primaryColor: '#DA291C',
    accentColor: '#FF6B5E',
    textColor: '#FFFFFF',
    description: '롯데마트 · 엘포인트 회원가 및 다다익선',
  },
];

export const INITIAL_PRODUCTS: ProductItem[] = [
  {
    barcode: '8801056154011',
    name: '칠성사이다 제로 355ml 캔',
    brand: '롯데칠성음료',
    category: '음료/탄산',
    volumeOrWeight: '355ml',
    imageEmoji: '🥤',
    stores: {
      GS25: {
        price: 2000,
        promoType: '1+1',
        promoLabel: '오리지널·제로 교차증정 가능 (개당 1,000원)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 2000,
        promoType: '2+1',
        promoLabel: '3개 구매 시 4,000원 (개당 1,333원)',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 2000,
        promoType: '1+1',
        promoLabel: '이달의 1+1 인기음료 행사',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 2000,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1180,
        promoType: 'DISCOUNT',
        originalPrice: 1380,
        promoLabel: '마트 단품 상시 할인가',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1200,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1150,
        promoType: 'DISCOUNT',
        originalPrice: 1350,
        promoLabel: '엘포인트 회원 할인가',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801094017200',
    name: '코카콜라 제로 500ml 페트',
    brand: '코카콜라음료',
    category: '음료/탄산',
    volumeOrWeight: '500ml',
    imageEmoji: '🍾',
    stores: {
      GS25: {
        price: 2400,
        promoType: '1+1',
        promoLabel: '코카콜라/코카콜라제로 교차 1+1 (개당 1,200원)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 2400,
        promoType: '1+1',
        promoLabel: '이달의 1+1 행사 상품',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 2400,
        promoType: '2+1',
        promoLabel: '500ml 페트 음료 2+1',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 2400,
        promoType: '2+1',
        promoLabel: '탄산 페트 2+1 행사',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1480,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1390,
        promoType: 'DISCOUNT',
        originalPrice: 1590,
        promoLabel: '2개 이상 구매 시 추가할인',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1450,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801104301655',
    name: '빙그레 바나나맛우유 240ml',
    brand: '빙그레',
    category: '유제품/우유',
    volumeOrWeight: '240ml',
    imageEmoji: '🍌',
    stores: {
      GS25: {
        price: 1800,
        promoType: 'NONE',
        promoLabel: '통신사(KT/LG U+) 멤버십 10% 할인 가능',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 1800,
        promoType: '2+1',
        promoLabel: '딸기맛·메론맛·라이트 교차 2+1 (개당 1,200원)',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 1800,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 1800,
        promoType: '2+1',
        promoLabel: '단지우유 전품목 2+1',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1350,
        promoType: 'DISCOUNT',
        originalPrice: 1500,
        promoLabel: '4입 기획팩 구매 시 개당 1,195원',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1380,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1350,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801043015264',
    name: '농심 신라면 큰사발면 114g',
    brand: '농심',
    category: '라면/컵라면',
    volumeOrWeight: '114g',
    imageEmoji: '🍜',
    stores: {
      GS25: {
        price: 1500,
        promoType: '2+1',
        promoLabel: '농심 큰사발 시리즈 교차 2+1 (개당 1,000원)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 1500,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 1500,
        promoType: '2+1',
        promoLabel: '인기 컵라면 2+1 행사',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 1500,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1150,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1120,
        promoType: 'DISCOUNT',
        originalPrice: 1250,
        promoLabel: '마트 초특가 할인',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1150,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801073210646',
    name: '삼양 불닭볶음면 큰컵 105g',
    brand: '삼양식품',
    category: '라면/컵라면',
    volumeOrWeight: '105g',
    imageEmoji: '🔥',
    stores: {
      GS25: {
        price: 1800,
        promoType: '2+1',
        promoLabel: '불닭/까르보불닭/짜장불닭 교차 2+1 (개당 1,200원)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 1800,
        promoType: '2+1',
        promoLabel: '삼양 불닭 시리즈 2+1 행사',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 1800,
        promoType: 'GIFT',
        promoLabel: '구매 시 쿨피스 180ml 덤증정',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 1800,
        promoType: '2+1',
        promoLabel: '불닭 전품목 교차 2+1',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1380,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1350,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1380,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801117752804',
    name: '오리온 포카칩 오리지널 66g',
    brand: '오리온',
    category: '스낵/과자',
    volumeOrWeight: '66g',
    imageEmoji: '🥔',
    stores: {
      GS25: {
        price: 1700,
        promoType: '2+1',
        promoLabel: '오리지널·어니언 교차 2+1 (개당 1,133원)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 1700,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 1700,
        promoType: '2+1',
        promoLabel: '감자스낵 모음 2+1',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 1700,
        promoType: '2+1',
        promoLabel: '오리온 인기스낵 2+1',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1360,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1350,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1360,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801056091101',
    name: '핫식스 더킹 파워 355ml',
    brand: '롯데칠성음료',
    category: '에너지음료',
    volumeOrWeight: '355ml',
    imageEmoji: '⚡',
    stores: {
      GS25: {
        price: 2200,
        promoType: '1+1',
        promoLabel: '핫식스 더킹 전종 교차 1+1 (개당 1,100원!)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 2200,
        promoType: '1+1',
        promoLabel: '더킹 파워/제로/포스 교차 1+1',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 2200,
        promoType: '1+1',
        promoLabel: '에너지음료 대전 1+1',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 2200,
        promoType: '2+1',
        promoLabel: '에너지음료 2+1 행사',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1480,
        promoType: 'DISCOUNT',
        originalPrice: 1680,
        promoLabel: '마트 할인가',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1500,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1480,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801097150010',
    name: 'CJ 햇반 백미 210g',
    brand: 'CJ제일제당',
    category: '즉석밥/간편식',
    volumeOrWeight: '210g',
    imageEmoji: '🍚',
    stores: {
      GS25: {
        price: 2100,
        promoType: '2+1',
        promoLabel: '햇반 210g 2+1 행사 (3개 4,200원 · 개당 1,400원)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 2100,
        promoType: '2+1',
        promoLabel: '햇반 단품 2+1 증정',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 2100,
        promoType: '1+1',
        promoLabel: '주말 한정 햇반 1+1 특가 (개당 1,050원!)',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 2100,
        promoType: '2+1',
        promoLabel: '즉석밥 2+1 행사',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1180,
        promoType: 'DISCOUNT',
        originalPrice: 1480,
        promoLabel: '묶음번들 기준 개당 1,180원',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1190,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1180,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8801104101019',
    name: '빙그레 메로나 80ml',
    brand: '빙그레',
    category: '아이스크림',
    volumeOrWeight: '80ml',
    imageEmoji: '🍈',
    stores: {
      GS25: {
        price: 1500,
        promoType: '2+1',
        promoLabel: '바 아이스크림 교차 2+1 (5개 이상 구매 시 개당 750원)',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 1500,
        promoType: '2+1',
        promoLabel: '인기 바 아이스크림 2+1 교차 가능',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 1500,
        promoType: '2+1',
        promoLabel: '바류 전품목 2+1',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 1500,
        promoType: '2+1',
        promoLabel: '아이스크림 2+1',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 600,
        promoType: 'DISCOUNT',
        originalPrice: 1500,
        promoLabel: '마트 아이스크림 균일가 60% 할인',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 600,
        promoType: 'DISCOUNT',
        originalPrice: 1500,
        promoLabel: '바 아이스크림 10개 골라담기 5,500원',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 600,
        promoType: 'DISCOUNT',
        originalPrice: 1500,
        promoLabel: '상시 할인가',
        updatedAt: '2026-11-01',
      },
    },
  },
  {
    barcode: '8808244201025',
    name: '제주 삼다수 그린 무라벨 2L',
    brand: '제주개발공사',
    category: '생수/음료',
    volumeOrWeight: '2L',
    imageEmoji: '💧',
    stores: {
      GS25: {
        price: 1700,
        promoType: 'NONE',
        promoLabel: 'PB 생수(지리산맑은샘물)는 1+1 행사 중',
        updatedAt: '2026-11-01',
      },
      CU: {
        price: 1700,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      SEVEN: {
        price: 1700,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      EMART24: {
        price: 1700,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      EMART: {
        price: 1080,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      HOMEPLUS: {
        price: 1080,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
      LOTTEMART: {
        price: 1080,
        promoType: 'NONE',
        updatedAt: '2026-11-01',
      },
    },
  },
];

/**
 * 행사 유형에 따른 단가(체감가) 및 묶음 결제 금액 계산 유틸리티
 */
export function calculateEffectiveUnitPrice(price: number, promoType: PromoType): number {
  switch (promoType) {
    case '1+1':
      return Math.round(price / 2);
    case '2+1':
      return Math.round((price * 2) / 3);
    case '3+1':
      return Math.round((price * 3) / 4);
    default:
      return price;
  }
}

/**
 * 장바구니 수량에 따른 실제 카운터 결제 금액 계산 (1+1, 2+1 자동 적용!)
 * 예: 1+1 상품을 2개 담으면 1개 가격만 청구, 2+1 상품을 3개 담으면 2개 가격만 청구
 */
export function calculateBundleTotal(
  price: number,
  promoType: PromoType,
  quantity: number
): {
  totalPayable: number;
  freeCount: number;
  promoTip?: string;
} {
  if (quantity <= 0) {
    return { totalPayable: 0, freeCount: 0 };
  }

  if (promoType === '1+1') {
    const groups = Math.floor(quantity / 2);
    const remainder = quantity % 2;
    const paidUnits = groups + remainder;
    const freeCount = groups;
    const promoTip =
      remainder === 1
        ? '💡 1+1 행사 상품입니다! 카운터 갈 때 1개 더 가져오셔도 결제 금액이 똑같아요!'
        : undefined;
    return {
      totalPayable: paidUnits * price,
      freeCount,
      promoTip,
    };
  }

  if (promoType === '2+1') {
    const groups = Math.floor(quantity / 3);
    const remainder = quantity % 3;
    const paidUnits = groups * 2 + remainder;
    const freeCount = groups;
    const promoTip =
      remainder === 2
        ? '💡 2+1 행사 상품입니다! 지금 2개 담으셨는데 1개 더 챙기시면 무료 증정됩니다!'
        : remainder === 1
        ? '💡 2+1 행사 중입니다 (2개 구매 시 1개 무료 증정)'
        : undefined;
    return {
      totalPayable: paidUnits * price,
      freeCount,
      promoTip,
    };
  }

  if (promoType === '3+1') {
    const groups = Math.floor(quantity / 4);
    const remainder = quantity % 4;
    const paidUnits = groups * 3 + remainder;
    const freeCount = groups;
    const promoTip =
      remainder === 3
        ? '💡 3+1 행사 상품입니다! 1개 더 가져오시면 무료 증정됩니다!'
        : undefined;
    return {
      totalPayable: paidUnits * price,
      freeCount,
      promoTip,
    };
  }

  return {
    totalPayable: price * quantity,
    freeCount: 0,
  };
}
