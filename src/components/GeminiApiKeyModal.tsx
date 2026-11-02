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
import { fetchServerConfig } from '../services/geminiService';

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
  const [serverHasKey, setServerHasKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      AsyncStorage.getItem(GEMINI_KEY_STORAGE).then((k) => {
        if (k) {
          setApiKey(k);
        }
      });
      fetchServerConfig().then((cfg) => {
        setServerHasKey(cfg.hasGeminiKey);
        if (!apiKey && cfg.geminiKey) {
          setApiKey(cfg.geminiKey);
        }
      });
      setIsSaved(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const cleanKey = apiKey.trim();
    if (cleanKey) {
      await AsyncStorage.setItem(GEMINI_KEY_STORAGE, cleanKey);
      onKeySaved(cleanKey);
    } else {
      await AsyncStorage.removeItem(GEMINI_KEY_STORAGE);
      onKeySaved('');
    }
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

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {serverHasKey || apiKey
                ? '✅ Gemini AI 엔진 활성화됨 (미등록 바코드·사진 자동 분석)'
                : '💡 Gemini API 키를 등록하면 AI 자동 분석이 활성화됩니다'}
            </Text>
          </View>

          <Text style={styles.desc}>
            Google Gemini AI가 연결되어 미등록 신상품 바코드 스캔 시{' '}
            <Text style={{ color: '#30D158', fontWeight: 'bold' }}>
              제조사·상품명·GS25/CU 편의점 판매가격
            </Text>
            을 자동으로 완성해 드립니다!
          </Text>

          <TouchableOpacity style={styles.linkBanner} onPress={handleOpenAiStudio}>
            <Text style={styles.linkBannerTitle}>
              👉 본인 전용 Google AI 키 발급받기 (무료)
            </Text>
            <Text style={styles.linkBannerDesc}>
              (구글 AI Studio에서 무료 발급 · 카드 불필요)
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Gemini API 키</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="AI 키를 입력하거나 서버 기본 키를 사용합니다"
            placeholderTextColor="#636366"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.saveBtn, isSaved && { backgroundColor: '#30D158' }]}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>
              {isSaved ? '✅ 저장 완료!' : 'AI 키 저장하고 적용'}
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
              <Text style={styles.deleteBtnText}>사용자 입력 키 초기화</Text>
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeBtnText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  statusBadge: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30D158',
  },
  statusBadgeText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  desc: {
    color: '#C7C7CC',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  linkBanner: {
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    marginBottom: 14,
  },
  linkBannerTitle: {
    color: '#0A84FF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  linkBannerDesc: {
    color: '#8E8E93',
    fontSize: 11,
  },
  label: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#141416',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#323236',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#FF453A',
    fontSize: 12,
    fontWeight: '600',
  },
});
