import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
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
  Wallet
} from 'lucide-react';

interface IntasendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntasendModal: React.FC<IntasendModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'test' | 'guide'>('credentials');

  // Form state
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isTest, setIsTest] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://gideon-global-tasks.ai.studio/api/intasend/webhook');

  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Test STK push state
  const [testPhone, setTestPhone] = useState('0712345678');
  const [testAmount, setTestAmount] = useState('260');
  const [isSendingStk, setIsSendingStk] = useState(false);
  const [stkResult, setStkResult] = useState<any | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/intasend/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.publishableKey) setPublishableKey(data.publishableKey);
        if (data.isTest !== undefined) setIsTest(data.isTest);
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/intasend/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishableKey,
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
        setErrorMsg(data.error || 'Failed to save configuration');
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
      const res = await fetch('/api/intasend/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          amount: Number(testAmount) || 260,
          packageId: 'starter-test',
          name: 'Gideon Contributor'
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
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-indigo-700 flex items-center justify-center font-bold text-sm shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold leading-tight">
                  IntaSend Payment Gateway
                </h2>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                  !isTest ? 'bg-emerald-500 text-white' : 'bg-indigo-900/40 text-indigo-100 border border-indigo-400/30'
                }`}>
                  {!isTest ? 'Live Mode' : 'Test Mode'}
                </span>
              </div>
              <p className="text-xs text-indigo-100/90">
                Collect M-PESA STK Push, Visa, Mastercard, and Airtel Money without a Paybill!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-indigo-100 hover:text-white hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'credentials'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test M-PESA STK Push</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Free Signup Guide</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-xs">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>IntaSend settings saved! Automated M-PESA STK Push is ready.</span>
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
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-xs">
                    Zero-Paperwork M-PESA Checkout via IntaSend
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    IntaSend handles the M-PESA STK Push on behalf of your platform and deposits the collected funds straight into your account. You can withdraw directly to your personal Safaricom line at any time!
                  </p>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Environment Mode</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {isTest ? 'Sandbox test transactions' : 'Real M-PESA & Card money collection'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTest(true)}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                      isTest
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Test / Sandbox Mode
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

              {/* Publishable Key */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>IntaSend Publishable Key</span>
                </label>
                <input
                  type="text"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  placeholder="e.g. ISPubKey_live_... or ISPubKey_test_..."
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>IntaSend Secret Key (For Server STK Push)</span>
                </label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="e.g. ISSecretKey_live_... or ISSecretKey_test_..."
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Webhook URL */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Webhook URL (Paste into your IntaSend Settings)</span>
                  <button
                    type="button"
                    onClick={copyWebhook}
                    className="text-indigo-700 hover:text-indigo-800 font-medium inline-flex items-center gap-1 cursor-pointer"
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
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save IntaSend Settings</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>Send an Instant Test STK Push Prompt</span>
                </h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Enter your Safaricom mobile number to test the IntaSend M-PESA prompt flow.
                </p>
              </div>

              <form onSubmit={handleTestStk} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Phone Number</label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="0712345678 or 254712345678"
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Amount (KES)</label>
                    <input
                      type="number"
                      value={testAmount}
                      onChange={(e) => setTestAmount(e.target.value)}
                      min="10"
                      placeholder="260"
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingStk}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSendingStk ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending IntaSend STK Push...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Trigger IntaSend M-PESA Prompt (KES {testAmount})</span>
                    </>
                  )}
                </button>
              </form>

              {stkResult && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-emerald-400 font-bold">STK Response:</span>
                    <span>{stkResult.simulation ? 'Simulation Mode' : 'Live IntaSend API'}</span>
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
              <h3 className="font-bold text-slate-900 text-sm">How to get your free IntaSend keys:</h3>
              <ol className="list-decimal pl-4 space-y-2.5 text-xs">
                <li>
                  Go to <a href="https://intasend.com" target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline font-medium">https://intasend.com</a> and click <strong>Create Free Account</strong>.
                </li>
                <li>
                  Sign up as an <strong>Individual / Freelancer</strong> (you only need your National ID and personal Safaricom number — no business registration required!).
                </li>
                <li>
                  Go to <strong>Settings</strong> → <strong>API Keys</strong> in your IntaSend Dashboard.
                </li>
                <li>
                  Copy your <strong>Publishable Key</strong> and <strong>Secret Key</strong>, and paste them into the <em>API Keys</em> tab here.
                </li>
                <li>
                  In IntaSend under <strong>Webhooks</strong>, paste your Webhook URL:
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px] block mt-1">{webhookUrl}</code>
                </li>
                <li>
                  That's it! When customers buy passes, money goes into your IntaSend balance and can be transferred to your M-PESA anytime with 1 click.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
