import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { useStudents } from '../store/students';
import { usePoints } from '../store/points';
import { fmtDateTime } from '../lib/format';

export function PointsPage() {
  const students = useStudents((s) => s.list);
  const { entries, add, remove } = usePoints();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');

  const totals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries) m[e.studentId] = (m[e.studentId] ?? 0) + e.delta;
    return m;
  }, [entries]);

  function submit() {
    if (!studentId || !reason) return;
    add({ studentId, delta, reason, category });
    setOpen(false);
    setStudentId('');
    setReason('');
    setCategory('');
    setDelta(1);
  }

  return (
    <>
      <PageHeader
        title="상·벌점 관리"
        desc="학생별 상·벌점 부여 및 누적 조회"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>+ 점수 부여</button>}
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-1">
          <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold">학생별 누적</div>
          <ul className="divide-y divide-slate-100">
            {students.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">학생 없음</li>}
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{s.name}</span>
                <span className={`font-bold ${(totals[s.id] ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {totals[s.id] >= 0 ? '+' : ''}{totals[s.id] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold">최근 이력</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-3 py-2 text-left">시각</th><th className="px-3 py-2">학생</th><th className="px-3 py-2 text-right">점수</th><th className="px-3 py-2 text-left">사유</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">없음</td></tr>}
              {entries.map((e) => {
                const s = students.find((x) => x.id === e.studentId);
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{fmtDateTime(new Date(e.createdAt))}</td>
                    <td className="px-3 py-2">{s?.name ?? '-'}</td>
                    <td className={`px-3 py-2 text-right font-bold ${e.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{e.delta > 0 ? '+' : ''}{e.delta}</td>
                    <td className="px-3 py-2">{e.reason} {e.category && <span className="text-xs text-slate-400">({e.category})</span>}</td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => remove(e.id)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="점수 부여"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>취소</button>
            <button className="btn-primary" onClick={submit}>저장</button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <label>학생
            <select className="input mt-1" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">선택</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>점수 (양수=상점, 음수=벌점)
            <input className="input mt-1" type="number" value={delta} onChange={(e) => setDelta(+e.target.value)} />
          </label>
          <label>사유
            <input className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 자습 태도 우수" />
          </label>
          <label>분류 (선택)
            <input className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 태도/지각/성취" />
          </label>
        </div>
      </Modal>
    </>
  );
}
