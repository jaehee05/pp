import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Firebase 웹 config는 비밀값이 아니다(클라이언트 번들에 공개되도록 설계됨).
// 실제 접근 보안은 Firestore 보안 규칙으로 강제한다. 따라서 기본값을 코드에 둔다.
// env(VITE_FB_*)가 있으면 그 값으로 덮어쓴다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY ?? 'AIzaSyDIGK1dtkEUbyZvG3CmsUVnu9AJKEcLjFI',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN ?? 'passplace-9b4f7.firebaseapp.com',
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? 'passplace-9b4f7',
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET ?? 'passplace-9b4f7.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID ?? '26562408903',
  appId: import.meta.env.VITE_FB_APP_ID ?? '1:26562408903:web:d486982e59fdff8c2f69e2',
};

// Firebase 자격증명(env)이 모두 설정된 경우에만 초기화.
// 미설정 시 앱은 localStorage 폴백으로 동작한다(firestoreStorage 참고).
export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app: FirebaseApp | null = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
