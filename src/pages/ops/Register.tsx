import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { useStudents, emptyStudent } from '../../store/students';
import { deviceAgent } from '../../lib/deviceAgent';

export function OpsRegister() {
  const add = useStudents((s) => s.add);
  const update = useStudents((s) => s.update);
  const nav = useNavigate();
  const [v, setV] = useState(emptyStudent());
  const [enrolling, setEnrolling] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  // PIN 을 직접 입력한 적 있는지. false 면 phone 뒷 4자리로 자동 동기화.
  const [pinTouched, setPinTouched] = useState(false);

  function updatePhone(phone: string) {
    const last4 = phone.replace(/\D/g, '').slice(-4);
    setV((prev) => ({
      ...prev,
      phone,
      pin: pinTouched ? prev.pin : (last4.length === 4 ? last4 : prev.pin),
    }));
  }
  function updatePin(pin: string) {
    setPinTouched(true);
    setV((prev) => ({ ...prev, pin: pin.replace(/\D/g, '').slice(0, 4) }));
  }

  function submit() {
    if (!v.name) return alert('성함은 필수입니다.');
    if (!v.pin || v.pin.length !== 4) return alert('PIN번호 4자리를 입력하세요.');
    const id = add(v);
    setNewId(id);
    alert('회원 등록 완료. 지문 등록을 진행하려면 "지문 등록" 버튼을 누르세요.');
  }

  function enrollFp() {
    const id = newId;
    if (!id) return alert('먼저 회원 등록을 완료하세요.');
    setEnrolling(true);
    const off = deviceAgent.on((e) => {
      if (e.type === 'fingerprint_enroll_done') {
        update(id, { fingerprintId: e.fingerprintId });
        setEnrolling(false);
        off();
        alert('지문 등록 완료');
      }
    });
    deviceAgent.send({ id: `e_${id}`, cmd: 'enroll_fingerprint', studentId: id });
  }

  return (
    <>
      <PageHeader title="👤+ 회원등록" />
      <div className="p-6">
        <div className="card p-6">
          <h3 className="mb-4 font-semibold">기본 회원 정보</h3>

          <div className="grid grid-cols-1 gap-y-3 md:grid-cols-12 md:gap-x-6 md:gap-y-4 text-sm">
            <Field label="성함" required col={4}>
              <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <Field label="" col={2}>
              <div className="flex h-9 items-center gap-1">
                <GenderToggle v={v.gender} onChange={(g) => setV({ ...v, gender: g })} />
              </div>
            </Field>
            <Field label="연락처" required col={4}>
              <input className="input" value={v.phone} onChange={(e) => updatePhone(e.target.value)} />
            </Field>
            <Field label="메시지 수신" col={2}>
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" className="accent-brand-600" checked={!!v.msgReceive}
                  onChange={(e) => setV({ ...v, msgReceive: e.target.checked })} />
                수신
              </label>
            </Field>

            <Field label="지문" col={6}>
              <div className="flex h-9 items-center gap-2">
                <button className="btn-secondary" disabled={!newId || enrolling} onClick={enrollFp}>
                  {enrolling ? '지문 인식 대기 중…' : '지문 등록'}
                </button>
                <span className="text-xs text-slate-500">{newId ? '회원 등록 후 진행 가능' : '회원등록을 해주세요.'}</span>
              </div>
            </Field>
            <Field label="PIN번호" required col={6}>
              <input className="input" maxLength={4} placeholder="4자리 (연락처 뒷자리 자동)" value={v.pin}
                onChange={(e) => updatePin(e.target.value)} />
            </Field>

            <Field label="생년월일" required col={4}>
              <input className="input" type="date" value={v.birthYmd ?? ''}
                onChange={(e) => setV({ ...v, birthYmd: e.target.value })} />
            </Field>
            <Field label="회원 구분" col={2}>
              <select className="input" value={v.memberKind ?? 'student'}
                onChange={(e) => setV({ ...v, memberKind: e.target.value as 'student' | 'adult' })}>
                <option value="student">학생</option>
                <option value="adult">성인</option>
              </select>
            </Field>
            <Field label="사물함" col={3}>
              <input className="input" value={v.lockerId ?? ''} placeholder="없음"
                onChange={(e) => setV({ ...v, lockerId: e.target.value })} />
            </Field>
            <Field label="신발장" col={3}>
              <input className="input" value={v.shoeId ?? ''} placeholder="없음"
                onChange={(e) => setV({ ...v, shoeId: e.target.value })} />
            </Field>

            <Field label="보호자" col={4}>
              <input className="input" placeholder="이름" value={''/* 보호자명 별도 필드 없음. memo 사용 가능 */} disabled />
            </Field>
            <Field label="보호자 연락처" col={6}>
              <input className="input" value={v.parentPhone ?? ''}
                onChange={(e) => setV({ ...v, parentPhone: e.target.value })} />
            </Field>
            <Field label="메시지 수신" col={2}>
              <label className="flex h-9 items-center gap-2">
                <input type="checkbox" className="accent-brand-600" checked={!!v.parentMsgReceive}
                  onChange={(e) => setV({ ...v, parentMsgReceive: e.target.checked })} />
                수신
              </label>
            </Field>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            {newId && (
              <button className="btn-secondary" onClick={() => nav(`/ops/member/${newId}`)}>회원 정보로 이동</button>
            )}
            <button className="rounded-md bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={submit} disabled={!!newId}>
              {newId ? '등록 완료' : '회원등록'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, required, children, col }: { label: string; required?: boolean; children: React.ReactNode; col: number }) {
  return (
    <div className={`col-span-${col}`} style={{ gridColumn: `span ${col} / span ${col}` }}>
      {label && (
        <label className="mb-1 block text-xs text-slate-600">
          {required && <span className="text-rose-500">*</span>} {label}
        </label>
      )}
      {children}
    </div>
  );
}

function GenderToggle({ v, onChange }: { v?: 'M' | 'F'; onChange: (g?: 'M' | 'F') => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md ring-1 ring-slate-300">
      {(['M', 'F'] as const).map((g) => (
        <button key={g} type="button" onClick={() => onChange(v === g ? undefined : g)}
          className={`px-3 py-1.5 text-sm ${v === g ? (g === 'M' ? 'bg-sky-500 text-white' : 'bg-pink-500 text-white') : 'bg-white text-slate-600'}`}>
          {g === 'M' ? '♂ 남' : '♀ 여'}
        </button>
      ))}
    </div>
  );
}
