import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  ShieldCheck,
  Zap,
  Key,
  Lock,
  Globe,
  Copy,
  Check,
  Send,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DarajaMpesaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DarajaMpesaModal: React.FC<DarajaMpesaModalProps> = ({ isOpen, onClose }) => {
  const { idToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'credentials' | 'test' | 'guide'>('credentials');

  // Form state
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [businessShortCode, setBusinessShortCode] = useState('174379');
  const [passkey, setPasskey] = useState('bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919');
  const [callbackUrl, setCallbackUrl] = useState('https://gideon-global-tasks.ai.studio/api/mpesa/callback');

  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // STK Test state
  const [testPhone, setTestPhone] = useState('0712345678');
  const [testAmount, setTestAmount] = useState('10');
  const [isSendingStk, setIsSendingStk] = useState(false);
  const [stkResult, setStkResult] = useState<any | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  useEffect(() => {
    if (!isOpen || !idToken) return;

    fetch('/api/mpesa/config', {
      headers: { Authorization: `Bearer ${idToken}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.environment) setEnvironment(data.environment);
        if (data.businessShortCode) setBusinessShortCode(data.businessShortCode);
        if (data.callbackUrl) setCallbackUrl(data.callbackUrl);
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
      const res = await fetch('/api/mpesa/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          environment,
          consumerKey,
          consumerSecret,
          businessShortCode,
          passkey,
          callbackUrl
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

  const handleTestStkPush = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingStk(true);
    setStkResult(null);

    try {
      const res = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          amount: Number(testAmount) || 10,
          packageId: 'test-stk',
          accountReference: 'GideonTest'
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

  const copyCallbackUrl = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-emerald-700 flex items-center justify-center font-bold text-sm shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold leading-tight">
                  Safaricom Daraja M-PESA Gateway
                </h2>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                  environment === 'production' ? 'bg-red-500 text-white' : 'bg-emerald-900/40 text-emerald-100 border border-emerald-400/30'
                }`}>
                  {environment === 'production' ? 'Live Production' : 'Sandbox Test'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90">
                Lipa Na M-PESA Online (STK Push) &amp; Automated Payout Integration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-emerald-100 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer"
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
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Credentials</span>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test STK Push to Phone</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Setup Guide</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-xs">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Daraja configuration saved! Lipa Na M-PESA STK Push is ready.</span>
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
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-xs">
                    Connect Your Safaricom Developer Account
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Paste your credentials from <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-medium">developer.safaricom.co.ke</a>. Once saved, worker pass purchases will prompt an instant STK push to the user's mobile phone!
                  </p>
                </div>
              </div>

              {/* Environment Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>API Environment</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {environment === 'production' ? 'Real M-PESA cash transactions' : 'Safaricom sandbox simulator'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEnvironment('sandbox')}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                      environment === 'sandbox'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Sandbox (Testing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironment('production')}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                      environment === 'production'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Production (Live Paybill / Till)
                  </button>
                </div>
              </div>

              {/* Consumer Key */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Daraja Consumer Key</span>
                </label>
                <input
                  type="text"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="e.g. 98qWeRtYuIoP..."
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Consumer Secret */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Daraja Consumer Secret</span>
                </label>
                <input
                  type="password"
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* ShortCode and Passkey Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Business Shortcode (Paybill / Till)</label>
                  <input
                    type="text"
                    value={businessShortCode}
                    onChange={(e) => setBusinessShortCode(e.target.value)}
                    placeholder="174379"
                    className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">Default sandbox shortcode is 174379</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Online Passkey (Lipa Na M-PESA)</label>
                  <input
                    type="text"
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value)}
                    placeholder="bfb279f9aa9bdbcf158e97dd71a467cd2e..."
                    className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">Used for generating the encrypted STK password</p>
                </div>
              </div>

              {/* Callback URL */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Webhook Callback URL (For Daraja Portal)</span>
                  <button
                    type="button"
                    onClick={copyCallbackUrl}
                    className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCallback ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCallback ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </label>
                <input
                  type="text"
                  value={callbackUrl}
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
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Daraja Settings</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Send a Live STK Push to Your Phone</span>
                </h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Enter your Kenyan Safaricom phone number to trigger the M-PESA PIN prompt on your phone!
                </p>
              </div>

              <form onSubmit={handleTestStkPush} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Phone Number</label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="0712345678 or 254712345678"
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Amount (KES)</label>
                    <input
                      type="number"
                      value={testAmount}
                      onChange={(e) => setTestAmount(e.target.value)}
                      min="1"
                      placeholder="10"
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingStk}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSendingStk ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending STK Prompt to Phone...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Trigger STK Push Prompt (KES {testAmount})</span>
                    </>
                  )}
                </button>
              </form>

              {stkResult && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-emerald-400 font-bold">STK Push Response:</span>
                    <span>{stkResult.simulation ? 'Simulation Mode' : 'Live Daraja API'}</span>
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
              <h3 className="font-bold text-slate-900 text-sm">How to get your Daraja credentials:</h3>
              <ol className="list-decimal pl-4 space-y-2 text-xs">
                <li>Log in to <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-medium">developer.safaricom.co.ke</a> with your account.</li>
                <li>Go to <strong>My Apps</strong> and click <strong>Create App</strong> (e.g. named <em>Gideon Global Tasks</em>).</li>
                <li>Check the box for <strong>Lipa Na M-PESA Sandbox</strong> or <strong>Lipa Na M-PESA Production</strong>.</li>
                <li>Copy your <strong>Consumer Key</strong> and <strong>Consumer Secret</strong> and paste them in the <em>API Credentials</em> tab.</li>
                <li>For production, get your <strong>Paybill / Till Shortcode</strong> and <strong>Online Passkey</strong> from the M-PESA portal.</li>
                <li>In your Daraja App, set the <strong>Callback URL</strong> to: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">{callbackUrl}</code></li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
