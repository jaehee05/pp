import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocalPoint {
  id: string;
  studentId: string;
  delta: number;
  reason: string;
  category?: string;
  createdAt: number;
}

interface State {
  entries: LocalPoint[];
  add: (e: Omit<LocalPoint, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
}

export const usePoints = create<State>()(
  persist(
    (set) => ({
      entries: [],
      add: (e) => set((st) => ({
        entries: [{ id: `pt_${Date.now().toString(36)}`, createdAt: Date.now(), ...e }, ...st.entries],
      })),
      remove: (id) => set((st) => ({ entries: st.entries.filter((x) => x.id !== id) })),
    }),
    { name: 'pp.points.v1' },
  ),
);

export type { LocalPoint };
