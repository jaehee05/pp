import { useEffect, useState } from 'react';
import type { Seat } from './types';
import { firestoreStorage } from './firestoreStorage';
import { liveAppState } from './firestoreSync';

const STORE_KEY = 'pp.seatLayout.v3';

// 좌석 레이아웃을 다른 페이지에서 read-only 로 구독.
// Seats.tsx 와 동일한 Firestore 문서를 본다.
export function useSeats(): Seat[] {
  const [seats, setSeats] = useState<Seat[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.resolve(firestoreStorage.getItem(STORE_KEY)).then((raw) => {
      if (!active || !raw) return;
      try {
        const v = JSON.parse(raw) as { seats?: Seat[] };
        if (v.seats) setSeats(v.seats);
      } catch { /* */ }
    });
    const unsub = liveAppState(STORE_KEY, (json) => {
      try {
        const v = JSON.parse(json) as { seats?: Seat[] };
        if (v.seats) setSeats(v.seats);
      } catch { /* */ }
    });
    return () => { active = false; unsub(); };
  }, []);
  return seats;
}

export function seatOfStudent(seats: Seat[], studentId: string): Seat | null {
  return seats.find((s) => s.assignedStudentId === studentId) ?? null;
}

// Seats.tsx 외부(예: OpsMember 의 결제 후 좌석 선택 모달)에서 좌석 배정 갱신.
// firestoreStorage 상의 pp.seatLayout.v3 JSON 을 직접 머지해 저장.
// Seats.tsx 는 liveAppState 구독으로 자동 갱신.
export async function assignSeatToStudent(seatId: string, studentId: string): Promise<boolean> {
  const raw = await Promise.resolve(firestoreStorage.getItem(STORE_KEY));
  if (!raw) return false;
  let parsed: { seats?: Seat[]; [k: string]: unknown };
  try { parsed = JSON.parse(raw) as { seats?: Seat[] }; } catch { return false; }
  if (!Array.isArray(parsed.seats)) return false;
  const idx = parsed.seats.findIndex((s) => s.id === seatId);
  if (idx < 0) return false;
  const seat = parsed.seats[idx];
  if (seat.assignedStudentId === studentId) return true;
  const history = seat.assignmentHistory ?? [];
  parsed.seats[idx] = {
    ...seat,
    assignedStudentId: studentId,
    assignmentHistory: [...history, { studentId, assignedAt: Date.now() }],
  };
  await firestoreStorage.setItem(STORE_KEY, JSON.stringify(parsed));
  return true;
}
