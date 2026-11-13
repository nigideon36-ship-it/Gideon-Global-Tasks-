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
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PublisherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacyTerms?: (tab: 'privacy' | 'terms') => void;
}

const PUBLIC_URL = typeof window !== 'undefined' && window.location.hostname.includes('gideon-global-tasks.ai.studio')
  ? 'https://gideon-global-tasks.ai.studio'
  : 'https://gideon-global-tasks.ai.studio';

export const PublisherModal: React.FC<PublisherModalProps> = ({
  isOpen,
  onClose,
  onOpenPrivacyTerms
}) => {
  const { idToken } = useAuth();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSitemap, setCopiedSitemap] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'adsense'>('console');

  const [searchToken, setSearchToken] = useState('google2d71976008fafb8e');
  const [adsensePubId, setAdsensePubId] = useState('pub-8366092986496846');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/publisher-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.searchConsoleToken) setSearchToken(data.searchConsoleToken);
        if (data.adsensePublisherId) setAdsensePubId(data.adsensePublisherId);
      })
      .catch(() => {});
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

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const cleanPub = adsensePubId.trim().replace(/^ca-/, '');
      const cleanClient = `ca-${cleanPub}`;

      const res = await fetch('/api/publisher-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          searchConsoleToken: searchToken.trim(),
          adsensePublisherId: cleanPub,
          adsenseClientId: cleanClient
        })
      });

      if (res.ok) {
        // Also update runtime meta tags in DOM
        const gscMeta = document.getElementById('google-site-verification');
        if (gscMeta) gscMeta.setAttribute('content', searchToken.trim());

        const adsMeta = document.getElementById('google-adsense-account');
        if (adsMeta) adsMeta.setAttribute('content', cleanClient);

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save publisher configuration', e);
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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Google Search Console & AdSense Hub</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Ready to Publish
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Submit your live URL so Google indexes your pages and people can find Gideon Global Tasks to create accounts
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
        <div className="flex border-b border-slate-200 px-6 bg-white gap-4">
          <button
            onClick={() => setActiveSubTab('console')}
            className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'console'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>1. Google Search Console (Organic Indexing & Signups)</span>
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
            <span>2. Google AdSense (Website Monetization & Ads)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-600">
          {activeSubTab === 'console' ? (
            <div className="space-y-6">
              {/* Overview */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-brand-600" />
                  How Google Search Console Brings Contributors
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Submitting Gideon Global Tasks to Google Search Console allows Googlebot to crawl your paid surveys, AI annotation, copywriting, and micro tasks. Users searching for <em>"paid online surveys"</em>, <em>"data annotation jobs"</em>, and <em>"make money online M-PESA"</em> find your site and register accounts.
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
                      Choose <strong>HTML Tag</strong> verification. Copy the <code className="bg-slate-100 px-1 py-0.5 rounded">content="..."</code> code and paste it below.
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
                      This value is dynamically served in <code className="bg-white px-1 py-0.5 rounded text-brand-700">&lt;meta name="google-site-verification"&gt;</code> for instant Google verification.
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
                      <p className="text-[11px] text-slate-500">Directs Googlebot & Mediapartners crawlers</p>
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
                      <p className="text-[11px] text-slate-500">7 indexed URLs with priorities & timestamps</p>
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
                      <span className="font-bold text-slate-800">Original High-Quality Tasks & Interactive Content</span>
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
            <span>Googlebot & Mediapartners crawlers fully authorized</span>
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
