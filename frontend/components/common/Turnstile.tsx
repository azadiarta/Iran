'use client';
import { useEffect, useId, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

// Cloudflare's published "always passes" test site key — used when no real
// key is configured, so the widget renders and CAPTCHA-gated forms keep
// working in dev/preview without a Cloudflare account.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile script'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Renders a Cloudflare Turnstile CAPTCHA widget. `resetKey` lets the parent
// force a fresh token after a failed submit, since each token is single-use.
export default function Turnstile({
  onVerify,
  onExpire,
  resetKey,
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  resetKey?: unknown;
}) {
  const containerId = `turnstile-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadTurnstileScript().then(() => {
      if (!mounted || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
        sitekey: SITE_KEY,
        theme: 'dark',
        callback: onVerify,
        'expired-callback': onExpire,
      });
    });
    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resetKey !== undefined && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  return <div id={containerId} />;
}
