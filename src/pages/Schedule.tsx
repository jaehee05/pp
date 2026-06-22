import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { useStudents } from '../store/students';
import { useSchedule, mondayOf, type LocalPlanItem } from '../store/schedule';
import { WEEKDAYS, WEEKDAY_LABEL, type WeekdayKey } from '../lib/types';

export function SchedulePage() {
  const students = useStudents((s) => s.list);
  const { items, add, remove } = useSchedule();
  const [studentId, setStudentId] = useState<string>(students[0]?.id ?? '');
  const [weekStart, setWeekStart] = useState<string>(mondayOf(new Date()));
  const [open, setOpen] = useState<{ weekday: WeekdayKey } | null>(null);

  const visible = useMemo(
    () => items.filter((x) => x.studentId === studentId && x.weekStart === weekStart),
    [items, studentId, weekStart],
  );

  function shiftWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(mondayOf(d));
  }

  return (
    <>
      <PageHeader
        title="학습 일정"
        desc="학생별 주간 학습 계획"
        actions={
          <>
            <select className="input w-40" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">학생 선택</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn-secondary" onClick={() => shiftWeek(-1)}>◀ 이전주</button>
            <span className="px-2 text-sm font-medium">{weekStart} 주</span>
            <button className="btn-secondary" onClick={() => shiftWeek(1)}>다음주 ▶</button>
          </>
        }
      />

      <div className="p-6">
        {!studentId && <div className="card p-10 text-center text-slate-400">학생을 선택하세요.</div>}
        {studentId && (
          <div className="grid grid-cols-7 gap-3">
            {WEEKDAYS.map((d) => {
              const dayItems = visible.filter((x) => x.weekday === d);
              return (
                <div key={d} className="card flex flex-col">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold">
                    {WEEKDAY_LABEL[d]}
                  </div>
                  <div className="flex-1 space-y-1.5 p-2">
                    {dayItems.length === 0 && <p className="py-6 text-center text-xs text-slate-300">없음</p>}
                    {dayItems.map((it) => (
                      <div key={it.id} className="group rounded-md border border-slate-200 bg-white p-2 text-xs">
                        <div className="text-[11px] font-semibold text-brand-600">{it.startTime}–{it.endTime}</div>
                        <div className="font-medium text-slate-800">{it.subject}</div>
                        {it.detail && <div className="text-slate-500">{it.detail}</div>}
                        <button className="mt-1 hidden text-[11px] text-red-500 group-hover:inline" onClick={() => remove(it.id)}>삭제</button>
                      </div>
                    ))}
                  </div>
                  <button className="border-t border-slate-200 py-1.5 text-xs text-slate-500 hover:bg-slate-50" onClick={() => setOpen({ weekday: d })}>+ 추가</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddItemModal
        open={!!open}
        onClose={() => setOpen(null)}
        weekday={open?.weekday ?? 'mon'}
        onAdd={(item) => add({ ...item, studentId, weekStart, weekday: open!.weekday })}
      />
    </>
  );
}

function AddItemModal({ open, onClose, weekday, onAdd }: {
  open: boolean; onClose: () => void; weekday: WeekdayKey;
  onAdd: (it: Omit<LocalPlanItem, 'id' | 'studentId' | 'weekStart' | 'weekday'>) => void;
}) {
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:30');
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  return (
    <Modal
      open={open} onClose={onClose}
      title={`${WEEKDAY_LABEL[weekday]}요일 항목 추가`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={() => { if (subject) { onAdd({ startTime, endTime, subject, detail }); onClose(); setSubject(''); setDetail(''); } }}>저장</button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label>시작<input className="input mt-1" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label>종료<input className="input mt-1" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
        </div>
        <label>과목/제목<input className="input mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 수학 모의고사 1세트" /></label>
        <label>상세<textarea className="input mt-1" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
      </div>
    </Modal>
  );
}
