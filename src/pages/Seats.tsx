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

const STORE_KEY = 'pp.seatLayout.v2';

interface SavedLayout {
  width: number;
  height: number;
  snap: number;
  seats: Seat[];
  autoLabelN: number;
}

function loadLayout(): SavedLayout {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { width: 1600, height: 1000, snap: 5, seats: [], autoLabelN: 1 };
}

export function SeatsPage() {
  const initial = useMemo(loadLayout, []);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [snap, setSnap] = useState(initial.snap);
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
    localStorage.setItem(STORE_KEY, JSON.stringify({ width, height, snap, seats, autoLabelN }));
  }, [width, height, snap, seats, autoLabelN]);

  const selected = useMemo(() => seats.find((s) => s.id === selectedId) ?? null, [seats, selectedId]);
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
    if (mode !== 'edit') return;
    e.stopPropagation();
    setSelectedId(s.id);
    const { x, y } = pxFromEvent(e);
    dragRef.current = { id: s.id, offX: x - s.x, offY: y - s.y };
  }

  function onResizeMouseDown(e: React.MouseEvent, s: Seat) {
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
    if (!confirm('전체 배치를 초기화할까요?')) return;
    setSeats([]); setSelectedId(null); setAutoLabelN(1);
  }

  function renderSeatDeco(s: Seat) {
    if (s.type !== 'seat') {
      const map = {
        desk: 'bg-amber-100 ring-amber-300',
        room: 'bg-sky-50 ring-sky-300',
        wall: 'bg-slate-300 ring-slate-500',
        door: 'bg-orange-100 ring-orange-400',
        label: 'bg-white ring-slate-300',
      } as const;
      return (
        <div
          className={`pointer-events-none flex h-full w-full select-none items-center justify-center rounded text-xs font-semibold ring-1 ${map[s.type as keyof typeof map] ?? ''}`}
        >
          {s.label}
        </div>
      );
    }
    const student = s.assignedStudentId ? students.find((x) => x.id === s.assignedStudentId) : null;
    const att = student ? attState[student.id] : undefined;
    const headerBg =
      att?.state === 'in' ? 'bg-emerald-300/90'
      : att?.state === 'temp_out' ? 'bg-amber-300/90'
      : 'bg-slate-300/90';
    const sub = student ? subs.filter((x) => x.studentId === student.id && x.status === 'active').sort((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0))[0] : null;
    const endAt = sub?.endAt;
    return (
      <div className="pointer-events-none flex h-full w-full select-none flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-sm">
        <div className={`flex items-center justify-between px-1.5 py-0.5 text-[11px] font-semibold ${headerBg}`}>
          <span className="text-slate-900">{s.label}</span>
          <span className="text-[10px] text-slate-700">{s.tag ?? ''}</span>
        </div>
        <div className="flex flex-1 flex-col justify-between px-1.5 py-1 text-[10px]">
          {endAt ? (
            <div className="flex items-center gap-1 text-slate-600">
              <span>{expiryShort(endAt)}</span>
              <span className={ddayOf(endAt) <= 7 ? 'text-red-500 font-semibold' : ''}>
                {ddayLabel(ddayOf(endAt))}
              </span>
            </div>
          ) : <div className="h-3" />}
          {student && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-800 truncate">{student.name}</span>
              <span className={student.gender === 'M' ? 'text-sky-600' : student.gender === 'F' ? 'text-pink-500' : 'text-slate-400'}>
                {student.gender === 'M' ? '♂' : student.gender === 'F' ? '♀' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="좌석 배치"
        desc="팔레트에서 도형을 선택 → 배치도에서 클릭. 좌석은 학생 배정 시 카드 형태로 표시됩니다."
        actions={
          <>
            <div className="rounded-md bg-slate-100 p-0.5 text-sm">
              {(['edit', 'view'] as EditorMode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 ${mode === m ? 'bg-white shadow-sm font-semibold' : 'text-slate-600'}`}>
                  {m === 'edit' ? '편집' : '보기'}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={clearAll}>전체 초기화</button>
          </>
        }
      />

      <div className="flex h-[calc(100%-65px)]">
        {mode === 'edit' && (
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

            <div className="mt-5 space-y-2 border-t border-slate-200 pt-3 text-xs">
              <div className="font-semibold text-slate-500">배치도 크기</div>
              <label className="block">너비
                <input className="input mt-1" type="number" min={400} max={5000} value={width}
                  onChange={(e) => setWidth(Math.max(400, +e.target.value))} />
              </label>
              <label className="block">높이
                <input className="input mt-1" type="number" min={400} max={5000} value={height}
                  onChange={(e) => setHeight(Math.max(400, +e.target.value))} />
              </label>
              <label className="block">스냅(px)
                <input className="input mt-1" type="number" min={1} max={50} value={snap}
                  onChange={(e) => setSnap(Math.max(1, +e.target.value))} />
              </label>
            </div>

            {paletteDrag && (
              <div className="mt-3 rounded-md bg-brand-50 p-2 text-xs text-brand-700">
                <b>{paletteDrag.label}</b> ({paletteDrag.w}×{paletteDrag.h}) — 배치도 클릭
                <button className="ml-2 underline" onClick={() => setPaletteDrag(null)}>취소</button>
              </div>
            )}
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
              backgroundImage:
                `linear-gradient(to right, #f1f5f9 1px, transparent 1px),
                 linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`,
              backgroundSize: `${snap * 4}px ${snap * 4}px`,
              cursor: paletteDrag ? 'crosshair' : 'default',
            }}
          >
            {[...seats].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((s) => (
              <div
                key={s.id}
                onMouseDown={(e) => onSeatMouseDown(e, s)}
                style={{
                  position: 'absolute',
                  left: s.x, top: s.y, width: s.w, height: s.h,
                  zIndex: s.z ?? 0,
                }}
                className={`group ${mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                  selectedId === s.id ? 'outline outline-2 outline-brand-600' : ''
                }`}
              >
                {renderSeatDeco(s)}
                {mode === 'edit' && selectedId === s.id && (
                  <div
                    onMouseDown={(e) => onResizeMouseDown(e, s)}
                    className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm bg-brand-600"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {mode === 'edit' && (
          <aside className="w-72 shrink-0 border-l border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-semibold text-slate-500">선택 항목</div>
            {!selected && <p className="text-sm text-slate-400">좌석/도형을 선택하세요.</p>}
            {selected && (
              <div className="space-y-3 text-sm">
                <div className="text-xs text-slate-500">유형: {selected.type}</div>

                <div className="grid grid-cols-2 gap-2">
                  <label>좌석번호/라벨
                    <input className="input mt-1" value={selected.label}
                      onChange={(e) => updateSelected({ label: e.target.value })} />
                  </label>
                  <label>분류
                    <input className="input mt-1" value={selected.tag ?? ''} placeholder="고정석"
                      onChange={(e) => updateSelected({ tag: e.target.value })} />
                  </label>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="mb-1 text-center text-xs font-semibold text-slate-500">배치도</div>
                  <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-slate-500">
                    <div>넓이</div><div>높이</div><div>X</div><div>Y</div><div>Z</div>
                  </div>
                  <div className="mt-1 grid grid-cols-5 gap-1">
                    <input className="input p-1 text-center" type="number" value={selected.w}
                      onChange={(e) => updateSelected({ w: Math.max(10, +e.target.value) })} />
                    <input className="input p-1 text-center" type="number" value={selected.h}
                      onChange={(e) => updateSelected({ h: Math.max(10, +e.target.value) })} />
                    <input className="input p-1 text-center" type="number" value={selected.x}
                      onChange={(e) => updateSelected({ x: clampX(+e.target.value, selected.w) })} />
                    <input className="input p-1 text-center" type="number" value={selected.y}
                      onChange={(e) => updateSelected({ y: clampY(+e.target.value, selected.h) })} />
                    <input className="input p-1 text-center" type="number" value={selected.z ?? 0}
                      onChange={(e) => updateSelected({ z: +e.target.value })} />
                  </div>
                </div>

                {selected.type === 'seat' && (
                  <label className="block">배정 학생
                    <select className="input mt-1"
                      value={selected.assignedStudentId ?? ''}
                      onChange={(e) => updateSelected({ assignedStudentId: e.target.value || null })}>
                      <option value="">(미배정)</option>
                      {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                    </select>
                  </label>
                )}

                <button className="btn-danger w-full" onClick={deleteSelected}>삭제</button>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
              총 좌석: <b className="text-slate-700">{seats.filter((s) => s.type === 'seat').length}</b>
              {' · '}배정: <b className="text-slate-700">{seats.filter((s) => s.type === 'seat' && s.assignedStudentId).length}</b>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
