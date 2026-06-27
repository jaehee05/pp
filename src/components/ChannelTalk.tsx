import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

// 채널톡 플러그인 키 (브라우저 공개용 — 토스 client key 처럼 시크릿 아님).
const CHANNEL_PLUGIN_KEY = '132db1c0-5890-41f2-b530-e280720b6b6b';

// 채널톡이 등록하는 전역 함수 타입.
interface ChannelIOFn {
  (cmd: string, ...args: unknown[]): void;
  c?: (args: unknown[]) => void;
  q?: unknown[][];
}
interface ChannelWindow extends Window {
  ChannelIO?: ChannelIOFn;
  ChannelIOInitialized?: boolean;
}

// 키오스크에서는 채널톡 버튼 가리기 (학생/방문자 화면이라 운영자 상담 필요 X).
function isKioskPath(pathname: string): boolean {
  return pathname === '/kiosk' || pathname.startsWith('/kiosk/');
}

export function ChannelTalk() {
  const current = useAuth((s) => s.current());
  const loc = useLocation();

  // 1) SDK 로드 — 최초 1회.
  useEffect(() => {
    const w = window as unknown as ChannelWindow;
    if (w.ChannelIO) return;
    const ch: ChannelIOFn = function (...args: unknown[]) {
      ch.c?.(args);
    } as ChannelIOFn;
    ch.q = [];
    ch.c = (args) => { ch.q?.push(args); };
    w.ChannelIO = ch;
    function load() {
      if (w.ChannelIOInitialized) return;
      w.ChannelIOInitialized = true;
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.async = true;
      s.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
      const x = document.getElementsByTagName('script')[0];
      if (x.parentNode) x.parentNode.insertBefore(s, x);
    }
    if (document.readyState === 'complete') load();
    else {
      window.addEventListener('DOMContentLoaded', load);
      window.addEventListener('load', load);
    }
  }, []);

  // 2) boot / shutdown — 로그인 상태 + 경로 변화에 따라 갱신.
  useEffect(() => {
    const w = window as unknown as ChannelWindow;
    if (!w.ChannelIO) return;

    if (isKioskPath(loc.pathname)) {
      w.ChannelIO('shutdown');
      return;
    }

    if (current) {
      w.ChannelIO('boot', {
        pluginKey: CHANNEL_PLUGIN_KEY,
        memberId: current.id,
        profile: {
          name: current.name,
          username: current.username,
          accountType: current.temp ? '임시 관리자' : '관리자',
        },
      });
    } else {
      // 비로그인 상태에서도 띄움 (로그인 페이지 등에서도 문의 가능).
      w.ChannelIO('boot', { pluginKey: CHANNEL_PLUGIN_KEY });
    }

    return () => {
      // 다음 effect 가 다시 boot 하므로 shutdown 은 생략 가능하지만,
      // 라우트 변경 시 깜빡임 방지를 위해 그대로 둔다.
    };
  }, [current?.id, current?.name, current?.username, current?.temp, loc.pathname]);

  return null;
}
