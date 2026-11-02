import { StoreId } from '../types/product';

const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
];

export interface GeminiProductAnalysis {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  promoType: 'NONE' | '1+1' | '2+1' | 'DISCOUNT' | 'GIFT';
  promoLabel?: string;
  volumeOrWeight?: string;
  confidence: 'high' | 'medium' | 'low';
}

function getApiOrigin(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

/**
 * 서버 설정(기본 Gemini 키 유무 등)을 확인합니다.
 */
export async function fetchServerConfig(): Promise<{
  hasGeminiKey: boolean;
  geminiKey?: string;
}> {
  try {
    const res = await fetch(`${getApiOrigin()}/api/config`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // ignore
  }
  return { hasGeminiKey: false };
}

/**
 * Gemini AI에게 바코드 번호를 질의하여 한국 편의점 상품명, 제조사, 매장별 판매가 및 행사 정보를 추출합니다.
 */
export async function queryGeminiForBarcode(params: {
  barcode: string;
  storeId: StoreId;
  apiKey?: string;
}): Promise<GeminiProductAnalysis | null> {
  const { barcode, storeId, apiKey } = params;
  if (!barcode) return null;

  // 1순위: 백엔드 통합 API 프록시 (/api/gemini/analyze) 호출 (CORS 방지 및 서버 기본 키 활용)
  try {
    const res = await fetch(`${getApiOrigin()}/api/gemini/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, storeId, apiKey }),
    });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && (parsed.name || parsed.brand)) {
        return {
          barcode: parsed.barcode || barcode,
          name: parsed.name || `상품 (${barcode})`,
          brand: parsed.brand || '기타 제조사',
          category: parsed.category || '편의점 유통상품',
          price: typeof parsed.price === 'number' ? parsed.price : 2000,
          promoType: parsed.promoType || 'NONE',
          promoLabel:
            parsed.promoLabel ||
            (parsed.promoType !== 'NONE'
              ? `${parsed.promoType} 행사 상품`
              : undefined),
          volumeOrWeight: parsed.volumeOrWeight,
          confidence: parsed.confidence || 'medium',
        };
      }
    }
  } catch (err) {
    console.warn('백엔드 Gemini 프록시 호출 실패, 직접 호출 시도:', err);
  }

  // 2순위: 브라우저 직접 구글 API 호출 (사용자 직접 키 제공 시)
  if (!apiKey || !apiKey.trim()) return null;

  const prompt = `당신은 대한민국 편의점(GS25, CU, 세븐일레븐, 이마트24) 유통 상품 가격 및 행사 전문 AI입니다.
바코드 번호: [${barcode}]
선택된 매장: [${storeId}]

이 13자리 바코드(880...) 상품의 실제 공식 상품명, 제조사, 정확한 규격/용량, 카테고리, 그리고 ${storeId} 편의점 기준 실제 매장 판매가격(원) 및 1+1/2+1 행사 여부를 현실적으로 정확하게 분석하세요.
(예시 가이드:
- 칠성사이다 제로 500ml 페트는 편의점 정가 2,200원이며 자주 1+1 행사를 진행합니다.
- 칠성사이다 제로 355ml 캔은 2,000원(1+1), 250ml 캔은 1,700원입니다.
- 코카콜라 제로 500ml 페트는 2,400원(1+1)입니다.
- 상품의 실제 규격에 맞는 정확한 편의점 단품 판매가와 1+1 / 2+1 행사 여부를 판별하세요.)

반드시 순수 JSON으로만 답변하세요:
{
  "barcode": "${barcode}",
  "name": "공식 상품명 (예: 칠성사이다 제로 500ml)",
  "brand": "제조사 (예: 롯데칠성음료)",
  "category": "음료",
  "volumeOrWeight": "500ml",
  "price": 2200,
  "promoType": "1+1",
  "promoLabel": "1+1 행사 상품",
  "confidence": "high"
}`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      return {
        barcode: parsed.barcode || barcode,
        name: parsed.name || `상품 (${barcode})`,
        brand: parsed.brand || '기타 제조사',
        category: parsed.category || '편의점 유통상품',
        price: typeof parsed.price === 'number' ? parsed.price : 2000,
        promoType: parsed.promoType || 'NONE',
        promoLabel:
          parsed.promoLabel ||
          (parsed.promoType !== 'NONE'
            ? `${parsed.promoType} 행사 상품`
            : undefined),
        volumeOrWeight: parsed.volumeOrWeight,
        confidence: parsed.confidence || 'medium',
      };
    } catch (err) {
      // try next model
    }
  }

  return null;
}

/**
 * 바코드 줄무늬가 흐려서 인식이 안 될 때, Gemini Vision으로 사진 속 패키지 라벨과 글씨를 직접 분석합니다.
 */
export async function queryGeminiVisionForPhoto(params: {
  imageBase64: string;
  mimeType: string;
  storeId: StoreId;
  apiKey?: string;
}): Promise<GeminiProductAnalysis | null> {
  const { imageBase64, mimeType, storeId, apiKey } = params;
  if (!imageBase64) return null;

  // 1순위: 백엔드 통합 API 프록시 (/api/gemini/vision) 호출
  try {
    const res = await fetch(`${getApiOrigin()}/api/gemini/vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType, storeId, apiKey }),
    });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && (parsed.name || parsed.brand)) {
        return {
          barcode: parsed.barcode || '',
          name: parsed.name || '사진 인식 상품',
          brand: parsed.brand || '기타 제조사',
          category: parsed.category || '일반상품',
          price: typeof parsed.price === 'number' ? parsed.price : 2000,
          promoType: parsed.promoType || 'NONE',
          promoLabel: parsed.promoLabel,
          volumeOrWeight: parsed.volumeOrWeight,
          confidence: parsed.confidence || 'high',
        };
      }
    }
  } catch (err) {
    console.warn('백엔드 Gemini Vision 프록시 실패, 직접 호출 시도:', err);
  }

  // 2순위: 브라우저 직접 구글 API 호출 (사용자 직접 키 제공 시)
  if (!apiKey || !apiKey.trim()) return null;

  const prompt = `이 사진은 한국 편의점(${storeId}) 진열대 또는 상품의 사진입니다.
사진 속 라벨 텍스트, 바코드 번호(숫자 880...), 제품 패키지 디자인(캔인지 페트병인지 용량 포함)을 정밀 판독하세요.
판독한 상품의 바코드 번호, 공식 상품명, 제조사/브랜드, ${storeId} 기준 실제 편의점 판매 가격(원), 1+1/2+1 행사 여부를 아래 JSON 형식으로만 반환하세요:
{
  "barcode": "바코드 번호 (없으면 880으로 시작하는 추정 바코드)",
  "name": "정확한 상품명과 규격 (예: 칠성사이다 제로 500ml)",
  "brand": "제조사 (예: 롯데칠성음료, LG생활건강)",
  "category": "카테고리",
  "volumeOrWeight": "용량 (예: 500ml, 100g)",
  "price": 2200,
  "promoType": "1+1",
  "promoLabel": "1+1 행사 상품",
  "confidence": "high"
}`;

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      return {
        barcode: parsed.barcode || '',
        name: parsed.name,
        brand: parsed.brand || '기타 제조사',
        category: parsed.category || '일반상품',
        price: typeof parsed.price === 'number' ? parsed.price : 2000,
        promoType: parsed.promoType || 'NONE',
        promoLabel: parsed.promoLabel,
        volumeOrWeight: parsed.volumeOrWeight,
        confidence: parsed.confidence || 'high',
      };
    } catch (err) {
      // try next model
    }
  }

  return null;
}
