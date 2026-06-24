import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { deviceAgent, type DeviceEvent } from '../lib/deviceAgent';
import { useStudents, type LocalStudent } from '../store/students';
import { useAttendance } from '../store/attendance';
import { usePlans } from '../store/plans';
import { useBranding } from '../store/branding';
import { useAuth, type Account } from '../store/auth';

type Person = { kind: 'student'; data: LocalStudent } | { kind: 'admin'; data: Account };
type Screen =
  | { kind: 'idle' }
  | { kind: 'pickAction'; person: Person }
  | { kind: 'done'; person: Person; action: '입실' | '퇴실' | '외출' | '복귀' }
  | { kind: 'error'; message: string };

function nameOf(p: Person) { return p.data.name; }

const IDLE_TIMEOUT_MS = 30_000;
const DONE_TIMEOUT_MS = 3_500;

export function KioskPage() {
  const students = useStudents((s) => s.list);
  const accounts = useAuth((s) => s.accounts);
  const att = useAttendance();
  const subs = usePlans((s) => s.subs);
  const { brand, storeName } = useBranding();

  const [agentConnected, setAgentConnected] = useState(false);
  const [pin, setPin] = useState('');
  const [screen, setScreen] = useState<Screen>({ kind: 'idle' });
  const [now, setNow] = useState(() => new Date());
  const idleTimerRef = useRef<number | null>(null);

  // 1초마다 시계 갱신
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 디바이스 에이전트 (지문기 — BioStar 연결 시) 이벤트
  useEffect(() => {
    const off = deviceAgent.on((e: DeviceEvent) => {
      if (e.type === 'connected') setAgentConnected(true);
      else if (e.type === 'disconnected') setAgentConnected(false);
      else if (e.type === 'fingerprint_scan') {
        // BioStar 사용자 ID 매칭: 학생 우선, 없으면 관리자
        const s = students.find((x) => x.fingerprintId === e.fingerprintId);
        if (s) { processStudent({ kind: 'student', data: s }); return; }
        const a = accounts.find((x) => x.fingerprintId === e.fingerprintId);
        if (a && a.enableKioskAccess !== false) processStudent({ kind: 'admin', data: a });
      }
    });
    deviceAgent.connect();
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, accounts]);

  // 아이들 자동 리셋
  function resetIdleTimer() {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setPin('');
      setScreen({ kind: 'idle' });
    }, IDLE_TIMEOUT_MS);
  }
  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current); };
  }, [pin, screen.kind]);

  // 활성 이용권 보유 여부
  function hasActiveSub(studentId: string): boolean {
    return subs.some((s) => s.studentId === studentId && s.status === 'active');
  }

  // 회원/관리자 식별 후 다음 화면 결정
  function processStudent(p: Person) {
    // 학생은 활성 이용권 필요. 관리자는 항상 통과.
    if (p.kind === 'student' && !hasActiveSub(p.data.id)) {
      setScreen({ kind: 'error', message: `${p.data.name}님 — 활성 이용권이 없습니다. 카운터에 문의하세요.` });
      setPin('');
      window.setTimeout(() => setScreen({ kind: 'idle' }), DONE_TIMEOUT_MS);
      return;
    }
    // 출입 기록 ID — 학생/관리자 구분
    const recordId = p.kind === 'admin' ? `admin_${p.data.id}` : p.data.id;
    const cur = att.state[recordId];
    if (cur?.state === 'temp_out') {
      att.returnFromTemp(recordId, 'fingerprint');
      setScreen({ kind: 'done', person: p, action: '복귀' });
      setPin('');
      window.setTimeout(() => setScreen({ kind: 'idle' }), DONE_TIMEOUT_MS);
      return;
    }
    if (cur?.state === 'in') {
      setScreen({ kind: 'pickAction', person: p });
      setPin('');
      return;
    }
    att.enter(recordId, 'fingerprint');
    setScreen({ kind: 'done', person: p, action: '입실' });
    setPin('');
    window.setTimeout(() => setScreen({ kind: 'idle' }), DONE_TIMEOUT_MS);
  }

  // PIN 입력
  function pressKey(k: string) {
    if (screen.kind !== 'idle' && screen.kind !== 'error') return;
    if (screen.kind === 'error') setScreen({ kind: 'idle' });
    if (k === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (k === 'enter') {
      tryIdentify(pin);
      return;
    }
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + k;
      // 4자리 채워지면 자동 시도
      if (next.length === 4) {
        window.setTimeout(() => tryIdentify(next), 100);
      }
      return next;
    });
  }

  function tryIdentify(p: string) {
    if (p.length === 0) return;
    const padded = p.padStart(4, '0');
    // 1) 학생 먼저 매칭
    const stMatched = students.filter((s) => (s.pin ?? '').padStart(4, '0') === padded);
    if (stMatched.length > 0) {
      processStudent({ kind: 'student', data: stMatched[0] });
      return;
    }
    // 2) 관리자 PIN
    const adMatched = accounts.filter((a) =>
      a.enableKioskAccess !== false &&
      (a.kioskPin ?? '').padStart(4, '0') === padded,
    );
    if (adMatched.length > 0) {
      processStudent({ kind: 'admin', data: adMatched[0] });
      return;
    }
    setScreen({ kind: 'error', message: `PIN ${p} — 일치하는 회원/관리자가 없습니다.` });
    setPin('');
    window.setTimeout(() => setScreen({ kind: 'idle' }), DONE_TIMEOUT_MS);
  }

  function recordIdOf(p: Person) { return p.kind === 'admin' ? `admin_${p.data.id}` : p.data.id; }
  function doExit() {
    if (screen.kind !== 'pickAction') return;
    att.exit(recordIdOf(screen.person), 'fingerprint');
    setScreen({ kind: 'done', person: screen.person, action: '퇴실' });
    window.setTimeout(() => setScreen({ kind: 'idle' }), DONE_TIMEOUT_MS);
  }
  function doTempOut() {
    if (screen.kind !== 'pickAction') return;
    att.leaveTemp(recordIdOf(screen.person), 'fingerprint');
    setScreen({ kind: 'done', person: screen.person, action: '외출' });
    window.setTimeout(() => setScreen({ kind: 'idle' }), DONE_TIMEOUT_MS);
  }
  function cancel() {
    setScreen({ kind: 'idle' });
    setPin('');
  }

  // 현재 입실 통계
  const insideCount = useMemo(
    () => Object.values(att.state).filter((s) => s.state === 'in' || s.state === 'temp_out').length,
    [att.state],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-900 text-white">
      {/* 상단바 */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
          <div>
            <div className="text-lg font-bold">{brand}</div>
            <div className="text-xs text-slate-400">{storeName}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">
              {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}<span className="text-base text-slate-400">:{String(now.getSeconds()).padStart(2, '0')}</span>
            </div>
            <div className="text-xs text-slate-400">
              {now.getFullYear()}.{String(now.getMonth() + 1).padStart(2, '0')}.{String(now.getDate()).padStart(2, '0')} · 현재 {insideCount}명
            </div>
          </div>
          <Link to="/admin/dashboard" className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">
            관리자 →
          </Link>
        </div>
      </header>

      {/* 메인 */}
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        {screen.kind === 'idle' && (
          <IdleScreen pin={pin} onKey={pressKey} agentConnected={agentConnected} />
        )}
        {screen.kind === 'pickAction' && (
          <PickActionScreen person={screen.person} onExit={doExit} onTemp={doTempOut} onCancel={cancel} />
        )}
        {screen.kind === 'done' && (
          <DoneScreen person={screen.person} action={screen.action} />
        )}
        {screen.kind === 'error' && (
          <ErrorScreen message={screen.message} onClose={() => setScreen({ kind: 'idle' })} />
        )}
      </main>

      {/* 하단 상태바 */}
      <footer className="border-t border-white/10 px-6 py-2 text-xs text-slate-500">
        <span className={`mr-1 inline-block h-2 w-2 rounded-full ${agentConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
        지문 인식기 {agentConnected ? '연결됨' : '미연결 (PIN 사용)'}
        <span className="ml-4 text-slate-600">PIN 4자리 입력 또는 지문 인식</span>
      </footer>
    </div>
  );
}

// ====================== 화면들 ======================

function IdleScreen({ pin, onKey, agentConnected }: { pin: string; onKey: (k: string) => void; agentConnected: boolean }) {
  const KEYS: { label: string; val: string; cls?: string }[] = [
    { label: '1', val: '1' }, { label: '2', val: '2' }, { label: '3', val: '3' },
    { label: '4', val: '4' }, { label: '5', val: '5' }, { label: '6', val: '6' },
    { label: '7', val: '7' }, { label: '8', val: '8' }, { label: '9', val: '9' },
    { label: '←', val: 'back', cls: 'bg-slate-700' },
    { label: '0', val: '0' },
    { label: '⏎', val: 'enter', cls: 'bg-brand-600' },
  ];
  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <h1 className="mb-3 text-3xl font-bold">PIN을 눌러주세요</h1>
      <p className="mb-6 text-sm text-slate-400">
        {agentConnected ? '지문 인식기에 손가락을 올려도 됩니다' : '회원 등록 시 받은 PIN 4자리를 입력하세요'}
      </p>

      <div className="mb-8 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-14 w-14 rounded-xl border-2 ${
            pin.length > i
              ? 'border-brand-500 bg-brand-500/30'
              : 'border-white/20'
          } flex items-center justify-center text-3xl font-bold`}>
            {pin.length > i ? '●' : ''}
          </div>
        ))}
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k.val}
            onClick={() => onKey(k.val)}
            className={`h-20 rounded-2xl text-3xl font-bold transition active:scale-95 ${
              k.cls ?? 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickActionScreen({ person, onExit, onTemp, onCancel }: {
  person: Person;
  onExit: () => void;
  onTemp: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <div className="text-sm text-slate-400">현재 입실 중{person.kind === 'admin' && ' (관리자)'}</div>
        <div className="mt-1 text-5xl font-bold">{nameOf(person)}</div>
      </div>
      <p className="text-xl text-slate-300">어떻게 하시겠습니까?</p>
      <div className="flex gap-4">
        <button onClick={onTemp}
          className="rounded-2xl bg-amber-500 px-10 py-8 text-2xl font-bold text-white hover:bg-amber-600 active:scale-95">
          🚶 외출
        </button>
        <button onClick={onExit}
          className="rounded-2xl bg-rose-600 px-10 py-8 text-2xl font-bold text-white hover:bg-rose-700 active:scale-95">
          🚪 퇴실
        </button>
      </div>
      <button onClick={onCancel} className="text-sm text-slate-400 underline hover:text-white">
        취소
      </button>
    </div>
  );
}

function DoneScreen({ person, action }: { person: Person; action: '입실' | '퇴실' | '외출' | '복귀' }) {
  const tone =
    action === '입실' || action === '복귀' ? 'text-emerald-400'
    : action === '외출' ? 'text-amber-400'
    : 'text-sky-400';
  const emoji = { 입실: '✅', 복귀: '↩️', 외출: '🚶', 퇴실: '👋' }[action];
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-7xl">{emoji}</div>
      <div className="text-4xl font-bold text-white">
        {nameOf(person)}{person.kind === 'admin' && <span className="ml-2 text-base text-slate-400">관리자</span>}
      </div>
      <div className={`text-3xl font-bold ${tone}`}>{action} 처리되었습니다</div>
      <div className="text-sm text-slate-400">
        {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

function ErrorScreen({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-6xl">⚠️</div>
      <div className="max-w-md text-center text-xl font-semibold text-rose-300">{message}</div>
      <button onClick={onClose} className="mt-4 rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
        닫기
      </button>
    </div>
  );
}
