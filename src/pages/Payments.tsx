import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { usePlans } from '../store/plans';
import { useStudents } from '../store/students';
import { deviceAgent } from '../lib/deviceAgent';
import { fmtDateTime, fmtMoney } from '../lib/format';

export function PaymentsPage() {
  const { plans, pays, subs, addPayment, setPaymentApproved, addSubscription } = usePlans();
  const students = useStudents((s) => s.list);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState<string>('');
  const [planId, setPlanId] = useState<string>(plans[0]?.id ?? '');
  const [installment, setInstallment] = useState<number>(0);
  const [terminalState, setTerminalState] = useState<'idle' | 'waiting' | 'done' | 'error'>('idle');
  const [terminalMsg, setTerminalMsg] = useState('');

  const plan = plans.find((p) => p.id === planId);
  const student = students.find((s) => s.id === studentId);

  function reset() {
    setOpen(false);
    setStudentId('');
    setPlanId(plans[0]?.id ?? '');
    setInstallment(0);
    setTerminalState('idle');
    setTerminalMsg('');
  }

  function startPay() {
    if (!student || !plan) return;
    setTerminalState('waiting');
    setTerminalMsg('단말기로 카드를 긁어주세요…');
    const payId = addPayment({
      studentId: student.id,
      planId: plan.id,
      amount: plan.price,
      method: 'card',
      installment: installment || undefined,
      status: 'pending',
    });
    const orderId = payId;
    const off = deviceAgent.on((e) => {
      if (e.type !== 'card_payment_result') return;
      off();
      if (!e.ok) {
        setPaymentApproved(payId, { status: 'failed', errorMessage: e.error });
        setTerminalState('error');
        setTerminalMsg(`결제 실패: ${e.error ?? '알 수 없는 오류'}`);
        return;
      }
      setPaymentApproved(payId, {
        status: 'approved',
        approvedAt: Date.now(),
        cardApprovalNo: e.approvalNo,
        cardIssuer: e.issuer,
        terminalTxId: e.txId,
      });
      const start = Date.now();
      const end = plan.durationDays ? start + plan.durationDays * 86400000 : undefined;
      addSubscription({
        studentId: student.id,
        planId: plan.id,
        planSnapshot: { name: plan.name, type: plan.type, durationDays: plan.durationDays, hours: plan.hours, counts: plan.counts, price: plan.price },
        startAt: start,
        endAt: end,
        hoursRemaining: plan.hours,
        countsRemaining: plan.counts,
        paymentId: payId,
        status: 'active',
      });
      setTerminalState('done');
      setTerminalMsg(`승인됨 · ${e.issuer} · 승인번호 ${e.approvalNo}`);
    });
    deviceAgent.send({ id: orderId, cmd: 'card_pay', amount: plan.price, installment: installment || undefined, orderId });
  }

  return (
    <>
      <PageHeader
        title="결제·이용권"
        desc="이용권 판매와 결제 내역"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>+ 결제 진행</button>}
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold">결제 내역</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-3 py-2 text-left">시각</th><th className="px-3 py-2 text-left">학생</th><th className="px-3 py-2 text-left">상품</th><th className="px-3 py-2 text-right">금액</th><th className="px-3 py-2">상태</th><th className="px-3 py-2">승인번호</th></tr>
            </thead>
            <tbody>
              {pays.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">결제 내역 없음</td></tr>}
              {pays.map((p) => {
                const s = students.find((x) => x.id === p.studentId);
                const pl = plans.find((x) => x.id === p.planId);
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{fmtDateTime(new Date(p.createdAt))}</td>
                    <td className="px-3 py-2">{s?.name ?? '-'}</td>
                    <td className="px-3 py-2">{pl?.name ?? '-'}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(p.amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={
                        p.status === 'approved' ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700' :
                        p.status === 'failed' ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700' :
                        'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                      }>{p.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{p.cardApprovalNo ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold">활성 이용권</div>
          <ul className="divide-y divide-slate-100">
            {subs.filter((s) => s.status === 'active').length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">없음</li>
            )}
            {subs.filter((s) => s.status === 'active').map((s) => {
              const st = students.find((x) => x.id === s.studentId);
              return (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <div className="font-medium">{st?.name ?? '-'}</div>
                  <div className="text-xs text-slate-500">{s.planSnapshot.name}</div>
                  <div className="text-xs text-slate-500">
                    {s.endAt ? `만료: ${fmtDateTime(new Date(s.endAt))}` : ''}
                    {s.hoursRemaining ? ` · 남은 ${s.hoursRemaining}시간` : ''}
                    {s.countsRemaining ? ` · 남은 ${s.countsRemaining}회` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Modal
        open={open}
        onClose={reset}
        title="이용권 결제"
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={reset}>{terminalState === 'done' ? '닫기' : '취소'}</button>
            {terminalState === 'idle' && <button className="btn-primary" disabled={!student || !plan} onClick={startPay}>결제 진행</button>}
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <label>학생
            <select className="input mt-1" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">선택</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>이용권
            <select className="input mt-1" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {fmtMoney(p.price)}</option>)}
            </select>
          </label>
          <label>할부 (0 = 일시불)
            <input className="input mt-1" type="number" min={0} max={36} value={installment} onChange={(e) => setInstallment(+e.target.value)} />
          </label>

          {terminalState !== 'idle' && (
            <div className={`rounded-md p-3 text-sm ${
              terminalState === 'done' ? 'bg-emerald-50 text-emerald-700' :
              terminalState === 'error' ? 'bg-red-50 text-red-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              {terminalMsg}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
