import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useStudents } from '../store/students';
import { useAttendance } from '../store/attendance';
import { usePoints } from '../store/points';
import { usePlans } from '../store/plans';
import { fmtDateTime, fmtPhone } from '../lib/format';

export function StudentDetailPage() {
  const { id = '' } = useParams();
  const student = useStudents((s) => s.get(id));
  const attLogs = useAttendance((s) => s.logs.filter((l) => l.studentId === id));
  const points = usePoints((s) => s.entries.filter((e) => e.studentId === id));
  const subs = usePlans((s) => s.subs.filter((x) => x.studentId === id));

  if (!student) {
    return (
      <>
        <PageHeader title="학생을 찾을 수 없습니다" />
        <div className="p-6"><Link to="/students" className="text-brand-600 hover:underline">← 학생 목록</Link></div>
      </>
    );
  }

  const pointTotal = points.reduce((a, e) => a + e.delta, 0);

  return (
    <>
      <PageHeader
        title={student.name}
        desc={`${fmtPhone(student.phone)} · ${[student.school, student.grade].filter(Boolean).join(' / ') || '학교 미등록'}`}
        actions={<Link to="/students" className="btn-secondary">← 목록</Link>}
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-700">PIN</div>
          <p className="mt-1 text-xs text-slate-500">
            현재: {student.pin ? <span className="font-mono text-emerald-700">{student.pin}</span> : <span className="text-slate-400">미설정</span>}
          </p>
          <p className="mt-3 text-[11px] text-slate-400">
            회원등록 시 연락처 뒷 4자리로 자동 설정됩니다. 회원 정보에서 수정 가능.
          </p>
        </div>

        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-700">상·벌점 누적</div>
          <div className={`mt-2 text-3xl font-bold ${pointTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {pointTotal >= 0 ? '+' : ''}{pointTotal}
          </div>
          <Link to="/points" className="mt-2 inline-block text-xs text-brand-600 hover:underline">전체 이력 →</Link>
        </div>

        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-700">활성 이용권</div>
          {subs.filter((s) => s.status === 'active').length === 0
            ? <p className="mt-2 text-sm text-slate-400">없음</p>
            : subs.filter((s) => s.status === 'active').map((s) => (
              <div key={s.id} className="mt-2 text-sm">
                <div className="font-medium">{s.planSnapshot.name}</div>
                <div className="text-xs text-slate-500">{s.endAt ? fmtDateTime(new Date(s.endAt)) + ' 만료' : ''}</div>
              </div>
            ))}
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold">최근 출입</div>
          <table className="w-full text-sm">
            <tbody>
              {attLogs.length === 0 && <tr><td className="px-3 py-6 text-center text-slate-400">로그 없음</td></tr>}
              {attLogs.slice(0, 20).map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{fmtDateTime(new Date(l.at))}</td>
                  <td className="px-3 py-2">{l.type}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-700">알림 수신</div>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <div>{student.notify.studentEnterExit ? '✅' : '❌'} 본인 입퇴실</div>
            <div>{student.notify.parentEnterExit ? '✅' : '❌'} 학부모 입퇴실</div>
            <div>{student.notify.parentLateMiss ? '✅' : '❌'} 학부모 미입실</div>
          </div>
        </div>
      </div>
    </>
  );
}
