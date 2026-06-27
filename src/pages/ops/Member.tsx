import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { useStudents } from '../../store/students';
import { useAttendance } from '../../store/attendance';
import { usePlans } from '../../store/plans';
import { deviceAgent } from '../../lib/deviceAgent';
import { chargeCard } from '../../lib/payment';
import { fmtDateTime, fmtMoney, toLocalISODate, fromLocalISODate } from '../../lib/format';
import { currentSubOf, lastActiveEndOf, nextDayStart } from '../../lib/sub';

type LogTab = 'member' | 'use' | 'pay';

interface OrderItem {
  id: string;
  planId: string;
  name: string;
  amount: number;            // 음수 = 할인/기타조정
  startAt: number;
  durationDays?: number;
  hours?: number;
  counts?: number;
  kind: 'plan' | 'etc' | 'discount';
}
type PayMethod = 'card' | 'cash' | 'remote' | 'localpay' | 'invoice';
interface PaymentSplit { method: PayMethod; amount: number; approvalNo?: string; txId?: string }
const METHOD_LABEL: Record<PayMethod, string> = {
  card: '카드',
  cash: '현금',
  remote: '비대면',
  localpay: '성남사랑',
  invoice: '지역상품권 QR',
};

export function OpsMember() {
  const { id = '' } = useParams();
  const student = useStudents((s) => s.get(id));
  const update = useStudents((s) => s.update);
  const att = useAttendance();
  const { subs, pays, plans, addPayment, setPaymentApproved, addSubscription, updateSubscription, removeSubscription,
    pendingOrders, addPendingOrder, updateInvoiceStatus, markPendingOrderApplied, cancelPendingOrder, removePendingOrder } = usePlans();
  const [editSubId, setEditSubId] = useState<string | null>(null);

  // 회원 정보 편집 모드 — false 면 read-only, true 면 draft에 임시 보관 후 [수정 완료]로 일괄 저장
  type SDraft = Partial<NonNullable<typeof student>>;
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<SDraft>({});
  function startEdit() {
    if (!student) return;
    setDraft({ ...student });
    setEditMode(true);
  }
  function cancelEdit() { setDraft({}); setEditMode(false); }
  function saveEdit() {
    if (!student) return;
    update(student.id, draft);
    setDraft({}); setEditMode(false);
  }
  const v: SDraft = editMode ? draft : (student ?? {});
  const setDraftField = <K extends keyof SDraft>(k: K, val: SDraft[K]) =>
    setDraft((prev) => ({ ...prev, [k]: val }));
  const [memo, setMemo] = useState(student?.memo ?? '');
  const [tab, setTab] = useState<LogTab>('member');
  const [enrolling, setEnrolling] = useState(false);

  // 이용권 선택
  const [planSeatType, setPlanSeatType] = useState<'' | 'fixed' | 'free'>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [planQty, setPlanQty] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(() => toLocalISODate(Date.now()));
  // 사용자가 직접 startDate 를 손댔는지 추적. 손댄 적 있으면 자동 동기화 안 함.
  const [startDateTouched, setStartDateTouched] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // 주문
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [payments, setPayments] = useState<PaymentSplit[]>([{ method: 'card', amount: 0 }]);
  const [processing, setProcessing] = useState(false);
  const [payStatus, setPayStatus] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // 기타결제 / 할인 모달
  const [etcModal, setEtcModal] = useState<'etc' | 'discount' | null>(null);

  useEffect(() => {
    const off = deviceAgent.on((e) => {
      if (e.type === 'fingerprint_enroll_done' && student) {
        update(student.id, { fingerprintId: e.fingerprintId });
        setEnrolling(false);
        alert('지문 등록 완료');
      }
    });
    return () => { off(); };
  }, [student, update]);

  if (!student) {
    return (
      <>
        <PageHeader title="회원을 찾을 수 없습니다" />
        <div className="p-6"><Link to="/admin/members" className="text-brand-600 hover:underline">← 회원 목록</Link></div>
      </>
    );
  }

  const sub = currentSubOf(subs, student.id);
  const upcomingSubs = subs
    .filter((x) => x.studentId === student.id && x.status === 'active' && x.startAt > Date.now())
    .sort((a, b) => a.startAt - b.startAt);
  const a = att.state[student.id];
  const inside = a?.state === 'in' || a?.state === 'temp_out';

  function toggleIn() {
    if (!student) return;
    if (inside) att.exit(student.id, 'manual');
    else att.enter(student.id, 'manual');
  }
  function saveMemo() { update(student!.id, { memo }); }
  function startEnroll() {
    if (!student) return;
    setEnrolling(true);
    deviceAgent.send({ id: `e_${student.id}`, cmd: 'enroll_fingerprint', studentId: student.id });
  }
  function deleteFp() { if (student && confirm('지문을 삭제할까요?')) update(student.id, { fingerprintId: '' }); }

  // 좌석타입 + 숨김 + 할인 등급 + 노출 월 필터 적용된 이용권 후보
  // 월 필터 기준일: 이 학생이 이 이용권을 산다면 "시작될" 날짜.
  //  - 활성/예정 이용권 있음 → 마지막 종료일 다음날
  //  - 없음 → 오늘
  const projectedStartTs = useMemo(() => {
    if (!student) return Date.now();
    const lastEnd = lastActiveEndOf(subs, student.id);
    return lastEnd ? nextDayStart(lastEnd) : Date.now();
  }, [subs, student?.id]);

  // 시작일 자동 세팅: 사용자가 직접 안 건드렸으면 projectedStartTs 로 동기화.
  // 이전 이용권 있으면 만료일 다음날, 없으면 오늘.
  useEffect(() => {
    if (startDateTouched) return;
    const next = toLocalISODate(projectedStartTs);
    setStartDate((prev) => (prev === next ? prev : next));
  }, [projectedStartTs, startDateTouched]);
  const availablePlans = useMemo(() => plans.filter((p) => {
    if (p.category !== 'seat') return false;
    if (!p.active) return false;
    if (!showHidden && p.hidden) return false;
    if (planSeatType && p.seatType !== planSeatType) return false;
    return true;
  }), [plans, planSeatType, showHidden]);

  function addPlanToOrder() {
    if (!selectedPlanId) return alert('이용권을 선택하세요.');
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;
    const qty = Math.max(1, Math.min(99, Math.floor(planQty) || 1));
    const items: OrderItem[] = Array.from({ length: qty }, (_, i) => ({
      id: `o_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      planId: plan.id, kind: 'plan',
      name: qty > 1 ? `${plan.name} (${i + 1}/${qty})` : plan.name,
      amount: plan.price,
      startAt: fromLocalISODate(startDate),
      durationDays: plan.durationDays, hours: plan.hours, counts: plan.counts,
    }));
    setOrder((prev) => [...prev, ...items]);
    setSelectedPlanId('');
    setPlanQty(1);
    syncAmount();
  }
  function addEtc(name: string, amount: number) {
    setOrder((prev) => [...prev, {
      id: `o_${Date.now().toString(36)}`, kind: 'etc',
      planId: '', name, amount, startAt: Date.now(),
    }]);
    syncAmount();
  }
  function addDiscount(reason: string, amount: number) {
    setOrder((prev) => [...prev, {
      id: `o_${Date.now().toString(36)}`, kind: 'discount',
      planId: '', name: `할인: ${reason}`, amount: -Math.abs(amount), startAt: Date.now(),
    }]);
    syncAmount();
  }
  function removeOrderItem(itemId: string) {
    setOrder((prev) => prev.filter((x) => x.id !== itemId));
    syncAmount();
  }

  const orderTotal = order.reduce((s, i) => s + i.amount, 0);
  const paidTotal = payments.reduce((s, p) => s + p.amount, 0);

  // 주문 합계가 바뀌면 단일 결제수단인 경우 금액 자동 채움.
  // (사용자가 분할 결제 행을 추가했거나 금액을 직접 수정한 뒤에는 건들지 않음 — 잔액 표시로 확인)
  useEffect(() => {
    setPayments((prev) => {
      if (prev.length !== 1) return prev;
      // 사용자가 만진 흔적이 있어도 합계와 다르면 합계로 맞춰주기.
      if (prev[0].amount === orderTotal) return prev;
      return [{ ...prev[0], amount: Math.max(0, orderTotal) }];
    });
  }, [orderTotal]);

  function syncAmount() { /* useEffect 가 처리 — 노옵으로 남겨두기 (기존 호출부 호환) */ }
  function splitPayment() {
    setPayments((prev) => [...prev, { method: 'cash', amount: 0 }]);
  }
  function updateSplit(i: number, patch: Partial<PaymentSplit>) {
    setPayments((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function removeSplit(i: number) {
    setPayments((prev) => prev.filter((_, idx) => idx !== i));
  }

  // 주문의 메인/서브 사업자별 금액 합계 (이용권 기준)
  const vendorTotals = useMemo(() => {
    let main = 0, sub = 0;
    for (const item of order) {
      if (item.kind === 'plan') {
        const pl = plans.find((p) => p.id === item.planId);
        main += pl?.taxFreeAmount ?? 0;
        sub += pl?.taxableAmount ?? 0;
      } else {
        // 기타/할인은 메인으로 잡음
        main += item.amount;
      }
    }
    return { main, sub };
  }, [order, plans]);

  // === 지역상품권 QR 결제 (수동 확인) ===
  // 학생이 지역상품권 앱에서 메인/서브 가맹점 QR 을 각각 스캔해 결제하면,
  // 운영자가 결제 확인 후 수동으로 [✓ 결제 완료 처리] 클릭 → 양쪽 완료 시 자동 활성화.
  // 외부 API 호출 없음 (지역상품권은 가맹점 별 QR + 별도 정산 시스템).
  async function processInvoice() {
    if (!student) return;
    setProcessing(true);
    setPayStatus('지역상품권 QR 주문 등록 중…');
    try {
      const safeStudentId = student.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
      const orderId = `ord_${safeStudentId}_${Date.now().toString(36)}`;
      const lines: { vendor: 'main' | 'sub'; amount: number }[] = [];
      if (vendorTotals.main > 0) lines.push({ vendor: 'main', amount: vendorTotals.main });
      if (vendorTotals.sub > 0) lines.push({ vendor: 'sub', amount: vendorTotals.sub });
      addPendingOrder({
        studentId: student.id,
        studentName: student.name,
        items: order,
        totalAmount: orderTotal,
        invoices: lines.map((l, i) => ({
          invoiceId: `qr_${orderId}_${l.vendor}_${i}`,
          orderId,
          vendor: l.vendor,
          amount: l.amount,
          status: 'pending' as const,
        })),
      });
      setPayStatus(`📋 지역상품권 QR 주문 등록 완료 (메인 ${vendorTotals.main.toLocaleString()}원 / 서브 ${vendorTotals.sub.toLocaleString()}원). 학생이 메인/서브 가맹점 QR 결제 완료하면 수동으로 [✓ 결제 완료 처리] 눌러주세요.`);
      setOrder([]);
      setPayments([{ method: 'card', amount: 0 }]);
    } catch (e) {
      setPayStatus(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcessing(false);
      setTimeout(() => setPayStatus(''), 8000);
    }
  }

  // 청구서가 모두 결제되면 자동으로 이용권/결제 생성.
  // appliedSubIds 가 있으면 이미 처리됨 → 스킵 (멱등).
  const readyPending = useMemo(() => pendingOrders.filter((po) =>
    po.studentId === student?.id && po.status === 'paid' && !po.appliedSubIds,
  ), [pendingOrders, student?.id]);
  useEffect(() => {
    for (const po of readyPending) {
      applyPendingOrder(po);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyPending]);

  function applyPendingOrder(po: typeof pendingOrders[number]) {
    if (!student || po.studentId !== student.id) return;
    if (po.appliedSubIds) return;
    const payId = addPayment({
      studentId: student.id,
      planId: po.items.find((i) => i.kind === 'plan')?.planId ?? 'multi',
      amount: po.totalAmount,
      method: 'invoice',
      cardApprovalNo: po.invoices.map((iv) => iv.invoiceId).join('/'),
      terminalTxId: po.id,
      status: 'approved',
    });
    setPaymentApproved(payId, { approvedAt: Date.now() });
    const existingFutureEnds = subs
      .filter((s) => s.studentId === student.id && s.status === 'active' && s.endAt && s.endAt > Date.now())
      .map((s) => s.endAt as number);
    let runningLatestEnd: number | null = existingFutureEnds.length > 0 ? Math.max(...existingFutureEnds) : null;
    const subIds: string[] = [];
    for (const item of po.items) {
      if (item.kind !== 'plan') continue;
      const plan = plans.find((x) => x.id === item.planId);
      if (!plan) continue;
      const actualStartAt = runningLatestEnd ? nextDayStart(runningLatestEnd) : item.startAt;
      const endAt = item.durationDays ? actualStartAt + (item.durationDays - 1) * 86400000 : undefined;
      const subId = addSubscription({
        studentId: student.id, planId: plan.id,
        planSnapshot: {
          name: plan.name, type: plan.type,
          durationDays: plan.durationDays, hours: plan.hours, counts: plan.counts,
          price: plan.price,
        },
        startAt: actualStartAt, endAt,
        hoursRemaining: plan.hours,
        countsRemaining: plan.counts,
        paymentId: payId,
        status: 'active',
      });
      subIds.push(subId);
      if (endAt) runningLatestEnd = endAt;
    }
    markPendingOrderApplied(po.id, subIds, payId);
    setPayStatus(`✅ 양쪽 결제 완료 — 이용권 ${subIds.length}건 자동 활성화됨`);
    setTimeout(() => setPayStatus(''), 6000);
  }

  async function callCardPay(amount: number, merchant: 'main' | 'sub', tag: string): Promise<{ ok: boolean; approvalNo?: string; txId?: string; error?: string }> {
    if (!student) return { ok: false, error: 'no student' };
    setPayStatus(`${tag} 카드 결제 ${amount.toLocaleString()}원 — 단말기에 카드를 긁어주세요…`);
    const orderId = `ord_${student.id}_${merchant}_${Date.now().toString(36)}`;
    const res = await chargeCard({ amount, merchant, orderId, taxFree: true });
    return {
      ok: res.ok,
      approvalNo: res.approvalNo,
      txId: res.txId,
      error: res.error,
    };
  }

  async function processPayment() {
    if (!student) return;
    if (order.length === 0) return alert('주문에 이용권을 추가하세요.');
    if (paidTotal !== orderTotal) return alert(`결제금액(${paidTotal.toLocaleString()})과 합계(${orderTotal.toLocaleString()})가 일치하지 않습니다.`);

    // 지역상품권 QR 흐름: 다른 결제수단과 혼합 불가.
    if (payments.some((p) => p.method === 'invoice')) {
      if (payments.length > 1) return alert('지역상품권 QR 결제는 다른 결제수단과 혼합할 수 없습니다.');
      return processInvoice();
    }

    setProcessing(true);
    try {
      const splits: PaymentSplit[] = [];
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        if (p.amount === 0) { splits.push(p); continue; }
        if (p.method === 'card') {
          // 카드 결제는 메인/서브로 비례 분할해 2회 단말기 호출
          const ratio = orderTotal > 0 ? p.amount / orderTotal : 1;
          const mainPart = Math.round(vendorTotals.main * ratio);
          const subPart = p.amount - mainPart;
          let combinedApprovalNo = '';
          let combinedTxId = '';
          if (mainPart > 0) {
            const r1 = await callCardPay(mainPart, 'main', '[메인 독서실]');
            if (!r1.ok) { setPayStatus(`메인 결제 실패: ${r1.error ?? ''}`); return; }
            combinedApprovalNo += r1.approvalNo ?? '';
            combinedTxId += r1.txId ?? '';
          }
          if (subPart > 0) {
            const r2 = await callCardPay(subPart, 'sub', '[서브 교습소]');
            if (!r2.ok) { setPayStatus(`서브 결제 실패: ${r2.error ?? ''}`); return; }
            combinedApprovalNo += (combinedApprovalNo ? '/' : '') + (r2.approvalNo ?? '');
            combinedTxId += (combinedTxId ? '/' : '') + (r2.txId ?? '');
          }
          splits.push({ ...p, approvalNo: combinedApprovalNo, txId: combinedTxId });
        } else {
          splits.push(p);
        }
      }
      setPayStatus('승인 완료. 이용권/결제 저장 중…');

      const cardSplit = splits.find((s) => s.method === 'card');
      // 큐잉 시작점: 기존 active 이용권 중 가장 늦은 endAt. 루프 내에서 새로 추가하는 이용권의 endAt 으로 갱신.
      const existingFutureEnds = subs
        .filter((s) => s.studentId === student.id && s.status === 'active' && s.endAt && s.endAt > Date.now())
        .map((s) => s.endAt as number);
      let runningLatestEnd: number | null = existingFutureEnds.length > 0 ? Math.max(...existingFutureEnds) : null;
      for (const item of order) {
        if (item.kind !== 'plan') continue;
        const plan = plans.find((x) => x.id === item.planId);
        if (!plan) continue;
        const payId = addPayment({
          studentId: student.id, planId: plan.id, amount: item.amount,
          method: splits[0]?.method ?? 'card',
          cardApprovalNo: cardSplit?.approvalNo,
          terminalTxId: cardSplit?.txId,
          status: 'approved',
        });
        setPaymentApproved(payId, { approvedAt: Date.now() });

        // 큐잉: 가장 늦은 endAt 다음날부터. (수량>1 이거나 갱신권일 때 올바르게 누적)
        const actualStartAt = runningLatestEnd ? nextDayStart(runningLatestEnd) : item.startAt;
        // 기간권 종료일 = 시작일 + (일수-1) (포함 기준).
        // 예: 6/1 시작 + 30일 = 6/30 만료 (다음권은 7/1 부터).
        const endAt = item.durationDays ? actualStartAt + (item.durationDays - 1) * 86400000 : undefined;
        addSubscription({
          studentId: student.id, planId: plan.id,
          planSnapshot: {
            name: plan.name, type: plan.type,
            durationDays: plan.durationDays, hours: plan.hours, counts: plan.counts,
            price: plan.price,
          },
          startAt: actualStartAt, endAt,
          hoursRemaining: plan.hours,
          countsRemaining: plan.counts,
          paymentId: payId,
          status: 'active',
        });
        if (endAt) runningLatestEnd = endAt;
      }
      const otherTotal = order.filter((i) => i.kind !== 'plan').reduce((s, i) => s + i.amount, 0);
      if (otherTotal !== 0) {
        addPayment({
          studentId: student.id, planId: 'other', amount: otherTotal,
          method: splits[0]?.method ?? 'card', status: 'approved',
        });
      }
      setPayStatus(`✅ 결제 완료 (${orderTotal.toLocaleString()}원)`);
      setOrder([]);
      setPayments([{ method: 'card', amount: 0 }]);
    } catch (e) {
      setPayStatus(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcessing(false);
      setTimeout(() => setPayStatus(''), 5000);
    }
  }

  const allSubs = subs.filter((x) => x.studentId === student?.id)
    .sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0));

  const myLogs = att.logs.filter((l) => l.studentId === student.id);
  const myPays = pays.filter((p) => p.studentId === student.id);
  const useLogs = myLogs.filter((l) => l.type === 'enter' || l.type === 'exit');
  // 이용 시간 페어 계산
  const useSessions: { start: number; end: number }[] = [];
  for (let i = useLogs.length - 1; i >= 0; i--) {
    const l = useLogs[i];
    if (l.type === 'enter') {
      const nextExit = useLogs.slice(0, i).reverse().find((x) => x.type === 'exit' && x.at > l.at);
      useSessions.unshift({ start: l.at, end: nextExit?.at ?? Date.now() });
    }
  }

  return (
    <>
      <PageHeader title="👤+ 회원정보" />
      <div className="space-y-4 p-6">
        {/* 기본 회원 정보 */}
        <section className="card p-6">
          <h3 className="mb-4 font-semibold">기본 회원 정보</h3>
          <div className="grid grid-cols-1 gap-y-3 md:grid-cols-12 md:gap-x-6 md:gap-y-4 text-sm">
            <Field label="성함" col={4}>
              <input className="input" value={v?.name ?? ''} readOnly={!editMode}
                onChange={(e) => setDraftField('name', e.target.value)} />
            </Field>
            <Field label="성별" col={2}>
              {editMode ? (
                <select className="input" value={v?.gender ?? ''}
                  onChange={(e) => setDraftField('gender', (e.target.value || undefined) as 'M' | 'F' | undefined)}>
                  <option value="">미정</option>
                  <option value="M">♂ 남</option>
                  <option value="F">♀ 여</option>
                </select>
              ) : (
                <div className="flex h-9 items-center gap-1">
                  <span className={`rounded px-2 py-1 text-xs ${v?.gender === 'M' ? 'bg-sky-100 text-sky-700' : v?.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>
                    {v?.gender === 'M' ? '♂ 남' : v?.gender === 'F' ? '♀ 여' : '미정'}
                  </span>
                </div>
              )}
            </Field>
            <Field label="연락처" col={4}>
              <input className="input" value={v?.phone ?? ''} readOnly={!editMode}
                onChange={(e) => setDraftField('phone', e.target.value)} />
            </Field>
            <Field label="메시지 수신" col={2}>
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" className="accent-brand-600" checked={!!v?.msgReceive} disabled={!editMode}
                  onChange={(e) => setDraftField('msgReceive', e.target.checked)} />
                수신
              </label>
            </Field>

            <Field label="" col={2}>
              <button className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50" disabled>정상회원</button>
            </Field>
            <Field label="" col={2}>
              <button className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={student.fingerprintId ? deleteFp : startEnroll} disabled={enrolling || editMode}>
                {student.fingerprintId ? '◉ 지문삭제' : enrolling ? '대기 중…' : '◯ 지문등록'}
              </button>
            </Field>
            <Field label="PIN번호" col={4}>
              <input className="input font-mono" maxLength={4} value={v?.pin ?? ''} readOnly={!editMode}
                onChange={(e) => setDraftField('pin', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </Field>
            <div className="col-span-4" />

            <Field label="생년월일" col={4}>
              <input className="input" type="date" value={v?.birthYmd ?? ''} readOnly={!editMode}
                onChange={(e) => setDraftField('birthYmd', e.target.value)} />
            </Field>
            <Field label="회원 구분" col={2}>
              <select className="input" value={v?.memberKind ?? 'student'} disabled={!editMode}
                onChange={(e) => setDraftField('memberKind', e.target.value as 'student' | 'adult')}>
                <option value="student">학생</option>
                <option value="adult">성인</option>
              </select>
            </Field>
            <Field label="사물함" col={3}>
              <input className="input" value={v?.lockerId ?? ''} placeholder="없음" readOnly={!editMode}
                onChange={(e) => setDraftField('lockerId', e.target.value)} />
            </Field>

            <Field label="보호자" col={4}>
              <input className="input" placeholder="이름" disabled />
            </Field>
            <Field label="보호자 연락처" col={6}>
              <input className="input" value={v?.parentPhone ?? ''} readOnly={!editMode}
                onChange={(e) => setDraftField('parentPhone', e.target.value)} />
            </Field>
            <Field label="메시지 수신" col={2}>
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" className="accent-brand-600" checked={!!v?.parentMsgReceive} disabled={!editMode}
                  onChange={(e) => setDraftField('parentMsgReceive', e.target.checked)} />
                수신
              </label>
            </Field>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button className={`rounded-md px-4 py-2 text-sm font-semibold ${inside ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-brand-600 text-white hover:bg-brand-700'} disabled:bg-slate-200 disabled:text-slate-500`}
              onClick={toggleIn} disabled={editMode}>
              {inside ? '퇴실' : '입실'}
            </button>
            {editMode ? (
              <>
                <button className="rounded-md bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-100"
                  onClick={cancelEdit}>취소</button>
                <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  onClick={saveEdit}>✓ 수정 완료</button>
              </>
            ) : (
              <button className="rounded-md bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-100"
                onClick={startEdit}>회원수정</button>
            )}
          </div>
        </section>

        {/* 메모 */}
        <section className="card p-6">
          <h3 className="mb-2 font-semibold">메모</h3>
          <textarea className="input min-h-[80px]" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <div className="mt-2 flex justify-end">
            <button className="rounded-md bg-white px-4 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-100" onClick={saveMemo}>저장</button>
          </div>
        </section>

        {/* 서비스 이용 정보 */}
        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">서비스 이용 정보</h3>
            <button className="rounded-md bg-white px-3 py-1.5 text-xs ring-1 ring-slate-300 hover:bg-slate-50"
              onClick={() => setShowHistory(true)}>+ 더보기</button>
          </div>
          {!sub && upcomingSubs.length === 0 && <p className="py-6 text-center text-sm text-slate-400">등록된 이용권이 없습니다.</p>}
          {sub && (
            <div className="grid grid-cols-6 gap-y-3 text-sm">
              <Field2 label="이용권">{sub.planSnapshot.name}</Field2>
              <Field2 label="상태"><span className="text-emerald-600 font-semibold">이용중</span></Field2>
              <Field2 label="시작일">{toLocalISODate(sub.startAt)}</Field2>
              <Field2 label="종료일">{sub.endAt ? toLocalISODate(sub.endAt) : '-'}</Field2>
              <Field2 label="이용기간">{sub.planSnapshot.durationDays ? `${sub.planSnapshot.durationDays}일` : '-'}</Field2>
              <Field2 label="잔여기간">
                {(() => {
                  const lastEnd = lastActiveEndOf(subs, student.id);
                  if (!lastEnd) return '-';
                  const days = Math.max(0, Math.round((lastEnd - Date.now()) / 86400000));
                  return upcomingSubs.length > 0 ? `${days}일 (예정 포함)` : `${days}일`;
                })()}
              </Field2>
            </div>
          )}
          {upcomingSubs.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <div className="text-xs font-semibold text-slate-500">📅 예정 이용권 ({upcomingSubs.length}건)</div>
              {upcomingSubs.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-xs">
                  <span className="font-medium text-amber-900">{u.planSnapshot.name}</span>
                  <span className="text-amber-700">
                    {toLocalISODate(u.startAt)}
                    {u.endAt ? ` ~ ${toLocalISODate(u.endAt)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 결제 대기 (지역상품권 QR 결제) */}
        {pendingOrders.filter((po) => po.studentId === student.id && po.status !== 'paid').length > 0 && (
          <section className="card border-2 border-sky-200 bg-sky-50/50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="font-semibold text-sky-900">📋 결제 대기 (지역상품권 QR)</h3>
              <span className="rounded bg-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-800">PENDING</span>
            </div>
            <p className="mb-3 text-xs text-slate-600">
              지역상품권 QR 결제 대기 중. 학생이 메인/서브 가맹점 QR 각각 결제 완료하면
              운영자가 <b>[✓ 결제 완료 처리]</b> 를 눌러주세요. <b>양쪽 모두 완료</b> 시 이용권이 자동 활성화됩니다.
            </p>
            <div className="space-y-3">
              {pendingOrders
                .filter((po) => po.studentId === student.id && po.status !== 'paid')
                .map((po) => (
                  <div key={po.id} className="rounded-md border border-sky-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono text-slate-500">{po.id.slice(0, 14)}…</span>
                        <span className="ml-2 text-slate-700">
                          총액 <b>{po.totalAmount.toLocaleString()}원</b> · {po.items.filter((i) => i.kind === 'plan').length}건
                        </span>
                      </div>
                      <span className="text-slate-400">{fmtDateTime(new Date(po.createdAt))}</span>
                    </div>
                    <div className="mb-2 text-xs text-slate-600">
                      {po.items.filter((i) => i.kind === 'plan').map((i) => i.name).join(' · ')}
                    </div>
                    <div className="space-y-1.5">
                      {po.invoices.map((iv) => (
                        <div key={iv.invoiceId} className="rounded bg-slate-50 p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                iv.vendor === 'main' ? 'bg-indigo-100 text-indigo-700' : 'bg-fuchsia-100 text-fuchsia-700'
                              }`}>
                                {iv.vendor === 'main' ? '메인 (독서실 / 면세)' : '서브 (교습소 / 과세)'}
                              </span>
                              <span className="font-mono font-semibold text-slate-800">{iv.amount.toLocaleString()}원</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                iv.status === 'paid' ? 'bg-emerald-200 text-emerald-800'
                                : iv.status === 'cancelled' ? 'bg-rose-200 text-rose-800'
                                : 'bg-amber-200 text-amber-800'
                              }`}>
                                {iv.status === 'paid' ? '✓ 결제 완료' : iv.status === 'cancelled' ? '취소' : '⏳ 결제 대기'}
                              </span>
                              {iv.status === 'pending' && (
                                <button
                                  className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
                                  onClick={() => updateInvoiceStatus(po.id, iv.invoiceId, 'paid')}
                                  title="해당 가맹점 지역상품권 QR 결제가 확인되면 클릭"
                                >✓ 결제 완료 처리</button>
                              )}
                            </div>
                          </div>
                          {iv.accountNumber && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700">
                              <span><b>{iv.bank ?? ''}</b></span>
                              <button
                                type="button"
                                className="font-mono font-bold text-slate-900 hover:bg-amber-100 hover:underline"
                                title="클릭해 계좌번호 복사"
                                onClick={() => {
                                  navigator.clipboard?.writeText(iv.accountNumber ?? '');
                                  setPayStatus('계좌번호가 복사되었습니다.');
                                  setTimeout(() => setPayStatus(''), 2000);
                                }}
                              >{iv.accountNumber}</button>
                              <span className="text-slate-500">예금주 <b>{iv.customerName ?? '-'}</b></span>
                              {iv.dueDate && (
                                <span className="text-rose-600">기한 {iv.dueDate.slice(0, 10)}</span>
                              )}
                              {iv.url && (
                                <a href={iv.url} target="_blank" rel="noreferrer" className="text-sky-600 underline">영수증 →</a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      {po.status !== 'cancelled' && (
                        <button
                          className="rounded bg-white px-2 py-1 text-[11px] text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50"
                          onClick={() => confirm('이 주문을 취소할까요? (이미 결제된 건은 별도 환불 필요)') && cancelPendingOrder(po.id)}
                        >취소</button>
                      )}
                      {po.status === 'cancelled' && (
                        <button
                          className="rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-300"
                          onClick={() => removePendingOrder(po.id)}
                        >목록에서 삭제</button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* 3종 로그 */}
        <section className="card overflow-hidden">
          <div className="flex border-b border-slate-200">
            {(['member', 'use', 'pay'] as LogTab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-semibold transition ${
                  tab === t ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                {t === 'member' ? '회원로그' : t === 'use' ? '이용로그' : '결제로그'}
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto p-4 text-sm">
            {tab === 'member' && (
              <ol className="space-y-1">
                {myLogs.length === 0 && <li className="text-center text-slate-400">로그 없음</li>}
                {myLogs.slice(0, 50).map((l, i) => (
                  <li key={l.id} className="grid grid-cols-12 border-b border-slate-50 py-1.5 text-slate-600">
                    <span className="col-span-1 text-slate-400">{i + 1}</span>
                    <span className="col-span-4 font-mono">{fmtDateTime(new Date(l.at))}</span>
                    <span className="col-span-4 text-xs uppercase text-slate-400">OPERATION</span>
                    <span className="col-span-3 font-semibold">
                      {l.type === 'enter' ? '입실' : l.type === 'exit' ? '퇴실' : l.type === 'leave_temp' ? '외출' : '복귀'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {tab === 'use' && (
              <ol className="space-y-1">
                {useSessions.length === 0 && <li className="text-center text-slate-400">이용 세션 없음</li>}
                {useSessions.slice(0, 30).map((s, i) => {
                  const dur = Math.max(0, s.end - s.start);
                  const h = Math.floor(dur / 3600000);
                  const m = Math.floor((dur % 3600000) / 60000);
                  const sec = Math.floor((dur % 60000) / 1000);
                  return (
                    <li key={i} className="grid grid-cols-12 border-b border-slate-50 py-1.5 text-slate-600">
                      <span className="col-span-1 text-slate-400">{i + 1}</span>
                      <span className="col-span-4 text-brand-700">{`${String(h).padStart(2,'0')}시간 ${String(m).padStart(2,'0')}분 ${String(sec).padStart(2,'0')}초`}</span>
                      <span className="col-span-7 font-mono text-xs">
                        {new Date(s.start).toISOString().replace('T',' ').slice(0,19)} ~ {new Date(s.end).toISOString().replace('T',' ').slice(0,19)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {tab === 'pay' && (
              <ol className="space-y-1">
                {myPays.length === 0 && <li className="text-center text-slate-400">결제 내역 없음</li>}
                {myPays.slice(0, 30).map((p, i) => (
                  <li key={p.id} className="grid grid-cols-12 border-b border-slate-50 py-1.5 text-slate-600">
                    <span className="col-span-1 text-slate-400">{i + 1}</span>
                    <span className="col-span-3 font-mono">{new Date(p.createdAt).toISOString().slice(2, 10).replace(/-/g, '.')}</span>
                    <span className={`col-span-2 font-semibold ${p.status === 'approved' ? 'text-emerald-600' : p.status === 'failed' ? 'text-rose-600' : 'text-slate-500'}`}>
                      {p.status === 'approved' ? '결제완료' : p.status === 'failed' ? '실패' : p.status === 'cancelled' ? '환불' : '대기'}
                    </span>
                    <span className="col-span-2 text-right">{fmtMoney(p.amount)}</span>
                    <span className="col-span-4 text-xs text-slate-500">
                      {plans.find((pl) => pl.id === p.planId)?.name}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* 이용권 선택 */}
        <section className="card p-6">
          <h3 className="mb-3 font-semibold">이용권 선택</h3>
          <div className="grid grid-cols-1 gap-y-3 md:grid-cols-12 md:gap-x-4 text-sm">
            <Field label="좌석타입" col={2}>
              <select className="input" value={planSeatType}
                onChange={(e) => { setPlanSeatType(e.target.value as '' | 'fixed' | 'free'); setSelectedPlanId(''); }}>
                <option value="">전체</option>
                <option value="fixed">고정석</option>
                <option value="free">자유석</option>
              </select>
            </Field>
            <Field label="이용권" col={4}>
              <select className="input" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
                <option value="">선택</option>
                {availablePlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {fmtMoney(p.price)}</option>
                ))}
              </select>
            </Field>
            <Field label="시작일" col={3}>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setStartDateTouched(true); }}
              />
              {startDateTouched && (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-slate-500 underline hover:text-brand-600"
                  onClick={() => { setStartDateTouched(false); }}
                  title="자동 계산 (이전 이용권 만료 다음날 또는 오늘) 복원"
                >↺ 자동 계산</button>
              )}
            </Field>
            <Field label="수량" col={1}>
              <input
                className="input text-center"
                type="number"
                min={1}
                max={99}
                value={planQty}
                onChange={(e) => setPlanQty(Math.max(1, Math.min(99, +e.target.value || 1)))}
              />
            </Field>
            <Field label="" col={2}>
              <button className="btn-primary h-9 w-full" disabled={!selectedPlanId} onClick={addPlanToOrder}>+ 추가</button>
            </Field>
            <div className="col-span-12">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" className="accent-brand-600" checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)} />
                숨긴 이용권 보기
              </label>
            </div>
          </div>
        </section>

        {/* 주문 정보 */}
        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">주문 정보</h3>
            <div className="flex gap-2">
              <button className="rounded-md bg-white px-3 py-1.5 text-xs ring-1 ring-slate-300 hover:bg-slate-50"
                onClick={() => setEtcModal('etc')}>💰 기타결제 추가</button>
              <button className="rounded-md bg-white px-3 py-1.5 text-xs ring-1 ring-slate-300 hover:bg-slate-50"
                onClick={() => setEtcModal('discount')}>% 할인 추가</button>
            </div>
          </div>
          {order.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">이용권을 선택해 추가하세요.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left">구분</th>
                  <th className="px-2 py-1 text-left">내용</th>
                  <th className="px-2 py-1 text-left">시작일</th>
                  <th className="px-2 py-1 text-right">금액</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {order.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-xs text-slate-500">
                      {it.kind === 'plan' ? '이용권' : it.kind === 'discount' ? '할인' : '기타'}
                    </td>
                    <td className="px-2 py-2">{it.name}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">{it.kind === 'plan' ? toLocalISODate(it.startAt) : '-'}</td>
                    <td className={`px-2 py-2 text-right font-mono ${it.amount < 0 ? 'text-rose-600' : ''}`}>
                      {it.amount.toLocaleString()}원
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button className="text-xs text-rose-500 hover:underline" onClick={() => removeOrderItem(it.id)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td className="px-2 py-2" colSpan={3}><b>합계금액</b></td>
                  <td className="px-2 py-2 text-right text-lg font-bold">{orderTotal.toLocaleString()}원</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        {/* 결제수단 */}
        <section className="card p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-semibold">결제수단 및 결제금액</h3>
            <button className="rounded-md bg-white px-3 py-1.5 text-xs ring-1 ring-slate-300 hover:bg-slate-50"
              onClick={splitPayment}>+ 분할결제</button>
          </div>
          <ol className="mt-4 space-y-3 text-sm">
            {payments.map((p, i) => {
              const external = p.method === 'remote' || p.method === 'localpay';
              return (
              <li key={i} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12 sm:gap-3">
                <span className="hidden text-center text-slate-400 sm:col-span-1 sm:block">{i + 1}</span>
                <div className="sm:col-span-5">
                  <div className="flex flex-wrap overflow-hidden rounded-md ring-1 ring-slate-300">
                    {(['card', 'cash', 'remote', 'localpay'] as const).map((m) => (
                      <button key={m} onClick={() => updateSplit(i, { method: m })}
                        className={`flex-1 px-2 py-1.5 text-xs sm:px-3 sm:text-sm ${p.method === m
                          ? (m === 'remote' || m === 'localpay'
                            ? 'bg-amber-100 text-amber-700 font-semibold'
                            : 'bg-brand-100 text-brand-700 font-semibold')
                          : 'bg-white text-slate-600'}`}>
                        {METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <input className="input text-right font-mono sm:col-span-5" type="number" min={0} step={100}
                  value={p.amount}
                  onChange={(e) => updateSplit(i, { amount: +e.target.value })}
                  title={external ? '비대면/성남사랑은 단말기 거치지 않고 0원으로 기록할 수도 있음' : '결제할 금액'} />
                <div className="text-right sm:col-span-1">
                  {payments.length > 1 && (
                    <button className="text-xs text-rose-500 hover:underline" onClick={() => removeSplit(i)}>삭제</button>
                  )}
                </div>
                {external && (
                  <div className="text-[11px] text-amber-700 sm:col-span-12 sm:pl-12">
                    ℹ️ 외부 결제 — 단말기 거치지 않고 기록만. 금액 0원으로 두면 영수 카운트 안 됨.
                  </div>
                )}
              </li>
              );
            })}
          </ol>
          <div className="mt-3 flex items-center justify-end gap-4 text-sm">
            <span className={paidTotal === orderTotal ? 'text-emerald-600' : 'text-rose-600'}>
              잔액: {(orderTotal - paidTotal).toLocaleString()}원
            </span>
            <span>총 결제금액 <b className="ml-1 text-lg">{paidTotal.toLocaleString()}</b> 원</span>
          </div>
          <button
            className="mt-4 w-full rounded-md bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-500"
            disabled={processing || order.length === 0 || paidTotal !== orderTotal}
            onClick={processPayment}
          >
            {processing ? '처리 중…' : '결제하기'}
          </button>
          {payStatus && (
            <div className={`mt-3 rounded-md p-3 text-sm ${
              payStatus.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' :
              payStatus.startsWith('오류') || payStatus.startsWith('결제 실패') ? 'bg-rose-50 text-rose-700' :
              'bg-amber-50 text-amber-700'
            }`}>{payStatus}</div>
          )}
        </section>
      </div>

      {/* 서비스 이용 정보 — 더보기 모달 */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={`${student?.name ?? ''} — 전체 이용권 이력`} width="max-w-2xl">
        {allSubs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">이용권 이력이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">이용권</th>
                <th className="px-2 py-2 text-center">상태</th>
                <th className="px-2 py-2 text-center">시작일</th>
                <th className="px-2 py-2 text-center">종료일</th>
                <th className="px-2 py-2 text-right">금액</th>
                <th className="px-2 py-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {allSubs.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{s.planSnapshot.name}</td>
                  <td className="px-2 py-2 text-center">
                    <select className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                      value={s.status}
                      onChange={(e) => updateSubscription(s.id, { status: e.target.value as 'active' | 'expired' | 'refunded' })}>
                      <option value="active">이용중</option>
                      <option value="expired">만료</option>
                      <option value="refunded">환불</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    <input className="rounded border border-slate-200 px-1 py-0.5 text-xs" type="date"
                      value={toLocalISODate(s.startAt)}
                      onChange={(e) => updateSubscription(s.id, { startAt: fromLocalISODate(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    <input className="rounded border border-slate-200 px-1 py-0.5 text-xs" type="date"
                      value={s.endAt ? toLocalISODate(s.endAt) : ''}
                      onChange={(e) => updateSubscription(s.id, { endAt: e.target.value ? fromLocalISODate(e.target.value) : undefined })} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input className="w-24 rounded border border-slate-200 px-1 py-0.5 text-right font-mono text-xs" type="number" step={100}
                      value={s.planSnapshot.price}
                      onChange={(e) => updateSubscription(s.id, { planSnapshot: { ...s.planSnapshot, price: +e.target.value } })} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button className="rounded bg-white px-2 py-0.5 text-xs ring-1 ring-slate-300 hover:bg-slate-50"
                      onClick={() => setEditSubId(s.id === editSubId ? null : s.id)}>
                      {editSubId === s.id ? '닫기' : '상세'}
                    </button>
                    <button className="ml-1 rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                      onClick={() => { if (confirm(`"${s.planSnapshot.name}" 이용권을 삭제할까요?`)) removeSubscription(s.id); }}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {editSubId && (() => {
          const s = allSubs.find((x) => x.id === editSubId);
          if (!s) return null;
          return (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="mb-2 text-xs font-semibold text-slate-600">상세 편집</div>
              <div className="grid grid-cols-2 gap-3">
                <label>이용권 이름
                  <input className="input mt-1" value={s.planSnapshot.name}
                    onChange={(e) => updateSubscription(s.id, { planSnapshot: { ...s.planSnapshot, name: e.target.value } })} />
                </label>
                <label>유형
                  <select className="input mt-1" value={s.planSnapshot.type}
                    onChange={(e) => updateSubscription(s.id, { planSnapshot: { ...s.planSnapshot, type: e.target.value as 'period' | 'hours' | 'count' } })}>
                    <option value="period">기간권</option>
                    <option value="hours">시간권</option>
                    <option value="count">회차권</option>
                  </select>
                </label>
                <label>기간(일)
                  <input className="input mt-1" type="number" min={1} value={s.planSnapshot.durationDays ?? 0}
                    onChange={(e) => updateSubscription(s.id, { planSnapshot: { ...s.planSnapshot, durationDays: +e.target.value } })} />
                </label>
                <label>시간(h)
                  <input className="input mt-1" type="number" min={0} value={s.planSnapshot.hours ?? 0}
                    onChange={(e) => updateSubscription(s.id, { planSnapshot: { ...s.planSnapshot, hours: +e.target.value } })} />
                </label>
                <label>회차
                  <input className="input mt-1" type="number" min={0} value={s.planSnapshot.counts ?? 0}
                    onChange={(e) => updateSubscription(s.id, { planSnapshot: { ...s.planSnapshot, counts: +e.target.value } })} />
                </label>
                <label>잔여 시간(h)
                  <input className="input mt-1" type="number" min={0} value={s.hoursRemaining ?? 0}
                    onChange={(e) => updateSubscription(s.id, { hoursRemaining: +e.target.value })} />
                </label>
                <label>잔여 회차
                  <input className="input mt-1" type="number" min={0} value={s.countsRemaining ?? 0}
                    onChange={(e) => updateSubscription(s.id, { countsRemaining: +e.target.value })} />
                </label>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 기타결제 / 할인 추가 모달 */}
      <EtcModal
        open={etcModal === 'etc'} onClose={() => setEtcModal(null)}
        title="기타결제 추가" labelA="항목" labelB="금액"
        onSubmit={(n, amt) => addEtc(n, amt)}
      />
      <EtcModal
        open={etcModal === 'discount'} onClose={() => setEtcModal(null)}
        title="할인 추가" labelA="할인 사유" labelB="할인 금액"
        onSubmit={(n, amt) => addDiscount(n, amt)}
      />
    </>
  );
}

function Field({ label, children, col }: { label: string; children: React.ReactNode; col: number }) {
  return (
    <div style={{ gridColumn: `span ${col} / span ${col}` }}>
      {label && <label className="mb-1 block text-xs text-slate-600">{label}</label>}
      {children}
    </div>
  );
}
function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="col-span-1 text-xs text-slate-500">{label}</div>
      <div className="col-span-2 text-sm">{children}</div>
    </>
  );
}

function EtcModal({ open, onClose, title, labelA, labelB, onSubmit }: {
  open: boolean; onClose: () => void; title: string;
  labelA: string; labelB: string;
  onSubmit: (name: string, amount: number) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={() => { if (!name) return; onSubmit(name, amount); setName(''); setAmount(0); onClose(); }}>추가</button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <label>{labelA}<input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{labelB} (원)
          <input className="input mt-1 text-right font-mono" type="number" min={0} step={100}
            value={amount} onChange={(e) => setAmount(+e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
