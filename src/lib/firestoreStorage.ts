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
