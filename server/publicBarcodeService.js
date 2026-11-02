const fs = require('fs');
const path = require('path');

const STANDARD_DB_FILE = path.join(__dirname, 'korean_standard_products.json');

let standardDbCache = null;

function getStandardDb() {
  if (!standardDbCache) {
    try {
      if (fs.existsSync(STANDARD_DB_FILE)) {
        standardDbCache = JSON.parse(fs.readFileSync(STANDARD_DB_FILE, 'utf-8'));
      }
    } catch (e) {
      standardDbCache = {};
    }
  }
  return standardDbCache || {};
}

/**
 * 1. 대한민국 유통 표준 바코드(880...) 마스터 DB 조회
 */
function lookupStandardDb(barcode) {
  const db = getStandardDb();
  return db[barcode] || null;
}

/**
 * 2. 공공데이터포털(data.go.kr) / 식품안전나라(C005) 오픈 API 조회
 * 환경변수 DATA_GO_KR_API_KEY 또는 FOOD_SAFETY_API_KEY 가 있을 때 동작
 */
async function lookupPublicDataPortal(barcode, apiKey) {
  const key = apiKey || process.env.DATA_GO_KR_API_KEY || process.env.FOOD_SAFETY_API_KEY;
  if (!key) return null;

  try {
    // 식품안전나라 C005 가공식품 유통바코드 기본정보
    const url = `http://openapi.foodsafetykorea.net/api/${encodeURIComponent(key)}/C005/json/1/5/BAR_CD=${encodeURIComponent(barcode)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const row = data?.C005?.row?.[0];
    if (row && row.PRDLST_NM) {
      return {
        barcode,
        name: row.PRDLST_NM,
        brand: row.BSSH_NM || '국내제조사',
        category: row.PRDLST_DCNM || '가공식품',
        volumeOrWeight: row.POG_DAYCNT || '',
        source: 'foodsafetykorea',
      };
    }
  } catch (err) {
    // ignore
  }

  return null;
}

/**
 * 3. Open Food Facts 글로벌 바코드 오픈 데이터 조회
 */
async function lookupOpenFoodFacts(barcode) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name =
        p.product_name_ko ||
        p.product_name ||
        p.generic_name_ko ||
        p.generic_name ||
        null;
      if (!name) return null;

      return {
        barcode,
        name,
        brand: p.brands ? String(p.brands).split(',')[0].trim() : '일반제조사',
        category: p.categories ? String(p.categories).split(',')[0].trim() : '식품/음료',
        volumeOrWeight: p.quantity || '',
        imageUrl: p.image_front_small_url || null,
        source: 'openfoodfacts',
      };
    }
  } catch (err) {
    // ignore
  }
  return null;
}

/**
 * 종합 공공/오픈 바코드 마스터 조회
 */
async function lookupPublicBarcode(barcode, publicApiKey) {
  // 1순위: 오프라인 표준 마스터 DB
  const standard = lookupStandardDb(barcode);
  if (standard) {
    return { ...standard, source: 'korean_standard_db' };
  }

  // 2순위: 식품안전나라 / 공공데이터포털 실시간 API
  const publicData = await lookupPublicDataPortal(barcode, publicApiKey);
  if (publicData) {
    return publicData;
  }

  // 3순위: Open Food Facts 글로벌 오픈 DB
  const off = await lookupOpenFoodFacts(barcode);
  if (off) {
    return off;
  }

  return null;
}

module.exports = {
  lookupPublicBarcode,
  lookupStandardDb,
  lookupPublicDataPortal,
  lookupOpenFoodFacts,
};
