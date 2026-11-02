/**
 * 편의점 4사 (GS25, CU, 세븐일레븐, 이마트24) 행사상품 자동 크롤러
 * 매월 진행되는 1+1, 2+1, 할인 상품 및 가격, 바코드를 수집하여 convenience_events_db.json에 저장합니다.
 *
 * 실행:
 *   node server/crawler.js
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'convenience_events_db.json');

const BRANDS = [
  { id: 'GS25', pyonyKey: 'gs25', name: 'GS25' },
  { id: 'CU', pyonyKey: 'cu', name: 'CU' },
  { id: 'SEVEN', pyonyKey: 'seven', name: '세븐일레븐' },
  { id: 'EMART24', pyonyKey: 'emart24', name: '이마트24' },
];

function cleanProductName(name) {
  return name.replace(/<[^>]+>/g, '').trim();
}

async function crawlBrand(brand, maxPages = 5) {
  const items = [];
  console.log(`[크롤러] ${brand.name} 행사 데이터 수집 중... (최대 ${maxPages}페이지)`);

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `https://pyony.com/search/?page=${page}&brand=${brand.pyonyKey}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const html = await res.text();

      const chunks = html.split('<div class="card-body');
      let pageCount = 0;

      for (const chunk of chunks.slice(1)) {
        const nameMatch = chunk.match(/<strong>([^<]+)<\/strong>/);
        if (!nameMatch) continue;
        const name = cleanProductName(nameMatch[1]);
        if (name.includes('전체편의점 행사상품')) continue;

        const priceMatch = chunk.match(/<i class="fa fa-coins[^"]*"><\/i>\s*([\d,]+)\s*원/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;

        const promoMatch = chunk.match(/<span class="badge[^>]*>([1-9]\+[1-9]|할인|덤증정)<\/span>/);
        const promoType = promoMatch ? promoMatch[1].trim() : 'NONE';

        const imgMatch = chunk.match(/src="([^"]+)"/);
        const imageUrl = imgMatch
          ? imgMatch[1].startsWith('//')
            ? 'https:' + imgMatch[1]
            : imgMatch[1]
          : undefined;

        // 이미지 파일명에서 유통 표준 880 바코드 추출 (GS25, CU, 이마트24 표준 형식)
        const bcMatch = imageUrl ? imageUrl.match(/(880\d{10})/) : null;
        const barcode = bcMatch ? bcMatch[1] : undefined;

        items.push({
          barcode,
          name,
          storeId: brand.id,
          price,
          promoType,
          imageUrl,
          updatedAt: new Date().toISOString().slice(0, 10),
        });
        pageCount++;
      }

      console.log(`   - ${brand.name} ${page}페이지: ${pageCount}건 수집`);
      if (pageCount === 0) break;
      await new Promise((r) => setTimeout(r, 250)); // 서버 부하 방지
    } catch (err) {
      console.warn(`   - ${brand.name} ${page}페이지 수집 실패:`, err.message);
      break;
    }
  }

  return items;
}

async function runCrawler(maxPagesPerBrand = 5) {
  const startTime = Date.now();
  console.log('====================================================');
  console.log('🚀 [편의점 행사상품 크롤링 시작] GS25 · CU · 7-ELEVEN · emart24');
  console.log('====================================================');

  const allEvents = [];
  const brandStats = {};

  for (const b of BRANDS) {
    const list = await crawlBrand(b, maxPagesPerBrand);
    allEvents.push(...list);
    brandStats[b.id] = list.length;
  }

  // 바코드별 및 상품명별 맵 구조화
  const byBarcode = {};
  const byName = {};

  for (const item of allEvents) {
    const storePrice = {
      price: item.price,
      promoType: item.promoType,
      promoLabel:
        item.promoType === '1+1'
          ? `1+1 행사 (개당 ${Math.round(item.price / 2).toLocaleString()}원)`
          : item.promoType === '2+1'
          ? `2+1 행사 (개당 ${Math.round((item.price * 2) / 3).toLocaleString()}원)`
          : `${item.promoType} 행사 상품`,
      updatedAt: item.updatedAt,
    };

    if (item.barcode) {
      if (!byBarcode[item.barcode]) {
        byBarcode[item.barcode] = {
          barcode: item.barcode,
          name: item.name,
          brand: item.storeId + ' 행사상품',
          category: '편의점 행사상품',
          imageUrl: item.imageUrl,
          stores: {},
        };
      }
      byBarcode[item.barcode].stores[item.storeId] = storePrice;
      if (item.imageUrl && !byBarcode[item.barcode].imageUrl) {
        byBarcode[item.barcode].imageUrl = item.imageUrl;
      }
    }

    // 이름 기준 매핑 (바코드가 없는 상품의 이름 매칭용)
    const normName = item.name.replace(/[^가-힣a-zA-Z0-9]/g, '');
    if (!byName[normName]) {
      byName[normName] = {
        name: item.name,
        barcode: item.barcode,
        imageUrl: item.imageUrl,
        stores: {},
      };
    }
    byName[normName].stores[item.storeId] = storePrice;
  }

  const result = {
    crawledAt: new Date().toISOString(),
    totalRawEvents: allEvents.length,
    matchedBarcodesCount: Object.keys(byBarcode).length,
    brandStats,
    byBarcode,
    byName,
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(result, null, 2), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('====================================================');
  console.log(`✅ [크롤링 완료 - ${elapsed}초 소요]`);
  console.log(`   - 총 수집된 행사 상품 수: ${allEvents.length}건`);
  console.log(`   - 고유 바코드(880...) 매칭: ${Object.keys(byBarcode).length}건`);
  console.log(`   - 브랜드별:`, brandStats);
  console.log(`📁 저장 파일: ${DB_FILE}`);
  console.log('====================================================');

  return result;
}

if (require.main === module) {
  runCrawler(5).catch((err) => {
    console.error('크롤러 실행 중 치명적 오류:', err);
  });
}

module.exports = { runCrawler };

