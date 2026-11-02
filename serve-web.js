/**
 * 얼마야 통합 웹 & API 서버
 * - 포트 3000 하나로 정적 웹앱과 백엔드 API(/api/products, /api/events 등)를 동시 제공합니다.
 * - 별도의 백엔드 터미널을 따로 띄우지 않아도 크롤링된 행사 DB(460건) 및 사용자 제보 DB가 즉시 연동됩니다.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');
const CUSTOM_DB_FILE = path.join(__dirname, 'server', 'custom_prices_db.json');
const EVENTS_DB_FILE = path.join(__dirname, 'server', 'convenience_events_db.json');

function loadEnv() {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        process.env[k] = v;
      }
    }
  }
}
loadEnv();
const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || '';

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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

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

  // ==========================================
  // 1. API 엔드포인트 핸들러 (/api/...)
  // ==========================================

  // GET /api/stats 또는 /api/health
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
        },
      })
    );
    return;
  }

  // GET /api/config (Gemini AI 키 및 시스템 설정 반환)
  if (req.method === 'GET' && url.pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        hasGeminiKey: Boolean(DEFAULT_GEMINI_KEY),
        geminiKey: DEFAULT_GEMINI_KEY,
      })
    );
    return;
  }

  // POST /api/gemini/analyze (바코드 번호로 Gemini AI 질의 프록시)
  if (req.method === 'POST' && url.pathname === '/api/gemini/analyze') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { barcode, storeId, apiKey } = JSON.parse(body || '{}');
        const effectiveKey = (apiKey && apiKey.trim()) || DEFAULT_GEMINI_KEY;
        if (!effectiveKey || !barcode) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '바코드 또는 API 키가 누락되었습니다.' }));
          return;
        }

        const prompt = `당신은 한국 편의점(GS25, CU, 세븐일레븐, 이마트24) 및 대형마트 유통 상품 전문 데이터 분석 AI입니다.
바코드 번호: [${barcode}]
선택된 매장: [${storeId || 'GS25'}]

이 13자리 바코드(880...) 상품의 정확한 상품명, 제조사/브랜드, 규격/용량, 카테고리, 그리고 ${storeId || 'GS25'} 편의점 기준 단품 판매 가격(원) 및 1+1 / 2+1 행사 여부를 추론하여 오직 순수 JSON으로만 답변하세요:
{
  "barcode": "${barcode}",
  "name": "상품명",
  "brand": "제조사/브랜드",
  "category": "카테고리",
  "volumeOrWeight": "용량",
  "price": 2000,
  "promoType": "NONE",
  "promoLabel": "정가 판매",
  "confidence": "high"
}`;

        const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-3.8-flash'];
        let answered = false;

        for (const m of models) {
          try {
            const apiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${effectiveKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
                }),
              }
            );
            if (apiRes.ok) {
              const d = await apiRes.json();
              const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (txt) {
                const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(parsed));
                answered = true;
                break;
              }
            }
          } catch (e) {}
        }

        if (!answered) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Gemini AI 호출에 실패했습니다.' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/gemini/vision (사진 Base64로 Gemini Vision 판독 프록시)
  if (req.method === 'POST' && url.pathname === '/api/gemini/vision') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { imageBase64, mimeType, storeId, apiKey } = JSON.parse(body || '{}');
        const effectiveKey = (apiKey && apiKey.trim()) || DEFAULT_GEMINI_KEY;
        if (!effectiveKey || !imageBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '이미지 데이터 또는 API 키가 누락되었습니다.' }));
          return;
        }

        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        const prompt = `이 사진은 한국 편의점(${storeId || 'GS25'}) 진열대 또는 상품의 사진입니다.
사진 속 라벨 텍스트, 바코드 번호(숫자 880...), 제품 패키지 디자인을 정밀 판독하세요.
판독한 상품의 바코드 번호, 상품명, 제조사/브랜드, ${storeId || 'GS25'} 기준 판매 가격(원), 1+1/2+1 행사 여부를 아래 JSON 형식으로만 반환하세요:
{
  "barcode": "바코드 번호",
  "name": "상품명",
  "brand": "제조사",
  "category": "카테고리",
  "volumeOrWeight": "용량",
  "price": 2000,
  "promoType": "NONE",
  "promoLabel": "정가 판매",
  "confidence": "high"
}`;

        const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-3.8-flash'];
        let answered = false;

        for (const m of models) {
          try {
            const apiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${effectiveKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        { text: prompt },
                        { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64 } },
                      ],
                    },
                  ],
                  generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
                }),
              }
            );
            if (apiRes.ok) {
              const d = await apiRes.json();
              const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (txt) {
                const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(parsed));
                answered = true;
                break;
              }
            }
          } catch (e) {}
        }

        if (!answered) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Gemini Vision AI 분석에 실패했습니다.' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/products/')) {
    const barcode = decodeURIComponent(url.pathname.replace('/api/products/', '').trim());
    const customDb = loadCustomDb();
    const eventsDb = loadEventsDb();

    const userItem = customDb[barcode];
    const eventItem = eventsDb.byBarcode ? eventsDb.byBarcode[barcode] : null;

    if (userItem || eventItem) {
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

    // 4순위: Gemini AI를 통한 880 바코드 제조사 및 상품명 정밀 분석
    try {
      const prompt = `당신은 한국 유통 상품 데이터 분석 AI입니다.
바코드: [${barcode}]
이 바코드 상품의 정확한 상품명, 제조사/브랜드, 규격, 카테고리를 JSON으로만 반환하세요:
{"barcode":"${barcode}","name":"상품명","brand":"제조사","category":"카테고리","volumeOrWeight":"용량"}`;

      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${DEFAULT_GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      );

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const raw = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
          if (parsed.name) {
            const aiResult = {
              barcode,
              name: parsed.name,
              brand: parsed.brand || '제조사 확인됨',
              category: parsed.category || '유통상품',
              volumeOrWeight: parsed.volumeOrWeight,
              stores: {},
              isGeminiAnalyzed: true,
            };
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            res.end(JSON.stringify(aiResult));
            return;
          }
        }
      }
    } catch (e) {
      // ignore
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: '미등록 바코드입니다.', barcode }));
    return;
  }

  // GET /api/events
  if (req.method === 'GET' && url.pathname === '/api/events') {
    const eventsDb = loadEventsDb();
    const customDb = loadCustomDb();
    const storeFilter = url.searchParams.get('store');
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();

    const items = [];
    if (eventsDb.byBarcode) {
      for (const [bc, p] of Object.entries(eventsDb.byBarcode)) {
        if (storeFilter && !p.stores[storeFilter]) continue;
        if (query && !p.name.toLowerCase().includes(query) && !bc.includes(query)) continue;
        items.push(p);
      }
    }
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

  // POST /api/products
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

        console.log(`[사용자 제보 등록 완료] ${name} (${barcode}) -> ${storeId} ${priceInfo.price}원 (${priceInfo.promoType})`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, product: existing }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ==========================================
  // 2. 정적 웹앱 서빙 (dist/...)
  // ==========================================
  let reqPath = url.pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(DIST, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback
    const indexPath = path.join(DIST, 'index.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    fs.createReadStream(indexPath).pipe(res);
  }
});

server.listen(PORT, () => {
  const events = loadEventsDb();
  const custom = loadCustomDb();
  console.log(`=============================================================`);
  console.log(`🎉 [얼마야] 편의점·마트 바코드 스캐너 통합 서버 실행 완료!`);
  console.log(`👉 브라우저 접속 주소: http://localhost:${PORT}`);
  console.log(`📊 행사 데이터베이스: ${events.totalRawEvents || 0}건 탑재됨`);
  console.log(`👥 사용자 제보 등록:   ${Object.keys(custom).length}건 영구 저장됨`);
  console.log(`=============================================================`);
});
