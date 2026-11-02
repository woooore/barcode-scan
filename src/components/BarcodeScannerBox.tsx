import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { ProductItem, StoreInfo } from '../types/product';
import { scanBarcodeFromImageFile } from '../services/imageBarcodeScanner';

interface BarcodeScannerBoxProps {
  selectedStore: StoreInfo;
  products: ProductItem[];
  onBarcodeDetected: (barcode: string) => void;
  lastScannedBarcode: string | null;
}

export const BarcodeScannerBox: React.FC<BarcodeScannerBoxProps> = ({
  selectedStore,
  products,
  onBarcodeDetected,
  lastScannedBarcode,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const isScanningRef = React.useRef(false);

  const isWeb = Platform.OS === 'web';

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageScanFeedback, setImageScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handlePickImageFile = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      setIsAnalyzingImage(true);
      setImageScanFeedback(null);

      try {
        const result = await scanBarcodeFromImageFile(file);
        setUploadedImage(result.previewUrl);
        setIsAnalyzingImage(false);

        if (result.success && result.barcode) {
          setImageScanFeedback({
            type: 'success',
            message: `🎉 바코드 [${result.barcode}] 감지 완료!`,
          });
          onBarcodeDetected(result.barcode);
        } else {
          setImageScanFeedback({
            type: 'error',
            message:
              result.error ||
              '사진에서 바코드를 찾지 못했습니다. 바코드 영역이 크고 선명한 사진을 사용해 주세요.',
          });
        }
      } catch (err: any) {
        setIsAnalyzingImage(false);
        setImageScanFeedback({
          type: 'error',
          message: '이미지 분석 중 오류가 발생했습니다.',
        });
      }
    };
    input.click();
  };

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (isScanningRef.current || !result?.data) return;
    const cleanCode = String(result.data).trim();
    if (!cleanCode) return;

    // 즉시 동기 잠금으로 중복 프레임 연속 호출 방지
    isScanningRef.current = true;
    setCooldown(true);

    try {
      onBarcodeDetected(cleanCode);
    } catch (e) {
      console.warn('Barcode detect error:', e);
    }

    setTimeout(() => {
      isScanningRef.current = false;
      setCooldown(false);
    }, 2000);
  };

  const handleManualSubmit = () => {
    const query = manualInput.trim();
    if (!query) return;

    // 상품명으로 검색했는지 바코드 번호로 입력했는지 판별
    const byName = products.find(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.barcode === query
    );
    if (byName) {
      onBarcodeDetected(byName.barcode);
    } else {
      onBarcodeDetected(query);
    }
    setManualInput('');
  };

  return (
    <View style={styles.container}>
      {/* 카메라 뷰파인더 영역 */}
      <View style={styles.cameraWrapper}>
        {isWeb ? (
          <View style={styles.liveCameraContainer}>
            {uploadedImage ? (
              <Image
                source={{ uri: uploadedImage }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="contain"
              />
            ) : null}

            <View style={styles.overlayContainer} pointerEvents="box-none">
              <View style={styles.topOverlayBar}>
                <View
                  style={[
                    styles.scanningStorePill,
                    { backgroundColor: selectedStore.primaryColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.scanningStorePillText,
                      { color: selectedStore.textColor },
                    ]}
                  >
                    📍 {selectedStore.name} 가격 조회 모드
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.camCtrlBtn, { backgroundColor: '#2C2C2E' }]}
                  onPress={handlePickImageFile}
                >
                  <Text style={styles.camCtrlText}>📁 사진 변경</Text>
                </TouchableOpacity>
              </View>

              {!uploadedImage ? (
                <View style={styles.reticleBox}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <View style={styles.laserLine} />
                </View>
              ) : isAnalyzingImage ? (
                <View style={[styles.autoDetectedBadge, { borderColor: '#0A84FF' }]}>
                  <Text style={[styles.autoDetectedBadgeText, { color: '#0A84FF' }]}>
                    ⏳ 사진 속 바코드(880...) 탐색 중...
                  </Text>
                </View>
              ) : imageScanFeedback?.type === 'success' ? (
                <View style={styles.autoDetectedBadge}>
                  <Text style={styles.autoDetectedBadgeText}>
                    🎉 바코드 감지 성공!
                  </Text>
                </View>
              ) : imageScanFeedback?.type === 'error' ? (
                <View style={[styles.autoDetectedBadge, { borderColor: '#FF453A' }]}>
                  <Text style={[styles.autoDetectedBadgeText, { color: '#FF453A' }]}>
                    ⚠️ 바코드 인식 실패
                  </Text>
                </View>
              ) : null}

              <Text style={styles.guideText}>
                {isAnalyzingImage
                  ? '⏳ 사진 속 바코드(880...)를 자동으로 스캔하는 중...'
                  : imageScanFeedback?.type === 'success'
                  ? '✅ 바코드 인식 완료! 아래에서 실시간 가격을 확인하세요.'
                  : imageScanFeedback?.type === 'error'
                  ? '❌ 바코드 줄무늬가 흐려서 읽지 못했습니다. 아래 번호를 직접 입력해 주세요.'
                  : uploadedImage
                  ? '사진 분석 완료'
                  : '💡 사진 속 어느 위치에 바코드가 있어도 자동으로 감지됩니다!'}
              </Text>
            </View>
          </View>
        ) : !permission ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionTitle}>카메라 권한 확인 중...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.cameraEmoji}>📷</Text>
            <Text style={styles.permissionTitle}>
              {selectedStore.name} 상품 바코드 스캔 준비
            </Text>
            <Text style={styles.permissionDesc}>
              진열대에 가격표가 없는 상품의 바코드를 비추면{'\n'}즉시 {selectedStore.name} 판매가와 1+1 행사 여부를 알려드려요!
            </Text>
            <TouchableOpacity
              style={[
                styles.grantBtn,
                { backgroundColor: selectedStore.primaryColor },
              ]}
              onPress={requestPermission}
            >
              <Text style={[styles.grantBtnText, { color: selectedStore.textColor }]}>
                카메라 권한 허용하고 스캔 시작
              </Text>
            </TouchableOpacity>
          </View>
        ) : cameraActive ? (
          <View style={styles.liveCameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                  'qr',
                ],
              }}
              onBarcodeScanned={handleBarCodeScanned}
            />
            {/* 스캔 가이드 오버레이 */}
            <View style={styles.overlayContainer} pointerEvents="box-none">
              <View style={styles.topOverlayBar}>
                <View
                  style={[
                    styles.scanningStorePill,
                    { backgroundColor: selectedStore.primaryColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.scanningStorePillText,
                      { color: selectedStore.textColor },
                    ]}
                  >
                    📍 {selectedStore.name} 가격 조회 모드
                  </Text>
                </View>

                <View style={styles.cameraControls}>
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity
                      style={[
                        styles.camCtrlBtn,
                        torchOn && styles.camCtrlBtnActive,
                      ]}
                      onPress={() => setTorchOn((prev) => !prev)}
                    >
                      <Text style={styles.camCtrlText}>
                        {torchOn ? '🔦 켜짐' : '🔦 조명'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.camCtrlBtn}
                    onPress={() => setCameraActive(false)}
                  >
                    <Text style={styles.camCtrlText}>⏸ 일시정지</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.reticleBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <View style={styles.laserLine} />
              </View>

              <Text style={styles.guideText}>
                {cooldown
                  ? '✅ 바코드 인식 완료! 아래에서 가격을 확인하세요'
                  : '상품 뒷면의 바코드(880...)를 사각형 안에 맞춰주세요'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionTitle}>카메라가 일시정지되었습니다</Text>
            <TouchableOpacity
              style={[
                styles.grantBtn,
                { backgroundColor: selectedStore.primaryColor, marginTop: 10 },
              ]}
              onPress={() => setCameraActive(true)}
            >
              <Text style={[styles.grantBtnText, { color: selectedStore.textColor }]}>
                ▶ 카메라 다시 켜기
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 찍어둔 바코드 사진 첨부 업로드 버튼 */}
      {isWeb && (
        <View style={styles.imageUploadSection}>
          <TouchableOpacity
            style={[
              styles.imageUploadBtn,
              { backgroundColor: selectedStore.primaryColor },
            ]}
            onPress={handlePickImageFile}
            disabled={isAnalyzingImage}
          >
            {isAnalyzingImage ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={selectedStore.textColor} />
                <Text style={[styles.imageUploadBtnText, { color: selectedStore.textColor }]}>
                  사진 속 바코드 분석 중...
                </Text>
              </View>
            ) : (
              <Text style={[styles.imageUploadBtnText, { color: selectedStore.textColor }]}>
                📷 찍어둔 바코드 사진 첨부해서 스캔하기 (JPG/PNG)
              </Text>
            )}
          </TouchableOpacity>

          {imageScanFeedback && (
            <View
              style={[
                styles.feedbackBox,
                imageScanFeedback.type === 'success'
                  ? styles.feedbackSuccess
                  : styles.feedbackError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  imageScanFeedback.type === 'success'
                    ? styles.feedbackTextSuccess
                    : styles.feedbackTextError,
                ]}
              >
                {imageScanFeedback.message}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 수동 바코드 번호 또는 상품명 검색 바 */}
      <View style={styles.searchBarRow}>
        <TextInput
          style={styles.searchInput}
          value={manualInput}
          onChangeText={setManualInput}
          placeholder="바코드 번호(880...) 또는 상품명 직접 입력 (예: 사이다, 불닭)"
          placeholderTextColor="#6E6E73"
          returnKeyType="search"
          onSubmitEditing={handleManualSubmit}
        />
        <TouchableOpacity
          style={[
            styles.searchBtn,
            { backgroundColor: selectedStore.primaryColor },
          ]}
          onPress={handleManualSubmit}
        >
          <Text style={[styles.searchBtnText, { color: selectedStore.textColor }]}>
            조회
          </Text>
        </TouchableOpacity>
      </View>

      {/* 빠른 시뮬레이션 바코드 칩 (카메라 없이도 즉시 테스트 가능) */}
      <View style={styles.quickTestSection}>
        <Text style={styles.quickTestHeader}>
          ⚡ 원터치 바코드 스캔 테스트 (실제 GS25·CU·마트 인기상품)
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChipsContainer}
        >
          {products.map((item) => {
            const isSelected = lastScannedBarcode === item.barcode;
            const storePrice = item.stores[selectedStore.id];
            const promoTag =
              storePrice && storePrice.promoType !== 'NONE'
                ? storePrice.promoType
                : null;

            return (
              <TouchableOpacity
                key={item.barcode}
                onPress={() => onBarcodeDetected(item.barcode)}
                style={[
                  styles.quickChip,
                  isSelected && {
                    borderColor: selectedStore.primaryColor,
                    backgroundColor: '#2C2C34',
                  },
                ]}
              >
                <Text style={styles.quickChipEmoji}>{item.imageEmoji}</Text>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.quickChipName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {promoTag && (
                      <View style={styles.quickPromoTag}>
                        <Text style={styles.quickPromoTagText}>{promoTag}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.quickChipPrice}>
                    {storePrice
                      ? `${selectedStore.shortName} ${storePrice.price.toLocaleString()}원`
                      : '가격 미등록'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 6,
  },
  cameraWrapper: {
    height: 225,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cameraEmoji: {
    fontSize: 34,
    marginBottom: 6,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  permissionDesc: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  grantBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
  },
  grantBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  liveCameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  topOverlayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanningStorePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  scanningStorePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cameraControls: {
    flexDirection: 'row',
    gap: 6,
  },
  camCtrlBtn: {
    backgroundColor: 'rgba(28,28,30,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  camCtrlBtnActive: {
    backgroundColor: '#FFD60A',
  },
  camCtrlText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  reticleBox: {
    alignSelf: 'center',
    width: 220,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#30D158',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  laserLine: {
    width: '88%',
    height: 2,
    backgroundColor: '#FF2D55',
    shadowColor: '#FF2D55',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  guideText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  searchBarRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  searchBtn: {
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  quickTestSection: {
    marginTop: 10,
  },
  quickTestHeader: {
    color: '#AEAEB2',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  quickChipsContainer: {
    paddingVertical: 2,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    marginRight: 8,
  },
  quickChipEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  quickChipName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 120,
  },
  quickPromoTag: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    marginLeft: 5,
  },
  quickPromoTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  quickChipPrice: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  imageUploadSection: {
    marginTop: 10,
    marginBottom: 4,
  },
  imageUploadBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageUploadBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  feedbackBox: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(48, 209, 88, 0.16)',
    borderWidth: 1,
    borderColor: '#30D158',
  },
  feedbackError: {
    backgroundColor: 'rgba(255, 69, 58, 0.16)',
    borderWidth: 1,
    borderColor: '#FF453A',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: '#30D158',
  },
  feedbackTextError: {
    color: '#FF453A',
  },
  autoDetectedBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30D158',
  },
  autoDetectedBadgeText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '800',
  },
});
