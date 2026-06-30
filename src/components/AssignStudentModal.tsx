import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useStudents } from '../store/students';
import { usePlans } from '../store/plans';
import { fmtMoney, fmtPhone } from '../lib/format';

export interface AssignData {
  studentId: string;
  useExisting: boolean;          // true = 기존 활성 이용권 사용 (신규 구매 X)
  planId?: string;               // useExisting=false 일 때만
  startAt?: number;
  durationDays?: number;
  durationMonths?: number;
}

export function AssignStudentModal({
  open, onClose, seatLabel, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  seatId?: string | null;
  seatLabel?: string;
  onConfirm: (data: AssignData) => void;
}) {
  const students = useStudents((s) => s.list);
  const plans = usePlans((s) => s.plans);
  const subs = usePlans((s) => s.subs);

  const [q, setQ] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [planId, setPlanId] = useState<string>('');
  const [start, setStart] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return students.slice(0, 30);
    return students.filter((s) => s.name.includes(t) || s.phone.includes(t)).slice(0, 30);
  }, [q, students]);

  const activePlans = plans.filter((p) => p.active);
  const chosenPlan = plans.find((p) => p.id === planId);

  const studentActiveSubs = useMemo(() => {
    if (!selectedStudent) return [];
    return subs
      .filter((s) => s.studentId === selectedStudent && s.status === 'active')
      .sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0));
  }, [subs, selectedStudent]);

  // 학생 선택 시 기존 이용권 있으면 '기존 사용' 기본, 없으면 '신규 구매'
  function selectStudent(id: string) {
    setSelectedStudent(id);
    const hasActive = subs.some((s) => s.studentId === id && s.status === 'active');
    setMode(hasActive ? 'existing' : 'new');
  }

  function confirm() {
    if (!selectedStudent) return alert('회원을 선택하세요.');
    if (mode === 'new' && !planId) return alert('이용권을 선택하세요.');
    onConfirm({
      studentId: selectedStudent,
      useExisting: mode === 'existing',
      planId: mode === 'new' ? planId : undefined,
      startAt: mode === 'new' ? new Date(start).getTime() : undefined,
      durationDays: mode === 'new' ? chosenPlan?.durationDays : undefined,
      durationMonths: mode === 'new' ? chosenPlan?.durationMonths : undefined,
    });
    reset();
  }
  function reset() { setQ(''); setSelectedStudent(''); setPlanId(''); setMode('existing'); }

  const canConfirm =
    !!selectedStudent && (mode === 'existing' ? studentActiveSubs.length > 0 : !!planId);

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title={`회원 배정 — ${seatLabel ?? '좌석'}`}
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-secondary" onClick={() => { reset(); onClose(); }}>취소</button>
          <button className="btn-primary" onClick={confirm} disabled={!canConfirm}>배정</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">회원 검색</label>
          <input className="input" placeholder="이름·전화" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-2 h-72 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100 text-sm">
            {filtered.length === 0 && <li className="p-3 text-center text-slate-400">검색 결과 없음</li>}
            {filtered.map((s) => {
              const hasActive = subs.some((x) => x.studentId === s.id && x.status === 'active');
              return (
                <li key={s.id}>
                  <button
                    onClick={() => selectStudent(s.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 transition ${
                      selectedStudent === s.id ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {s.name} {s.gender === 'M' ? '♂' : s.gender === 'F' ? '♀' : ''}
                      {hasActive && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">이용권</span>}
                    </span>
                    <span className="text-xs text-slate-400">{fmtPhone(s.phone) || '-'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="mb-2 inline-flex w-full overflow-hidden rounded-md ring-1 ring-slate-300 text-sm">
            <button
              onClick={() => setMode('existing')}
              disabled={!selectedStudent || studentActiveSubs.length === 0}
              className={`flex-1 px-3 py-2 ${mode === 'existing' && studentActiveSubs.length > 0
                ? 'bg-brand-600 text-white font-semibold' : 'bg-white text-slate-600 disabled:opacity-40'}`}
            >
              기존 이용권 사용
            </button>
            <button
              onClick={() => setMode('new')}
              disabled={!selectedStudent}
              className={`flex-1 border-l border-slate-300 px-3 py-2 ${mode === 'new'
                ? 'bg-brand-600 text-white font-semibold' : 'bg-white text-slate-600 disabled:opacity-40'}`}
            >
              신규 구매
            </button>
          </div>

          {mode === 'existing' ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">활성 이용권</label>
              {studentActiveSubs.length === 0 ? (
                <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">
                  활성 이용권 없음 — "신규 구매"로 전환하세요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {studentActiveSubs.map((s) => (
                    <li key={s.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="font-semibold text-slate-800">{s.planSnapshot.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {s.endAt ? `종료: ${new Date(s.endAt).toISOString().slice(0, 10)} (${Math.max(0, Math.round((s.endAt - Date.now()) / 86400000))}일 남음)` : '기간 무제한'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">
                이미 보유한 이용권으로 좌석만 배정합니다. 결제 발생 안 함.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">이용권 선택 (신규 구매)</label>
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
                  {chosenPlan.durationMonths && <div>기간: {chosenPlan.durationMonths}개월 (시작 월의 마지막 날까지)</div>}
                  {!chosenPlan.durationMonths && chosenPlan.durationDays && <div>기간: {chosenPlan.durationDays}일</div>}
                  {chosenPlan.hours && <div>시간: {chosenPlan.hours}h</div>}
                  {chosenPlan.counts && <div>회차: {chosenPlan.counts}회</div>}
                  <div className="mt-1 font-semibold text-slate-800">{fmtMoney(chosenPlan.price)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
