import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { useStudents, type LocalStudent } from '../../store/students';
import { useAttendance } from '../../store/attendance';
import { usePlans } from '../../store/plans';
import { fmtPhone } from '../../lib/format';
import { currentSubOf } from '../../lib/sub';
import { useSeats, seatOfStudent } from '../../lib/useSeats';

type MemberState = 'all' | 'normal' | 'restricted' | 'risk' | 'left';
type MemberKind = 'all' | 'student' | 'adult' | 'unknown';
type SeatType = 'all' | 'free' | 'fixed';
type AttFilter = 'all' | 'in' | 'temp_out' | 'out';
type LockerUse = 'all' | 'yes' | 'no';
type Gender = 'all' | 'M' | 'F' | 'unknown';
type UseState = 'all' | 'waiting' | 'reserved' | 'using' | 'ended' | 'longIdle' | 'idle';
type PlanType = 'all' | 'oneshot' | 'flat' | 'period';
type SeatOccupy = 'all' | 'occupied' | 'free';
type MsgReceive = 'all' | 'on' | 'off';

interface Filters {
  dateFrom: string;
  dateTo: string;
  search: string;
  memberState: MemberState;
  memberKind: MemberKind;
  seatType: SeatType;
  attendance: AttFilter;
  lockerUse: LockerUse;
  gender: Gender;
  useState: UseState;
  planType: PlanType;
  seatOccupy: SeatOccupy;
  msgReceive: MsgReceive;
}

const DEFAULT: Filters = {
  dateFrom: '', dateTo: '', search: '',
  memberState: 'all', memberKind: 'all', seatType: 'all', attendance: 'all',
  lockerUse: 'all', gender: 'all', useState: 'all', planType: 'all',
  seatOccupy: 'all', msgReceive: 'all',
};

export function MembersAdmin() {
  const students = useStudents((s) => s.list);
  const att = useAttendance((s) => s.state);
  const seats = useSeats();
  const subs = usePlans((s) => s.subs);
  const pays = usePlans((s) => s.pays);
  const nav = useNavigate();
  const [f, setF] = useState<Filters>(DEFAULT);
  const [applied, setApplied] = useState<Filters>(DEFAULT);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => filter(students, applied, att, subs), [students, applied, att, subs]);
  const visible = filtered.slice(0, pageSize);

  function reset() { setF(DEFAULT); setApplied(DEFAULT); }

  return (
    <>
      <PageHeader title="회원 목록" desc="가입회원 목록을 관리하고, 회원 상태별로 정렬 할 수 있습니다." />
      <div className="space-y-4 p-6">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="[&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">
              <tr className="border-b border-slate-100">
                <th className="w-32">기간검색</th>
                <td>
                  <div className="flex items-center gap-2">
                    <input className="input w-44" type="date" value={f.dateFrom}
                      onChange={(e) => setF({ ...f, dateFrom: e.target.value })} />
                    <span className="text-slate-400">→</span>
                    <input className="input w-44" type="date" value={f.dateTo}
                      onChange={(e) => setF({ ...f, dateTo: e.target.value })} />
                  </div>
                </td>
                <th className="w-24">검색</th>
                <td>
                  <input className="input" placeholder="이름, 휴대폰으로 검색 가능합니다."
                    value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
                </td>
              </tr>
              <FilterRow
                left={{ label: '회원 상태', val: f.memberState, set: (v) => setF({ ...f, memberState: v as MemberState }),
                  opts: [['all','전체'],['normal','정상'],['restricted','제한'],['risk','불량'],['left','탈퇴']] }}
                right={{ label: '성별', val: f.gender, set: (v) => setF({ ...f, gender: v as Gender }),
                  opts: [['all','전체'],['M','남자'],['F','여자'],['unknown','확인불가']] }}
              />
              <FilterRow
                left={{ label: '회원 구분', val: f.memberKind, set: (v) => setF({ ...f, memberKind: v as MemberKind }),
                  opts: [['all','전체'],['student','학생'],['adult','성인'],['unknown','확인불가']] }}
                right={{ label: '이용 상태', val: f.useState, set: (v) => setF({ ...f, useState: v as UseState }),
                  opts: [['all','전체'],['waiting','대기'],['reserved','예약'],['using','이용중'],['ended','이용종료'],['longIdle','장기미이용'],['idle','이용안함']] }}
              />
              <FilterRow
                left={{ label: '좌석 타입', val: f.seatType, set: (v) => setF({ ...f, seatType: v as SeatType }),
                  opts: [['all','전체'],['free','자유석'],['fixed','고정석']] }}
                right={{ label: '이용권 종류', val: f.planType, set: (v) => setF({ ...f, planType: v as PlanType }),
                  opts: [['all','전체'],['oneshot','일회시간권'],['flat','정액시간권'],['period','기간권']] }}
              />
              <FilterRow
                left={{ label: '입실 여부', val: f.attendance, set: (v) => setF({ ...f, attendance: v as AttFilter }),
                  opts: [['all','전체'],['in','입실'],['temp_out','외출'],['out','퇴실']] }}
                right={{ label: '좌석 점유 여부', val: f.seatOccupy, set: (v) => setF({ ...f, seatOccupy: v as SeatOccupy }),
                  opts: [['all','전체'],['occupied','점유'],['free','미점유']], radio: true }}
              />
              <FilterRow
                left={{ label: '사물함 사용 여부', val: f.lockerUse, set: (v) => setF({ ...f, lockerUse: v as LockerUse }),
                  opts: [['all','전체'],['yes','사용'],['no','미사용']], radio: true }}
                right={{ label: '메시지 수신 여부', val: f.msgReceive, set: (v) => setF({ ...f, msgReceive: v as MsgReceive }),
                  opts: [['all','전체'],['on','수신'],['off','거부']], radio: true }}
              />
            </tbody>
          </table>
          <div className="flex justify-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-4">
            <button className="rounded-md bg-brand-600 px-8 py-2 text-sm font-semibold text-white hover:bg-brand-700" onClick={() => setApplied(f)}>검색</button>
            <button className="rounded-md bg-white px-8 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100" onClick={reset}>초기화</button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            🗒 엑셀 다운로드
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            페이지당 표시:
            <select className="input w-24 py-1" value={pageSize} onChange={(e) => setPageSize(+e.target.value)}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}개씩</option>)}
            </select>
          </label>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {['No','구분','성별','이름','상태','휴대폰','PIN번호','메시지','이용상태','좌석타입','이용권','좌석','사물함','시작일','종료일','잔여일시','이용기간','누적금액(원)','관리'].map((h) => (
                  <th key={h} className="px-2 py-2 text-center font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-center">
              {visible.length === 0 && (
                <tr><td colSpan={19} className="px-3 py-10 text-slate-400">조건에 맞는 회원이 없습니다.</td></tr>
              )}
              {visible.map((s, i) => {
                const a = att[s.id];
                const sub = currentSubOf(subs, s.id);
                const sumPaid = pays.filter((p) => p.studentId === s.id && p.status === 'approved').reduce((acc, p) => acc + p.amount, 0);
                // 이용상태: 활성 이용권 보유 여부로만 판단 (입실/외출은 별도 컬럼이 필요하면 추가).
                // 활성 이용권 있고 현재 입실 → 진한 색, 단순 보유 → 옅은 색, 없음 → 이용안함
                const useStateLabel = sub
                  ? (a?.state === 'in'
                      ? <span className="text-brand-700 font-semibold">이용중 · 입실</span>
                      : a?.state === 'temp_out'
                        ? <span className="text-brand-700">이용중 · <span className="text-amber-600">외출</span></span>
                        : <span className="text-brand-700">이용중</span>)
                  : <span className="text-rose-500">이용안함</span>;
                const endAt = sub?.endAt;
                const daysLeft = endAt ? Math.max(0, Math.round((endAt - Date.now()) / 86400000)) : null;
                const totalDays = sub?.planSnapshot.durationDays ?? null;
                return (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-2 text-slate-500">{i + 1}</td>
                    <td>{s.memberKind === 'adult' ? '성인' : '학생'}</td>
                    <td>{s.gender === 'M' ? '남성' : s.gender === 'F' ? '여성' : '-'}</td>
                    <td className="font-medium text-slate-800">{s.name}</td>
                    <td>{stateLabel(s.memberState)}</td>
                    <td className="text-slate-600">{fmtPhone(s.phone) || '-'}</td>
                    <td className="font-mono text-xs">{s.pin || '-'}</td>
                    <td className="text-xs">{s.msgReceive ? '수신' : '거부'}</td>
                    <td>{useStateLabel}</td>
                    <td>{sub ? '고정석' : '-'}</td>
                    <td>{sub ? '기간권' : '-'}</td>
                    <td>{(() => {
                      const seat = seatOfStudent(seats, s.id);
                      return seat ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{seat.label}</span> : '-';
                    })()}</td>
                    <td>{s.lockerId ?? '-'}</td>
                    <td className="text-xs text-slate-600">{sub ? new Date(sub.startAt).toISOString().slice(0, 10) : '-'}</td>
                    <td className="text-xs text-slate-600">{endAt ? new Date(endAt).toISOString().slice(0, 10) : '-'}</td>
                    <td className="text-xs">{daysLeft != null ? `${daysLeft}일` : '-'}</td>
                    <td className="text-xs">{totalDays ? `${String(totalDays).padStart(2,'0')}일` : '-'}</td>
                    <td className="text-xs text-slate-600">{sumPaid.toLocaleString()}</td>
                    <td>
                      <button className="rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-300 hover:bg-slate-100"
                        onClick={() => nav(`/ops/member/${s.id}`)}>상세</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500">전체 {filtered.length}명 중 {visible.length}명 표시</div>
      </div>
    </>
  );
}

function stateLabel(s?: 'normal' | 'restricted' | 'risk' | 'left') {
  if (s === 'restricted') return <span className="text-amber-600">제한</span>;
  if (s === 'risk') return <span className="text-rose-600">불량</span>;
  if (s === 'left') return <span className="text-slate-400">탈퇴</span>;
  return <span className="text-slate-700">정상</span>;
}

function FilterRow({ left, right }: {
  left: { label: string; val: string; set: (v: string) => void; opts: [string, string][]; radio?: boolean };
  right: { label: string; val: string; set: (v: string) => void; opts: [string, string][]; radio?: boolean };
}) {
  return (
    <tr className="border-b border-slate-100">
      <th className="w-32">{left.label}</th>
      <td><OptList {...left} /></td>
      <th className="w-24">{right.label}</th>
      <td><OptList {...right} /></td>
    </tr>
  );
}

function OptList({ val, set, opts, radio }: { val: string; set: (v: string) => void; opts: [string, string][]; radio?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      {opts.map(([v, label]) => (
        <label key={v} className="inline-flex cursor-pointer items-center gap-1.5">
          <input type={radio ? 'radio' : 'checkbox'} className="accent-brand-600"
            checked={val === v} onChange={() => set(v)} />
          {label}
        </label>
      ))}
    </div>
  );
}

function filter(
  list: LocalStudent[], f: Filters,
  att: Record<string, { state: 'in' | 'out' | 'temp_out' }>,
  subs: { studentId: string; status: string }[],
): LocalStudent[] {
  const q = f.search.trim();
  return list.filter((s) => {
    if (q && !s.name.includes(q) && !s.phone.includes(q)) return false;
    if (f.memberState !== 'all' && (s.memberState ?? 'normal') !== f.memberState) return false;
    if (f.memberKind !== 'all') {
      const k = s.memberKind ?? 'student';
      if (f.memberKind === 'unknown') { if (k === 'student' || k === 'adult') return false; }
      else if (k !== f.memberKind) return false;
    }
    if (f.gender !== 'all') {
      if (f.gender === 'unknown') { if (s.gender) return false; }
      else if (s.gender !== f.gender) return false;
    }
    if (f.attendance !== 'all') {
      const a = att[s.id]?.state;
      const map: Record<string, string> = { in: 'in', temp_out: 'temp_out', out: 'out' };
      if ((a ?? 'out') !== map[f.attendance]) return false;
    }
    if (f.lockerUse !== 'all') {
      const has = !!s.lockerId;
      if (f.lockerUse === 'yes' && !has) return false;
      if (f.lockerUse === 'no' && has) return false;
    }
    if (f.msgReceive !== 'all') {
      const on = s.msgReceive ?? true;
      if (f.msgReceive === 'on' && !on) return false;
      if (f.msgReceive === 'off' && on) return false;
    }
    if (f.useState !== 'all') {
      const hasActive = subs.some((x) => x.studentId === s.id && x.status === 'active');
      if (f.useState === 'using' && !hasActive) return false;
      if (f.useState === 'idle' && hasActive) return false;
    }
    return true;
  });
}
