import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useStudents } from '../store/students';
import { usePlans } from '../store/plans';
import { fmtMoney, fmtPhone } from '../lib/format';

export function AssignStudentModal({
  open, onClose, seatLabel, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  seatId?: string | null;
  seatLabel?: string;
  onConfirm: (data: { studentId: string; planId: string; startAt: number; durationDays?: number }) => void;
}) {
  const students = useStudents((s) => s.list);
  const plans = usePlans((s) => s.plans);
  const [q, setQ] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [start, setStart] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return students.slice(0, 30);
    return students.filter((s) => s.name.includes(t) || s.phone.includes(t)).slice(0, 30);
  }, [q, students]);

  const activePlans = plans.filter((p) => p.active);
  const chosenPlan = plans.find((p) => p.id === planId);

  function confirm() {
    if (!selectedStudent || !planId) return alert('회원과 이용권을 선택하세요.');
    onConfirm({
      studentId: selectedStudent,
      planId,
      startAt: new Date(start).getTime(),
      durationDays: chosenPlan?.durationDays,
    });
    reset();
  }
  function reset() { setQ(''); setSelectedStudent(''); setPlanId(''); }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title={`회원 배정 — ${seatLabel ?? '좌석'}`}
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-secondary" onClick={() => { reset(); onClose(); }}>취소</button>
          <button className="btn-primary" onClick={confirm} disabled={!selectedStudent || !planId}>배정</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">회원 검색</label>
          <input className="input" placeholder="이름·전화" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-2 h-72 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100 text-sm">
            {filtered.length === 0 && <li className="p-3 text-center text-slate-400">검색 결과 없음</li>}
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelectedStudent(s.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 transition ${
                    selectedStudent === s.id ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span>{s.name} {s.gender === 'M' ? '♂' : s.gender === 'F' ? '♀' : ''}</span>
                  <span className="text-xs text-slate-400">{fmtPhone(s.phone) || '-'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">이용권 선택</label>
          <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">선택</option>
            {activePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {fmtMoney(p.price)}
              </option>
            ))}
          </select>

          <label className="mt-3 mb-1 block text-xs font-semibold text-slate-500">시작일</label>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />

          {chosenPlan && (
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <div>유형: {chosenPlan.type === 'period' ? '기간권' : chosenPlan.type === 'hours' ? '시간권' : '회차권'}</div>
              {chosenPlan.durationDays && <div>기간: {chosenPlan.durationDays}일</div>}
              {chosenPlan.hours && <div>시간: {chosenPlan.hours}h</div>}
              {chosenPlan.counts && <div>회차: {chosenPlan.counts}회</div>}
              <div className="mt-1 font-semibold text-slate-800">{fmtMoney(chosenPlan.price)}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
