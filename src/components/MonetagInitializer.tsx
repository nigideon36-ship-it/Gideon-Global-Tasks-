import React, { useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface MonetagRuntimeConfig {
  monetagEnabled?: boolean;
  monetagDomain?: string;
  monetagZoneId?: string;
  monetagMetaTag?: string;
  monetagScriptSrc?: string;
  monetagScriptTag?: string;
  monetagSwCode?: string;
}

export const MONETAG_CONFIG_EVENT = 'gideon:publisher-config-updated';

function parseMonetagScriptTag(rawTag: string): {
  attrs: Record<string, string>;
  inlineCode: string;
  src: string;
} | null {
  const trimmed = rawTag.trim();
  if (!trimmed) return null;

  if (/^https:\/\/[a-zA-Z0-9.-]+/.test(trimmed)) {
    return {
      attrs: { async: '', 'data-cfasync': 'false' },
      inlineCode: '',
      src: trimmed,
    };
  }

  const match = trimmed.match(/^<script\b([^>]*)>([\s\S]*)<\/script>$/i);
  if (!match || /<\/script>[\s\S]*<script/i.test(trimmed)) {
    return null;
  }

  const attrString = match[1] || '';
  const inlineCode = (match[2] || '').trim();
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(attrString)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    if (!key.startsWith('on')) {
      attrs[key] = val;
    }
  }

  return {
    attrs,
    inlineCode,
    src: attrs.src || '',
  };
}

export const MonetagInitializer: React.FC = () => {
  const applyMonetagConfig = useCallback(async (cfg: MonetagRuntimeConfig) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const enabled = cfg.monetagEnabled !== false;
    const metaHash = String(cfg.monetagMetaTag || '').trim();
    const rawScriptTag = String(cfg.monetagScriptTag || '').trim();
    const scriptSrc = String(cfg.monetagScriptSrc || '').trim();

    // 1. Manage <meta name="monetag" content="...">
    const existingMeta = document.querySelector('meta[name="monetag"]') as HTMLMetaElement | null;
    if (enabled && metaHash) {
      if (existingMeta) {
        existingMeta.setAttribute('content', metaHash);
      } else {
        const meta = document.createElement('meta');
        meta.name = 'monetag';
        meta.content = metaHash;
        document.head.appendChild(meta);
      }
    } else if (existingMeta) {
      existingMeta.remove();
    }

    // 2. Manage Monetag Step 2 <head> MultiTag / In-Page Push / Vignette / OnClick <script>
    const existingManaged = document.getElementById('monetag-zone-script') as HTMLScriptElement | null;
    const parsedTag =
      (rawScriptTag ? parseMonetagScriptTag(rawScriptTag) : null) ||
      (scriptSrc && /^https:\/\/[a-zA-Z0-9.-]+/.test(scriptSrc)
        ? { attrs: { async: '', 'data-cfasync': 'false' }, inlineCode: '', src: scriptSrc }
        : null);

    if (enabled && parsedTag) {
      const headScripts = Array.from(document.head.querySelectorAll('script'));
      const alreadyPresentInHead = headScripts.some((s) => {
        if (s.id === 'monetag-zone-script') return false;
        if (parsedTag.src && s.getAttribute('src') === parsedTag.src) return true;
        if (parsedTag.inlineCode && (s.textContent || '').trim() === parsedTag.inlineCode) return true;
        return false;
      });

      if (!alreadyPresentInHead) {
        const needsRebuild =
          !existingManaged ||
          (parsedTag.src && existingManaged.getAttribute('src') !== parsedTag.src) ||
          (!parsedTag.src && (existingManaged.textContent || '').trim() !== parsedTag.inlineCode) ||
          existingManaged.getAttribute('data-tag-signature') !== (rawScriptTag || scriptSrc);

        if (needsRebuild) {
          if (existingManaged) existingManaged.remove();
          const script = document.createElement('script');
          script.id = 'monetag-zone-script';
          script.setAttribute('data-tag-signature', rawScriptTag || scriptSrc);
          Object.entries(parsedTag.attrs).forEach(([k, v]) => {
            if (k === 'id') return;
            if (k === 'async') {
              script.async = true;
            } else {
              script.setAttribute(k, v);
            }
          });
          if (parsedTag.inlineCode) {
            script.textContent = parsedTag.inlineCode;
          }
          document.head.appendChild(script);
        }
      } else if (existingManaged) {
        existingManaged.remove();
      }
    } else if (existingManaged) {
      existingManaged.remove();
    }

    // 3. Register or unregister /sw.js Service Worker (Step 1)
    if ('serviceWorker' in navigator) {
      try {
        if (enabled) {
          const isSecureOrigin =
            window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
          if (isSecureOrigin) {
            await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          }
        } else {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
            if (scriptUrl.endsWith('/sw.js') || scriptUrl.includes('sw_563a301a.js')) {
              await reg.unregister();
            }
          }
        }
      } catch {
        // Non-blocking in sandboxed preview iframes where SW registration may be restricted
      }
    }
  }, []);

  const syncFromSources = useCallback(async () => {
    let config: MonetagRuntimeConfig = {
      monetagEnabled: true,
      monetagDomain: '5gvci.com',
      monetagZoneId: '12292827',
    };

    try {
      const res = await fetch('/api/publisher-config');
      if (res.ok) {
        const data = await res.json();
        config = { ...config, ...data };
      }
    } catch {
      // fallback to defaults / Firestore
    }

    if (!config.monetagMetaTag && !config.monetagScriptSrc && !config.monetagScriptTag) {
      try {
        const snap = await getDoc(doc(db, 'platform_settings', 'global'));
        if (snap.exists()) {
          const fsData = snap.data() as MonetagRuntimeConfig;
          config = { ...config, ...fsData };
        }
      } catch {
        // non-blocking
      }
    }

    await applyMonetagConfig(config);
  }, [applyMonetagConfig]);

  useEffect(() => {
    void syncFromSources();

    const handleCustomUpdate = (evt: Event) => {
      const detail = (evt as CustomEvent<MonetagRuntimeConfig>)?.detail;
      if (detail) {
        void applyMonetagConfig(detail);
      } else {
        void syncFromSources();
      }
    };

    window.addEventListener(MONETAG_CONFIG_EVENT, handleCustomUpdate);
    return () => window.removeEventListener(MONETAG_CONFIG_EVENT, handleCustomUpdate);
  }, [applyMonetagConfig, syncFromSources]);

  return null;
};
