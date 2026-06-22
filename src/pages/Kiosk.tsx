import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deviceAgent, type DeviceEvent } from '../lib/deviceAgent';
import { useStudents } from '../store/students';
import { useAttendance } from '../store/attendance';

type Mode = 'idle' | 'leave_prompt';

export function KioskPage() {
  const students = useStudents((s) => s.list);
  const att = useAttendance();
  const [agentConnected, setAgentConnected] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [pendingAction, setPendingAction] = useState<'exit' | 'leave_temp' | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  useEffect(() => {
    const off = deviceAgent.on((e: DeviceEvent) => {
      if (e.type === 'connected') setAgentConnected(true);
      if (e.type === 'disconnected') setAgentConnected(false);
      if (e.type === 'fingerprint_scan') {
        const student = students.find((s) => s.fingerprintId === e.fingerprintId);
        if (!student) {
          // mock 모드에서는 첫 학생으로 폴백 (시연용)
          const fallback = students[0];
          if (!fallback) return showFlash('err', '등록된 학생이 없습니다');
          return handleScan(fallback.id);
        }
        handleScan(student.id);
      }
    });
    deviceAgent.connect();
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, mode, pendingAction]);

  function handleScan(studentId: string) {
    const cur = att.state[studentId];
    const s = students.find((x) => x.id === studentId);
    if (!s) return;
    if (mode === 'leave_prompt' && pendingAction) {
      if (pendingAction === 'exit') att.exit(studentId, 'fingerprint');
      else att.leaveTemp(studentId, 'fingerprint');
      setMode('idle');
      setPendingAction(null);
      return showFlash('ok', `${s.name}님 ${pendingAction === 'exit' ? '퇴실' : '외출'} 처리`);
    }
    if (cur?.state === 'in') {
      // 이미 입실 중인데 그냥 지문 → 안내
      return showFlash('info', `${s.name}님은 이미 입실 중. 외출/퇴실 버튼을 먼저 누르세요.`);
    }
    if (cur?.state === 'temp_out') {
      att.returnFromTemp(studentId, 'fingerprint');
      return showFlash('ok', `${s.name}님 복귀 처리`);
    }
    att.enter(studentId, 'fingerprint');
    showFlash('ok', `${s.name}님 입실 처리`);
  }

  function showFlash(kind: 'ok' | 'err' | 'info', text: string) {
    setFlash({ kind, text });
    setTimeout(() => setFlash(null), 3000);
  }

  function requestLeave(action: 'exit' | 'leave_temp') {
    setPendingAction(action);
    setMode('leave_prompt');
    deviceAgent.send({ id: 'k1', cmd: 'identify_fingerprint' });
    showFlash('info', `지문을 인식해주세요 (${action === 'exit' ? '퇴실' : '외출'})`);
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white">
      <Link to="/dashboard" className="absolute right-4 top-4 text-xs text-slate-400 hover:text-white">관리자 화면 →</Link>
      <div className="absolute left-4 top-4 flex items-center gap-2 text-xs">
        <span className={`h-2 w-2 rounded-full ${agentConnected ? 'bg-emerald-400' : 'bg-red-500'}`} />
        에이전트 {agentConnected ? '연결됨' : '미연결'}
      </div>

      <h1 className="text-4xl font-bold">지문 인식기에 손가락을 올려주세요</h1>
      <p className="mt-3 text-slate-400">자동으로 입실/복귀가 처리됩니다.</p>

      <div className="mt-12 flex gap-6">
        <button onClick={() => requestLeave('leave_temp')} className="rounded-xl bg-amber-500 px-10 py-6 text-2xl font-bold hover:bg-amber-600">
          🚶 외출
        </button>
        <button onClick={() => requestLeave('exit')} className="rounded-xl bg-red-500 px-10 py-6 text-2xl font-bold hover:bg-red-600">
          🚪 퇴실
        </button>
        <button onClick={() => deviceAgent.send({ id: 'k0', cmd: 'identify_fingerprint' })}
          className="rounded-xl bg-emerald-500 px-10 py-6 text-2xl font-bold hover:bg-emerald-600">
          ✋ 지문 입력
        </button>
      </div>

      {mode === 'leave_prompt' && (
        <div className="mt-8 rounded-md bg-amber-500/20 px-4 py-2 text-amber-200">
          {pendingAction === 'exit' ? '퇴실' : '외출'} 대기 — 지문을 인식해주세요. <button className="ml-2 underline" onClick={() => { setMode('idle'); setPendingAction(null); }}>취소</button>
        </div>
      )}

      {flash && (
        <div className={`mt-8 rounded-md px-6 py-3 text-xl font-semibold ${
          flash.kind === 'ok' ? 'bg-emerald-500/20 text-emerald-200' :
          flash.kind === 'err' ? 'bg-red-500/20 text-red-200' :
          'bg-sky-500/20 text-sky-200'
        }`}>
          {flash.text}
        </div>
      )}
    </div>
  );
}
