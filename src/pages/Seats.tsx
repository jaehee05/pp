import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import type { Seat } from '../lib/types';
import { useStudents } from '../store/students';
import { useAttendance } from '../store/attendance';
import { usePlans } from '../store/plans';
import { ddayLabel, ddayOf, expiryShort } from '../lib/sub';

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

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ width, height, snap, offsetX, offsetY, offsetZ, seats, autoLabelN }));
  }, [width, height, snap, offsetX, offsetY, offsetZ, seats, autoLabelN]);

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
    const label = paletteDrag.type === 'seat' ? String(autoLabelN).padStart(2, '0') : paletteDrag.label;
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
    if (!editable || mode !== 'edit') return;
    const { x, y } = pxFromEvent(e);
    dragRef.current = { id: s.id, offX: x - s.x, offY: y - s.y };
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
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(snapshot));
    alert(`현재 배치를 기본값으로 저장했습니다.\n좌석 ${seats.filter(s => s.type === 'seat').length}개 / 캔버스 ${width}×${height}\n이후 "기본값으로 복원" 시 이 상태로 되돌아갑니다.`);
  }

  function clearDefault() {
    if (!confirm('저장된 기본 배치도를 삭제할까요? 이후 "초기화"는 빈 캔버스가 됩니다.')) return;
    localStorage.removeItem(DEFAULT_KEY);
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

        <div className="flex-1 overflow-auto bg-slate-100 p-6">
          <div
            ref={canvasRef}
            onClick={(e) => {
              if (paletteDrag) dropFromPalette(e);
              else if (e.target === canvasRef.current) setSelectedId(null);
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className="relative border border-slate-300 bg-white"
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
  const numChipByState = {
    in: 'bg-emerald-500 text-white',
    temp: 'bg-amber-500 text-white',
    idle: 'bg-slate-500 text-white',
    empty: 'bg-slate-500 text-white',
  }[state];

  const sub = student
    ? subs.filter((x) => x.studentId === student.id && x.status === 'active').sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0))[0]
    : null;
  const endAt = sub?.endAt;

  return (
    <div
      onMouseDown={onMouseDown}
      style={{ position: 'absolute', left: seat.x, top: seat.y, width: seat.w, height: seat.h, zIndex: seat.z ?? 0 }}
      className={`${mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
        selected ? 'outline outline-2 outline-brand-600' : ''
      }`}
    >
      <div className="flex h-full w-full select-none flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        {/* 헤더: 번호 칩 + 분류 */}
        <div className={`flex items-center gap-1 px-1 py-0.5 text-[11px] ${headerBgByState}`}>
          <span className={`inline-block min-w-[20px] rounded px-1 text-center font-bold leading-tight ${numChipByState}`}>
            {seat.label}
          </span>
          <span className="font-medium text-slate-700">{seat.tag ?? '고정석'}</span>
        </div>

        {/* 본문 */}
        {student ? (
          <div className="flex flex-1 flex-col justify-between px-1.5 py-1 text-[10px]">
            <div className="flex items-center gap-1 text-slate-600">
              {endAt && (
                <>
                  <span className="font-mono">{expiryShort(endAt)}</span>
                  <span className={`font-semibold ${ddayOf(endAt) <= 7 ? 'text-rose-500' : 'text-slate-500'}`}>
                    {ddayLabel(ddayOf(endAt))}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="truncate font-semibold text-slate-800">{student.name}</span>
              <span className={
                student.gender === 'M' ? 'text-sky-500'
                : student.gender === 'F' ? 'text-pink-500'
                : 'text-slate-300'
              }>
                {student.gender === 'M' ? '♂' : student.gender === 'F' ? '♀' : ''}
              </span>
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
