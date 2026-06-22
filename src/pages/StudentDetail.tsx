import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useStudents } from '../store/students';
import { useAttendance } from '../store/attendance';
import { usePoints } from '../store/points';
import { usePlans } from '../store/plans';
import { deviceAgent } from '../lib/deviceAgent';
import { fmtDateTime, fmtPhone } from '../lib/format';

export function StudentDetailPage() {
  const { id = '' } = useParams();
  const student = useStudents((s) => s.get(id));
  const updateStudent = useStudents((s) => s.update);
  const attLogs = useAttendance((s) => s.logs.filter((l) => l.studentId === id));
  const points = usePoints((s) => s.entries.filter((e) => e.studentId === id));
  const subs = usePlans((s) => s.subs.filter((x) => x.studentId === id));

  const [enroll, setEnroll] = useState<{ step: number; total: number } | null>(null);

  useEffect(() => {
    const off = deviceAgent.on((e) => {
      if (e.type === 'fingerprint_enroll_progress') setEnroll({ step: e.step, total: e.total });
      if (e.type === 'fingerprint_enroll_done') {
        setEnroll(null);
        if (student) updateStudent(student.id, { fingerprintId: e.fingerprintId });
        alert('지문 등록 완료');
      }
    });
    return () => { off(); };
  }, [student, updateStudent]);

  if (!student) {
    return (
      <>
        <PageHeader title="학생을 찾을 수 없습니다" />
        <div className="p-6"><Link to="/students" className="text-brand-600 hover:underline">← 학생 목록</Link></div>
      </>
    );
  }

  function startEnroll() {
    if (!student) return;
    setEnroll({ step: 0, total: 3 });
    deviceAgent.send({ id: `e_${student.id}`, cmd: 'enroll_fingerprint', studentId: student.id });
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
          <div className="text-sm font-semibold text-slate-700">지문 등록</div>
          <p className="mt-1 text-xs text-slate-500">
            현재: {student.fingerprintId ? <span className="font-mono text-emerald-700">{student.fingerprintId.slice(0, 16)}…</span> : <span className="text-slate-400">미등록</span>}
          </p>
          <button className="btn-primary mt-3 w-full" onClick={startEnroll} disabled={!!enroll}>
            {enroll ? `등록 중… ${enroll.step}/${enroll.total}` : '+ 지문 등록 시작'}
          </button>
          {student.fingerprintId && (
            <button className="btn-secondary mt-2 w-full" onClick={() => updateStudent(student.id, { fingerprintId: '' })}>지문 삭제</button>
          )}
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
