import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Search,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  BellRing,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { MONETAG_CONFIG_EVENT } from './MonetagInitializer';
import { CANONICAL_PLATFORM_ORIGIN } from '../utils/platformUrl';

interface PublisherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacyTerms?: (tab: 'privacy' | 'terms') => void;
}

const PUBLIC_URL = CANONICAL_PLATFORM_ORIGIN;

export const PublisherModal: React.FC<PublisherModalProps> = ({
  isOpen,
  onClose,
  onOpenPrivacyTerms
}) => {
  const { idToken, getFreshToken } = useAuth();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSitemap, setCopiedSitemap] = useState(false);
  const [copiedSwUrl, setCopiedSwUrl] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'adsense' | 'monetag'>('monetag');

  const [searchToken, setSearchToken] = useState('google2d71976008fafb8e');
  const [adsensePubId, setAdsensePubId] = useState('pub-8366092986496846');

  // Monetag configuration (Epic tag Step 1 pre-configured: 5gvci.com / zoneId 12292827)
  const [monetagEnabled, setMonetagEnabled] = useState(true);
  const [monetagDomain, setMonetagDomain] = useState('5gvci.com');
  const [monetagZoneId, setMonetagZoneId] = useState('12292827');
  const [monetagMetaTag, setMonetagMetaTag] = useState('');
  const [monetagScriptSrc, setMonetagScriptSrc] = useState('');
  const [monetagScriptTag, setMonetagScriptTag] = useState('');
  const [monetagSwCode, setMonetagSwCode] = useState('');
  const [swFileNotice, setSwFileNotice] = useState<string | null>(null);
  const [swStatus, setSwStatus] = useState<string>('Checking service worker status...');
  const [swTesting, setSwTesting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const checkServiceWorkerStatus = async (forceRegister = false) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setSwStatus('Service Workers are not supported in this browser.');
      return;
    }
    setSwTesting(true);
    try {
      if (forceRegister && monetagEnabled) {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      const regs = await navigator.serviceWorker.getRegistrations();
      const swReg = regs.find((r) => {
        const u = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '';
        return u.endsWith('/sw.js') || u.includes('sw_563a301a.js');
      });
      if (swReg) {
        const state = swReg.active ? 'Active' : swReg.installing ? 'Installing' : swReg.waiting ? 'Waiting' : 'Registered';
        setSwStatus(`Registered (${state}) · Scope: ${swReg.scope}`);
      } else if (!monetagEnabled) {
        setSwStatus('Disabled by Owner toggle.');
      } else {
        setSwStatus('Ready at /sw.js (awaiting HTTPS browser registration)');
      }
    } catch (err: any) {
      setSwStatus(err?.message || 'Service worker accessible at /sw.js');
    } finally {
      setSwTesting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/publisher-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.searchConsoleToken) setSearchToken(data.searchConsoleToken);
        if (data.adsensePublisherId) setAdsensePubId(data.adsensePublisherId);
        if (typeof data.monetagEnabled === 'boolean') setMonetagEnabled(data.monetagEnabled);
        if (data.monetagDomain) setMonetagDomain(data.monetagDomain);
        if (data.monetagZoneId) setMonetagZoneId(String(data.monetagZoneId));
        if (typeof data.monetagMetaTag === 'string') setMonetagMetaTag(data.monetagMetaTag);
        if (typeof data.monetagScriptSrc === 'string') setMonetagScriptSrc(data.monetagScriptSrc);
        if (typeof data.monetagScriptTag === 'string') {
          setMonetagScriptTag(data.monetagScriptTag);
        } else if (typeof data.monetagScriptSrc === 'string' && data.monetagScriptSrc) {
          setMonetagScriptTag(`<script src="${data.monetagScriptSrc}" async data-cfasync="false"></script>`);
        }
        if (typeof data.monetagSwCode === 'string') setMonetagSwCode(data.monetagSwCode);
      })
      .catch(() => {});

    getDoc(doc(db, 'platform_settings', 'global'))
      .then((snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        if (typeof d.monetagMetaTag === 'string' && d.monetagMetaTag) {
          setMonetagMetaTag((curr) => curr || d.monetagMetaTag);
        }
        if (typeof d.monetagScriptSrc === 'string' && d.monetagScriptSrc) {
          setMonetagScriptSrc((curr) => curr || d.monetagScriptSrc);
        }
        if (typeof d.monetagScriptTag === 'string' && d.monetagScriptTag) {
          setMonetagScriptTag((curr) => curr || d.monetagScriptTag);
        }
        if (typeof d.monetagSwCode === 'string' && d.monetagSwCode) {
          setMonetagSwCode((curr) => curr || d.monetagSwCode);
        }
      })
      .catch(() => {});

    void checkServiceWorkerStatus(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(PUBLIC_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopySitemap = () => {
    navigator.clipboard.writeText(`${PUBLIC_URL}/sitemap.xml`);
    setCopiedSitemap(true);
    setTimeout(() => setCopiedSitemap(false), 2500);
  };

  const handleCopySwUrl = () => {
    navigator.clipboard.writeText(`${PUBLIC_URL}/sw.js`);
    setCopiedSwUrl(true);
    setTimeout(() => setCopiedSwUrl(false), 2500);
  };

  const handleUploadSwFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '').trim();
      if (!content.includes('importScripts(') || !content.includes('https://')) {
        setSaveError('Uploaded file does not appear to be a valid Monetag service worker (.js with importScripts).');
        return;
      }
      if (content.length > 1000) {
        setSaveError('Monetag service worker script exceeds 1,000 character limit.');
        return;
      }
      setMonetagSwCode(content);
      const domMatch = content.match(/"domain"\s*:\s*"([^"]+)"/);
      if (domMatch?.[1]) setMonetagDomain(domMatch[1]);
      const zoneMatch = content.match(/"zoneId"\s*:\s*(\d+)/);
      if (zoneMatch?.[1]) setMonetagZoneId(zoneMatch[1]);
      setSwFileNotice(`Loaded "${file.name}"${zoneMatch?.[1] ? ` (Zone ${zoneMatch[1]})` : ''} — click Save below to activate on /sw.js.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const cleanPub = adsensePubId.trim().replace(/^ca-/, '');
      const cleanClient = `ca-${cleanPub}`;
      const cleanDomain = monetagDomain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || '3nbf4.com';
      let cleanZone = monetagZoneId.replace(/[^0-9]/g, '') || '12292694';
      const cleanMeta = monetagMetaTag.trim();
      const rawTagInput = monetagScriptTag.trim();
      const cleanSwCode = monetagSwCode.trim();

      let cleanScriptTag = '';
      let cleanScriptSrc = monetagScriptSrc.trim();

      if (rawTagInput) {
        if (/^https:\/\/[a-zA-Z0-9.-]+/.test(rawTagInput)) {
          cleanScriptSrc = rawTagInput.slice(0, 300);
          cleanScriptTag = `<script src="${cleanScriptSrc}" async data-cfasync="false"></script>`;
        } else if (
          /^<script\b[^>]*>[\s\S]*<\/script>$/i.test(rawTagInput) &&
          !/<\/script>[\s\S]*<script/i.test(rawTagInput)
        ) {
          if (rawTagInput.length > 1000) {
            setSaveError('Monetag <script> code must be 1,000 characters or fewer.');
            setSaving(false);
            return;
          }
          cleanScriptTag = rawTagInput;
          const srcMatch = rawTagInput.match(/src\s*=\s*["'](https:\/\/[^"']+)["']/i);
          cleanScriptSrc = srcMatch?.[1] ? srcMatch[1].slice(0, 300) : '';
          const tagZoneMatch = rawTagInput.match(/data-zone\s*=\s*["']([0-9]+)["']/i);
          if (tagZoneMatch?.[1] && !monetagSwCode.trim()) {
            cleanZone = tagZoneMatch[1];
          }
        } else {
          setSaveError('Step 2 code must be a single <script>...</script> tag or a valid https:// script URL.');
          setSaving(false);
          return;
        }
      } else {
        cleanScriptSrc = '';
      }

      if (cleanSwCode && (!cleanSwCode.includes('importScripts(') || !cleanSwCode.includes('https://') || cleanSwCode.length > 1000)) {
        setSaveError('Step 1 sw.js code must be a valid Monetag service worker (<= 1,000 chars) or left blank to auto-generate.');
        setSaving(false);
        return;
      }

      if (cleanScriptSrc && !/^https:\/\/[a-zA-Z0-9.-]+/.test(cleanScriptSrc)) {
        setSaveError('Monetag script URL must begin with https://');
        setSaving(false);
        return;
      }

      const freshToken = (await getFreshToken()) || idToken;
      const res = await fetch('/api/publisher-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {})
        },
        body: JSON.stringify({
          searchConsoleToken: searchToken.trim(),
          adsensePublisherId: cleanPub,
          adsenseClientId: cleanClient,
          monetagEnabled,
          monetagDomain: cleanDomain,
          monetagZoneId: cleanZone,
          monetagMetaTag: cleanMeta,
          monetagScriptSrc: cleanScriptSrc,
          monetagScriptTag: cleanScriptTag,
          monetagSwCode: cleanSwCode,
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSaveError(errData?.error || 'Could not save monetization configuration.');
        setSaving(false);
        return;
      }

      // Persist durably in Firestore platform_settings/global so config survives any server restart
      if (auth.currentUser?.emailVerified && auth.currentUser.email) {
        try {
          await setDoc(
            doc(db, 'platform_settings', 'global'),
            {
              searchConsoleToken: searchToken.trim().slice(0, 128),
              adsensePublisherId: cleanPub.slice(0, 64),
              adsenseClientId: cleanClient.slice(0, 64),
              monetagEnabled,
              monetagDomain: cleanDomain.slice(0, 120),
              monetagZoneId: cleanZone.slice(0, 32),
              monetagMetaTag: cleanMeta.slice(0, 128),
              monetagScriptSrc: cleanScriptSrc.slice(0, 300),
              monetagScriptTag: cleanScriptTag.slice(0, 1000),
              monetagSwCode: cleanSwCode.slice(0, 1000),
              monetagSourceAsset: '/assets/aistudio/sw_563a301a.js',
              updatedBy: auth.currentUser.email.slice(0, 200),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // non-blocking
        }
      }

      setMonetagScriptSrc(cleanScriptSrc);
      if (cleanScriptTag) setMonetagScriptTag(cleanScriptTag);
      setSwFileNotice(null);

      // Update runtime meta tags in DOM
      const gscMeta = document.getElementById('google-site-verification');
      if (gscMeta) gscMeta.setAttribute('content', searchToken.trim());

      const adsMeta = document.getElementById('google-adsense-account');
      if (adsMeta) adsMeta.setAttribute('content', cleanClient);

      window.dispatchEvent(
        new CustomEvent(MONETAG_CONFIG_EVENT, {
          detail: {
            monetagEnabled,
            monetagDomain: cleanDomain,
            monetagZoneId: cleanZone,
            monetagMetaTag: cleanMeta,
            monetagScriptSrc: cleanScriptSrc,
            monetagScriptTag: cleanScriptTag,
            monetagSwCode: cleanSwCode,
          },
        })
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      void checkServiceWorkerStatus(monetagEnabled);
    } catch (e: any) {
      console.error('Failed to save publisher configuration', e);
      setSaveError(e?.message || 'Failed to save publisher configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg">
              <Globe className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">Monetization &amp; Publishing Hub</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  {monetagEnabled ? `Monetag Zone ${monetagZoneId} Live` : 'Monetag Paused'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Manage Monetag Push &amp; MultiTag monetization, Google AdSense, and Search Console verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Public URL Card */}
        <div className="px-6 py-3.5 bg-brand-50/60 border-b border-brand-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 whitespace-nowrap">Your Live Production Domain:</span>
            <code className="bg-white px-2.5 py-1 rounded-md border border-brand-200 text-brand-700 font-mono text-[11px] font-medium break-all select-all">
              {PUBLIC_URL}
            </code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-brand-200 hover:bg-brand-50 text-brand-700 font-medium transition-colors cursor-pointer text-xs shadow-sm"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied URL!' : 'Copy Site URL'}</span>
            </button>
            <a
              href={PUBLIC_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors text-xs shadow-sm"
            >
              <span>Visit Live</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap border-b border-slate-200 px-6 bg-white gap-4">
          <button
            onClick={() => setActiveSubTab('monetag')}
            className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'monetag'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 text-blue-600" />
            <span>1. Monetag (Push &amp; MultiTag Ads)</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              {monetagEnabled ? 'Active' : 'Off'}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('console')}
            className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'console'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>2. Google Search Console</span>
          </button>
          <button
            onClick={() => setActiveSubTab('adsense')}
            className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'adsense'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>3. Google AdSense</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-600">
          {saveError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {activeSubTab === 'monetag' ? (
            <div className="space-y-6">
              {/* Uploaded SW Live Status */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-blue-600" />
                    Monetag Service Worker Installed &amp; Mounted at <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-blue-800">/sw.js</code>
                  </h3>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={monetagEnabled}
                      onChange={(e) => setMonetagEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-blue-950">Enable Monetag Ads</span>
                  </label>
                </div>
                <p className="text-blue-900 leading-relaxed text-[11px]">
                  Your uploaded Monetag service worker (<code className="bg-white/80 px-1 py-0.5 rounded font-mono">/assets/aistudio/sw_563a301a.js</code>) is mounted at the site root <code className="bg-white/80 px-1 py-0.5 rounded font-mono">{PUBLIC_URL}/sw.js</code> with <strong>domain: {monetagDomain}</strong> and <strong>zoneId: {monetagZoneId}</strong>, and automatically registered when visitors load the platform.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopySwUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-800 font-semibold text-[11px] cursor-pointer"
                  >
                    {copiedSwUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSwUrl ? 'Copied /sw.js URL!' : 'Copy /sw.js URL'}</span>
                  </button>
                  <a
                    href="/sw.js"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-800 font-semibold text-[11px]"
                  >
                    <span>Inspect Live /sw.js</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="/assets/aistudio/sw_563a301a.js"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-800 font-semibold text-[11px]"
                  >
                    <span>View Uploaded sw_563a301a.js</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void checkServiceWorkerStatus(true)}
                    disabled={swTesting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold text-[11px] cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${swTesting ? 'animate-spin' : ''}`} />
                    <span>Register &amp; Test SW</span>
                  </button>
                </div>

                <div className="pt-1 text-[11px] font-mono text-blue-900 bg-white/80 px-3 py-2 rounded-lg border border-blue-200/80">
                  Browser SW Status: <strong>{swStatus}</strong>
                </div>
              </div>

              {/* Step 1 & Step 2 MultiTag Configuration */}
              <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Monetag MultiTag Setup (Step 1: <code className="bg-slate-100 px-1 py-0.5 rounded">/sw.js</code> &amp; Step 2: <code className="bg-slate-100 px-1 py-0.5 rounded">&lt;head&gt;</code> JS Code)
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      Complete both steps from your Monetag MultiTag popup (&quot;Epic tag&quot;: Push 12292827, Vignette 12292826, In-Page 12292825, OnClick 12292824). Everything saved here is injected live into HTML <code className="bg-slate-100 px-1 py-0.5 rounded">&lt;head&gt;</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">/sw.js</code>.
                    </p>
                  </div>
                  {saveSuccess && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Monetag Saved Live!
                    </span>
                  )}
                </div>

                {/* Step 1: Upload or paste new sw.js */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        1
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        Step 1: Upload / Update Monetag <code className="font-mono">/sw.js</code> File
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] cursor-pointer shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Monetag .js File</span>
                        <input
                          type="file"
                          accept=".js,application/javascript,text/javascript"
                          onChange={handleUploadSwFile}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMonetagZoneId('12292827');
                          setMonetagSwCode('');
                          setSwFileNotice('Set Push Zone ID to 12292827 (Epic tag). Upload the downloaded .js file if its domain differs from ' + monetagDomain + ', then click Save.');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] cursor-pointer"
                      >
                        Use Epic Tag Zone (12292827)
                      </button>
                    </div>
                  </div>

                  {swFileNotice && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                      {swFileNotice}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Monetag SW Domain
                      </label>
                      <input
                        type="text"
                        value={monetagDomain}
                        onChange={(e) => setMonetagDomain(e.target.value)}
                        placeholder="3nbf4.com"
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Monetag Push Zone ID
                      </label>
                      <input
                        type="text"
                        value={monetagZoneId}
                        onChange={(e) => setMonetagZoneId(e.target.value)}
                        placeholder="12292827"
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Optional Verbatim <code className="font-mono">sw.js</code> File Content{' '}
                      <span className="text-slate-400 font-normal">(auto-filled when you upload the downloaded .js file, or leave blank to serve Domain + Zone above)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={monetagSwCode}
                      onChange={(e) => setMonetagSwCode(e.target.value)}
                      placeholder={`self.options = {\n    "domain": "${monetagDomain}",\n    "zoneId": ${monetagZoneId}\n}\nself.lary = ""\nimportScripts('https://${monetagDomain}/act/files/service-worker.min.js?r=sw')`}
                      className="w-full px-3 py-2 text-[11px] font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Step 2: Paste <head> MultiTag JS code */}
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        2
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        Step 2: Paste Monetag <code className="font-mono">&lt;head&gt;</code> JS Code (&quot;Copy this JS code&quot;)
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        monetagScriptTag.trim()
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {monetagScriptTag.trim() ? 'Injected into <head>' : 'Awaiting Step 2 JS Code'}
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={monetagScriptTag}
                    onChange={(e) => setMonetagScriptTag(e.target.value)}
                    placeholder={`Paste the exact <script ...></script> snippet from Monetag "2. Copy this JS code and paste it into an html file after the <head> tag"`}
                    className="w-full px-3 py-2 text-[11px] font-mono bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <p className="text-[11px] text-slate-600">
                    When saved, our server injects this exact <code className="bg-white px-1 py-0.5 rounded font-mono">&lt;script&gt;</code> tag directly after <code className="bg-white px-1 py-0.5 rounded font-mono">&lt;head&gt;</code> in the live HTML document so Monetag&apos;s <strong>Installation check</strong> detects all 4 MultiTag zones (Push, Vignette, In-Page Push, OnClick).
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Monetag Site Verification Meta Tag Value <span className="text-slate-400 font-normal">(optional: content=&quot;...&quot; of &lt;meta name=&quot;monetag&quot;&gt;)</span>
                  </label>
                  <input
                    type="text"
                    value={monetagMetaTag}
                    onChange={(e) => setMonetagMetaTag(e.target.value)}
                    placeholder="e.g. a1b2c3d4e5f6... (already verified if Monetag shows Verified)"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Saving Monetag Config...' : 'Save & Inject Monetag Step 1 + Step 2'}
                  </button>
                </div>
              </div>

              {/* Monetag Verification Steps */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  How to Pass Monetag&apos;s Installation Check
                </h4>
                <ol className="list-decimal pl-5 space-y-1.5 text-[11px] text-slate-600">
                  <li>
                    In Monetag&apos;s <strong>Multitag created · Epic tag</strong> popup, tap <strong>1. Download this JS file</strong> and upload it with the <strong>Upload Monetag .js File</strong> button above.
                  </li>
                  <li>
                    Tap <strong>2. Copy this JS code</strong> in Monetag and paste it into the <strong>Step 2</strong> box above, then click <strong>Save &amp; Inject Monetag Step 1 + Step 2</strong>.
                  </li>
                  <li>
                    Click <strong>Installation check</strong> in Monetag. Ensure your site URL in Monetag matches your official platform URL (<code className="bg-white px-1 py-0.5 rounded font-mono">{PUBLIC_URL}/</code>).
                  </li>
                </ol>
              </div>
            </div>
          ) : activeSubTab === 'console' ? (
            <div className="space-y-6">
              {/* Overview */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-brand-600" />
                  How Google Search Console Brings Contributors
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Submitting Gideon Global Tasks to Google Search Console allows Googlebot to crawl your paid surveys, AI annotation, copywriting, and micro tasks. Users searching for <em>"paid online surveys"</em>, <em>"data annotation jobs"</em>, and <em>"make money online PayPal"</em> find your site and register accounts.
                </p>
              </div>

              {/* Step-by-Step Submission Guide */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Step-by-Step Publishing Walkthrough
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1 */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                      1
                    </div>
                    <h5 className="font-bold text-slate-900">Add Property in Console</h5>
                    <p className="text-slate-500 text-[11px]">
                      Open Google Search Console, select <strong>URL prefix</strong>, and paste your live URL:
                    </p>
                    <code className="block bg-slate-100 p-1.5 rounded text-[10px] break-all font-mono text-slate-700">
                      {PUBLIC_URL}
                    </code>
                    <a
                      href="https://search.google.com/search-console"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-brand-600 hover:text-brand-700 font-semibold text-[11px]"
                    >
                      <span>Open Search Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Step 2 */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                      2
                    </div>
                    <h5 className="font-bold text-slate-900">HTML Tag Verification</h5>
                    <p className="text-slate-500 text-[11px]">
                      Choose <strong>HTML Tag</strong> verification. Copy the <code className="bg-slate-100 px-1 py-0.5 rounded">content=&quot;...&quot;</code> code and paste it below.
                    </p>
                    <div className="pt-2">
                      <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Meta tag configured in &lt;head&gt;
                      </span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                      3
                    </div>
                    <h5 className="font-bold text-slate-900">Submit Sitemap.xml</h5>
                    <p className="text-slate-500 text-[11px]">
                      In Search Console, go to <strong>Sitemaps</strong> in the left sidebar and submit:
                    </p>
                    <code className="block bg-slate-100 p-1.5 rounded text-[10px] font-mono text-slate-700">
                      sitemap.xml
                    </code>
                    <button
                      onClick={handleCopySitemap}
                      className="inline-flex items-center gap-1 mt-2 text-brand-600 hover:text-brand-700 font-semibold text-[11px] cursor-pointer"
                    >
                      {copiedSitemap ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSitemap ? 'Copied Sitemap URL!' : 'Copy Full Sitemap URL'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Token Configuration Box */}
              <div className="p-5 rounded-xl border border-brand-200 bg-brand-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Google Site Verification Token</h4>
                    <p className="text-slate-500 text-[11px]">
                      This value is dynamically served in <code className="bg-white px-1 py-0.5 rounded text-brand-700">&lt;meta name=&quot;google-site-verification&quot;&gt;</code> for instant Google verification.
                    </p>
                  </div>
                  {saveSuccess && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Saved Live!
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={searchToken}
                    onChange={(e) => setSearchToken(e.target.value)}
                    placeholder="e.g. gideon-search-console-verification-token"
                    className="flex-1 w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition-colors shrink-0 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Updating...' : 'Save Token'}
                  </button>
                </div>
              </div>

              {/* Crawler Endpoints */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-slate-500" />
                  Live SEO Indexing Files Generated for Googlebot
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <a
                    href="/robots.txt"
                    target="_blank"
                    className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800">/robots.txt</span>
                      <p className="text-[11px] text-slate-500">Directs Googlebot &amp; Mediapartners crawlers</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </a>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800">/sitemap.xml</span>
                      <p className="text-[11px] text-slate-500">Indexed URLs with priorities &amp; timestamps</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* AdSense Overview */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Google AdSense Monetization Setup
                </h3>
                <p className="text-emerald-900 leading-relaxed text-[11px]">
                  Earn recurring ad revenue every time visitors view and interact with your tasks and meme feed. Google AdSense requires an approved publisher ID and an active <code className="bg-white/80 px-1 py-0.5 rounded font-mono">ads.txt</code> file on your domain.
                </p>
              </div>

              {/* Publisher ID Form */}
              <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Your Google AdSense Publisher ID</h4>
                    <p className="text-slate-500 text-[11px]">
                      Enter your AdSense Publisher ID (e.g., <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">pub-1234567890123456</code>). We automatically generate your authorized <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">ads.txt</code>.
                    </p>
                  </div>
                  {saveSuccess && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> AdSense Synced!
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={adsensePubId}
                    onChange={(e) => setAdsensePubId(e.target.value)}
                    placeholder="pub-XXXXXXXXXXXXXXXX"
                    className="flex-1 w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shrink-0 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Updating...' : 'Save Publisher ID'}
                  </button>
                </div>
              </div>

              {/* AdSense Verification Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Google AdSense Site Approval Checklist
                </h4>

                <div className="space-y-2">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800">Authorized ads.txt File Deployed</span>
                      <p className="text-slate-500 text-[11px]">
                        Google crawlers automatically check <code className="bg-white px-1 py-0.5 rounded font-mono">/ads.txt</code> to confirm publisher authorization.
                      </p>
                      <a
                        href="/ads.txt"
                        target="_blank"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold text-[11px] mt-1"
                      >
                        <span>View Live ads.txt</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-slate-800">AdSense Policy-Compliant Privacy Policy</span>
                      <p className="text-slate-500 text-[11px]">
                        Includes standard Google advertising cookie disclosure, third-party vendor opt-out links, and data rights notices.
                      </p>
                      {onOpenPrivacyTerms && (
                        <button
                          onClick={() => onOpenPrivacyTerms('privacy')}
                          className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-semibold text-[11px] mt-1 cursor-pointer"
                        >
                          <span>Review Privacy Policy</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800">Original High-Quality Tasks &amp; Interactive Content</span>
                      <p className="text-slate-500 text-[11px]">
                        Site contains high value interactive tools: AI CV annotation, OCR digitization, writing prompts, and community meme feed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="font-bold text-sm">Ready to connect with Google AdSense?</h4>
                  <p className="text-slate-300 text-[11px]">
                    Create your account or add this site at Google AdSense console using your live URL.
                  </p>
                </div>
                <a
                  href="https://www.google.com/adsense/start/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg transition-colors text-xs whitespace-nowrap shadow-sm"
                >
                  Go to Google AdSense
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Monetag SW (/sw.js), AdSense &amp; Search Console ready</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
