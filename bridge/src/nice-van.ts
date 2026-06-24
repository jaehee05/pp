import net from 'node:net';
import iconv from 'iconv-lite';
import { config } from './config.js';

// NICE VAN 결제 클라이언트.
// 가정: PC에 NICE VAN 미들웨어(NICEPAY POS Connector 등)가 설치되어 127.0.0.1:9188 에서 듣고 있음.
// 실제 패킷 포맷은 NICE에서 받은 "POS-VAN 연동규격서" 문서를 따라야 함.
// 아래는 통상적인 NICE VAN 텍스트 패킷 구조 골격이며, 필드 구성·길이·구분자는
// 발급받은 규격서대로 nicePacket() 함수 안을 채워야 한다.
//
// 일반 흐름:
//   [4byte 헤더 길이] [본문]
// 본문은 ASCII/CP949, 필드 구분자 FS(0x1C). 응답도 동일 구조.

const FS = '\x1C';      // 필드 구분자
const ETX = '\x03';     // 종료 (사용 안 하는 규격도 있음)

export interface PayRequest {
  amount: number;
  installment?: number;        // 0 = 일시불
  orderId: string;
  merchant?: 'main' | 'sub';   // 메인/서브 사업자 선택
}

export interface PayResult {
  ok: boolean;
  approvalNo?: string;
  approvalDate?: string;       // YYMMDD
  cardIssuer?: string;
  cardNo?: string;             // 마스킹된 번호
  txId?: string;
  rawResponse?: string;
  error?: string;
}

export async function pay(req: PayRequest): Promise<PayResult> {
  const merchant = req.merchant === 'sub' ? config.nice.merchantSub : config.nice.merchantMain;
  if (!merchant) return { ok: false, error: 'NICE merchant ID 미설정' };

  const packet = nicePacket('APPROVAL', merchant, req);
  try {
    const resp = await sendTcp(packet);
    return parseNiceResponse(resp);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancel(approvalNo: string, amount: number, approvalDate: string): Promise<PayResult> {
  const merchant = config.nice.merchantMain;
  if (!merchant) return { ok: false, error: 'NICE merchant ID 미설정' };
  const packet = nicePacket('CANCEL', merchant, { amount, orderId: approvalNo, installment: 0 }, { approvalNo, approvalDate });
  try {
    const resp = await sendTcp(packet);
    return parseNiceResponse(resp);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// =====================================================
// TODO: 실제 NICE 규격서에 맞춰 필드 채워야 함. 아래는 일반적인 구조 예시.
// 각 NICE VAN 미들웨어(NICEPAY/PG-Connector 등)마다 약간씩 다를 수 있다.
// =====================================================
function nicePacket(
  kind: 'APPROVAL' | 'CANCEL',
  merchant: string,
  req: PayRequest,
  extra: { approvalNo?: string; approvalDate?: string } = {},
): Buffer {
  const fields: string[] = [
    // 1. 거래구분: '01'=신용카드 승인, '02'=취소
    kind === 'APPROVAL' ? '01' : '02',
    // 2. 가맹점번호
    merchant,
    // 3. 결제금액
    String(req.amount),
    // 4. 봉사료 (보통 0)
    '0',
    // 5. 세금 (면세 사업자 → 0)
    config.nice.taxFree ? '0' : String(Math.round(req.amount / 11)),
    // 6. 면세금액 (면세 사업자 → 전체)
    config.nice.taxFree ? String(req.amount) : '0',
    // 7. 할부개월 (00=일시불)
    String(req.installment ?? 0).padStart(2, '0'),
    // 8. 주문번호 / 거래고유ID
    req.orderId,
    // 9. 원거래 승인번호 (취소 시)
    extra.approvalNo ?? '',
    // 10. 원거래 승인일자 (취소 시, YYMMDD)
    extra.approvalDate ?? '',
  ];

  const body = fields.join(FS) + FS + ETX;
  const bodyBuf = iconv.encode(body, config.nice.encoding);
  // 4-byte ASCII 길이 헤더
  const header = Buffer.from(String(bodyBuf.length).padStart(4, '0'), 'ascii');
  return Buffer.concat([header, bodyBuf]);
}

function parseNiceResponse(buf: Buffer): PayResult {
  const text = iconv.decode(buf, config.nice.encoding);
  const fields = text.split(FS);
  // TODO: 응답 필드 인덱스도 규격서대로 조정
  // 통상: [응답코드, 응답메시지, 승인번호, 승인일자, 카드사명, 카드번호(마스킹), ...]
  const code = fields[0]?.trim();
  if (code !== '0000' && code !== '00') {
    return {
      ok: false,
      error: fields[1]?.trim() || `응답코드 ${code}`,
      rawResponse: text,
    };
  }
  return {
    ok: true,
    approvalNo: fields[2]?.trim(),
    approvalDate: fields[3]?.trim(),
    cardIssuer: fields[4]?.trim(),
    cardNo: fields[5]?.trim(),
    txId: fields[2]?.trim(),
    rawResponse: text,
  };
}

function sendTcp(packet: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.nice.host, port: config.nice.port });
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`NICE VAN timeout (${config.nice.host}:${config.nice.port})`));
    }, 90_000); // 카드결제는 60~90초 걸릴 수 있음

    socket.on('connect', () => socket.write(packet));
    socket.on('data', (d) => chunks.push(d));
    socket.on('end', () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks));
    });
    socket.on('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}
