import type { Timestamp } from 'firebase/firestore';

export function tsToDate(ts: Timestamp | Date | undefined | null): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate();
  return null;
}

export function fmtTime(ts: Timestamp | Date | undefined | null): string {
  const d = tsToDate(ts);
  if (!d) return '-';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(ts: Timestamp | Date | undefined | null): string {
  const d = tsToDate(ts);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(ts: Timestamp | Date | undefined | null): string {
  const d = tsToDate(ts);
  if (!d) return '-';
  return d.toLocaleDateString('ko-KR');
}

// 한국 시간(KST, UTC+9) 자정 기준. 브라우저 timezone 무관 — 이용권 시작/종료가 KST 00:00 으로 고정.
// (브라우저가 UTC 등 다른 TZ 일 때 "오늘 시작" 이용권이 미래로 계산돼 시작 예정으로 잘못 표시되던 버그 방지)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// epoch ms → KST 기준 YYYY-MM-DD.
export function toLocalISODate(ts: number | Date): string {
  const ms = typeof ts === 'number' ? ts : ts.getTime();
  const d = new Date(ms + KST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// YYYY-MM-DD (KST 날짜) → 해당일 KST 00:00 의 epoch ms.
export function fromLocalISODate(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

export function fmtPhone(p: string | undefined | null): string {
  if (!p) return '-';
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  return p;
}
