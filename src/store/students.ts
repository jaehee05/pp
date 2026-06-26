import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage } from '../lib/firestoreStorage';
import type { Student, WeekdayKey } from '../lib/types';

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
  discountTier?: DiscountTier;  // 할인 대상 (이용권 노출 필터링용)
}

export type DiscountTier = '없음' | '1과목' | '2과목이상';
export const DISCOUNT_TIERS: DiscountTier[] = ['없음', '1과목', '2과목이상'];

interface State {
  list: LocalStudent[];
  add: (s: Omit<LocalStudent, 'id' | 'joinedAt' | 'pointsTotal'>) => string;
  update: (id: string, patch: Partial<LocalStudent>) => void;
  remove: (id: string) => void;
  get: (id: string) => LocalStudent | undefined;
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
    { name: 'pp.students.v1', storage: createJSONStorage(() => firestoreStorage) },
  ),
);

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
    discountTier: '없음',
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
