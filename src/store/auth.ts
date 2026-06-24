import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage } from '../lib/firestoreStorage';

// 관리자 로그인 store.
// 주의: 이 앱은 백엔드가 없는 클라이언트 사이드(localStorage) 데모입니다.
// 비밀번호는 평문 대신 SHA-256 해시로 저장하지만, 클라이언트 저장 특성상
// 강한 보안 보장은 아닙니다. 실서비스 전환 시 서버/Firebase Auth로 교체하세요.

export interface Account {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  temp?: boolean;       // 초기 임시 계정 여부
  createdAt: number;

  // 키오스크 출입용 (관리자도 출퇴근 기록 가능)
  kioskPin?: string;            // 4자리 PIN
  fingerprintId?: string;       // BioStar 사용자 ID
  enableKioskAccess?: boolean;  // 키오스크 출입 허용 (기본 true)
}

// 초기 임시 계정: admin / admin1234!
const TEMP_USERNAME = 'admin';
// SHA-256('admin1234!')
const TEMP_HASH = 'b0d107a1cb94cd60c513a8636f99b8d700154887e2a96f0310a1b5f3e60a6ddd';

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function tempAccount(): Account {
  return {
    id: 'temp-admin',
    username: TEMP_USERNAME,
    passwordHash: TEMP_HASH,
    name: '임시 관리자',
    temp: true,
    createdAt: Date.now(),
  };
}

interface Result {
  ok: boolean;
  error?: string;
}

interface State {
  accounts: Account[];
  currentId: string | null;

  login: (username: string, password: string) => Promise<Result>;
  logout: () => void;
  createAdmin: (p: { username: string; password: string; name: string }) => Promise<Result>;
  changePassword: (id: string, newPassword: string) => Promise<Result>;
  removeAccount: (id: string) => Result;
  updateAccount: (id: string, patch: Partial<Account>) => void;

  current: () => Account | null;
  hasOnlyTemp: () => boolean;
}

export const useAuth = create<State>()(
  persist(
    (set, get) => ({
      accounts: [tempAccount()],
      currentId: null,

      async login(username, password) {
        const acc = get().accounts.find((a) => a.username === username.trim());
        if (!acc) return { ok: false, error: '존재하지 않는 아이디입니다.' };
        const hash = await sha256(password);
        if (hash !== acc.passwordHash) return { ok: false, error: '비밀번호가 일치하지 않습니다.' };
        set({ currentId: acc.id });
        return { ok: true };
      },

      logout() {
        set({ currentId: null });
      },

      async createAdmin({ username, password, name }) {
        const uname = username.trim();
        if (!uname) return { ok: false, error: '아이디를 입력하세요.' };
        if (password.length < 6) return { ok: false, error: '비밀번호는 6자 이상이어야 합니다.' };
        if (get().accounts.some((a) => a.username === uname && !a.temp)) {
          return { ok: false, error: '이미 존재하는 아이디입니다.' };
        }
        const passwordHash = await sha256(password);
        const acc: Account = {
          id: `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          username: uname,
          passwordHash,
          name: name.trim() || uname,
          createdAt: Date.now(),
        };
        // 실제 관리자 계정 생성 시 임시 계정 제거.
        const wasTemp = get().accounts.some((a) => a.temp && a.id === get().currentId);
        const remaining = get().accounts.filter((a) => !a.temp);
        set({
          accounts: [...remaining, acc],
          // 임시 계정으로 로그인 중이었다면 새 계정으로 세션 이어줌.
          currentId: wasTemp ? acc.id : get().currentId,
        });
        return { ok: true };
      },

      async changePassword(id, newPassword) {
        if (newPassword.length < 6) return { ok: false, error: '비밀번호는 6자 이상이어야 합니다.' };
        const passwordHash = await sha256(newPassword);
        set({
          accounts: get().accounts.map((a) => (a.id === id ? { ...a, passwordHash } : a)),
        });
        return { ok: true };
      },

      updateAccount(id, patch) {
        set({
          accounts: get().accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        });
      },

      removeAccount(id) {
        const accounts = get().accounts.filter((a) => a.id !== id);
        if (accounts.filter((a) => !a.temp).length === 0 && !accounts.some((a) => a.temp)) {
          return { ok: false, error: '마지막 계정은 삭제할 수 없습니다.' };
        }
        set({
          accounts,
          currentId: get().currentId === id ? null : get().currentId,
        });
        return { ok: true };
      },

      current() {
        const id = get().currentId;
        return get().accounts.find((a) => a.id === id) ?? null;
      },

      hasOnlyTemp() {
        const real = get().accounts.filter((a) => !a.temp);
        return real.length === 0;
      },
    }),
    { name: 'pp.auth.v1', storage: createJSONStorage(() => firestoreStorage) },
  ),
);
