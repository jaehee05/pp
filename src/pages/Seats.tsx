import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { SeatContextMenu } from '../components/SeatContextMenu';
import { AssignStudentModal } from '../components/AssignStudentModal';
import type { Seat } from '../lib/types';
import { useStudents } from '../store/students';
import { useAttendance } from '../store/attendance';
import { usePlans } from '../store/plans';
import { ddayLabel, ddayOf, expiryShort, currentSubOf, lastActiveEndOf } from '../lib/sub';
import { fmtDateTime } from '../lib/format';
import { firestoreStorage } from '../lib/firestoreStorage';
import { liveAppState } from '../lib/firestoreSync';

type EditorMode = 'view' | 'edit';

interface PaletteItem {
  type: Seat['type'];
  label: string;
  w: number;
  h: number;
  emoji: string;
  tag?: string;
}

const PALETTE: PaletteItem[] = [
  { type: 'seat', label: '고정석', w: 80, h: 70, emoji: '💺', tag: '고정석' },
  { type: 'seat', label: '관리자석', w: 80, h: 70, emoji: '🪑', tag: '관리자석' },
  { type: 'desk', label: '책상', w: 160, h: 40, emoji: '🪵' },
  { type: 'room', label: '구역', w: 240, h: 160, emoji: '🏠' },
  { type: 'wall', label: '벽', w: 20, h: 180, emoji: '🧱' },
  { type: 'door', label: '문', w: 60, h: 20, emoji: '🚪' },
];

const STORE_KEY = 'pp.seatLayout.v3';
const DEFAULT_KEY = 'pp.seatLayout.default.v1';

function loadDefault(): SavedLayout | null {
  try {
    const raw = localStorage.getItem(DEFAULT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return null;
}

function emptyLayout(): SavedLayout {
  return { width: 1427, height: 1421, snap: 5, offsetX: 1, offsetY: 62, offsetZ: 50, seats: [], autoLabelN: 1 };
}

interface SavedLayout {
  width: number;
  height: number;
  snap: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  seats: Seat[];
  autoLabelN: number;
}

function loadLayout(): SavedLayout {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return { offsetX: 1, offsetY: 62, offsetZ: 50, ...v };
    }
  } catch { /* */ }
  // 현재 상태 없으면 기본값(스냅샷)이 있으면 그걸로, 없으면 빈 캔버스
  return loadDefault() ?? emptyLayout();
}

export function SeatsPage({ editable = true }: { editable?: boolean } = {}) {
  const initial = useMemo(loadLayout, []);
  const [mode, setMode] = useState<EditorMode>(editable ? 'edit' : 'view');
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [snap, setSnap] = useState(initial.snap);
  const [offsetX, setOffsetX] = useState(initial.offsetX);
  const [offsetY, setOffsetY] = useState(initial.offsetY);
  const [offsetZ, setOffsetZ] = useState(initial.offsetZ);
  const [seats, setSeats] = useState<Seat[]>(initial.seats);
  const [autoLabelN, setAutoLabelN] = useState<number>(initial.autoLabelN);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paletteDrag, setPaletteDrag] = useState<PaletteItem | null>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startW: number; startH: number; startX: number; startY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const students = useStudents((s) => s.list);
  const attState = useAttendance((s) => s.state);
  const subs = usePlans((s) => s.subs);
  const addSubscription = usePlans((s) => s.addSubscription);
  const plans = usePlans((s) => s.plans);
  const nav = useNavigate();

  const [ctxMenu, setCtxMenu] = useState<{ seatId: string; x: number; y: number } | null>(null);
  const [assignSeatId, setAssignSeatId] = useState<string | null>(null);
  const [memoSeatId, setMemoSeatId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [historySeatId, setHistorySeatId] = useState<string | null>(null);
  const [typeSeatId, setTypeSeatId] = useState<string | null>(null);

  const [hydrated, setHydrated] = useState(false);

  // 실시간 구독: 다른 기기/탭(키오스크 등)에서 좌석 상태 변경 시 즉시 반영.
  // 드래그/리사이즈 중에는 본인 입력 보호 위해 스킵.
  useEffect(() => {
    return liveAppState(STORE_KEY, (json) => {
      if (dragRef.current || resizeRef.current) return;
      try {
        const v = JSON.parse(json) as Partial<SavedLayout>;
        if (v.seats) setSeats(v.seats);
        if (v.width != null) setWidth(v.width);
        if (v.height != null) setHeight(v.height);
        if (v.snap != null) setSnap(v.snap);
        if (v.offsetX != null) setOffsetX(v.offsetX);
        if (v.offsetY != null) setOffsetY(v.offsetY);
        if (v.offsetZ != null) setOffsetZ(v.offsetZ);
        if (v.autoLabelN != null) setAutoLabelN(v.autoLabelN);
      } catch { /* */ }
    });
  }, []);

  // 마운트 시 Firestore(원격)에서 배치도를 받아 반영. 다른 기기/도메인에서 저장한
  // 좌석도 여기로 동기화된다. 원격 로드 전엔 저장을 막아 빈 데이터로 덮어쓰지 않는다.
  useEffect(() => {
    let active = true;
    void Promise.resolve(firestoreStorage.getItem(STORE_KEY)).then((raw) => {
      if (active && raw) {
        try {
          const v = JSON.parse(raw) as Partial<SavedLayout>;
          // 가드: 원격에 실제 좌석이 있을 때만 적용. 비어있으면 로컬 유지
          // (빈 원격이 좌석 있는 로컬을 덮어쓰는 사고 방지).
          if (v.seats && v.seats.length > 0) {
            if (v.width != null) setWidth(v.width);
            if (v.height != null) setHeight(v.height);
            if (v.snap != null) setSnap(v.snap);
            if (v.offsetX != null) setOffsetX(v.offsetX);
            if (v.offsetY != null) setOffsetY(v.offsetY);
            if (v.offsetZ != null) setOffsetZ(v.offsetZ);
            setSeats(v.seats);
            if (v.autoLabelN != null) setAutoLabelN(v.autoLabelN);
          }
        } catch { /* */ }
      }
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  // 변경 시 Firestore + localStorage에 저장 (원격 로드 후).
  // 운영(editable=false) 모드에서도 좌석 배정/메모/상태 변경은 저장돼야 하므로
  // editable 가드 제거. dimensions는 view 모드 UI에서 변경 불가하므로 안전.
  useEffect(() => {
    if (!hydrated) return;
    const json = JSON.stringify({ width, height, snap, offsetX, offsetY, offsetZ, seats, autoLabelN });
    try { localStorage.setItem(STORE_KEY, json); } catch { /* */ }
    // 빈 배치도는 원격에 저장하지 않음(다른 origin의 좌석 덮어쓰기 방지)
    if (seats.length > 0) void firestoreStorage.setItem(STORE_KEY, json);
  }, [hydrated, width, height, snap, offsetX, offsetY, offsetZ, seats, autoLabelN]);

  const selected = useMemo(() => seats.find((s) => s.id === selectedId) ?? null, [seats, selectedId]);
  const seatCount = useMemo(() => seats.filter((s) => s.type === 'seat').length, [seats]);
  const assignedCount = useMemo(() => seats.filter((s) => s.type === 'seat' && s.assignedStudentId).length, [seats]);
  const snapVal = (v: number) => Math.round(v / snap) * snap;
  const clampX = (x: number, w: number) => Math.max(0, Math.min(width - w, snapVal(x)));
  const clampY = (y: number, h: number) => Math.max(0, Math.min(height - h, snapVal(y)));

  function pxFromEvent(e: { clientX: number; clientY: number }) {
    const g = canvasRef.current!;
    const r = g.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function dropFromPalette(e: React.MouseEvent) {
    if (!paletteDrag) return;
    const { x, y } = pxFromEvent(e);
    const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const label = paletteDrag.type === 'seat' ? String(autoLabelN) : paletteDrag.label;
    const next: Seat = {
      id,
      label,
      tag: paletteDrag.tag,
      x: clampX(x - paletteDrag.w / 2, paletteDrag.w),
      y: clampY(y - paletteDrag.h / 2, paletteDrag.h),
      w: paletteDrag.w,
      h: paletteDrag.h,
      z: 0,
      type: paletteDrag.type,
    };
    setSeats((prev) => [...prev, next]);
    if (paletteDrag.type === 'seat') setAutoLabelN((n) => n + 1);
    setSelectedId(id);
    setPaletteDrag(null);
  }

  function onSeatMouseDown(e: React.MouseEvent, s: Seat) {
    e.stopPropagation();
    setSelectedId(s.id);
    // 우클릭(2번 버튼) → 컨텍스트 메뉴
    if (e.button === 2) {
      e.preventDefault();
      setCtxMenu({ seatId: s.id, x: e.clientX, y: e.clientY });
      return;
    }
    // 운영 view 모드에서 좌클릭 = 컨텍스트 메뉴 (좌석 종류만)
    if (!editable && s.type === 'seat') {
      setCtxMenu({ seatId: s.id, x: e.clientX, y: e.clientY });
      return;
    }
    if (!editable || mode !== 'edit') return;
    const { x, y } = pxFromEvent(e);
    dragRef.current = { id: s.id, offX: x - s.x, offY: y - s.y };
  }

  function handleContextAction(action: 'memberInfo' | 'assign' | 'release' | 'memo' | 'toggleActive' | 'changeType' | 'history') {
    if (!ctxMenu) return;
    const seat = seats.find((s) => s.id === ctxMenu.seatId);
    if (!seat) return;
    if (action === 'memberInfo' && seat.assignedStudentId) {
      nav(`/ops/member/${seat.assignedStudentId}`);
    } else if (action === 'assign') {
      setAssignSeatId(seat.id);
    } else if (action === 'release') {
      if (confirm(`${seat.label} 좌석의 배정을 해제할까요?`)) {
        const history = seat.assignmentHistory ?? [];
        const last = history[history.length - 1];
        if (last && !last.releasedAt && last.studentId === seat.assignedStudentId) {
          last.releasedAt = Date.now();
        }
        setSeats((prev) => prev.map((s) =>
          s.id === seat.id ? { ...s, assignedStudentId: null, assignmentHistory: [...history] } : s,
        ));
      }
    } else if (action === 'memo') {
      setMemoDraft(seat.memo ?? '');
      setMemoSeatId(seat.id);
    } else if (action === 'toggleActive') {
      setSeats((prev) => prev.map((s) =>
        s.id === seat.id ? { ...s, active: s.active === false ? true : false } : s,
      ));
    } else if (action === 'changeType') {
      setTypeSeatId(seat.id);
    } else if (action === 'history') {
      setHistorySeatId(seat.id);
    }
  }

  function confirmAssign(data: { studentId: string; useExisting: boolean; planId?: string; startAt?: number; durationDays?: number }) {
    const seat = seats.find((s) => s.id === assignSeatId);
    if (!seat) return;
    // 신규 구매면 Subscription 생성, 기존 사용이면 스킵 (좌석 배정만)
    if (!data.useExisting) {
      const plan = plans.find((p) => p.id === data.planId);
      if (!plan || !data.startAt) return;
      // 갱신 처리: 기존 active 이용권이 아직 안 끝났으면 그 직후부터 시작
      const futureEnds = subs
        .filter((s) => s.studentId === data.studentId && s.status === 'active' && s.endAt && s.endAt > Date.now())
        .map((s) => s.endAt as number);
      const latestEnd = futureEnds.length > 0 ? Math.max(...futureEnds) : null;
      const actualStartAt = latestEnd ?? data.startAt;
      const endAt = data.durationDays ? actualStartAt + data.durationDays * 86400000 : undefined;
      addSubscription({
        studentId: data.studentId,
        planId: plan.id,
        planSnapshot: {
          name: plan.name, type: plan.type,
          durationDays: plan.durationDays, hours: plan.hours, counts: plan.counts,
          price: plan.price,
        },
        startAt: actualStartAt,
        endAt,
        hoursRemaining: plan.hours,
        countsRemaining: plan.counts,
        status: 'active',
      });
    }
    const history = seat.assignmentHistory ?? [];
    setSeats((prev) => prev.map((s) =>
      s.id === seat.id
        ? { ...s, assignedStudentId: data.studentId,
            assignmentHistory: [...history, { studentId: data.studentId, assignedAt: Date.now() }] }
        : s,
    ));
    setAssignSeatId(null);
  }

  function saveMemo() {
    if (!memoSeatId) return;
    setSeats((prev) => prev.map((s) => (s.id === memoSeatId ? { ...s, memo: memoDraft } : s)));
    setMemoSeatId(null);
  }

  function changeSeatTag(newTag: string) {
    if (!typeSeatId) return;
    setSeats((prev) => prev.map((s) => (s.id === typeSeatId ? { ...s, tag: newTag } : s)));
    setTypeSeatId(null);
  }

  function onResizeMouseDown(e: React.MouseEvent, s: Seat) {
    if (!editable) return;
    e.stopPropagation();
    setSelectedId(s.id);
    const { x, y } = pxFromEvent(e);
    resizeRef.current = { id: s.id, startW: s.w, startH: s.h, startX: x, startY: y };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (dragRef.current) {
      const { x, y } = pxFromEvent(e);
      const d = dragRef.current;
      setSeats((prev) => prev.map((s) =>
        s.id === d.id ? { ...s, x: clampX(x - d.offX, s.w), y: clampY(y - d.offY, s.h) } : s,
      ));
    } else if (resizeRef.current) {
      const { x, y } = pxFromEvent(e);
      const r = resizeRef.current;
      const dx = x - r.startX;
      const dy = y - r.startY;
      setSeats((prev) => prev.map((s) =>
        s.id === r.id
          ? { ...s, w: Math.max(20, snapVal(r.startW + dx)), h: Math.max(20, snapVal(r.startH + dy)) }
          : s,
      ));
    }
  }

  function onMouseUp() {
    dragRef.current = null;
    resizeRef.current = null;
  }

  function updateSelected(patch: Partial<Seat>) {
    if (!selected) return;
    setSeats((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));
  }

  function deleteSelected() {
    if (!selected) return;
    setSeats((prev) => prev.filter((s) => s.id !== selected.id));
    setSelectedId(null);
  }

  function clearAll() {
    const def = loadDefault();
    const msg = def
      ? '저장된 기본 배치도로 되돌릴까요? 현재 변경사항은 사라집니다.'
      : '전체 배치를 비울까요? (기본 배치도가 저장되어 있지 않습니다)';
    if (!confirm(msg)) return;
    if (def) {
      setWidth(def.width);
      setHeight(def.height);
      setSnap(def.snap);
      setOffsetX(def.offsetX);
      setOffsetY(def.offsetY);
      setOffsetZ(def.offsetZ);
      setSeats(def.seats);
      setAutoLabelN(def.autoLabelN);
    } else {
      setSeats([]); setAutoLabelN(1);
    }
    setSelectedId(null);
  }

  function saveAsDefault() {
    const snapshot: SavedLayout = {
      width, height, snap,
      offsetX, offsetY, offsetZ,
      seats: JSON.parse(JSON.stringify(seats)),
      autoLabelN,
    };
    void firestoreStorage.setItem(DEFAULT_KEY, JSON.stringify(snapshot));
    alert(`현재 배치를 기본값으로 저장했습니다.\n좌석 ${seats.filter(s => s.type === 'seat').length}개 / 캔버스 ${width}×${height}\n이후 "기본값으로 복원" 시 이 상태로 되돌아갑니다.`);
  }

  function clearDefault() {
    if (!confirm('저장된 기본 배치도를 삭제할까요? 이후 "초기화"는 빈 캔버스가 됩니다.')) return;
    void firestoreStorage.removeItem(DEFAULT_KEY);
    alert('기본 배치도 삭제 완료.');
  }

  return (
    <>
      <PageHeader
        title={editable ? '좌석 배치 (편집)' : '배치도'}
        desc={editable
          ? '팔레트에서 도형을 선택 → 배치도에서 클릭. 좌석은 학생 배정 시 카드 형태로 표시됩니다.'
          : '좌석을 클릭하면 우측에서 학생 배정·상태를 관리할 수 있습니다. 모양 편집은 관리 → 배치도/사물함 관리에서.'}
        actions={editable && (
          <>
            <div className="rounded-md bg-slate-100 p-0.5 text-sm">
              {(['edit', 'view'] as EditorMode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 ${mode === m ? 'bg-white shadow-sm font-semibold' : 'text-slate-600'}`}>
                  {m === 'edit' ? '편집' : '보기'}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={saveAsDefault}>★ 기본값으로 저장</button>
            <button className="btn-secondary" onClick={clearAll}>↺ 기본값으로 복원</button>
            <button className="btn-secondary" onClick={clearDefault}>기본값 삭제</button>
          </>
        )}
      />

      <div className="flex h-[calc(100%-65px)]">
        {editable && mode === 'edit' && (
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold text-slate-500">팔레트</div>
            <div className="grid grid-cols-2 gap-2">
              {PALETTE.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPaletteDrag(p)}
                  className={`flex flex-col items-center justify-center rounded-md px-2 py-3 text-xs ring-1 ring-slate-200 transition hover:bg-slate-50 ${
                    paletteDrag === p ? 'ring-2 ring-brand-500 bg-brand-50' : ''
                  }`}
                >
                  <span className="text-lg">{p.emoji}</span>
                  <span className="mt-1 font-medium">{p.label}</span>
                  <span className="text-[10px] text-slate-400">{p.w}×{p.h}</span>
                </button>
              ))}
            </div>

            {paletteDrag && (
              <div className="mt-3 rounded-md bg-brand-50 p-2 text-xs text-brand-700">
                <b>{paletteDrag.label}</b> ({paletteDrag.w}×{paletteDrag.h}) — 배치도 클릭
                <button className="ml-2 underline" onClick={() => setPaletteDrag(null)}>취소</button>
              </div>
            )}

            <div className="mt-5 border-t border-slate-200 pt-3">
              <div className="mb-2 text-xs font-semibold text-slate-500">스냅</div>
              <input className="input" type="number" min={1} max={50} value={snap}
                onChange={(e) => setSnap(Math.max(1, +e.target.value))} />
            </div>
          </aside>
        )}

        <div className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-6">
          <div
            ref={canvasRef}
            onClick={(e) => {
              if (paletteDrag) dropFromPalette(e);
              else if (e.target === canvasRef.current) setSelectedId(null);
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative ${editable ? 'border border-slate-300 bg-white' : ''}`}
            style={{
              width, height,
              marginLeft: offsetX, marginTop: offsetY,
              zIndex: offsetZ,
              backgroundImage: editable
                ? `linear-gradient(to right, #f1f5f9 1px, transparent 1px),
                   linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`
                : undefined,
              backgroundSize: editable ? `${snap * 4}px ${snap * 4}px` : undefined,
              cursor: paletteDrag ? 'crosshair' : 'default',
            }}
          >
            {[...seats].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((s) => (
              <SeatBox key={s.id} seat={s} mode={mode} selected={selectedId === s.id}
                students={students} attState={attState} subs={subs}
                onMouseDown={(e) => onSeatMouseDown(e, s)}
                onResizeMouseDown={(e) => onResizeMouseDown(e, s)}
              />
            ))}
          </div>
        </div>

        {editable && (
        <aside className="w-72 shrink-0 border-l border-slate-200 bg-white p-4">
            {!selected ? (
              <div>
                <div className="mb-3 text-center text-sm font-bold text-slate-800">배치도</div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="좌석수">
                      <input className="input p-1.5 text-center font-mono" value={seatCount} readOnly />
                    </Field>
                    <Field label="배정">
                      <input className="input p-1.5 text-center font-mono" value={assignedCount} readOnly />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="넓이">
                      <input className="input p-1.5 text-center" type="number" value={width} readOnly={!editable}
                        onChange={(e) => setWidth(Math.max(400, +e.target.value))} />
                    </Field>
                    <Field label="높이">
                      <input className="input p-1.5 text-center" type="number" value={height} readOnly={!editable}
                        onChange={(e) => setHeight(Math.max(400, +e.target.value))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="X">
                      <input className="input p-1.5 text-center" type="number" value={offsetX} readOnly={!editable}
                        onChange={(e) => setOffsetX(+e.target.value)} />
                    </Field>
                    <Field label="Y">
                      <input className="input p-1.5 text-center" type="number" value={offsetY} readOnly={!editable}
                        onChange={(e) => setOffsetY(+e.target.value)} />
                    </Field>
                    <Field label="Z">
                      <input className="input p-1.5 text-center" type="number" value={offsetZ} readOnly={!editable}
                        onChange={(e) => setOffsetZ(+e.target.value)} />
                    </Field>
                  </div>
                  <p className="pt-2 text-[11px] leading-relaxed text-slate-400">
                    좌석/도형을 선택하면 해당 항목의 속성으로 전환됩니다.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">{selected.label} — {selected.type}</div>
                  {editable && (
                    <button className="text-xs text-rose-500 hover:underline" onClick={deleteSelected}>삭제</button>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="좌석번호/라벨">
                      <input className="input" value={selected.label} readOnly={!editable}
                        onChange={(e) => updateSelected({ label: e.target.value })} />
                    </Field>
                    <Field label="분류">
                      <input className="input" value={selected.tag ?? ''} placeholder="고정석" readOnly={!editable}
                        onChange={(e) => updateSelected({ tag: e.target.value })} />
                    </Field>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <div className="mb-1 text-center text-xs font-semibold text-slate-500">배치도</div>
                    <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-slate-500">
                      <div>넓이</div><div>높이</div><div>X</div><div>Y</div><div>Z</div>
                    </div>
                    <div className="mt-1 grid grid-cols-5 gap-1">
                      <input className="input p-1 text-center" type="number" value={selected.w} readOnly={!editable}
                        onChange={(e) => updateSelected({ w: Math.max(10, +e.target.value) })} />
                      <input className="input p-1 text-center" type="number" value={selected.h} readOnly={!editable}
                        onChange={(e) => updateSelected({ h: Math.max(10, +e.target.value) })} />
                      <input className="input p-1 text-center" type="number" value={selected.x} readOnly={!editable}
                        onChange={(e) => updateSelected({ x: clampX(+e.target.value, selected.w) })} />
                      <input className="input p-1 text-center" type="number" value={selected.y} readOnly={!editable}
                        onChange={(e) => updateSelected({ y: clampY(+e.target.value, selected.h) })} />
                      <input className="input p-1 text-center" type="number" value={selected.z ?? 0} readOnly={!editable}
                        onChange={(e) => updateSelected({ z: +e.target.value })} />
                    </div>
                  </div>

                  {selected.type === 'seat' && (
                    <Field label="배정 학생">
                      <select className="input"
                        value={selected.assignedStudentId ?? ''}
                        onChange={(e) => updateSelected({ assignedStudentId: e.target.value || null })}>
                        <option value="">(미배정)</option>
                        {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                      </select>
                    </Field>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {ctxMenu && (() => {
        const seat = seats.find((s) => s.id === ctxMenu.seatId);
        if (!seat) return null;
        const stu = seat.assignedStudentId ? students.find((x) => x.id === seat.assignedStudentId) : undefined;
        return (
          <SeatContextMenu
            seat={seat}
            x={ctxMenu.x}
            y={ctxMenu.y}
            assignedName={stu?.name}
            onClose={() => setCtxMenu(null)}
            onAction={handleContextAction}
          />
        );
      })()}

      <AssignStudentModal
        open={!!assignSeatId}
        onClose={() => setAssignSeatId(null)}
        seatId={assignSeatId}
        seatLabel={seats.find((s) => s.id === assignSeatId)?.label}
        onConfirm={confirmAssign}
      />

      <Modal
        open={!!memoSeatId}
        onClose={() => setMemoSeatId(null)}
        title={`좌석 메모 — ${seats.find((s) => s.id === memoSeatId)?.label ?? ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setMemoSeatId(null)}>취소</button>
            <button className="btn-primary" onClick={saveMemo}>저장</button>
          </>
        }
      >
        <textarea className="input min-h-[120px]" value={memoDraft} onChange={(e) => setMemoDraft(e.target.value)}
          placeholder="고장 신고, 특이사항 등" />
      </Modal>

      <Modal
        open={!!historySeatId}
        onClose={() => setHistorySeatId(null)}
        title={`좌석 히스토리 — ${seats.find((s) => s.id === historySeatId)?.label ?? ''}`}
        width="max-w-lg"
      >
        {(() => {
          const seat = seats.find((s) => s.id === historySeatId);
          const hist = seat?.assignmentHistory ?? [];
          if (hist.length === 0) return <p className="py-6 text-center text-sm text-slate-400">배정 이력 없음</p>;
          return (
            <ol className="space-y-1 text-sm">
              {[...hist].reverse().map((h, i) => {
                const stu = students.find((s) => s.id === h.studentId);
                return (
                  <li key={i} className="flex items-center justify-between border-b border-slate-100 py-2">
                    <span className="font-medium">{stu?.name ?? '(삭제된 회원)'}</span>
                    <span className="text-xs text-slate-500">
                      {fmtDateTime(new Date(h.assignedAt))}
                      {h.releasedAt && ` → ${fmtDateTime(new Date(h.releasedAt))}`}
                      {!h.releasedAt && <span className="ml-1 text-emerald-600">(이용중)</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          );
        })()}
      </Modal>

      <Modal
        open={!!typeSeatId}
        onClose={() => setTypeSeatId(null)}
        title="좌석 타입 변경"
        width="max-w-sm"
      >
        <div className="space-y-2">
          {['고정석', '자유석', '관리자석', '지정석'].map((t) => (
            <button key={t} onClick={() => changeSeatTag(t)}
              className="w-full rounded-md border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50">
              {t}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-center text-[11px] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function SeatBox({
  seat, mode, selected, students, attState, subs, onMouseDown, onResizeMouseDown,
}: {
  seat: Seat;
  mode: EditorMode;
  selected: boolean;
  students: ReturnType<typeof useStudents.getState>['list'];
  attState: ReturnType<typeof useAttendance.getState>['state'];
  subs: ReturnType<typeof usePlans.getState>['subs'];
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}) {
  // 비-좌석 도형: 기존 컬러 박스 렌더
  if (seat.type !== 'seat') {
    const map = {
      desk: 'bg-amber-100 ring-amber-300',
      room: 'bg-sky-50 ring-sky-300',
      wall: 'bg-slate-300 ring-slate-500',
      door: 'bg-orange-100 ring-orange-400',
      label: 'bg-white ring-slate-300',
    } as const;
    return (
      <div
        onMouseDown={onMouseDown}
        style={{ position: 'absolute', left: seat.x, top: seat.y, width: seat.w, height: seat.h, zIndex: seat.z ?? 0 }}
        className={`${mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
          selected ? 'outline outline-2 outline-brand-600' : ''
        }`}
      >
        <div className={`flex h-full w-full select-none items-center justify-center rounded text-xs font-semibold ring-1 ${map[seat.type as keyof typeof map] ?? ''}`}>
          {seat.label}
        </div>
        {mode === 'edit' && selected && (
          <div onMouseDown={onResizeMouseDown}
            className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm bg-brand-600" />
        )}
      </div>
    );
  }

  const student = seat.assignedStudentId ? students.find((x) => x.id === seat.assignedStudentId) : null;
  const att = student ? attState[student.id] : undefined;
  const state: 'in' | 'temp' | 'idle' | 'empty' =
    !student ? 'empty'
    : att?.state === 'in' ? 'in'
    : att?.state === 'temp_out' ? 'temp'
    : 'idle';

  // 상태별 색상 — 헤더 배경과 좌석 번호 칩
  const headerBgByState = {
    in: 'bg-emerald-200',         // 입실: 연두
    temp: 'bg-amber-200',          // 외출: 노랑
    idle: 'bg-slate-200',         // 퇴실/이용중인데 미입실: 회색
    empty: 'bg-slate-200',
  }[state];
  const sub = student
    ? currentSubOf(subs, student.id)
    : null;
  // D-day 는 활성 이용권 전체(현재+예정)의 가장 늦은 종료일 기준
  const endAt = student ? lastActiveEndOf(subs, student.id) ?? sub?.endAt : sub?.endAt;

  return (
    <div
      onMouseDown={onMouseDown}
      style={{ position: 'absolute', left: seat.x, top: seat.y, width: seat.w, height: seat.h, zIndex: seat.z ?? 0 }}
      className={`${mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
        selected ? 'outline outline-2 outline-brand-600' : ''
      }`}
    >
      <div className="flex h-full w-full select-none flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        {/* 헤더: 번호 + 분류 (1줄 고정) */}
        <div className={`flex shrink-0 items-baseline gap-1 truncate px-1.5 py-0.5 text-[11px] leading-none text-slate-800 ${headerBgByState}`}>
          <span className="font-bold tabular-nums">{seat.label}</span>
          <span className="truncate text-[10px] font-medium text-slate-700">{seat.tag ?? '고정석'}</span>
        </div>

        {/* 본문 */}
        {student ? (
          <div className="flex flex-1 flex-col leading-none">
            {endAt ? (() => {
              const d = ddayOf(endAt);
              const cls =
                d <= 3   ? 'bg-orange-500 text-white font-semibold'         // 매우 임박
                : d <= 7   ? 'bg-orange-200 text-orange-800 font-semibold' // 임박
                : d <= 14  ? 'bg-amber-100 text-amber-800'                 // 주의
                            : 'bg-slate-100 text-slate-600';               // 일반 (항상 컬러 띠)
              return (
                <div className={`flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 text-[9px] ${cls}`}>
                  <span className="font-mono">{expiryShort(endAt)}</span>
                  <span className="font-semibold">{ddayLabel(d)}</span>
                </div>
              );
            })() : <div className="px-1.5 py-0.5" />}
            <div className="flex min-w-0 max-w-full items-baseline gap-1 overflow-hidden whitespace-nowrap break-keep px-1.5 pb-0.5 pt-0.5 text-[11px] leading-tight">
              <span className="truncate font-semibold text-slate-800 break-keep">{student.name}</span>
              {student.gender && (
                <span className={`shrink-0 break-keep text-[10px] ${
                  student.gender === 'M' ? 'text-sky-500' : 'text-pink-500'
                }`}>
                  {student.gender === 'M' ? '♂' : '♀'}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white" />
        )}
      </div>

      {mode === 'edit' && selected && (
        <div onMouseDown={onResizeMouseDown}
          className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm bg-brand-600" />
      )}
    </div>
  );
}
