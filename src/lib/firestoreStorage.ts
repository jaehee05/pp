import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import type { StateStorage } from 'zustand/middleware';
import { db, firebaseEnabled } from './firebase';

// zustand persist용 저장소 어댑터.
// - Firebase 자격증명이 설정돼 있으면 Firestore(컬렉션 appState, 문서 id = store 이름)에 저장.
// - 동시에 localStorage에도 캐시해 오프라인/초기 로딩 속도를 보장.
// - Firebase 미설정 또는 네트워크 실패 시 localStorage만으로 동작.
//
// 데이터 모델: 단일 매장(테넌트) 기준. 각 store 상태(JSON 문자열)를
// appState/{name} 문서의 `json` 필드에 통째로 저장한다.

const COLLECTION = 'appState';

// Firestore가 셋업 전이거나 네트워크가 막히면 getDoc이 응답/에러 없이
// 멈출 수 있다. 그 경우 하이드레이션이 끝나지 않아 앱이 무한 로딩된다.
// → 읽기에 타임아웃을 걸어, 일정 시간 내 응답이 없으면 localStorage로 폴백한다.
const READ_TIMEOUT_MS = 3500;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: T) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => finish(fallback), ms);
    p.then(finish, () => finish(fallback));
  });
}

function localGet(name: string): string | null {
  try { return localStorage.getItem(name); } catch { return null; }
}
function localSet(name: string, value: string) {
  try { localStorage.setItem(name, value); } catch { /* quota/private mode */ }
}
function localRemove(name: string) {
  try { localStorage.removeItem(name); } catch { /* */ }
}

export const firestoreStorage: StateStorage = {
  async getItem(name) {
    if (firebaseEnabled && db) {
      const database = db;
      const read = (async (): Promise<string | null> => {
        try {
          const snap = await getDoc(doc(database, COLLECTION, name));
          if (snap.exists()) {
            const json = (snap.data() as { json?: string }).json ?? null;
            if (json != null) localSet(name, json); // 로컬 캐시 갱신
            return json;
          }
          // Firestore에 문서가 없으면 로컬 캐시로 폴백(최초 마이그레이션 케이스).
          return localGet(name);
        } catch {
          return localGet(name);
        }
      })();
      // 응답이 늦으면(셋업 전/네트워크 차단) localStorage 캐시로 즉시 진행.
      return withTimeout(read, READ_TIMEOUT_MS, localGet(name));
    }
    return localGet(name);
  },

  async setItem(name, value) {
    // 방어: Firestore 에 실제 데이터가 있는데 이번 write 가 defaults/빈 상태처럼 보이면 거부.
    // 하이드레이션 실패 시 초기 defaults 가 persist write 로 흘러들어 실제 데이터를
    // 덮어쓴 사고(2026-07-01) 재발 방지용 안전망.
    if (firebaseEnabled && db && looksLikeDefaultsPayload(value)) {
      try {
        const cur = await getDoc(doc(db, COLLECTION, name));
        if (cur.exists()) {
          const curJson = (cur.data() as { json?: string }).json ?? '';
          if (curJson && !looksLikeDefaultsPayload(curJson)) {
            // 로컬 캐시만 지역적으로 갱신 (다른 브라우저는 온전한 Firestore 원본을 계속 봄).
            // localStorage 도 덮어쓰지 않음 — 백업 소스 보호.
            console.warn(`[firestoreStorage] REFUSED empty overwrite of ${name} (Firestore has data)`);
            return;
          }
        }
      } catch { /* 원격 확인 실패 시 아래 정상 flow 로 진행 */ }
    }
    localSet(name, value); // 항상 로컬 캐시 우선 기록
    if (firebaseEnabled && db) {
      try {
        await setDoc(doc(db, COLLECTION, name), { json: value, updatedAt: Date.now() });
      } catch { /* 오프라인 등 — 로컬 캐시는 이미 기록됨 */ }
    }
  },

  async removeItem(name) {
    localRemove(name);
    if (firebaseEnabled && db) {
      try { await deleteDoc(doc(db, COLLECTION, name)); } catch { /* */ }
    }
  },
};

// 주어진 JSON 문자열이 "실 데이터 없는 초기/defaults 상태" 처럼 보이는지 판정.
// 아래 배열/맵 필드가 전부 비어있으면 defaults 로 간주 — persist 가 하이드레이션 실패 후
// 초기 상태 그대로 쓰려는 상황일 가능성이 큼. 진짜 신규 매장이라도 subs/students/logs 등
// 하나라도 있으면 defaults 로 안 봄.
function looksLikeDefaultsPayload(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    const state = (parsed?.state ?? parsed) as Record<string, unknown> | null;
    if (!state || typeof state !== 'object') return false;
    // 검사 필드: 어느 스토어에서든 실 데이터가 있으면 배열 길이 > 0.
    const dataFields = ['subs', 'pays', 'pendingOrders', 'list', 'logs', 'seats'];
    for (const k of dataFields) {
      const v = state[k];
      if (Array.isArray(v) && v.length > 0) return false;
    }
    // 위 필드 어느 것도 채워지지 않았고 최소 하나라도 존재 → defaults 로 간주.
    return dataFields.some((k) => Array.isArray(state[k]));
  } catch {
    return false;
  }
}

// 외부(웹훅 등)에서 appState/{name} 문서를 직접 갱신했을 때 zustand 스토어 자동 rehydrate.
//   - hasPendingWrites=true : 내 로컬 write 의 즉시 콜백 → 내용을 lastJson 으로 기록해
//                              뒤따라올 server-confirm 콜백을 자기 echo 로 인식하게 한다.
//   - hasPendingWrites=false: 서버 확정 — lastJson 과 다르면 외부 변경이므로 rehydrate.
// 권한/네트워크 오류는 무시 (다음 변경 콜백에서 자연 재시도).
export function subscribeExternalUpdates(name: string, rehydrate: () => Promise<unknown> | void) {
  if (!firebaseEnabled || !db || typeof window === 'undefined') return () => { /* noop */ };
  let lastJson: string | null = null;
  try { lastJson = localStorage.getItem(name); } catch { /* ignore */ }
  return onSnapshot(
    doc(db, COLLECTION, name),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { json?: string } | undefined;
      const json = data?.json;
      if (!json) return;
      if (snap.metadata.hasPendingWrites) {
        lastJson = json;
        return;
      }
      if (json === lastJson) return;
      lastJson = json;
      void rehydrate();
    },
    () => { /* permission/network 오류 무시 */ },
  );
}
