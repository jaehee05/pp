import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage } from '../lib/firestoreStorage';

// 뿌리오 설정. Firestore(appState/pp.ppurioSettings) + localStorage 캐시.
// 주의: Edge Function(api/notify/send)은 여전히 Vercel 환경변수에서 값을 읽음.
// 이 store는 관리 UI 표시·관리용. 값 변경 시 Vercel env도 같이 갱신해야 실제 발송에 반영.

export interface PpurioSettings {
  ppurioAccount: string;
  apiKey: string;
  senderProfile: string;   // 알림톡 발신프로필 (예: @kjhedu)
  smsSender: string;       // SMS/LMS 발신번호 (예: 01041518306)
  proxyUrl: string;        // VM 프록시 URL
  proxySecret: string;
  enabled: boolean;

  // 채널: 'sms' | 'kakao' (입퇴실/미입실 자동 알림 발송 채널)
  channel: 'sms' | 'kakao';
  // PPURIO에 사전 등록한 알림톡 템플릿 코드 (channel=kakao 일 때 사용)
  templateEnter: string;
  templateExit: string;
  templateNoShow: string;
  // 공통 공지 ([*2*] 변수에 치환)
  notice: string;
}

interface State extends PpurioSettings {
  set: (patch: Partial<PpurioSettings>) => void;
}

export const usePpurio = create<State>()(
  persist(
    (set) => ({
      ppurioAccount: '',
      apiKey: '',
      senderProfile: '',
      smsSender: '',
      proxyUrl: '',
      proxySecret: '',
      enabled: true,
      channel: 'sms',
      templateEnter: '',
      templateExit: '',
      templateNoShow: '',
      notice: '',
      set: (patch) => set(patch),
    }),
    {
      name: 'pp.ppurioSettings.v1',
      storage: createJSONStorage(() => firestoreStorage),
    },
  ),
);
