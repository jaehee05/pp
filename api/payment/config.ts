// 토스페이먼츠 설정 상태 조회 — 클라이언트가 mock 여부 확인용.
// 시크릿 키 자체는 노출하지 않고 mock/configured boolean 만 응답.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const env = process.env;
  const main = env.TOSS_SECRET_KEY_MAIN ?? env.TOSS_SECRET_KEY ?? '';
  const sub = env.TOSS_SECRET_KEY_SUB ?? env.TOSS_SECRET_KEY ?? '';
  const isReal = (k: string) => !!k && !k.startsWith('dummy');
  const mainReady = isReal(main);
  const subReady = isReal(sub);
  res.status(200).json({
    mock: !mainReady, // 메인 키만 있으면 카드 결제는 가능
    configured: mainReady,
    main: mainReady,
    sub: subReady,
  });
}
