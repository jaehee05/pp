import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useStudents } from '../store/students';
import { usePlans } from '../store/plans';
import { fmtPhone } from '../lib/format';

// 좌석 배정 = 기존 활성 이용권이 있는 회원만 가능.
// 신규 구매 흐름은 회원정보 페이지에서 처리 (좌석 배정 모달은 단순화).
export interface AssignData {
  studentId: string;
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
  const subs = usePlans((s) => s.subs);

  const [q, setQ] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return students.slice(0, 30);
    return students.filter((s) => s.name.includes(t) || s.phone.includes(t)).slice(0, 30);
  }, [q, students]);

  const studentActiveSubs = useMemo(() => {
    if (!selectedStudent) return [];
    return subs
      .filter((s) => s.studentId === selectedStudent && s.status === 'active')
      .sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0));
  }, [subs, selectedStudent]);

  function selectStudent(id: string) { setSelectedStudent(id); }

  function confirm() {
    if (!selectedStudent) return alert('회원을 선택하세요.');
    if (studentActiveSubs.length === 0) return alert('활성 이용권이 없는 회원은 좌석 배정할 수 없습니다. 회원정보에서 이용권 구매 후 다시 시도하세요.');
    onConfirm({ studentId: selectedStudent });
    reset();
  }
  function reset() { setQ(''); setSelectedStudent(''); }

  const canConfirm = !!selectedStudent && studentActiveSubs.length > 0;

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
          <label className="mb-1 block text-xs font-semibold text-slate-500">활성 이용권</label>
          {!selectedStudent ? (
            <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">좌측에서 회원을 선택하세요.</p>
          ) : studentActiveSubs.length === 0 ? (
            <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700">
              <p className="font-semibold">활성 이용권 없음</p>
              <p className="mt-1">좌석 배정 불가. <b>회원정보 페이지</b>에서 이용권을 구매한 뒤 다시 시도하세요.</p>
            </div>
          ) : (
            <>
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
              <p className="mt-3 text-xs text-slate-500">
                보유 중인 이용권으로 좌석만 배정합니다. 결제는 발생하지 않습니다.
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
