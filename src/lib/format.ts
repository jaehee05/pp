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
