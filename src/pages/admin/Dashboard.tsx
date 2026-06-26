import { PageHeader } from '../../components/PageHeader';
import { useStudents } from '../../store/students';
import { useAttendance } from '../../store/attendance';
import { usePlans } from '../../store/plans';

export function Dashboard() {
  const students = useStudents((s) => s.list);
  const att = useAttendance();
  const { subs } = usePlans();

  const inCount = Object.values(att.state).filter((s) => s.state === 'in').length;
  const activeSubs = subs.filter((s) => s.status === 'active');
  const total = students.length || 1;
  const usingCount = activeSubs.length;
  const idleCount = total - usingCount;

  return (
    <>
      <PageHeader title="대시보드" desc={`최근 업데이트: ${new Date().toLocaleString('ko-KR')}`} />
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        {/* 매출 현황 — 결제선생 연동 후 활성 예정 */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-2 font-semibold text-slate-500">매출 현황 (준비 중)</h3>
          <p className="text-xs text-slate-400">결제선생 API 연동 완료 후 실시간 집계 표시 예정.</p>
        </div>

        {/* 출입문 / 공지 placeholder */}
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">출입문 개방</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">입실</span>
              <button className="rounded-md bg-slate-200 px-3 py-1.5 text-xs text-slate-600">🔒 잠금</button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">퇴실</span>
              <button className="rounded-md bg-slate-200 px-3 py-1.5 text-xs text-slate-600">🔒 잠금</button>
            </div>
          </div>
        </div>

        {/* 좌석/룸 이용 현황 */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold">좌석/룸 이용 현황</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { l: '전체 좌석', v: inCount, sub: `${Math.max(0, total - inCount)}석 잔여` },
              { l: '고정석', v: inCount, sub: `${Math.max(0, total - inCount)}석 잔여` },
              { l: '자유석', v: 0, sub: '0석 잔여' },
              { l: '스터디룸', v: 0, sub: '0룸 잔여' },
            ].map((d) => (
              <Donut key={d.l} value={d.v} label={d.l} sub={d.sub} />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 font-semibold">회원 이용현황</h3>
          <div className="flex items-center gap-4">
            <Donut value={total} label={`${total}명`} sub="" big />
            <ul className="space-y-1 text-xs">
              <li><span className="inline-block h-2 w-2 rounded-full bg-brand-600" /> 이용중 <b className="ml-1">{usingCount}</b></li>
              <li><span className="inline-block h-2 w-2 rounded-full bg-brand-300" /> 이용종료 <b className="ml-1">0</b></li>
              <li><span className="inline-block h-2 w-2 rounded-full bg-slate-300" /> 예약 <b className="ml-1">0</b></li>
              <li><span className="inline-block h-2 w-2 rounded-full bg-slate-200" /> 이용안함 <b className="ml-1">{idleCount}</b></li>
            </ul>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">메시지 현황</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">오늘 발송 수</span><b>0 건</b></div>
            <div className="flex justify-between"><span className="text-slate-500">SMS</span><span>0 건</span></div>
            <div className="flex justify-between"><span className="text-slate-500">LMS</span><span>0 건</span></div>
            <div className="mt-3 border-t border-slate-100 pt-2 text-xs">
              <div className="flex justify-between"><span>잔여 캐시</span><b>0 c</b></div>
              <div className="flex justify-between"><span>잔여 포인트</span><b>0 p</b></div>
            </div>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-3 font-semibold">최근 7일 매출 통계</h3>
          <p className="py-12 text-center text-sm text-slate-400">최근 7일 데이터가 수집되지 않았습니다.</p>
        </div>
      </div>
    </>
  );
}

function Donut({ value, label, sub, big }: { value: number; label: string; sub: string; big?: boolean }) {
  const size = big ? 110 : 80;
  return (
    <div className="flex flex-col items-center">
      <div className={`relative flex items-center justify-center rounded-full ${value > 0 ? 'bg-brand-100' : 'bg-slate-100'}`}
        style={{ width: size, height: size }}>
        <div className="rounded-full bg-white"
          style={{ width: size * 0.65, height: size * 0.65 }} />
        <div className="absolute text-center text-sm font-bold text-brand-700">
          {big ? label : `${value}석`}
          {!big && <div className="text-[10px] font-medium text-slate-500">이용</div>}
        </div>
      </div>
      {!big && (
        <>
          <div className="mt-2 text-sm font-semibold text-brand-700">{label}</div>
          <div className="text-[11px] text-slate-500">{sub}</div>
        </>
      )}
    </div>
  );
}
