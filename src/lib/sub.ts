// 학생의 현재 활성 이용권 + D-day 계산 헬퍼.
// 모든 날짜 비교는 KST(UTC+9) 00:00 기준 — 브라우저 timezone 무관.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 주어진 epoch ms 가 속한 KST 날짜의 00:00 epoch ms.
function kstMidnight(ts: number): number {
  const shifted = ts + KST_OFFSET_MS;
  const d = new Date(shifted);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - KST_OFFSET_MS;
}

export interface ActiveSubInfo {
  endAt: number;        // epoch ms
  ddays: number;        // 양수=남은 일수, 0=오늘, 음수=만료 후
  expiryShort: string;  // "26/06/30"
}

export function ddayOf(endAt: number): number {
  const today0 = kstMidnight(Date.now());
  const end0 = kstMidnight(endAt);
  return Math.round((end0 - today0) / 86400000);
}

export function expiryShort(endAt: number): string {
  const d = new Date(endAt + KST_OFFSET_MS);
  const y = String(d.getUTCFullYear()).slice(2);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function ddayLabel(d: number): string {
  if (d === 0) return 'D-DAY';
  if (d > 0) return `D-${String(d).padStart(2, '0')}`;
  return `D+${String(-d).padStart(2, '0')}`;
}

// 활성 이용권 중 현재 시점에 실제로 사용 가능한 것 (status='active' + startAt ≤ 지금 ≤ endAt)
interface SubLike { studentId: string; status: string; startAt: number; endAt?: number }
export function currentSubOf<T extends SubLike>(subs: T[], studentId: string, now = Date.now()): T | null {
  const found = subs
    .filter((s) => s.studentId === studentId && s.status === 'active' && s.startAt <= now && (!s.endAt || s.endAt > now))
    .sort((a, b) => (a.endAt ?? Infinity) - (b.endAt ?? Infinity))[0];
  return found ?? null;
}

// 미래에 시작될 예약 이용권 (갱신 결제로 큐된 것)
export function upcomingSubsOf<T extends SubLike>(subs: T[], studentId: string, now = Date.now()): T[] {
  return subs
    .filter((s) => s.studentId === studentId && s.status === 'active' && s.startAt > now)
    .sort((a, b) => a.startAt - b.startAt);
}

// 주어진 시각의 다음 날 KST 00:00 반환. 갱신 이용권 시작일 계산용.
export function nextDayStart(ts: number): number {
  return kstMidnight(ts) + 86400000;
}

// 활성 이용권 중 가장 늦은 종료 시각 (현재 + 예정 모두 포함). D-day 계산용.
export function lastActiveEndOf<T extends SubLike>(subs: T[], studentId: string): number | null {
  const ends = subs
    .filter((s) => s.studentId === studentId && s.status === 'active' && s.endAt)
    .map((s) => s.endAt as number);
  return ends.length > 0 ? Math.max(...ends) : null;
}
