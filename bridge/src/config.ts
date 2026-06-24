import 'dotenv/config';

function num(v: string | undefined, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function bool(v: string | undefined, def: boolean) {
  if (v == null) return def;
  return /^(1|true|y|yes)$/i.test(v.trim());
}

export const config = {
  wsPort: num(process.env.WS_PORT, 7421),

  nice: {
    host: process.env.NICE_HOST ?? '127.0.0.1',
    port: num(process.env.NICE_PORT, 9188),
    merchantMain: process.env.NICE_MERCHANT_MAIN ?? '',
    merchantSub: process.env.NICE_MERCHANT_SUB ?? '',
    encoding: process.env.NICE_ENCODING ?? 'cp949',
    taxFree: bool(process.env.NICE_TAX_FREE, true),
  },

  biostar: {
    baseUrl: process.env.BIOSTAR_BASE_URL ?? '',
    username: process.env.BIOSTAR_USERNAME ?? 'admin',
    password: process.env.BIOSTAR_PASSWORD ?? '',
    insecureTls: bool(process.env.BIOSTAR_INSECURE_TLS, true),
    pollMs: num(process.env.BIOSTAR_POLL_MS, 3000),
    deviceId: process.env.BIOSTAR_DEVICE_ID ?? '',
  },
};

export function summary() {
  const c = config;
  return [
    `WS port: ${c.wsPort}`,
    `NICE: ${c.nice.host}:${c.nice.port} merchant=${c.nice.merchantMain || '(none)'} ${c.nice.taxFree ? '(면세)' : ''}`,
    `BioStar: ${c.biostar.baseUrl || '(미설정)'} user=${c.biostar.username} device=${c.biostar.deviceId || '(any)'}`,
  ].join('\n');
}
