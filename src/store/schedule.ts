import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WeekdayKey } from '../lib/types';

interface LocalPlanItem {
  id: string;
  studentId: string;
  weekStart: string;  // YYYY-MM-DD
  weekday: WeekdayKey;
  startTime: string;
  endTime: string;
  subject: string;
  detail?: string;
  done?: boolean;
}

interface State {
  items: LocalPlanItem[];
  add: (it: Omit<LocalPlanItem, 'id'>) => void;
  update: (id: string, patch: Partial<LocalPlanItem>) => void;
  remove: (id: string) => void;
}

export const useSchedule = create<State>()(
  persist(
    (set) => ({
      items: [],
      add: (it) => set((st) => ({ items: [{ id: `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, ...it }, ...st.items] })),
      update: (id, patch) => set((st) => ({ items: st.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      remove: (id) => set((st) => ({ items: st.items.filter((x) => x.id !== id) })),
    }),
    { name: 'pp.schedule.v1' },
  ),
);

export function mondayOf(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export type { LocalPlanItem };
