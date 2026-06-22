import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Student, WeekdayKey } from '../lib/types';

// 임시 로컬 스토어. 추후 Firestore로 교체.
type LocalStudent = Omit<Student, 'joinedAt' | 'pointsTotal'> & {
  joinedAt: number;       // epoch ms
  pointsTotal: number;
};

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
    { name: 'pp.students.v1' },
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
