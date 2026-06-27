import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage } from '../lib/firestoreStorage';
import type { Plan, Subscription, Payment } from '../lib/types';

type LocalPlan = Plan;
type LocalSub = Omit<Subscription, 'startAt' | 'endAt'> & { startAt: number; endAt?: number };
type LocalPay = Omit<Payment, 'createdAt' | 'approvedAt'> & { createdAt: number; approvedAt?: number };

// 토스페이먼츠 가상계좌 단건 상태
export interface InvoicePart {
  invoiceId: string;          // 토스 paymentKey (mock 시 toss_mock_xxx)
  orderId?: string;           // 토스 orderId (가맹점별 분리)
  vendor: 'main' | 'sub';     // 메인(독서실, 면세) / 서브(교습소, 과세)
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  // 가상계좌 정보 (학생이 입금할 계좌)
  bank?: string;              // 은행 이름 (예: '우리')
  bankCode?: string;          // 두 자리 코드
  accountNumber?: string;
  customerName?: string;
  dueDate?: string;           // 입금 기한 ISO
  url?: string;               // 영수증/결제 정보 URL
  paidAt?: number;
}

// 청구서 발송 후 결제 대기 중인 주문. 모든 invoice.status === 'paid' 가 되면 이용권/결제 활성화.
export interface PendingOrder {
  id: string;
  studentId: string;
  studentName?: string;
  createdAt: number;
  items: {
    planId: string;
    name: string;
    amount: number;
    startAt: number;
    durationDays?: number;
    hours?: number;
    counts?: number;
    kind: 'plan' | 'etc' | 'discount';
  }[];
  totalAmount: number;
  invoices: InvoicePart[];      // 보통 메인+서브 2건
  status: 'pending' | 'paid' | 'cancelled';
  appliedSubIds?: string[];     // 완료 후 생성된 sub ID 들 (멱등성용)
  appliedPayId?: string;
  notes?: string;
}

interface State {
  plans: LocalPlan[];
  subs: LocalSub[];
  pays: LocalPay[];
  pendingOrders: PendingOrder[];
  upsertPlan: (p: LocalPlan) => void;
  removePlan: (id: string) => void;
  movePlan: (id: string, delta: number) => void;
  reorderPlan: (id: string, targetId: string, position: 'before' | 'after') => void;
  addPayment: (p: Omit<LocalPay, 'id' | 'createdAt'>) => string;
  setPaymentApproved: (id: string, fields: Partial<LocalPay>) => void;
  addSubscription: (s: Omit<LocalSub, 'id'>) => string;
  updateSubscription: (id: string, patch: Partial<LocalSub>) => void;
  removeSubscription: (id: string) => void;
  addPendingOrder: (o: Omit<PendingOrder, 'id' | 'createdAt' | 'status'>) => string;
  updateInvoiceStatus: (orderId: string, invoiceId: string, status: InvoicePart['status']) => void;
  markPendingOrderApplied: (orderId: string, subIds: string[], payId: string) => void;
  cancelPendingOrder: (orderId: string) => void;
  removePendingOrder: (orderId: string) => void;
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
      pendingOrders: [],
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
      reorderPlan: (id, targetId, position) => set((st) => {
        if (id === targetId) return st;
        const fromIdx = st.plans.findIndex((p) => p.id === id);
        const toIdx = st.plans.findIndex((p) => p.id === targetId);
        if (fromIdx < 0 || toIdx < 0) return st;
        // 같은 카테고리 안에서만 이동
        if (st.plans[fromIdx].category !== st.plans[toIdx].category) return st;
        const moved = st.plans[fromIdx];
        const arr = [...st.plans];
        arr.splice(fromIdx, 1);
        // splice 후 인덱스 보정
        let insertAt = arr.findIndex((p) => p.id === targetId);
        if (insertAt < 0) return st;
        if (position === 'after') insertAt += 1;
        arr.splice(insertAt, 0, moved);
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
      updateSubscription: (id, patch) => set((st) => ({
        subs: st.subs.map((s) => {
          if (s.id !== id) return s;
          const merged = { ...s, ...patch };
          // planSnapshot은 얕은 머지 (필드 단위)
          if (patch.planSnapshot) {
            merged.planSnapshot = { ...s.planSnapshot, ...patch.planSnapshot };
          }
          return merged;
        }),
      })),
      removeSubscription: (id) => set((st) => ({ subs: st.subs.filter((s) => s.id !== id) })),

      addPendingOrder: (o) => {
        const id = `po_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const item: PendingOrder = { id, createdAt: Date.now(), status: 'pending', ...o };
        set((st) => ({ pendingOrders: [item, ...st.pendingOrders] }));
        return id;
      },
      updateInvoiceStatus: (orderId, invoiceId, status) => set((st) => ({
        pendingOrders: st.pendingOrders.map((po) => {
          if (po.id !== orderId) return po;
          const invoices = po.invoices.map((iv) =>
            iv.invoiceId === invoiceId
              ? { ...iv, status, paidAt: status === 'paid' ? Date.now() : iv.paidAt }
              : iv,
          );
          const allPaid = invoices.every((iv) => iv.status === 'paid');
          return { ...po, invoices, status: allPaid ? 'paid' : po.status };
        }),
      })),
      markPendingOrderApplied: (orderId, subIds, payId) => set((st) => ({
        pendingOrders: st.pendingOrders.map((po) =>
          po.id === orderId ? { ...po, appliedSubIds: subIds, appliedPayId: payId } : po,
        ),
      })),
      cancelPendingOrder: (orderId) => set((st) => ({
        pendingOrders: st.pendingOrders.map((po) =>
          po.id === orderId ? { ...po, status: 'cancelled' } : po,
        ),
      })),
      removePendingOrder: (orderId) => set((st) => ({
        pendingOrders: st.pendingOrders.filter((po) => po.id !== orderId),
      })),
    }),
    { name: 'pp.plans.v1', storage: createJSONStorage(() => firestoreStorage) },
  ),
);
