import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { useStudents, emptyStudent, type LocalStudent } from '../store/students';
import { fmtPhone } from '../lib/format';
import { useAttendance } from '../store/attendance';
import { isNoShow } from '../lib/noShow';
import { WEEKDAYS, WEEKDAY_LABEL } from '../lib/types';

export function StudentsPage() {
  const list = useStudents((s) => s.list);
  const add = useStudents((s) => s.add);
  const update = useStudents((s) => s.update);
  const remove = useStudents((s) => s.remove);
  const attendance = useAttendance((s) => s.state);

  const [query, setQuery] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      (s.parentPhone ?? '').includes(q),
    );
  }, [list, query]);

  const editing = list.find((s) => s.id === editId) ?? null;

  return (
    <>
      <PageHeader
        title="학생 관리"
        desc={`등록된 학생: ${list.length}명`}
        actions={
          <>
            <input className="input w-56" placeholder="이름·전화 검색"
              value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn-primary" onClick={() => setOpenNew(true)}>+ 신규 등록</button>
          </>
        }
      />

      <div className="p-6">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3">학부모</th>
                <th className="px-4 py-3">학교/학년</th>
                <th className="px-4 py-3">현재 상태</th>
                <th className="px-4 py-3">알림 수신</th>
                <th className="px-4 py-3 text-right">동작</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">등록된 학생이 없습니다.</td></tr>
              )}
              {filtered.map((s) => {
                const att = attendance[s.id];
                const noShow = isNoShow(s, att);
                const liveLabel = att?.state === 'in' ? '입실 중'
                  : att?.state === 'temp_out' ? '외출 중'
                  : noShow ? '미입실 ⚠️'
                  : '미입실';
                return (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/students/${s.id}`} className="text-brand-700 hover:underline">{s.name || '(이름없음)'}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmtPhone(s.phone)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtPhone(s.parentPhone || '')}</td>
                    <td className="px-4 py-3 text-slate-600">{[s.school, s.grade].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={
                        att?.state === 'in' ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700'
                          : att?.state === 'temp_out' ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700'
                          : noShow ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700'
                          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'
                      }>{liveLabel}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {s.notify.studentEnterExit && '본인 '}
                      {s.notify.parentEnterExit && '학부모 '}
                      {!s.notify.studentEnterExit && !s.notify.parentEnterExit && '꺼짐'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-secondary mr-1" onClick={() => setEditId(s.id)}>수정</button>
                      <button className="btn-danger" onClick={() => confirm(`${s.name} 삭제할까요?`) && remove(s.id)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <StudentFormModal
        open={openNew}
        title="신규 학생 등록"
        initial={emptyStudent()}
        onClose={() => setOpenNew(false)}
        onSubmit={(v) => { add(v); setOpenNew(false); }}
      />
      <StudentFormModal
        open={!!editing}
        title="학생 정보 수정"
        initial={editing ?? emptyStudent()}
        onClose={() => setEditId(null)}
        onSubmit={(v) => { if (editing) update(editing.id, v); setEditId(null); }}
      />
    </>
  );
}

function StudentFormModal({
  open, onClose, onSubmit, title, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: Omit<LocalStudent, 'id' | 'joinedAt' | 'pointsTotal'>) => void;
  title: string;
  initial: Omit<LocalStudent, 'id' | 'joinedAt' | 'pointsTotal'>;
}) {
  const [v, setV] = useState(initial);
  // reset when reopening
  if (open && v.name !== initial.name && v === initial) setV(initial);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={() => onSubmit(v)}>저장</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label>이름<input className="input mt-1" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <label>성별
          <select className="input mt-1" value={v.gender ?? ''} onChange={(e) => setV({ ...v, gender: (e.target.value || undefined) as 'M' | 'F' | undefined })}>
            <option value="">선택</option>
            <option value="M">남 ♂</option>
            <option value="F">여 ♀</option>
          </select>
        </label>
        <label className="col-span-2">연락처<input className="input mt-1" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
        <label>학부모 연락처<input className="input mt-1" value={v.parentPhone ?? ''} onChange={(e) => setV({ ...v, parentPhone: e.target.value })} /></label>
        <label>학교<input className="input mt-1" value={v.school ?? ''} onChange={(e) => setV({ ...v, school: e.target.value })} /></label>
        <label>학년<input className="input mt-1" value={v.grade ?? ''} onChange={(e) => setV({ ...v, grade: e.target.value })} /></label>
        <label>상태
          <select className="input mt-1" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as LocalStudent['status'] })}>
            <option value="active">이용중</option>
            <option value="leaving">퇴원 예정</option>
            <option value="paused">일시정지</option>
            <option value="left">퇴실</option>
          </select>
        </label>
        <label className="col-span-2">메모<textarea className="input mt-1" rows={2} value={v.memo ?? ''} onChange={(e) => setV({ ...v, memo: e.target.value })} /></label>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold text-slate-500">알림 수신 설정</div>
        <div className="space-y-2 text-sm">
          {(['studentEnterExit', 'parentEnterExit', 'parentLateMiss'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={v.notify[k]} onChange={(e) => setV({ ...v, notify: { ...v.notify, [k]: e.target.checked } })} />
              {k === 'studentEnterExit' && '학생 본인에게 입퇴실 알림'}
              {k === 'parentEnterExit' && '학부모에게 입퇴실 알림'}
              {k === 'parentLateMiss' && '학부모에게 미입실 알림'}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold text-slate-500">입실 예정 시간 (요일별)</div>
        <div className="space-y-1.5">
          {WEEKDAYS.map((d) => {
            const slot = v.schedule[d] ?? null;
            const on = !!slot;
            return (
              <div key={d} className="flex items-center gap-2 text-sm">
                <label className="flex w-20 items-center gap-1">
                  <input type="checkbox" checked={on}
                    onChange={(e) => setV({ ...v, schedule: { ...v.schedule, [d]: e.target.checked ? { start: '14:00', end: '22:00' } : null } })} />
                  {WEEKDAY_LABEL[d]}
                </label>
                <input className="input w-28" type="time" disabled={!on}
                  value={slot?.start ?? ''}
                  onChange={(e) => setV({ ...v, schedule: { ...v.schedule, [d]: { start: e.target.value, end: slot?.end ?? '22:00' } } })} />
                <span className="text-slate-400">~</span>
                <input className="input w-28" type="time" disabled={!on}
                  value={slot?.end ?? ''}
                  onChange={(e) => setV({ ...v, schedule: { ...v.schedule, [d]: { start: slot?.start ?? '14:00', end: e.target.value } } })} />
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
