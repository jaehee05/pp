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
      set: (patch) => set(patch),
    }),
    {
      name: 'pp.ppurioSettings.v1',
      storage: createJSONStorage(() => firestoreStorage),
    },
  ),
);
