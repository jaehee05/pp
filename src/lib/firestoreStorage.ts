import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
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
      try {
        const snap = await getDoc(doc(db, COLLECTION, name));
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
