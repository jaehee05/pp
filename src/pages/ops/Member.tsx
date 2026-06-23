import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { useStudents } from '../../store/students';
import { useAttendance } from '../../store/attendance';
import { usePlans } from '../../store/plans';
import { deviceAgent } from '../../lib/deviceAgent';
import { fmtDateTime, fmtMoney } from '../../lib/format';

type LogTab = 'member' | 'use' | 'pay';

export function OpsMember() {
  const { id = '' } = useParams();
  const student = useStudents((s) => s.get(id));
  const update = useStudents((s) => s.update);
  const att = useAttendance();
  const { subs, pays, plans } = usePlans();
  const [memo, setMemo] = useState(student?.memo ?? '');
  const [tab, setTab] = useState<LogTab>('member');
  const [planType, setPlanType] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const off = deviceAgent.on((e) => {
      if (e.type === 'fingerprint_enroll_done' && student) {
        update(student.id, { fingerprintId: e.fingerprintId });
        setEnrolling(false);
        alert('지문 등록 완료');
      }
    });
    return () => { off(); };
  }, [student, update]);

  if (!student) {
    return (
      <>
        <PageHeader title="회원을 찾을 수 없습니다" />
        <div className="p-6"><Link to="/admin/members" className="text-brand-600 hover:underline">← 회원 목록</Link></div>
      </>
    );
  }

  const sub = subs.filter((x) => x.studentId === student.id && x.status === 'active').sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0))[0];
  const a = att.state[student.id];
  const inside = a?.state === 'in' || a?.state === 'temp_out';

  function toggleIn() {
    if (!student) return;
    if (inside) att.exit(student.id, 'manual');
    else att.enter(student.id, 'manual');
  }
  function saveMemo() { update(student!.id, { memo }); }
  function startEnroll() {
    if (!student) return;
    setEnrolling(true);
    deviceAgent.send({ id: `e_${student.id}`, cmd: 'enroll_fingerprint', studentId: student.id });
  }
  function deleteFp() { if (student && confirm('지문을 삭제할까요?')) update(student.id, { fingerprintId: '' }); }

  const myLogs = att.logs.filter((l) => l.studentId === student.id);
  const myPays = pays.filter((p) => p.studentId === student.id);
  const useLogs = myLogs.filter((l) => l.type === 'enter' || l.type === 'exit');
  // 이용 시간 페어 계산
  const useSessions: { start: number; end: number }[] = [];
  for (let i = useLogs.length - 1; i >= 0; i--) {
    const l = useLogs[i];
    if (l.type === 'enter') {
      const nextExit = useLogs.slice(0, i).reverse().find((x) => x.type === 'exit' && x.at > l.at);
      useSessions.unshift({ start: l.at, end: nextExit?.at ?? Date.now() });
    }
  }

  return (
    <>
      <PageHeader title="👤+ 회원정보" />
      <div className="space-y-4 p-6">
        {/* 기본 회원 정보 */}
        <section className="card p-6">
          <h3 className="mb-4 font-semibold">기본 회원 정보</h3>
          <div className="grid grid-cols-12 gap-x-6 gap-y-4 text-sm">
            <Field label="성함" col={4}>
              <input className="input" value={student.name}
                onChange={(e) => update(student.id, { name: e.target.value })} />
            </Field>
            <Field label="" col={2}>
              <div className="flex h-9 items-center gap-1">
                <span className={`rounded px-2 py-1 text-xs ${student.gender === 'M' ? 'bg-sky-100 text-sky-700' : student.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>
                  {student.gender === 'M' ? '♂ 남' : student.gender === 'F' ? '♀ 여' : '미정'}
                </span>
              </div>
            </Field>
            <Field label="연락처" col={4}>
              <input className="input" value={student.phone}
                onChange={(e) => update(student.id, { phone: e.target.value })} />
            </Field>
            <Field label="메시지 수신" col={2}>
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" className="accent-brand-600" checked={!!student.msgReceive}
                  onChange={(e) => update(student.id, { msgReceive: e.target.checked })} />
                수신
              </label>
            </Field>

            <Field label="" col={2}>
              <button className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50">정상회원</button>
            </Field>
            <Field label="" col={2}>
              <button className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50"
                onClick={student.fingerprintId ? deleteFp : startEnroll} disabled={enrolling}>
                {student.fingerprintId ? '◉ 지문삭제' : enrolling ? '대기 중…' : '◯ 지문등록'}
              </button>
            </Field>
            <Field label="PIN번호" col={4}>
              <input className="input font-mono" maxLength={4} value={student.pin ?? ''}
                onChange={(e) => update(student.id, { pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            </Field>
            <div className="col-span-4" />

            <Field label="생년월일" col={4}>
              <input className="input" type="date" value={student.birthYmd ?? ''}
                onChange={(e) => update(student.id, { birthYmd: e.target.value })} />
            </Field>
            <Field label="회원 구분" col={2}>
              <select className="input" value={student.memberKind ?? 'student'}
                onChange={(e) => update(student.id, { memberKind: e.target.value as 'student' | 'adult' })}>
                <option value="student">학생</option>
                <option value="adult">성인</option>
              </select>
            </Field>
            <Field label="사물함" col={3}>
              <input className="input" value={student.lockerId ?? ''} placeholder="없음"
                onChange={(e) => update(student.id, { lockerId: e.target.value })} />
            </Field>
            <Field label="신발장" col={3}>
              <input className="input" value={student.shoeId ?? ''} placeholder="없음"
                onChange={(e) => update(student.id, { shoeId: e.target.value })} />
            </Field>

            <Field label="보호자" col={4}>
              <input className="input" placeholder="이름" disabled />
            </Field>
            <Field label="보호자 연락처" col={6}>
              <input className="input" value={student.parentPhone ?? ''}
                onChange={(e) => update(student.id, { parentPhone: e.target.value })} />
            </Field>
            <Field label="메시지 수신" col={2}>
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" className="accent-brand-600" checked={!!student.parentMsgReceive}
                  onChange={(e) => update(student.id, { parentMsgReceive: e.target.checked })} />
                수신
              </label>
            </Field>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button className={`rounded-md px-4 py-2 text-sm font-semibold ${inside ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
              onClick={toggleIn}>
              {inside ? '퇴실' : '입실'}
            </button>
            <button className="rounded-md bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-100">회원수정</button>
          </div>
        </section>

        {/* 메모 */}
        <section className="card p-6">
          <h3 className="mb-2 font-semibold">메모</h3>
          <textarea className="input min-h-[80px]" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <div className="mt-2 flex justify-end">
            <button className="rounded-md bg-white px-4 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-100" onClick={saveMemo}>저장</button>
          </div>
        </section>

        {/* 서비스 이용 정보 */}
        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">서비스 이용 정보</h3>
            <button className="rounded-md bg-white px-3 py-1.5 text-xs ring-1 ring-slate-300 hover:bg-slate-50">+ 더보기</button>
          </div>
          {!sub && <p className="py-6 text-center text-sm text-slate-400">등록된 이용권이 없습니다.</p>}
          {sub && (
            <div className="grid grid-cols-6 gap-y-3 text-sm">
              <Field2 label="이용권">{sub.planSnapshot.name}</Field2>
              <Field2 label="상태"><span className="text-emerald-600 font-semibold">이용중</span></Field2>
              <Field2 label="시작일">{new Date(sub.startAt).toISOString().slice(0, 10)}</Field2>
              <Field2 label="종료일">{sub.endAt ? new Date(sub.endAt).toISOString().slice(0, 10) : '-'}</Field2>
              <Field2 label="이용기간">{sub.planSnapshot.durationDays ? `${sub.planSnapshot.durationDays}일` : '-'}</Field2>
              <Field2 label="잔여기간">
                {sub.endAt ? `${Math.max(0, Math.round((sub.endAt - Date.now()) / 86400000))}일` : '-'}
              </Field2>
            </div>
          )}
        </section>

        {/* 3종 로그 */}
        <section className="card overflow-hidden">
          <div className="flex border-b border-slate-200">
            {(['member', 'use', 'pay'] as LogTab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-semibold transition ${
                  tab === t ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                {t === 'member' ? '회원로그' : t === 'use' ? '이용로그' : '결제로그'}
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto p-4 text-sm">
            {tab === 'member' && (
              <ol className="space-y-1">
                {myLogs.length === 0 && <li className="text-center text-slate-400">로그 없음</li>}
                {myLogs.slice(0, 50).map((l, i) => (
                  <li key={l.id} className="grid grid-cols-12 border-b border-slate-50 py-1.5 text-slate-600">
                    <span className="col-span-1 text-slate-400">{i + 1}</span>
                    <span className="col-span-4 font-mono">{fmtDateTime(new Date(l.at))}</span>
                    <span className="col-span-4 text-xs uppercase text-slate-400">OPERATION</span>
                    <span className="col-span-3 font-semibold">
                      {l.type === 'enter' ? '입실' : l.type === 'exit' ? '퇴실' : l.type === 'leave_temp' ? '외출' : '복귀'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {tab === 'use' && (
              <ol className="space-y-1">
                {useSessions.length === 0 && <li className="text-center text-slate-400">이용 세션 없음</li>}
                {useSessions.slice(0, 30).map((s, i) => {
                  const dur = Math.max(0, s.end - s.start);
                  const h = Math.floor(dur / 3600000);
                  const m = Math.floor((dur % 3600000) / 60000);
                  const sec = Math.floor((dur % 60000) / 1000);
                  return (
                    <li key={i} className="grid grid-cols-12 border-b border-slate-50 py-1.5 text-slate-600">
                      <span className="col-span-1 text-slate-400">{i + 1}</span>
                      <span className="col-span-4 text-brand-700">{`${String(h).padStart(2,'0')}시간 ${String(m).padStart(2,'0')}분 ${String(sec).padStart(2,'0')}초`}</span>
                      <span className="col-span-7 font-mono text-xs">
                        {new Date(s.start).toISOString().replace('T',' ').slice(0,19)} ~ {new Date(s.end).toISOString().replace('T',' ').slice(0,19)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {tab === 'pay' && (
              <ol className="space-y-1">
                {myPays.length === 0 && <li className="text-center text-slate-400">결제 내역 없음</li>}
                {myPays.slice(0, 30).map((p, i) => (
                  <li key={p.id} className="grid grid-cols-12 border-b border-slate-50 py-1.5 text-slate-600">
                    <span className="col-span-1 text-slate-400">{i + 1}</span>
                    <span className="col-span-3 font-mono">{new Date(p.createdAt).toISOString().slice(2, 10).replace(/-/g, '.')}</span>
                    <span className={`col-span-2 font-semibold ${p.status === 'approved' ? 'text-emerald-600' : p.status === 'failed' ? 'text-rose-600' : 'text-slate-500'}`}>
                      {p.status === 'approved' ? '결제완료' : p.status === 'failed' ? '실패' : p.status === 'cancelled' ? '환불' : '대기'}
                    </span>
                    <span className="col-span-2 text-right">{fmtMoney(p.amount)}</span>
                    <span className="col-span-4 text-xs text-slate-500">
                      {plans.find((pl) => pl.id === p.planId)?.name}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* 이용권 선택 (신규 발급) */}
        <section className="card p-6">
          <h3 className="mb-3 font-semibold">이용권 선택</h3>
          <div className="grid grid-cols-12 gap-x-4 gap-y-3 text-sm">
            <Field label="좌석타입" col={3}>
              <select className="input" value={planType} onChange={(e) => setPlanType(e.target.value)}>
                <option value="">좌석타입 선택</option>
                <option value="fixed">고정석</option>
                <option value="free">자유석</option>
              </select>
            </Field>
            <Field label="좌석" col={3}>
              <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">좌석 선택</option>
              </select>
            </Field>
            <Field label="시작일" col={3}>
              <input className="input" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="" col={3}>
              <label className="flex h-9 items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" className="accent-brand-600" /> 숨긴 이용권 보기
              </label>
            </Field>
          </div>
          <div className="mt-3 rounded-md bg-slate-50 p-8 text-center text-sm text-slate-400">
            등록된 이용권이 없습니다.
          </div>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-semibold">결제수단 및 결제금액</h3>
            <button className="rounded-md bg-white px-3 py-1.5 text-xs ring-1 ring-slate-300 hover:bg-slate-50">분할결제</button>
          </div>
          <div className="mt-4 grid grid-cols-12 items-center gap-3 text-sm">
            <span className="col-span-1 text-slate-400">1</span>
            <div className="col-span-3">
              <div className="inline-flex overflow-hidden rounded-md ring-1 ring-slate-300">
                <button className="bg-brand-100 px-4 py-1.5 text-sm text-brand-700">카드</button>
                <button className="bg-white px-4 py-1.5 text-sm text-slate-600">현금</button>
              </div>
            </div>
            <input className="input col-span-8 text-right font-mono" placeholder="0" />
          </div>
          <div className="mt-4 text-right text-sm">총 결제금액 <b className="ml-2 text-lg">0</b> 원</div>
          <button className="mt-4 w-full rounded-md bg-slate-200 py-3 text-sm font-semibold text-slate-500" disabled>결제하기</button>
        </section>
      </div>
    </>
  );
}

function Field({ label, children, col }: { label: string; children: React.ReactNode; col: number }) {
  return (
    <div style={{ gridColumn: `span ${col} / span ${col}` }}>
      {label && <label className="mb-1 block text-xs text-slate-600">{label}</label>}
      {children}
    </div>
  );
}
function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="col-span-1 text-xs text-slate-500">{label}</div>
      <div className="col-span-2 text-sm">{children}</div>
    </>
  );
}
