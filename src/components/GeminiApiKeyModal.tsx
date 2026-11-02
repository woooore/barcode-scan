import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GEMINI_KEY_STORAGE = '@convenience_gemini_api_key_v1';

interface GeminiApiKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({
  visible,
  onClose,
  onKeySaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      AsyncStorage.getItem(GEMINI_KEY_STORAGE).then((k) => {
        if (k) setApiKey(k);
      });
      setIsSaved(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const cleanKey = apiKey.trim();
    await AsyncStorage.setItem(GEMINI_KEY_STORAGE, cleanKey);
    onKeySaved(cleanKey);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleOpenAiStudio = () => {
    const url = 'https://aistudio.google.com/apikey';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>🤖 Gemini AI 연동 설정</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>
            Google Gemini AI를 연결하면, 미등록 신상품 바코드 스캔 시{' '}
            <Text style={{ color: '#30D158', fontWeight: 'bold' }}>
              상품명·제조사·GS25/CU 판매 가격
            </Text>
            을 AI가 스스로 추론하여 자동으로 완성해 줍니다!
          </Text>

          <TouchableOpacity style={styles.linkBanner} onPress={handleOpenAiStudio}>
            <Text style={styles.linkBannerTitle}>
              👉 Google AI Studio에서 무료 API 키 발급받기
            </Text>
            <Text style={styles.linkBannerDesc}>
              (구글 계정만 있으면 10초 만에 무료 발급 · 카드 등록 불필요)
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Gemini API 키 (AIzaSy...)</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="AIzaSy... 로 시작하는 키를 붙여넣으세요"
            placeholderTextColor="#636366"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.saveBtn, isSaved && { backgroundColor: '#30D158' }]}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>
              {isSaved ? '✅ 저장 완료!' : 'AI 키 저장하고 즉시 활성화'}
            </Text>
          </TouchableOpacity>

          {apiKey ? (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={async () => {
                await AsyncStorage.removeItem(GEMINI_KEY_STORAGE);
                setApiKey('');
                onKeySaved('');
              }}
            >
              <Text style={styles.deleteBtnText}>API 키 삭제</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#AEAEB2',
    fontSize: 12,
    fontWeight: '600',
  },
  desc: {
    color: '#AEAEB2',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  linkBanner: {
    backgroundColor: 'rgba(10, 132, 255, 0.14)',
    borderWidth: 1,
    borderColor: '#0A84FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  linkBannerTitle: {
    color: '#0A84FF',
    fontSize: 13,
    fontWeight: '800',
  },
  linkBannerDesc: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  label: {
    color: '#E5E5EA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#242426',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#323236',
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: '#0A84FF',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#FF453A',
    fontSize: 12,
  },
});
