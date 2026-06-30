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

// startAt 부터 N개월 후 "같은 날짜" KST 00:00.
// 시작일 day 가 대상 월에 없으면 (예: 1/31 + 1개월 → 2/31 없음) 그 월의 마지막 날로 클램프.
function addMonthsKstClamped(startAt: number, months: number): number {
  const start = new Date(startAt + KST_OFFSET_MS);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const day = start.getUTCDate();
  const totalMonths = m + months;
  const newY = y + Math.floor(totalMonths / 12);
  const newM = ((totalMonths % 12) + 12) % 12;
  // 다음 달의 0일 = 현재 달의 마지막 날
  const lastDay = new Date(Date.UTC(newY, newM + 1, 0)).getUTCDate();
  const newDay = Math.min(day, lastDay);
  return Date.UTC(newY, newM, newDay) - KST_OFFSET_MS;
}

// 시작 시각 + 기간 → 만료일 KST 00:00.
//   durationMonths : 캘린더 N개월 — (시작일 + N개월 - 1일). 7/1 + 1개월 = 7/31, 6/1 + 1개월 = 6/30.
//   durationDays   : 정확히 N일 — 시작일 포함 N일째 (시작일 + (N-1)일).
// 둘 다 없으면 undefined (만료 없음 — 시간권/회차권은 호출 측에서 처리).
export function computeEndAt(
  startAt: number,
  opts: { durationDays?: number; durationMonths?: number },
): number | undefined {
  if (opts.durationMonths && opts.durationMonths > 0) {
    return addMonthsKstClamped(startAt, opts.durationMonths) - 86400000;
  }
  if (opts.durationDays && opts.durationDays > 0) {
    return startAt + (opts.durationDays - 1) * 86400000;
  }
  return undefined;
}

// 활성 이용권 중 가장 늦은 종료 시각 (현재 + 예정 모두 포함). D-day 계산용.
export function lastActiveEndOf<T extends SubLike>(subs: T[], studentId: string): number | null {
  const ends = subs
    .filter((s) => s.studentId === studentId && s.status === 'active' && s.endAt)
    .map((s) => s.endAt as number);
  return ends.length > 0 ? Math.max(...ends) : null;
}
