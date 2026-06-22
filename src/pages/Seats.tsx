import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import type { Seat } from '../lib/types';

type EditorMode = 'view' | 'edit';

const PALETTE: { type: Seat['type']; label: string; w: number; h: number; bg: string; emoji: string }[] = [
  { type: 'seat', label: '좌석', w: 1, h: 1, bg: 'bg-emerald-100 ring-emerald-400', emoji: '💺' },
  { type: 'desk', label: '책상', w: 2, h: 1, bg: 'bg-amber-100 ring-amber-400', emoji: '🪵' },
  { type: 'room', label: '구역', w: 3, h: 2, bg: 'bg-sky-100 ring-sky-400', emoji: '🏠' },
  { type: 'wall', label: '벽', w: 1, h: 3, bg: 'bg-slate-300 ring-slate-500', emoji: '🧱' },
  { type: 'door', label: '문', w: 1, h: 1, bg: 'bg-orange-100 ring-orange-400', emoji: '🚪' },
];

const DEFAULT_LAYOUT = {
  cols: 24,
  rows: 16,
  cellSize: 36,
};

interface PlacedSeat extends Seat {}

export function SeatsPage() {
  const [mode, setMode] = useState<EditorMode>('edit');
  const [cols, setCols] = useState(DEFAULT_LAYOUT.cols);
  const [rows, setRows] = useState(DEFAULT_LAYOUT.rows);
  const [cellSize, setCellSize] = useState(DEFAULT_LAYOUT.cellSize);
  const [seats, setSeats] = useState<PlacedSeat[]>(() => {
    const saved = localStorage.getItem('pp.seatLayout.v1');
    if (saved) try { return JSON.parse(saved).seats ?? []; } catch { /* */ }
    return [];
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offX: number; offY: number } | null>(null);
  const [paletteDrag, setPaletteDrag] = useState<typeof PALETTE[number] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [autoLabelN, setAutoLabelN] = useState<number>(() => {
    const saved = localStorage.getItem('pp.seatLayout.v1');
    if (saved) try { return ((JSON.parse(saved).seats?.length ?? 0) as number) + 1; } catch { /* */ }
    return 1;
  });

  useEffect(() => {
    localStorage.setItem('pp.seatLayout.v1', JSON.stringify({ cols, rows, cellSize, seats }));
  }, [cols, rows, cellSize, seats]);

  const selected = useMemo(() => seats.find((s) => s.id === selectedId) ?? null, [seats, selectedId]);

  function cellFromEvent(e: { clientX: number; clientY: number }) {
    const g = gridRef.current;
    if (!g) return { x: 0, y: 0 };
    const r = g.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cellSize);
    const y = Math.floor((e.clientY - r.top) / cellSize);
    return {
      x: Math.max(0, Math.min(cols - 1, x)),
      y: Math.max(0, Math.min(rows - 1, y)),
    };
  }

  function dropFromPalette(e: React.MouseEvent) {
    if (!paletteDrag) return;
    const { x, y } = cellFromEvent(e);
    const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const label = paletteDrag.type === 'seat' ? String(autoLabelN) : paletteDrag.label;
    const newSeat: PlacedSeat = {
      id,
      label,
      x: clampX(x, paletteDrag.w),
      y: clampY(y, paletteDrag.h),
      w: paletteDrag.w,
      h: paletteDrag.h,
      type: paletteDrag.type,
    };
    setSeats((prev) => [...prev, newSeat]);
    if (paletteDrag.type === 'seat') setAutoLabelN((n) => n + 1);
    setSelectedId(id);
    setPaletteDrag(null);
  }

  function clampX(x: number, w: number) { return Math.max(0, Math.min(cols - w, x)); }
  function clampY(y: number, h: number) { return Math.max(0, Math.min(rows - h, y)); }

  function onSeatMouseDown(e: React.MouseEvent, s: PlacedSeat) {
    if (mode !== 'edit') return;
    e.stopPropagation();
    setSelectedId(s.id);
    const { x, y } = cellFromEvent(e);
    setDragging({ id: s.id, offX: x - s.x, offY: y - s.y });
  }

  function onGridMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const { x, y } = cellFromEvent(e);
    setSeats((prev) => prev.map((s) =>
      s.id === dragging.id
        ? { ...s, x: clampX(x - dragging.offX, s.w), y: clampY(y - dragging.offY, s.h) }
        : s,
    ));
  }

  function onGridMouseUp() {
    setDragging(null);
  }

  function updateSelected(patch: Partial<PlacedSeat>) {
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
    setSeats([]);
    setSelectedId(null);
    setAutoLabelN(1);
  }

  return (
    <>
      <PageHeader
        title="좌석 배치"
        desc="팔레트에서 도형을 골라 그리드에 드래그하세요."
        actions={
          <>
            <div className="rounded-md bg-slate-100 p-0.5 text-sm">
              {(['edit', 'view'] as EditorMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 ${mode === m ? 'bg-white shadow-sm font-semibold' : 'text-slate-600'}`}
                >
                  {m === 'edit' ? '편집' : '보기'}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={clearAll}>전체 초기화</button>
          </>
        }
      />

      <div className="flex h-[calc(100%-65px)]">
        {/* 팔레트 */}
        {mode === 'edit' && (
          <aside className="w-56 border-r border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold text-slate-500">도형 팔레트</div>
            <div className="grid grid-cols-2 gap-2">
              {PALETTE.map((p) => (
                <button
                  key={p.type + p.label}
                  onMouseDown={() => setPaletteDrag(p)}
                  className={`flex flex-col items-center justify-center rounded-md px-2 py-3 text-xs ring-1 hover:scale-[1.02] ${p.bg} ${paletteDrag === p ? 'ring-2 ring-brand-500' : ''}`}
                >
                  <span className="text-lg">{p.emoji}</span>
                  <span className="mt-1 font-medium">{p.label}</span>
                  <span className="text-[10px] text-slate-500">{p.w}×{p.h}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-3 text-xs">
              <div className="mb-2 font-semibold text-slate-500">그리드 설정</div>
              <label className="mb-1 block text-slate-600">
                가로 칸 수
                <input className="input mt-1" type="number" value={cols} min={4} max={60}
                  onChange={(e) => setCols(Math.max(4, Math.min(60, +e.target.value)))} />
              </label>
              <label className="mb-1 block text-slate-600">
                세로 칸 수
                <input className="input mt-1" type="number" value={rows} min={4} max={60}
                  onChange={(e) => setRows(Math.max(4, Math.min(60, +e.target.value)))} />
              </label>
              <label className="mb-1 block text-slate-600">
                칸 크기(px)
                <input className="input mt-1" type="number" value={cellSize} min={20} max={80}
                  onChange={(e) => setCellSize(Math.max(20, Math.min(80, +e.target.value)))} />
              </label>
            </div>

            {paletteDrag && (
              <div className="mt-3 rounded-md bg-brand-50 p-2 text-xs text-brand-700">
                <b>{paletteDrag.label}</b> 선택됨. 그리드에서 클릭하면 배치됩니다.
                <button className="ml-2 underline" onClick={() => setPaletteDrag(null)}>취소</button>
              </div>
            )}
          </aside>
        )}

        {/* 그리드 */}
        <div className="flex-1 overflow-auto p-6">
          <div
            ref={gridRef}
            onClick={(e) => {
              if (paletteDrag) dropFromPalette(e);
              else if (e.target === gridRef.current) setSelectedId(null);
            }}
            onMouseMove={onGridMouseMove}
            onMouseUp={onGridMouseUp}
            onMouseLeave={onGridMouseUp}
            className="relative border border-slate-300 bg-white"
            style={{
              width: cols * cellSize,
              height: rows * cellSize,
              backgroundImage:
                `linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                 linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)`,
              backgroundSize: `${cellSize}px ${cellSize}px`,
              cursor: paletteDrag ? 'crosshair' : 'default',
            }}
          >
            {seats.map((s) => (
              <SeatBox
                key={s.id}
                seat={s}
                cellSize={cellSize}
                selected={selectedId === s.id}
                mode={mode}
                onMouseDown={(e) => onSeatMouseDown(e, s)}
              />
            ))}
          </div>
        </div>

        {/* 인스펙터 */}
        {mode === 'edit' && (
          <aside className="w-64 border-l border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-semibold text-slate-500">선택 항목</div>
            {!selected && (
              <p className="text-sm text-slate-400">좌석을 선택하거나 팔레트에서 도형을 배치하세요.</p>
            )}
            {selected && (
              <div className="space-y-3 text-sm">
                <div className="text-xs text-slate-500">유형: {selected.type}</div>
                <label className="block">
                  표시 라벨
                  <input className="input mt-1" value={selected.label}
                    onChange={(e) => updateSelected({ label: e.target.value })} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    가로(w)
                    <input className="input mt-1" type="number" value={selected.w} min={1}
                      onChange={(e) => updateSelected({ w: Math.max(1, +e.target.value) })} />
                  </label>
                  <label className="block">
                    세로(h)
                    <input className="input mt-1" type="number" value={selected.h} min={1}
                      onChange={(e) => updateSelected({ h: Math.max(1, +e.target.value) })} />
                  </label>
                  <label className="block">
                    X
                    <input className="input mt-1" type="number" value={selected.x} min={0}
                      onChange={(e) => updateSelected({ x: clampX(+e.target.value, selected.w) })} />
                  </label>
                  <label className="block">
                    Y
                    <input className="input mt-1" type="number" value={selected.y} min={0}
                      onChange={(e) => updateSelected({ y: clampY(+e.target.value, selected.h) })} />
                  </label>
                </div>
                <button className="btn-danger w-full" onClick={deleteSelected}>삭제</button>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
              총 좌석: <b className="text-slate-700">{seats.filter((s) => s.type === 'seat').length}</b>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

function SeatBox({
  seat, cellSize, selected, mode, onMouseDown,
}: {
  seat: Seat; cellSize: number; selected: boolean; mode: EditorMode;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const palette = PALETTE.find((p) => p.type === seat.type);
  const bg = palette?.bg ?? 'bg-slate-100 ring-slate-300';
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: seat.x * cellSize,
        top: seat.y * cellSize,
        width: seat.w * cellSize,
        height: seat.h * cellSize,
      }}
      className={`flex select-none items-center justify-center rounded-md text-xs font-semibold ring-2 transition ${bg} ${
        selected ? 'ring-brand-600 shadow-lg' : ''
      } ${mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      {seat.label}
    </div>
  );
}
