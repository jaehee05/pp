import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// 숫자 입력 필드 클릭 시 전체선택. number/text 모두 적용 (focus는 bubble 안 하므로 capture phase).
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && (t.type === 'number' || t.type === 'tel' || t.dataset.selectOnFocus === 'true')) {
    requestAnimationFrame(() => {
      try { t.select(); } catch { /* */ }
    });
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
