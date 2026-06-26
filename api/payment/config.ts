// 결제선생(PaymentTeacher) 설정 상태 조회 — 클라이언트가 mock 여부 확인용.
// API 키 자체는 노출하지 않고 mock/configured boolean 만 응답.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.PAYMENTTEACHER_API_KEY ?? '';
  const mock = !apiKey || apiKey.startsWith('dummy');
  res.status(200).json({ mock, configured: !mock });
}
