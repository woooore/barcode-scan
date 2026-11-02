import { StoreId } from '../types/product';

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

/**
 * Gemini AI에게 바코드 번호를 질의하여 한국 편의점 상품명, 제조사, 매장별 판매가 및 행사 정보를 추출합니다.
 */
export async function queryGeminiForBarcode(params: {
  barcode: string;
  storeId: StoreId;
  apiKey: string;
}): Promise<GeminiProductAnalysis | null> {
  const { barcode, storeId, apiKey } = params;
  if (!apiKey || !barcode) return null;

  const prompt = `당신은 한국 편의점(GS25, CU, 세븐일레븐, 이마트24) 및 대형마트 유통 상품 전문 데이터 분석 AI입니다.
바코드 번호: [${barcode}]
선택된 매장: [${storeId}]

이 13자리 바코드(880...) 상품의 정확한 상품명, 제조사/브랜드, 규격/용량, 카테고리, 그리고 ${storeId} 편의점 기준 단품 판매 가격(원) 및 1+1 / 2+1 행사 여부를 추론하여 오직 순수 JSON으로만 답변하세요. 마크다운(\`\`\`json) 기호 없이 JSON만 반환하세요:
{
  "barcode": "${barcode}",
  "name": "상품명 (예: 칠성사이다 제로 500ml)",
  "brand": "제조사/브랜드 (예: 롯데칠성음료)",
  "category": "카테고리 (예: 탄산음료, 스낵, 아이스크림, 라면)",
  "volumeOrWeight": "규격 (예: 500ml, 120g)",
  "price": 2400,
  "promoType": "1+1",
  "promoLabel": "1+1 행사 상품",
  "confidence": "high"
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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

    if (!res.ok) {
      console.warn('Gemini API 호출 실패:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    return {
      barcode: parsed.barcode || barcode,
      name: parsed.name || `상품 (${barcode})`,
      brand: parsed.brand || '기타 제조사',
      category: parsed.category || '편의점 유통상품',
      price: typeof parsed.price === 'number' ? parsed.price : 2000,
      promoType: parsed.promoType || 'NONE',
      promoLabel: parsed.promoLabel || (parsed.promoType !== 'NONE' ? `${parsed.promoType} 행사 상품` : undefined),
      volumeOrWeight: parsed.volumeOrWeight,
      confidence: parsed.confidence || 'medium',
    };
  } catch (err) {
    console.error('Gemini 질의 중 오류:', err);
    return null;
  }
}

/**
 * 바코드 줄무늬가 흐려서 인식이 안 될 때, Gemini Vision으로 사진 속 패키지 라벨과 글씨를 직접 분석합니다.
 */
export async function queryGeminiVisionForPhoto(params: {
  imageBase64: string;
  mimeType: string;
  storeId: StoreId;
  apiKey: string;
}): Promise<GeminiProductAnalysis | null> {
  const { imageBase64, mimeType, storeId, apiKey } = params;
  if (!apiKey || !imageBase64) return null;

  const prompt = `이 사진은 한국 편의점(${storeId}) 진열대 또는 상품의 사진입니다.
사진 속 라벨 텍스트, 바코드 번호(숫자 880...), 제품 패키지 디자인을 정밀 판독하세요.
판독한 상품의 바코드 번호, 상품명, 제조사/브랜드, ${storeId} 기준 판매 가격(원), 1+1/2+1 행사 여부를 아래 JSON 형식으로만 반환하세요:
{
  "barcode": "사진에서 확인된 13자리 바코드 번호 (없으면 추정 바코드)",
  "name": "정확한 상품명 (예: 페리오 46CM치약 쿨민트 100g)",
  "brand": "제조사 (예: LG생활건강, 페리오)",
  "category": "카테고리 (예: 생활용품, 치약/칫솔)",
  "volumeOrWeight": "용량 (예: 100g)",
  "price": 3900,
  "promoType": "1+1",
  "promoLabel": "1+1 행사 상품",
  "confidence": "high"
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

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

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

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
    console.error('Gemini Vision 분석 오류:', err);
    return null;
  }
}
