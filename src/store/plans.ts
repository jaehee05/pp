import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage } from '../lib/firestoreStorage';
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
  { id: 'p_1d', name: '1일권', category: 'seat', seatType: 'fixed', type: 'period', durationDays: 1, kind: '일반',
    taxFreeAmount: 16400, taxableAmount: 0, price: 16400, active: true },
  { id: 'p_1m_basic', name: '1개월 기본', category: 'seat', seatType: 'fixed', type: 'period', durationDays: 30, kind: '일반',
    taxFreeAmount: 169670, taxableAmount: 320330, price: 490000, active: true, discountPolicy: '분두 비원생 정상가 (0%)' },
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
    { name: 'pp.plans.v1', storage: createJSONStorage(() => firestoreStorage) },
  ),
);
