import { PageHeader } from '../components/PageHeader';

export function Dashboard() {
  return (
    <>
      <PageHeader title="대시보드" desc="오늘 한눈에 보기" />
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="현재 입실 학생" value="0" hint="실시간" />
        <StatCard label="미입실 (예정 지난)" value="0" hint="자동 알림 대상" tone="danger" />
        <StatCard label="오늘 결제" value="0건" hint="0원" />
        <StatCard label="오늘 신규 등록" value="0명" />
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">최근 출입 로그</h3>
          <p className="text-sm text-slate-500">아직 데이터가 없습니다.</p>
        </div>
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">만료 임박 이용권</h3>
          <p className="text-sm text-slate-500">아직 데이터가 없습니다.</p>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'danger' | 'ok' }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === 'danger' ? 'text-red-600' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
