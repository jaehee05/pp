import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage, subscribeExternalUpdates } from '../lib/firestoreStorage';
import type { Plan, Subscription, Payment } from '../lib/types';

const STORE_NAME = 'pp.plans.v1';

type LocalPlan = Plan;
type LocalSub = Omit<Subscription, 'startAt' | 'endAt'> & { startAt: number; endAt?: number };
type LocalPay = Omit<Payment, 'createdAt' | 'approvedAt'> & { createdAt: number; approvedAt?: number };

// 토스페이먼츠 가상계좌 단건 상태
export interface InvoicePart {
  invoiceId: string;          // 토스 paymentKey (mock 시 toss_mock_xxx)
  orderId?: string;           // 토스 orderId (가맹점별 분리)
  vendor: 'main' | 'sub';     // 메인(독서실, 면세) / 서브(교습소, 과세). 비대면/성남사랑/카드는 의미 없음 — 'main' 기본값.
  // 'invoice'(기본) = 지역상품권 QR, 'remote' = 비대면, 'localpay' = 성남사랑, 'card' = 토스플레이스 카드 단말기.
  // 'card' 는 단말기 결제 → 토스플레이스 웹훅 (payment.payment.approved.v1) 으로 자동 paid 처리.
  // 'remote'/'localpay' 는 추후 외부 API 연동 예정 — 지금은 운영자가 수동 paid 처리.
  method?: 'invoice' | 'remote' | 'localpay' | 'card';
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
    durationMonths?: number;
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
  { id: 'p_1m_basic', name: '1개월 기본', category: 'seat', seatType: 'fixed', type: 'period', durationMonths: 1, kind: '일반',
    taxFreeAmount: 169670, taxableAmount: 320330, price: 490000, active: true, discountPolicy: '분두 비원생 정상가 (0%)' },
];

// 레거시 durationDays(30/60/90/180/365) 는 캘린더 개월 이용권으로 간주해 durationMonths 변환.
// 이름에 "일" 명시된 경우(예: "30일권") 만 스킵 — 그건 진짜 N일권 의도.
function migrateMonthDuration(list: LocalPlan[]): LocalPlan[] {
  const dayToMonth: Record<number, number> = { 30: 1, 60: 2, 90: 3, 180: 6, 365: 12 };
  return list.map((p) => {
    if (p.type !== 'period') return p;
    if (p.durationMonths != null) return p;
    if (p.durationDays == null) return p;
    const monthsMaybe = dayToMonth[p.durationDays];
    if (!monthsMaybe) return p;
    // "N일권/N일 단기/N일 특가" 등 명시적으로 N일 의도인 경우만 그대로 둠.
    if (/\d+일/.test(p.name)) return p;
    const next: LocalPlan = { ...p, durationMonths: monthsMaybe };
    delete (next as { durationDays?: number }).durationDays;
    return next;
  });
}

// 1개월 이용권인데 endAt 이 "시작 월의 마지막 날 - 1" 로 들어가 있는 기존 sub 보정.
// 예: 7/1 시작 + (구) durationDays=30 → 7/30 만료. 캘린더 1개월 기준으로는 7/31 이어야 함.
// 조건 (보수적):
//   - status === 'active'
//   - startAt KST = (어떤 달의) 1일 00:00
//   - endAt KST = (같은 달의) 마지막 날 - 1 일
//   - planSnapshot 이 1개월 플랜 패턴 (durationMonths===1 또는 durationDays===30 + 이름에 "개월/달")
// 위 조건 모두 만족 시 endAt 을 해당 월의 마지막 날 KST 00:00 으로 보정. 멱등.
const KST_OFFSET_MS_FIX = 9 * 60 * 60 * 1000;
function migrateMonthlySubEndAt(subs: LocalSub[]): LocalSub[] {
  return subs.map((s) => {
    if (s.status !== 'active') return s;
    if (!s.startAt || !s.endAt) return s;

    const startKst = new Date(s.startAt + KST_OFFSET_MS_FIX);
    if (startKst.getUTCDate() !== 1) return s;
    const y = startKst.getUTCFullYear();
    const m = startKst.getUTCMonth();

    // 같은 달 안에 있는 endAt 만 대상.
    const endKst = new Date(s.endAt + KST_OFFSET_MS_FIX);
    if (endKst.getUTCFullYear() !== y || endKst.getUTCMonth() !== m) return s;

    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const properEnd = Date.UTC(y, m, lastDay) - KST_OFFSET_MS_FIX;
    if (s.endAt === properEnd) return s;                          // 이미 맞음
    const oneDayBeforeLast = properEnd - 86400000;
    if (s.endAt !== oneDayBeforeLast) return s;                   // 끝-1일 패턴만

    const snap = s.planSnapshot ?? {} as LocalSub['planSnapshot'];
    // 1개월 이용권 판단: durationMonths=1 이 정석. durationDays=30 도 (이름에 "N일"
    // 명시된 경우 제외하고) 캘린더 1개월로 간주. 학원 도메인 상 30일 flat 이용권은 없음.
    const looksLikeMonthlyPlan =
      snap.durationMonths === 1 ||
      (snap.durationDays === 30 && !/\d+일/.test(snap.name ?? ''));
    if (!looksLikeMonthlyPlan) return s;

    return { ...s, endAt: properEnd };
  });
}

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
    {
      name: STORE_NAME,
      storage: createJSONStorage(() => firestoreStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        if (!p) return current;
        return {
          ...current,
          ...p,
          plans: Array.isArray(p.plans) ? migrateMonthDuration(p.plans) : current.plans,
          subs: Array.isArray(p.subs) ? migrateMonthlySubEndAt(p.subs) : current.subs,
        };
      },
    },
  ),
);

// 하이드레이션 완료 후 sub.endAt 마이그레이션이 무언가 바꿨을 수 있으므로 persist write 트리거.
// **안전 가드**: subs 가 이미 비어있으면 setState 하지 않음 — 빈 상태로 Firestore 덮어쓰는
// 사고 재발 방지.
const triggerMigrationWrite = () => {
  const s = usePlans.getState() as Partial<State>;
  if (!Array.isArray(s.subs) || s.subs.length === 0) return;
  usePlans.setState((prev) => ({ ...prev }));
};
// hydration 이 이미 끝났을 수 있으므로 두 경로 다 등록.
if (usePlans.persist.hasHydrated?.()) {
  setTimeout(triggerMigrationWrite, 0);
} else {
  usePlans.persist.onFinishHydration?.(() => setTimeout(triggerMigrationWrite, 0));
}

// 외부(토스플레이스 웹훅 등)에서 appState/pp.plans.v1 을 직접 갱신했을 때 자동 rehydrate.
subscribeExternalUpdates(STORE_NAME, () => usePlans.persist.rehydrate());
