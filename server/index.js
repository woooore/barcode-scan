/**
 * 편의점 4사(GS25, CU, 세븐일레븐, 이마트24) 행사 크롤러 & 바코드 가격 API 서버
 * 외부 무거운 패키지 의존성 없이 Node.js 내장 http 및 fetch(Node 18+)로 즉시 구동됩니다.
 *
 * 실행 방법:
 *   node server/index.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname, 'custom_prices_db.json');

function loadCustomDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('DB 파일 로드 실패:', err.message);
  }
  return {};
}

function saveCustomDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('DB 파일 저장 실패:', err.message);
  }
}

/**
 * Open Food Facts API를 통해 미등록 바코드(880...)의 한국 상품명/브랜드 조회
 */
async function fetchOpenFoodFacts(barcode) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      return {
        barcode,
        name:
          p.product_name_ko ||
          p.product_name ||
          p.generic_name_ko ||
          p.generic_name ||
          null,
        brand: p.brands ? String(p.brands).split(',')[0].trim() : '일반브랜드',
        category: '식품/음료',
        volumeOrWeight: p.quantity || '',
        imageUrl: p.image_front_small_url || null,
      };
    }
  } catch (err) {
    // ignore network error
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  // CORS 헤더 설정 (Expo Web 및 모바일 기기 연동)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 1. 헬스 체크
  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'convenience-barcode-price-server',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // 2. 바코드 단건 조회: GET /api/products/:barcode
  if (req.method === 'GET' && url.pathname.startsWith('/api/products/')) {
    const barcode = decodeURIComponent(url.pathname.replace('/api/products/', '').trim());
    const db = loadCustomDb();

    if (db[barcode]) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(db[barcode]));
      return;
    }

    // 로컬 서버 DB에 없으면 Open Food Facts 연동 조회
    const externalItem = await fetchOpenFoodFacts(barcode);
    if (externalItem && externalItem.name) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(externalItem));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: '미등록 바코드입니다.', barcode }));
    return;
  }

  // 3. 사용자 현장 가격/행사 제보 저장: POST /api/products
  if (req.method === 'POST' && url.pathname === '/api/products') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { barcode, name, brand, category, storeId, priceInfo } = payload;
        if (!barcode || !storeId || !priceInfo) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '필수 필드가 누락되었습니다.' }));
          return;
        }

        const db = loadCustomDb();
        const existing = db[barcode] || {
          barcode,
          name: name || `상품 (${barcode})`,
          brand: brand || '기타',
          category: category || '일반상품',
          stores: {},
        };

        existing.name = name || existing.name;
        existing.brand = brand || existing.brand;
        existing.category = category || existing.category;
        existing.stores = {
          ...existing.stores,
          [storeId]: priceInfo,
        };

        db[barcode] = existing;
        saveCustomDb(db);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, product: existing }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`🚀 얼마야 바코드 가격/행사 API 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   - 바코드 조회: GET  http://localhost:${PORT}/api/products/:barcode`);
  console.log(`   - 가격 제보:   POST http://localhost:${PORT}/api/products`);
  console.log(`========================================================`);
});
