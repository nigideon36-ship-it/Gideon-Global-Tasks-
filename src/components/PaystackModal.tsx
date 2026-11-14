import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  ShieldCheck,
  Zap,
  Key,
  Lock,
  Copy,
  Check,
  Send,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PaystackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PaystackModal: React.FC<PaystackModalProps> = ({ isOpen, onClose }) => {
  const { idToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'credentials' | 'test' | 'guide'>('credentials');

  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isTest, setIsTest] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState(
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/paystack/webhook`
      : 'https://gideon-global-tasks.ai.studio/api/paystack/webhook'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState('+254712345678');
  const [testAmountKes, setTestAmountKes] = useState('260');
  const [isSendingStk, setIsSendingStk] = useState(false);
  const [stkResult, setStkResult] = useState<any | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (!isOpen || !idToken) return;

    fetch('/api/paystack/config', {
      headers: { Authorization: `Bearer ${idToken}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.publicKey) setPublicKey(data.publicKey);
        if (data.isTest !== undefined) setIsTest(data.isTest);
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      })
      .catch(() => {});
  }, [isOpen, idToken]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/paystack/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          publicKey,
          secretKey,
          isTest,
          webhookUrl
        })
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to save Paystack configuration');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestStk = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingStk(true);
    setStkResult(null);

    try {
      const res = await fetch('/api/paystack/stk-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': 'KE',
          'x-ea-verified': 'true'
        },
        body: JSON.stringify({
          phone: testPhone,
          amount: Number(testAmountKes) || 260,
          countryCode: 'KE',
          packageId: 'starter-test',
          name: 'Gideon Owner Test'
        })
      });

      const data = await res.json();
      setStkResult(data);
    } catch (err: any) {
      setStkResult({ error: err.message || 'Network request failed' });
    } finally {
      setIsSendingStk(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#09A5DB] text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-[#09A5DB] flex items-center justify-center font-bold text-sm shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold leading-tight">
                  Paystack Gateway (Kenya Starter Business)
                </h2>
                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                    !isTest
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900/30 text-white border border-white/30'
                  }`}
                >
                  {!isTest ? 'Live Mode' : 'Test Mode'}
                </span>
              </div>
              <p className="text-xs text-sky-50">
                M-PESA STK Push + East Africa Visa/Mastercard without a Paybill or Till!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-sky-100 hover:text-white hover:bg-sky-600/40 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'credentials'
                ? 'border-[#09A5DB] text-[#0576A0] font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-[#09A5DB] text-[#0576A0] font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test M-PESA STK Push</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-[#09A5DB] text-[#0576A0] font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>East Africa Coverage &amp; Setup</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-xs">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Paystack keys saved! M-PESA STK Push and Card checkout are active.</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'credentials' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#0576A0] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-xs">
                    How Paystack Works Across Your 8 East Africa Countries
                  </p>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>Kenya (+254):</strong> Direct M-PESA STK Push via Paystack Charge API (settles straight to your personal M-PESA or personal bank account, no Paybill/Till required).<br />
                    <strong>Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia &amp; Somalia:</strong> Covered automatically via <strong>Paystack Visa / Mastercard / Apple Pay</strong> checkout.
                  </p>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Environment Mode</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {isTest ? 'Test keys (pk_test_ / sk_test_)' : 'Live keys (pk_live_ / sk_live_)'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTest(true)}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                      isTest
                        ? 'border-[#09A5DB] bg-sky-50 text-[#0576A0] ring-2 ring-[#09A5DB]/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Test Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTest(false)}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                      !isTest
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Live Production Mode
                  </button>
                </div>
              </div>

              {/* Public Key */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paystack Public Key</span>
                </label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="pk_test_... or pk_live_..."
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#09A5DB] focus:outline-none"
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paystack Secret Key (For Server STK Push &amp; Verification)</span>
                </label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="sk_test_... or sk_live_..."
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#09A5DB] focus:outline-none"
                />
              </div>

              {/* Webhook URL */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Paystack Webhook URL (Paste in Dashboard → Settings → API Keys)</span>
                  <button
                    type="button"
                    onClick={copyWebhook}
                    className="text-[#0576A0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedWebhook ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="w-full px-3.5 py-2.5 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Paystack Keys</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <Smartphone className="w-4 h-4 text-[#0576A0]" />
                  <span>Send Test Paystack M-PESA STK Push</span>
                </h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Enter a Kenyan Safaricom number (<code className="bg-white px-1 rounded">+2547...</code> or <code className="bg-white px-1 rounded">07...</code>) to trigger <code className="bg-white px-1 rounded">POST /charge</code>.
                </p>
              </div>

              <form onSubmit={handleTestStk} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Safaricom M-PESA Phone</label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="+254712345678"
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#09A5DB] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Amount (KES)</label>
                    <input
                      type="number"
                      value={testAmountKes}
                      onChange={(e) => setTestAmountKes(e.target.value)}
                      min="10"
                      placeholder="260"
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#09A5DB] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingStk}
                  className="w-full py-3 bg-[#09A5DB] hover:bg-[#0576A0] text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSendingStk ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Paystack M-PESA STK Push...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Trigger Paystack M-PESA STK Push (KES {testAmountKes})</span>
                    </>
                  )}
                </button>
              </form>

              {stkResult && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-emerald-400 font-bold">Paystack Response:</span>
                    <span>{stkResult.simulation ? 'Simulation Mode' : 'Live Paystack API'}</span>
                  </div>
                  <pre className="whitespace-pre-wrap overflow-x-auto text-[10px] text-slate-300">
                    {JSON.stringify(stkResult, null, 2)}
                  </pre>
                  {stkResult.message && (
                    <p className="text-emerald-300 text-xs font-sans mt-2">
                      ✓ {stkResult.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <h3 className="font-bold text-slate-900 text-sm">Paystack Starter Business Setup (No Paybill/Till Needed):</h3>
              <ol className="list-decimal pl-4 space-y-2 text-xs">
                <li>
                  Create your account on <a href="https://dashboard.paystack.com/#/signup" target="_blank" rel="noopener noreferrer" className="text-[#0576A0] underline font-medium">paystack.com</a> and select <strong>Kenya → Starter Business</strong>.
                </li>
                <li>
                  Verify with your <strong>National ID</strong> and link your <strong>personal Safaricom M-PESA number or personal bank account</strong> (no Paybill, Till, or business registration certificate required up to KES 600,000).
                </li>
                <li>
                  If onboarding asks for a website URL and rejects <code className="bg-slate-100 px-1 rounded">*.run.app</code>, select the <strong>No Website / Social Media / Payment Links</strong> option and link your active business social page.
                </li>
                <li>
                  Go to <strong>Settings → API Keys &amp; Webhooks</strong>, copy your Public Key &amp; Secret Key, and paste them into the <em>API Keys</em> tab here.
                </li>
              </ol>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5 text-[11px] text-amber-950">
                <div className="font-bold flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-700" />
                  <span>Important East Africa Coverage Note:</span>
                </div>
                <p>
                  • <strong>M-PESA STK Push:</strong> Works natively for Kenyan (<code className="bg-white px-1 rounded">+254</code>) Safaricom numbers.<br />
                  • <strong>Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia &amp; Somalia:</strong> Contributors in those countries pay via <strong>Paystack Visa / Mastercard</strong> checkout (or add Flutterwave later if you also want native Ugandan/Tanzanian/Rwandan Mobile Money).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
