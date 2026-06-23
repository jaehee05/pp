import { useEffect } from 'react';
import type { Seat } from '../lib/types';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  divider?: boolean;
}

export function SeatContextMenu({
  seat, x, y, assignedName, onClose, onAction,
}: {
  seat: Seat;
  x: number;
  y: number;
  assignedName?: string;
  onClose: () => void;
  onAction: (id: 'memberInfo' | 'assign' | 'release' | 'memo' | 'toggleActive' | 'changeType' | 'history') => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasStudent = !!seat.assignedStudentId;
  const isActive = seat.active !== false;

  const items: ContextMenuAction[] = [
    hasStudent
      ? { id: 'memberInfo', label: '회원 정보', icon: '👤', onClick: () => onAction('memberInfo') }
      : { id: 'assign', label: '회원 배정', icon: '➕', onClick: () => onAction('assign') },
    hasStudent
      ? { id: 'release', label: '배석 해제', icon: '⊝', danger: true, onClick: () => onAction('release') }
      : { id: 'release', label: '배석 해제', icon: '⊝', disabled: true, onClick: () => {} },
    { id: 'memo', label: '메모', icon: '📝', onClick: () => onAction('memo') },
    {
      id: 'toggleActive',
      label: isActive ? '좌석 비활성화' : '좌석 활성화',
      icon: isActive ? '🚫' : '✅',
      onClick: () => onAction('toggleActive'),
    },
    { id: 'changeType', label: '좌석 타입변경 ▸', icon: '⚙', onClick: () => onAction('changeType') },
    { id: 'history', label: '좌석 히스토리', icon: '↻', onClick: () => onAction('history') },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-50 min-w-[180px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        style={{ left: x, top: y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
          {seat.label} - {seat.tag ?? '좌석'}{assignedName ? ` · ${assignedName}` : ''}
        </div>
        <div className="border-b border-slate-100 px-3 py-1 text-[11px] text-slate-400">{seat.tag ?? '고정석'}</div>
        <ul className="py-1 text-sm">
          {items.map((it) => (
            <li key={it.id}>
              <button
                disabled={it.disabled}
                onClick={() => { if (!it.disabled) { it.onClick(); onClose(); } }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
                  it.disabled ? 'cursor-not-allowed text-slate-300' :
                  it.danger ? 'text-rose-600 hover:bg-rose-50' :
                  'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="w-4 text-center">{it.icon}</span>
                <span>{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={onClose}
          className="block w-full border-t border-slate-100 px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50">
          ✕ 닫기
        </button>
      </div>
    </>
  );
}
