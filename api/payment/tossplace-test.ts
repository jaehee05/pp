// 토스플레이스 Open API 자격증명(access/secret key + merchantId) 테스트 엔드포인트.
// GET /api/payment/tossplace-test → 등록된 merchantId 로 최근 결제 1건 조회 시도.
// 성공하면 credentials 정상. 실패하면 상세 에러 반환.
//
// 환경변수:
//   TOSSPLACE_ACCESS_KEY   x-access-key
//   TOSSPLACE_SECRET_KEY   x-secret-key
//   TOSSPLACE_MERCHANT_ID  주 조회 대상 merchantId (없으면 _MAIN, _SUB 순 fallback)
//   TOSSPLACE_MERCHANT_ID_MAIN
//   TOSSPLACE_MERCHANT_ID_SUB
//   TOSSPLACE_OPENAPI_BASE_URL   (기본: https://open-api.tossplace.com/api-public/openapi/v1)

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_BASE = 'https://open-api.tossplace.com/api-public/openapi/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const accessKey = process.env.TOSSPLACE_ACCESS_KEY ?? '';
  const secretKey = process.env.TOSSPLACE_SECRET_KEY ?? '';
  const merchantId =
    process.env.TOSSPLACE_MERCHANT_ID ??
    process.env.TOSSPLACE_MERCHANT_ID_MAIN ??
    process.env.TOSSPLACE_MERCHANT_ID_SUB ??
    '';
  const base = (process.env.TOSSPLACE_OPENAPI_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');

  const missing: string[] = [];
  if (!accessKey) missing.push('TOSSPLACE_ACCESS_KEY');
  if (!secretKey) missing.push('TOSSPLACE_SECRET_KEY');
  if (!merchantId) missing.push('TOSSPLACE_MERCHANT_ID (또는 _MAIN/_SUB)');
  if (missing.length > 0) {
    return res.status(200).json({
      ok: false,
      stage: 'env',
      missing,
      hint: 'Vercel Settings → Environment Variables 에 등록 후 Redeploy 필요',
    });
  }

  // 가장 무해한 endpoint 로 credentials 만 검증 — 존재하지 않는 orderId (숫자) 로 결제 조회.
  // 토스플레이스 orderId 는 Java long — 큰 소수 하나 넣어 존재 안 하는 걸 유도.
  // 인증 실패면 401/403, 인증 성공하지만 데이터 없으면 200/success=[].
  const testOrderId = '99999999999999';
  const url = `${base}/merchants/${encodeURIComponent(merchantId)}/payment/payments/by-order-id?orderId=${testOrderId}`;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'x-access-key': accessKey,
        'x-secret-key': secretKey,
        'Content-Type': 'application/json',
      },
    });
    const text = await resp.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text.slice(0, 400); }

    // 인증 성공 판정:
    //   200 + resultType=SUCCESS → 인증 OK, 데이터 없음이면 success=[] 이나 null
    //   401/403 → 인증 실패
    //   404 → merchant 없거나 endpoint 잘못
    const j = (json ?? {}) as { resultType?: string; error?: { errorCode?: string; reason?: string } };
    if (resp.status === 200 && j.resultType === 'SUCCESS') {
      return res.status(200).json({
        ok: true,
        stage: 'authenticated',
        merchantId,
        note: 'Open API 자격증명 정상 확인됨. 테스트 orderId 로 조회했으므로 결과는 비어있음.',
        raw: json,
      });
    }
    return res.status(200).json({
      ok: false,
      stage: 'auth-or-request',
      httpStatus: resp.status,
      resultType: j.resultType,
      errorCode: j.error?.errorCode,
      reason: j.error?.reason,
      merchantId,
      url,
      raw: json,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      stage: 'fetch-error',
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
