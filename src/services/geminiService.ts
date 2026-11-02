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

  const prompt = `당신은 대한민국 편의점(GS25, CU, 세븐일레븐, 이마트24) 및 대형마트(이마트, 홈플러스, 롯데마트) 유통 상품 가격 및 행사 전문 AI입니다.
바코드 번호: [${barcode}]
선택된 매장: [${storeId}]

[필수 판독 지침]
1. 바코드 번호 [${barcode}]의 국내 표준 제조사 코드를 정확하게 조회하여 실제 제품명과 제조사를 판별하세요.
2. 절대 칠성사이다 등 특정 제품명을 임의로 지어내거나 복사하지 마세요. 과자, 초콜릿, 라면, 유제품, 음료수 등 해당 바코드의 실제 품명을 정확히 찾아내세요.
3. 매장 [${storeId}] 기준 실제 카운터 소비자 판매가격(원) 및 1+1 / 2+1 행사 여부를 추론하세요.

반드시 순수 JSON으로만 답변하세요:
{
  "barcode": "${barcode}",
  "name": "정확한 상품명과 규격",
  "brand": "실제 제조사/브랜드",
  "category": "스낵/초콜릿/식품/음료 등",
  "volumeOrWeight": "용량",
  "price": 2000,
  "promoType": "NONE",
  "promoLabel": "정가 판매",
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
[필수 시각 판독 지침]
1. 사진 속 포장지의 원재료명, 인쇄된 한글 텍스트(예: 코코아버터, 과자, 초콜릿, 라면 등), 포장 형태(상자, 봉지, 캔, 페트병)를 최우선으로 분석하세요.
2. 사진 속 내용물과 전혀 다른 엉뚱한 제품명(예: 과자인데 사이다나 콜라로 판독하는 행위)을 출력하는 것을 엄격히 금지합니다.
3. 확인된 바코드 번호(숫자 880...), 공식 상품명, 제조사/브랜드, ${storeId} 기준 실제 매장 판매가격(원) 및 1+1/2+1 행사 여부를 아래 JSON 형식으로만 반환하세요:
{
  "barcode": "바코드 번호",
  "name": "정확한 상품명과 규격",
  "brand": "제조사/브랜드",
  "category": "스낵/초콜릿/식품/음료 등",
  "volumeOrWeight": "용량",
  "price": 2000,
  "promoType": "NONE",
  "promoLabel": "정가 판매",
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
