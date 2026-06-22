import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useStudents } from '../store/students';
import { useAttendance } from '../store/attendance';
import { fmtDateTime } from '../lib/format';
import { isNoShow } from '../lib/noShow';
import { notify } from '../lib/notifications';

const LOG_TYPE_LABEL: Record<string, string> = {
  enter: '입실', exit: '퇴실', leave_temp: '외출', return: '복귀',
};

export function AttendancePage() {
  const students = useStudents((s) => s.list);
  const att = useAttendance();

  const noShows = useMemo(
    () => students.filter((s) => isNoShow(s, att.state[s.id])),
    [students, att.state],
  );
  const inside = useMemo(
    () => students.filter((s) => att.state[s.id]?.state === 'in'),
    [students, att.state],
  );

  function manualEnter(id: string) { att.enter(id, 'manual'); }
  function manualExit(id: string) { att.exit(id, 'manual'); }
  function notifyAllNoShow() {
    noShows.forEach((s) => {
      const slot = Object.values(s.schedule).find((x) => x?.start);
      notify.noShow(s, slot?.start ?? '');
    });
    alert(`${noShows.length}명 학부모에게 알림 발송 (콘솔/로그 확인)`);
  }

  return (
    <>
      <PageHeader
        title="출입 현황"
        desc="실시간 입퇴실 및 미입실 학생"
        actions={
          <button className="btn-primary" onClick={notifyAllNoShow} disabled={noShows.length === 0}>
            미입실 {noShows.length}명에게 알림 발송
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            현재 입실 ({inside.length})
          </div>
          {inside.length === 0 && <div className="p-6 text-center text-sm text-slate-400">없음</div>}
          <ul className="divide-y divide-slate-100">
            {inside.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">입실: {fmtDateTime(new Date(att.state[s.id].lastEnterAt ?? 0))}</div>
                </div>
                <button className="btn-secondary" onClick={() => manualExit(s.id)}>수동 퇴실</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            미입실 (예정 지남, {noShows.length})
          </div>
          {noShows.length === 0 && <div className="p-6 text-center text-sm text-slate-400">없음</div>}
          <ul className="divide-y divide-slate-100">
            {noShows.map((s) => {
              const slot = Object.values(s.schedule).find((x) => x?.start);
              return (
                <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      예정: {slot?.start ?? '-'} / 학부모: {s.parentPhone || '미등록'}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-secondary" onClick={() => manualEnter(s.id)}>수동 입실</button>
                    <button className="btn-secondary" onClick={() => slot?.start && notify.noShow(s, slot.start)}>알림</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">최근 로그</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-4 py-2 text-left">시각</th><th className="px-4 py-2 text-left">학생</th><th className="px-4 py-2 text-left">유형</th><th className="px-4 py-2 text-left">방식</th></tr>
            </thead>
            <tbody>
              {att.logs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">로그 없음</td></tr>
              )}
              {att.logs.slice(0, 30).map((l) => {
                const s = students.find((x) => x.id === l.studentId);
                return (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">{fmtDateTime(new Date(l.at))}</td>
                    <td className="px-4 py-2">{s?.name ?? '(삭제됨)'}</td>
                    <td className="px-4 py-2">{LOG_TYPE_LABEL[l.type] ?? l.type}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{l.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
