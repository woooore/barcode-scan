/**
 * 편의점 4사(GS25, CU, 세븐일레븐, 이마트24) 행사 크롤러 & 바코드 가격 API 서버
 *
 * 지원 기능:
 * 1. 바코드 스캔 조회: 사용자 제보 DB + 이달의 공식 행사 크롤링 DB + 오픈 바코드 DB 3중 검색
 * 2. 사용자 참여형 가격/행사 제보: 현장에서 등록한 가격을 즉시 영구 저장하여 전 사용자 공유
 * 3. 이달의 편의점 행사상품 목록 API: 1+1, 2+1 카테고리별/검색어별 조회
 * 4. 원클릭 행사 크롤러 트리거: POST /api/crawl
 * 5. 통계 API: GET /api/stats
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { runCrawler } = require('./crawler');

const PORT = process.env.PORT || 4000;
const CUSTOM_DB_FILE = path.join(__dirname, 'custom_prices_db.json');
const EVENTS_DB_FILE = path.join(__dirname, 'convenience_events_db.json');

function loadCustomDb() {
  try {
    if (fs.existsSync(CUSTOM_DB_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOM_DB_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('사용자 DB 로드 실패:', err.message);
  }
  return {};
}

function saveCustomDb(db) {
  try {
    fs.writeFileSync(CUSTOM_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('사용자 DB 저장 실패:', err.message);
  }
}

function loadEventsDb() {
  try {
    if (fs.existsSync(EVENTS_DB_FILE)) {
      return JSON.parse(fs.readFileSync(EVENTS_DB_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('행사 DB 로드 실패:', err.message);
  }
  return { byBarcode: {}, byName: {}, totalRawEvents: 0 };
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
    // ignore
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 1. 헬스 체크 & 통계: GET /api/stats
  if (req.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api/stats')) {
    const customDb = loadCustomDb();
    const eventsDb = loadEventsDb();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'convenience-barcode-price-server',
        timestamp: new Date().toISOString(),
        stats: {
          userContributedProducts: Object.keys(customDb).length,
          totalCrawledEvents: eventsDb.totalRawEvents || 0,
          matchedBarcodesCount: eventsDb.matchedBarcodesCount || 0,
          brandStats: eventsDb.brandStats || {},
          lastCrawledAt: eventsDb.crawledAt || null,
        },
      })
    );
    return;
  }

  // 2. 바코드 단건 조회: GET /api/products/:barcode
  if (req.method === 'GET' && url.pathname.startsWith('/api/products/')) {
    const barcode = decodeURIComponent(url.pathname.replace('/api/products/', '').trim());
    const customDb = loadCustomDb();
    const eventsDb = loadEventsDb();

    // 1순위: 사용자 직접 제보 가격 DB
    const userItem = customDb[barcode];

    // 2순위: 크롤링된 행사 바코드 DB
    const eventItem = eventsDb.byBarcode ? eventsDb.byBarcode[barcode] : null;

    if (userItem || eventItem) {
      // 두 소스의 매장별 가격 정보 병합 (사용자 제보가 우선)
      const mergedStores = {
        ...(eventItem?.stores || {}),
        ...(userItem?.stores || {}),
      };

      const result = {
        barcode,
        name: userItem?.name || eventItem?.name || `상품 (${barcode})`,
        brand: userItem?.brand || eventItem?.brand || '편의점 유통상품',
        category: userItem?.category || eventItem?.category || '일반상품',
        imageUrl: userItem?.imageUrl || eventItem?.imageUrl,
        stores: mergedStores,
        isUserContributed: Boolean(userItem),
        isCrawledEvent: Boolean(eventItem),
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    // 3순위: Open Food Facts 글로벌 바코드 DB에서 상품명 자동 조회
    const externalItem = await fetchOpenFoodFacts(barcode);
    if (externalItem && externalItem.name) {
      // 오픈 DB에서 찾은 상품명으로 행사 DB 매칭 시도
      const normName = externalItem.name.replace(/[^가-힣a-zA-Z0-9]/g, '');
      const matchedByName = eventsDb.byName ? eventsDb.byName[normName] : null;

      const result = {
        barcode,
        name: externalItem.name,
        brand: externalItem.brand,
        category: externalItem.category,
        volumeOrWeight: externalItem.volumeOrWeight,
        imageUrl: externalItem.imageUrl,
        stores: matchedByName?.stores || {},
        isCrawledEvent: Boolean(matchedByName),
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: '미등록 바코드입니다.', barcode }));
    return;
  }

  // 3. 이달의 전체 편의점 행사상품 조회: GET /api/events
  if (req.method === 'GET' && url.pathname === '/api/events') {
    const eventsDb = loadEventsDb();
    const customDb = loadCustomDb();
    const storeFilter = url.searchParams.get('store');
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();

    const items = [];

    // 크롤링된 바코드 상품들
    if (eventsDb.byBarcode) {
      for (const [bc, p] of Object.entries(eventsDb.byBarcode)) {
        if (storeFilter && !p.stores[storeFilter]) continue;
        if (query && !p.name.toLowerCase().includes(query) && !bc.includes(query)) continue;
        items.push(p);
      }
    }

    // 사용자 제보 상품들
    for (const [bc, p] of Object.entries(customDb)) {
      if (storeFilter && !p.stores[storeFilter]) continue;
      if (query && !p.name.toLowerCase().includes(query) && !bc.includes(query)) continue;
      if (!items.find((i) => i.barcode === bc)) {
        items.push(p);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ total: items.length, items: items.slice(0, 100) }));
    return;
  }

  // 4. 사용자 현장 가격/행사 제보 저장: POST /api/products
  if (req.method === 'POST' && url.pathname === '/api/products') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { barcode, name, brand, category, storeId, priceInfo, imageUrl } = payload;
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
          imageUrl,
          stores: {},
          isUserContributed: true,
        };

        existing.name = name || existing.name;
        existing.brand = brand || existing.brand;
        existing.category = category || existing.category;
        if (imageUrl) existing.imageUrl = imageUrl;
        existing.stores = {
          ...existing.stores,
          [storeId]: priceInfo,
        };

        db[barcode] = existing;
        saveCustomDb(db);

        console.log(`[사용자 제보 등록] 바코드: ${barcode}, 상품명: ${name}, 매장: ${storeId}, 가격: ${priceInfo.price}원, 행사: ${priceInfo.promoType}`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, product: existing }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. 행사상품 최신 크롤링 실행 트리거: POST /api/crawl
  if (req.method === 'POST' && url.pathname === '/api/crawl') {
    try {
      console.log('[API 요청] 편의점 행사상품 크롤링 즉시 실행...');
      const result = await runCrawler(5);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  const events = loadEventsDb();
  const custom = loadCustomDb();
  console.log(`========================================================`);
  console.log(`🚀 얼마야 편의점 가격·행사 통합 API 서버 구동 완료: http://localhost:${PORT}`);
  console.log(`   - 📊 수집된 편의점 행사 데이터: ${events.totalRawEvents || 0}건 (매칭 바코드: ${events.matchedBarcodesCount || 0}건)`);
  console.log(`   - 👥 사용자 참여 제보 등록 상품: ${Object.keys(custom).length}건`);
  console.log(`   - 🔍 바코드 조회 엔드포인트: GET http://localhost:${PORT}/api/products/:barcode`);
  console.log(`   - ✍️ 현장 제보 엔드포인트:   POST http://localhost:${PORT}/api/products`);
  console.log(`========================================================`);
});
