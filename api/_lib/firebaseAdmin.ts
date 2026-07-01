// Firebase Admin SDK 지연 로더 (Vercel 서버리스 공용).
// firebase-admin v12+ 는 namespace 형태 (admin.credential.cert) 가 dynamic import
// 로는 접근 안 됨 → 모듈러 subpath import (`firebase-admin/app`, `firebase-admin/firestore`)
// 를 사용한다.
//
// 환경변수:
//   GOOGLE_APPLICATION_CREDENTIALS_JSON  서비스 어카운트 JSON (raw or base64)
//   FIREBASE_SERVICE_ACCOUNT_JSON        위 값의 alias (하위호환)
//   FIREBASE_PROJECT_ID                  프로젝트 ID (예: passplace-9b4f7)
//
// 반환:
//   { firestore }  성공 시 Firestore 인스턴스를 뽑는 함수
//   null           초기화 실패. 이유는 `lastFirebaseAdminError` 에 저장됨.

export let lastFirebaseAdminError: string | null = null;

// 한번 초기화한 firestore 는 캐시 (invocation 재사용).
let cached: { firestore: () => unknown } | null = null;

export async function loadFirebaseAdmin(): Promise<{ firestore: () => unknown } | null> {
  if (cached) return cached;
  lastFirebaseAdminError = null;
  try {
    const appMod = await import('firebase-admin/app');
    const fsMod = await import('firebase-admin/firestore');
    const { initializeApp, getApps, cert } = appMod as unknown as {
      initializeApp: (opts: Record<string, unknown>) => unknown;
      getApps: () => unknown[];
      cert: (sa: Record<string, unknown>) => unknown;
    };
    const { getFirestore } = fsMod as unknown as { getFirestore: () => unknown };

    if (getApps().length === 0) {
      const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (!saJson) {
        lastFirebaseAdminError = 'GOOGLE_APPLICATION_CREDENTIALS_JSON env var missing/empty';
        return null;
      }
      let sa: Record<string, unknown>;
      try {
        const decoded = saJson.trim().startsWith('{') ? saJson : Buffer.from(saJson, 'base64').toString('utf8');
        sa = JSON.parse(decoded);
      } catch (e) {
        lastFirebaseAdminError = `sa JSON parse failed: ${e instanceof Error ? e.message : String(e)}`;
        return null;
      }
      const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FB_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? (sa.project_id as string | undefined);
      if (!projectId) {
        lastFirebaseAdminError = 'FIREBASE_PROJECT_ID env var missing (and none in service account JSON)';
        return null;
      }
      try {
        initializeApp({ credential: cert(sa), projectId });
      } catch (e) {
        lastFirebaseAdminError = `initializeApp failed: ${e instanceof Error ? e.message : String(e)}`;
        return null;
      }
    }
    cached = { firestore: () => getFirestore() };
    return cached;
  } catch (e) {
    lastFirebaseAdminError = `firebase-admin module load failed: ${e instanceof Error ? e.message : String(e)}`;
    return null;
  }
}
