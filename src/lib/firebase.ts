import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

// Firebase 자격증명(env)이 모두 설정된 경우에만 초기화.
// 미설정 시 앱은 localStorage 폴백으로 동작한다(firestoreStorage 참고).
export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app: FirebaseApp | null = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
