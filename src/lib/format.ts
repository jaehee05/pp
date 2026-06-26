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

// 로컬 시간대 기준 YYYY-MM-DD. toISOString() 은 UTC 라 KST 자정이 전날로 밀리는 버그 방지.
export function toLocalISODate(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// YYYY-MM-DD 문자열 → 로컬 자정 timestamp. new Date(s).getTime() 은 UTC 자정이라 9시간 차이.
export function fromLocalISODate(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
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
