import { BrowserMultiFormatReader } from '@zxing/library';

/**
 * 이미지 파일(File 또는 Blob)에서 바코드를 스캔하여 문자열을 반환합니다.
 * 1차: 브라우저 네이티브 BarcodeDetector API (가장 빠름)
 * 2차: @zxing/library 다중 포맷 바코드 리더 (EAN-13, EAN-8, UPC 등 정밀 분석)
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
      // 1. 네이티브 BarcodeDetector 시도
      try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          const BarcodeDetectorClass = (window as any).BarcodeDetector;
          const detector = new BarcodeDetectorClass({
            formats: [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_128',
              'code_39',
              'qr_code',
            ],
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
      } catch (err) {
        console.warn('Native BarcodeDetector pass failed, falling back to ZXing:', err);
      }

      // 2. @zxing/library 정밀 분석
      try {
        const reader = new BrowserMultiFormatReader();
        const zxingResult = await reader.decodeFromImageElement(img);
        if (zxingResult && zxingResult.getText()) {
          resolve({
            success: true,
            barcode: zxingResult.getText(),
            format: zxingResult.getBarcodeFormat().toString(),
            previewUrl,
          });
          return;
        }
      } catch (zxingErr: any) {
        // ZXing can throw NotFoundException if no barcode in image
        console.warn('ZXing barcode not found:', zxingErr?.message);
      }

      resolve({
        success: false,
        previewUrl,
        error:
          '사진에서 바코드를 감지하지 못했습니다. 바코드 영역이 크고 선명하게 나온 사진으로 다시 시도해 주세요.',
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

