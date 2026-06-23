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
  movePlan: (id: string, delta: number) => void;
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
      movePlan: (id, delta) => set((st) => {
        const i = st.plans.findIndex((p) => p.id === id);
        if (i < 0 || delta === 0) return st;
        const plan = st.plans[i];
        const dir = delta > 0 ? 1 : -1;
        let remaining = Math.abs(delta);
        let j = i;
        // 같은 category 내에서만 이동
        while (remaining > 0) {
          let k = j + dir;
          while (k >= 0 && k < st.plans.length && st.plans[k].category !== plan.category) k += dir;
          if (k < 0 || k >= st.plans.length) break;
          j = k;
          remaining--;
        }
        if (j === i) return st;
        const arr = [...st.plans];
        arr.splice(i, 1);
        arr.splice(j, 0, plan);
        return { plans: arr };
      }),
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
