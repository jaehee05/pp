import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useStudents } from '../store/students';
import { useAttendance } from '../store/attendance';
import { usePlans } from '../store/plans';
import { currentSubOf } from '../lib/sub';

type Tab = 'members' | 'memberLogs' | 'paymentLogs';

export function MemberPanel({ onClose }: { onClose?: () => void } = {}) {
  const [tab, setTab] = useState<Tab>('members');
  const [q, setQ] = useState('');
  const students = useStudents((s) => s.list);
  const att = useAttendance((s) => s.state);
  const subs = usePlans((s) => s.subs);
  const pays = usePlans((s) => s.pays);
  const nav = useNavigate();

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return students;
    return students.filter((s) => s.name.includes(t) || s.phone.includes(t));
  }, [q, students]);

  return (
    <aside className="flex h-full w-[85vw] max-w-xs shrink-0 flex-col border-l border-slate-200 bg-white sm:w-80">
      <div className="flex items-center gap-2 border-b border-slate-200 p-3">
        <input
          className="input"
          placeholder="이름/전화번호로 검색하세요"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {onClose && (
          <button
            onClick={onClose}
            aria-label="회원 패널 닫기"
            className="shrink-0 rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >✕</button>
        )}
      </div>
      <div className="flex border-b border-slate-200 text-sm">
        {(['members', 'memberLogs', 'paymentLogs'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 border-b-2 py-2 transition ${
              tab === t ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t === 'members' ? '회원목록' : t === 'memberLogs' ? '회원로그' : '결제로그'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'members' && (
          <ul className="divide-y divide-slate-100">
            {filtered.length === 0 && <li className="p-6 text-center text-sm text-slate-400">회원 없음</li>}
            {filtered.map((s) => {
              const a = att[s.id];
              const sub = currentSubOf(subs, s.id);
              // 이용중/이용안함은 활성 이용권 기준. 입실/외출은 별도 라벨로 우선 표시.
              const stateLabel = !sub
                ? { txt: '이용안함', cls: 'bg-slate-100 text-slate-500' }
                : a?.state === 'in' ? { txt: '입실', cls: 'bg-emerald-100 text-emerald-700' }
                : a?.state === 'temp_out' ? { txt: '외출', cls: 'bg-amber-100 text-amber-700' }
                : { txt: '이용중', cls: 'bg-brand-100 text-brand-700' };
              return (
                <li key={s.id}>
                  <NavLink
                    to={`/ops/member/${s.id}`}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `block px-3 py-3 transition ${isActive ? 'bg-brand-50' : 'hover:bg-slate-50'}`
                    }
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${stateLabel.cls}`}>{stateLabel.txt}</span>
                      <span className="text-sm font-bold text-slate-900">{s.name}</span>
                      <span className={s.gender === 'M' ? 'text-sky-500' : s.gender === 'F' ? 'text-pink-500' : 'text-slate-300'}>
                        {s.gender === 'M' ? '♂' : s.gender === 'F' ? '♀' : '·'}
                      </span>
                      {s.fingerprintId && <span className="text-rose-500" title="지문 등록됨">◉</span>}
                      <span className="ml-auto text-[11px] text-slate-400">성인</span>
                    </div>
                    {sub && (
                      <div className="ml-1 text-[11px] text-slate-500">
                        <div>{sub.planSnapshot.name}</div>
                        <div className="mt-0.5">📅 {sub.endAt ? new Date(sub.endAt).toISOString().slice(0, 10) : '-'}</div>
                      </div>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
        {tab === 'memberLogs' && (
          <ul className="divide-y divide-slate-100 text-xs">
            {useAttendance.getState().logs.slice(0, 50).map((l) => {
              const s = students.find((x) => x.id === l.studentId);
              return (
                <li key={l.id} className="px-3 py-2">
                  <button className="text-slate-600 hover:text-brand-700" onClick={() => { if (s) { nav(`/ops/member/${s.id}`); onClose?.(); } }}>
                    {new Date(l.at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {' · '}<b className="text-slate-900">{s?.name ?? '?'}</b> {l.type === 'enter' ? '입실' : l.type === 'exit' ? '퇴실' : l.type === 'leave_temp' ? '외출' : '복귀'}
                  </button>
                </li>
              );
            })}
            {useAttendance.getState().logs.length === 0 && <li className="p-6 text-center text-sm text-slate-400">로그 없음</li>}
          </ul>
        )}
        {tab === 'paymentLogs' && (
          <ul className="divide-y divide-slate-100 text-xs">
            {pays.slice(0, 50).map((p) => {
              const s = students.find((x) => x.id === p.studentId);
              return (
                <li key={p.id} className="px-3 py-2">
                  <div className="text-slate-600">{new Date(p.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit' })}</div>
                  <div><b className="text-slate-900">{s?.name ?? '?'}</b> {p.amount.toLocaleString()}원 · {p.status}</div>
                </li>
              );
            })}
            {pays.length === 0 && <li className="p-6 text-center text-sm text-slate-400">결제 내역 없음</li>}
          </ul>
        )}
      </div>
    </aside>
  );
}
