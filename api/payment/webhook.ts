// 토스페이먼츠 webhook 수신 endpoint.
// 가상계좌 입금 이벤트 (deposit_callback) 또는 결제 상태 변경 (payment_status_changed) 수신.
//
// 토스 → POST {여기 endpoint} → 우리가 200 응답 + Firestore PendingOrder 업데이트.
//
// 등록: 토스 개발자센터 > 웹훅 > URL 등록 → https://passplace.space/api/payment/webhook
//
// 검증: 가상계좌 deposit_callback 은 body 에 secret 이 들어옴. 토스에서 발급한 우리 secret 과 비교.
//       payment_status_changed 는 Payment 객체 안의 secret 으로 검증.
//
// 현재 구현은 webhook 수신만 로깅 + 200 응답. 실제 Firestore 갱신은
// 클라이언트 측 폴링 (또는 별도 cloud function 으로 처리 권장).

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DepositCallback {
  secret?: string;
  orderId: string;
  status: 'DONE' | 'WAITING_FOR_DEPOSIT' | 'CANCELED' | 'PARTIAL_CANCELED' | 'EXPIRED' | 'ABORTED';
  transactionKey?: string;
  createdAt?: string;
  paymentKey?: string;
  amount?: number;
}

interface StatusChangedEvent {
  eventType?: 'PAYMENT_STATUS_CHANGED';
  data?: {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    secret?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 토스는 POST 로 보냄. GET 은 health check 용도로 200 응답.
  if (req.method === 'GET') return res.status(200).send('OK');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body: DepositCallback | StatusChangedEvent;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  // 로깅 (Vercel function logs 에서 확인 가능)
  // eslint-disable-next-line no-console
  console.log('[toss webhook]', JSON.stringify(body));

  // TODO: 실제 운영에서는 Firebase Admin SDK 로 Firestore 직접 갱신.
  // 현재는 클라이언트가 주기적으로 토스 결제 조회 API (/v1/payments/{paymentKey}) 폴링 권장.

  // 토스는 200 응답이 와야 webhook 성공으로 간주. 실패 응답이면 재시도.
  res.status(200).json({ ok: true });
}
