import { onSnapshot, doc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

// Firestore appState/{name} 문서의 변경을 실시간 구독.
// 콜백은 본인이 방금 쓴 변경(hasPendingWrites)은 무시 → 무한 루프 방지.
// 같은 JSON이 반복 들어오면 한 번만 적용.

export function liveAppState(
  name: string,
  applyJson: (json: string) => void,
): () => void {
  if (!firebaseEnabled || !db) return () => {};
  let lastSeen = '';
  const unsub = onSnapshot(
    doc(db, 'appState', name),
    (snap) => {
      // 본인이 쓴 변경은 스킵
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.data() as { json?: string } | undefined;
      const json = data?.json;
      if (!json || json === lastSeen) return;
      lastSeen = json;
      try { applyJson(json); } catch { /* */ }
    },
    (err) => { console.warn('[liveAppState]', name, err); },
  );
  return unsub;
}
