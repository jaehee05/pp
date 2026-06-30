import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage, subscribeExternalUpdates } from '../lib/firestoreStorage';
import type { Student, WeekdayKey } from '../lib/types';

const STORE_NAME = 'pp.students.v1';

type LocalStudent = Omit<Student, 'joinedAt' | 'pointsTotal'> & {
  joinedAt: number;
  pointsTotal: number;
  pin?: string;                 // 키오스크/지문 보조용 PIN (4자리)
  birthYmd?: string;            // YYYY-MM-DD
  memberKind?: 'student' | 'adult';  // 구분
  memberState?: 'normal' | 'restricted' | 'risk' | 'left'; // 정상/제한/불량/탈퇴
  msgReceive?: boolean;         // 본인 메시지 수신 (true=수신, false=거부)
  parentMsgReceive?: boolean;   // 학부모 메시지 수신
  lockerId?: string;
  shoeId?: string;
}

interface State {
  list: LocalStudent[];
  add: (s: Omit<LocalStudent, 'id' | 'joinedAt' | 'pointsTotal'>) => string;
  update: (id: string, patch: Partial<LocalStudent>) => void;
  remove: (id: string) => void;
  get: (id: string) => LocalStudent | undefined;
}

// 레거시 discountTier 필드 → 메모로 이전. 1회 실행 (hydration merge 단계).
// "없음" 은 그냥 폐기. 그 외 값은 "할인 대상: X" 형태로 memo 에 prepend (중복 방지).
function migrateDiscountTier(list: LocalStudent[]): LocalStudent[] {
  return list.map((s) => {
    const legacy = (s as unknown as { discountTier?: string }).discountTier;
    if (!legacy) return s;
    const stripped = { ...(s as Record<string, unknown>) };
    delete stripped.discountTier;
    if (legacy === '없음') return stripped as LocalStudent;
    const tag = `할인 대상: ${legacy}`;
    const memo = (s.memo ?? '').trim();
    if (memo.includes(tag)) return stripped as LocalStudent;
    const newMemo = memo ? `${tag}\n${memo}` : tag;
    return { ...(stripped as LocalStudent), memo: newMemo };
  });
}

export const useStudents = create<State>()(
  persist(
    (set, get) => ({
      list: [],
      add: (s) => {
        const id = `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const next: LocalStudent = {
          id,
          joinedAt: Date.now(),
          pointsTotal: 0,
          ...s,
        };
        set((st) => ({ list: [next, ...st.list] }));
        return id;
      },
      update: (id, patch) =>
        set((st) => ({ list: st.list.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      remove: (id) => set((st) => ({ list: st.list.filter((x) => x.id !== id) })),
      get: (id) => get().list.find((x) => x.id === id),
    }),
    {
      name: STORE_NAME,
      storage: createJSONStorage(() => firestoreStorage),
      merge: (persisted, current) => {
        const p = persisted as State | undefined;
        if (!p || !Array.isArray(p.list)) return current;
        return { ...current, list: migrateDiscountTier(p.list) };
      },
    },
  ),
);

// 외부(페이스패스 등록 콜백 등)에서 appState/pp.students.v1 직접 갱신 시 자동 rehydrate.
subscribeExternalUpdates(STORE_NAME, () => useStudents.persist.rehydrate());

export function emptyStudent(): Omit<LocalStudent, 'id' | 'joinedAt' | 'pointsTotal'> {
  return {
    name: '',
    gender: undefined,
    phone: '',
    parentPhone: '',
    school: '',
    grade: '',
    memo: '',
    pin: '',
    birthYmd: '',
    memberKind: 'student',
    memberState: 'normal',
    msgReceive: true,
    parentMsgReceive: true,
    notify: {
      studentEnterExit: true,
      parentEnterExit: true,
      parentLateMiss: true,
    },
    schedule: {} as Partial<Record<WeekdayKey, { start: string; end: string } | null>>,
    status: 'active',
  };
}

export type { LocalStudent };
