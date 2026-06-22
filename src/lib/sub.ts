// 학생의 현재 활성 이용권 + D-day 계산 헬퍼.
export interface ActiveSubInfo {
  endAt: number;        // epoch ms
  ddays: number;        // 양수=남은 일수, 0=오늘, 음수=만료 후
  expiryShort: string;  // "26/06/30"
}

export function ddayOf(endAt: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endAt);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function expiryShort(endAt: number): string {
  const d = new Date(endAt);
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function ddayLabel(d: number): string {
  if (d === 0) return 'D-DAY';
  if (d > 0) return `D-${String(d).padStart(2, '0')}`;
  return `D+${String(-d).padStart(2, '0')}`;
}
