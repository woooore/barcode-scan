import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

/**
 * 캔버스를 이용한 고성능 다단계 이미지 바코드 디코더
 * 1단계: 브라우저 네이티브 BarcodeDetector
 * 2단계: ZXing 원본 스캔
 * 3단계: 캔버스 대비(Contrast) 향상 + 흑백 이진화
 * 4단계: 90도 회전 스캔 (스마트폰 세로/가로 회전 보정)
 */
export async function scanBarcodeFromImageFile(file: File): Promise<{
  success: boolean;
  barcode?: string;
  format?: string;
  previewUrl: string;
  error?: string;
}> {
  const previewUrl = URL.createObjectURL(file);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      // 1. 네이티브 BarcodeDetector (가장 빠름)
      try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const results = await detector.detect(img);
          if (results && results.length > 0) {
            resolve({
              success: true,
              barcode: results[0].rawValue,
              format: results[0].format,
              previewUrl,
            });
            return;
          }
        }
      } catch (e) {
        // fallback
      }

      // 2. ZXing 기본 힌트 설정 (EAN-13, EAN-8, UPC 우선)
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);

      // 원본 이미지 디코딩
      try {
        const res = await reader.decodeFromImageElement(img);
        if (res && res.getText()) {
          resolve({
            success: true,
            barcode: res.getText(),
            format: res.getBarcodeFormat().toString(),
            previewUrl,
          });
          return;
        }
      } catch (e) {
        // continue to pass 3
      }

      // 3. 캔버스 전처리: 스마트폰 고해상도 리사이즈 및 흑백 대비 보정
      try {
        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // 너무 큰 사진(4000px 이상)은 축소하여 바코드 라인이 뭉개지지 않게
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          const maxDim = 1600;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }

          canvas.width = w;
          canvas.height = h;

          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);

            // 흑백 대비 강화 필터 적용
            const imgData = ctx.getImageData(0, 0, w, h);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i];
              const g = d[i + 1];
              const b = d[i + 2];
              // 명도 계산
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              // 대비(Contrast) 확장
              const contrast = (gray - 128) * 1.5 + 128;
              const finalVal = Math.min(255, Math.max(0, contrast));
              d[i] = finalVal;
              d[i + 1] = finalVal;
              d[i + 2] = finalVal;
            }
            ctx.putImageData(imgData, 0, 0);

            // 캔버스에서 재디코딩
            const enhancedUrl = canvas.toDataURL('image/png');
            const enhancedImg = new Image();
            enhancedImg.src = enhancedUrl;
            await new Promise((r) => (enhancedImg.onload = r));

            try {
              const res2 = await reader.decodeFromImageElement(enhancedImg);
              if (res2 && res2.getText()) {
                resolve({
                  success: true,
                  barcode: res2.getText(),
                  format: res2.getBarcodeFormat().toString(),
                  previewUrl,
                });
                return;
              }
            } catch (e2) {
              // try rotation pass 4
            }

            // 4. 90도 회전 스캔 (스마트폰을 돌려 찍은 경우)
            const rotCanvas = document.createElement('canvas');
            rotCanvas.width = h;
            rotCanvas.height = w;
            const rotCtx = rotCanvas.getContext('2d');
            if (rotCtx) {
              rotCtx.translate(h / 2, w / 2);
              rotCtx.rotate((90 * Math.PI) / 180);
              rotCtx.drawImage(img, -w / 2, -h / 2, w, h);

              const rotUrl = rotCanvas.toDataURL('image/png');
              const rotImg = new Image();
              rotImg.src = rotUrl;
              await new Promise((r) => (rotImg.onload = r));

              try {
                const res3 = await reader.decodeFromImageElement(rotImg);
                if (res3 && res3.getText()) {
                  resolve({
                    success: true,
                    barcode: res3.getText(),
                    format: res3.getBarcodeFormat().toString(),
                    previewUrl,
                  });
                  return;
                }
              } catch (e3) {
                // not found
              }
            }
          }
        }
      } catch (err) {
        console.warn('Canvas preprocessing error:', err);
      }

      resolve({
        success: false,
        previewUrl,
        error:
          '사진에서 바코드를 감지하지 못했습니다. 조명 반사나 흔들림 없이 바코드 줄무늬가 선명한 사진을 올려주시거나, 사진 속 바코드 번호를 직접 입력해 주세요.',
      });
    };

    img.onerror = () => {
      resolve({
        success: false,
        previewUrl,
        error: '이미지 파일을 불러오는데 실패했습니다.',
      });
    };

    img.src = previewUrl;
  });
}
