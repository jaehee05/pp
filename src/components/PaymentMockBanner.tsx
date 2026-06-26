import { useEffect, useState } from 'react';
import { fetchPaymentMock } from '../lib/payment';

// 결제선생 API 키 미설정 시 상단 띠배너 표시.
export function PaymentMockBanner() {
  const [mock, setMock] = useState<boolean | null>(null);
  useEffect(() => {
    void fetchPaymentMock().then(setMock);
  }, []);
  if (!mock) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-center text-[12px] font-medium text-amber-900 sm:text-xs">
      💳 결제선생 API 키 미설정 — 카드 결제는 <b>시연 모드</b> (실제 결제·차감 없음)
    </div>
  );
}
