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
