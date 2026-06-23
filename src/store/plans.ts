import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Plan, Subscription, Payment } from '../lib/types';

type LocalPlan = Plan;
type LocalSub = Omit<Subscription, 'startAt' | 'endAt'> & { startAt: number; endAt?: number };
type LocalPay = Omit<Payment, 'createdAt' | 'approvedAt'> & { createdAt: number; approvedAt?: number };

interface State {
  plans: LocalPlan[];
  subs: LocalSub[];
  pays: LocalPay[];
  upsertPlan: (p: LocalPlan) => void;
  removePlan: (id: string) => void;
  addPayment: (p: Omit<LocalPay, 'id' | 'createdAt'>) => string;
  setPaymentApproved: (id: string, fields: Partial<LocalPay>) => void;
  addSubscription: (s: Omit<LocalSub, 'id'>) => string;
}

const DEFAULT_PLANS: LocalPlan[] = [
  { id: 'p_1m', name: '고정석 1개월', category: 'seat', seatType: 'fixed', type: 'period', durationDays: 30, price: 220000, active: true },
  { id: 'p_2w', name: '고정석 2주', category: 'seat', seatType: 'fixed', type: 'period', durationDays: 14, price: 130000, active: true },
  { id: 'p_h40', name: '자유석 40시간권', category: 'seat', seatType: 'free', type: 'hours', hours: 40, price: 100000, active: true },
  { id: 'p_c10', name: '자유석 10회권', category: 'seat', seatType: 'free', type: 'count', counts: 10, price: 70000, active: true },
];

export const usePlans = create<State>()(
  persist(
    (set) => ({
      plans: DEFAULT_PLANS,
      subs: [],
      pays: [],
      upsertPlan: (p) => set((st) => {
        const exists = st.plans.some((x) => x.id === p.id);
        return { plans: exists ? st.plans.map((x) => (x.id === p.id ? p : x)) : [...st.plans, p] };
      }),
      removePlan: (id) => set((st) => ({ plans: st.plans.filter((p) => p.id !== id) })),
      addPayment: (p) => {
        const id = `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const item: LocalPay = { id, createdAt: Date.now(), ...p };
        set((st) => ({ pays: [item, ...st.pays] }));
        return id;
      },
      setPaymentApproved: (id, fields) =>
        set((st) => ({ pays: st.pays.map((x) => (x.id === id ? { ...x, ...fields } : x)) })),
      addSubscription: (s) => {
        const id = `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const item: LocalSub = { id, ...s };
        set((st) => ({ subs: [item, ...st.subs] }));
        return id;
      },
    }),
    { name: 'pp.plans.v1' },
  ),
);
