import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

/**
 * 캔버스를 이용한 고성능 다단계 이미지 바코드 디코더
 * 한국 편의점·마트 유통 상품의 99.9%는 13자리 EAN-13(880...) 바코드입니다.
 * 13자리 바코드 일부를 8자리(EAN-8)로 조기 오인식하는 문제를 방지하기 위해 EAN-13을 최우선으로 정밀 스캔합니다.
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
      // 1단계: 브라우저 네이티브 BarcodeDetector (EAN-13 최우선 단독 스캔으로 오인식 원천 차단)
      try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'code_128', 'upc_a'],
          });
          const results = await detector.detect(img);
          if (results && results.length > 0) {
            const best = results.find((r: any) => r.format === 'ean_13') || results[0];
            resolve({
              success: true,
              barcode: best.rawValue,
              format: best.format,
              previewUrl,
            });
            return;
          }
        }
      } catch (e) {
        // fallback
      }

      // 2단계: ZXing 정밀 스캔 (EAN-13 최우선)
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.CODE_128,
        BarcodeFormat.UPC_A,
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

      // 3단계: 캔버스 전처리 (리사이즈 + 흑백 명암 대비 극대화)
      try {
        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

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

            // 흑백 대비 강화 필터
            const imgData = ctx.getImageData(0, 0, w, h);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              const contrast = (gray - 128) * 1.6 + 128;
              const val = Math.min(255, Math.max(0, contrast));
              d[i] = val;
              d[i + 1] = val;
              d[i + 2] = val;
            }
            ctx.putImageData(imgData, 0, 0);

            const enhancedUrl = canvas.toDataURL('image/png');
            const enhancedImg = new Image();
            enhancedImg.src = enhancedUrl;
            await new Promise((r) => (enhancedImg.onload = r));

            // 전처리 이미지로 네이티브 + ZXing 재시도
            try {
              if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
                const det2 = new (window as any).BarcodeDetector({
                  formats: ['ean_13', 'code_128', 'upc_a'],
                });
                const r2 = await det2.detect(enhancedImg);
                if (r2 && r2.length > 0) {
                  resolve({
                    success: true,
                    barcode: r2[0].rawValue,
                    format: r2[0].format,
                    previewUrl,
                  });
                  return;
                }
              }
            } catch (e) {}

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
            } catch (e2) {}

            // 4단계: 90도 회전 스캔 (스마트폰 회전 사진 대응)
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
              } catch (e3) {}
            }
          }
        }
      } catch (err) {
        console.warn('Canvas preprocessing error:', err);
      }

      // 5단계: 최후의 보루 (EAN-8 등 희귀 포맷 포함 전체 스캔)
      try {
        const fallbackHints = new Map();
        fallbackHints.set(DecodeHintType.TRY_HARDER, true);
        const fallbackReader = new BrowserMultiFormatReader(fallbackHints);
        const lastRes = await fallbackReader.decodeFromImageElement(img);
        if (lastRes && lastRes.getText()) {
          resolve({
            success: true,
            barcode: lastRes.getText(),
            format: lastRes.getBarcodeFormat().toString(),
            previewUrl,
          });
          return;
        }
      } catch (e) {}

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
