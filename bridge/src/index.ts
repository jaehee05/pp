import { config, summary } from './config.js';
import { startServer } from './ws-server.js';
import { startPolling } from './biostar.js';

console.log('=============================================');
console.log(' 합격공간 Bridge 0.1.0');
console.log('=============================================');
console.log(summary());
console.log('=============================================');

startServer();

if (config.biostar.baseUrl) {
  startPolling();
} else {
  console.log('[biostar] BIOSTAR_BASE_URL 미설정 — 지문 폴링 비활성');
}

process.on('SIGINT', () => { console.log('\nbye'); process.exit(0); });
