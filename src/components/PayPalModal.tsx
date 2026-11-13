import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  ShieldCheck,
  Mail,
  Key,
  Lock,
  Copy,
  Check,
  Send,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PayPalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PayPalModal: React.FC<PayPalModalProps> = ({ isOpen, onClose }) => {
  const { idToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'settings' | 'test'>('settings');

  const [primaryEmail, setPrimaryEmail] = useState('nigideon36@gmail.com');
  const [payPalMeHandle, setPayPalMeHandle] = useState('nigideon36');
  const [mode, setMode] = useState<'live' | 'sandbox'>('live');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Test order state
  const [testAmount, setTestAmount] = useState('5');
  const [testBuyerEmail, setTestBuyerEmail] = useState('customer@example.com');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/paypal/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.primaryEmail) setPrimaryEmail(data.primaryEmail);
        if (data.payPalMeHandle) setPayPalMeHandle(data.payPalMeHandle);
        if (data.mode) setMode(data.mode);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const payPalMeUrl = `https://paypal.me/${payPalMeHandle.replace(/^@/, '')}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/paypal/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          primaryEmail,
          payPalMeHandle,
          mode,
          clientId,
          clientSecret
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to save PayPal settings');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(testAmount) || 5,
          packageId: 'pro',
          description: 'Test International Pass Checkout',
          payerEmail: testBuyerEmail
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ error: err.message || 'Order test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const copyPayPalMe = () => {
    navigator.clipboard.writeText(payPalMeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#003087] text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-[#003087] flex items-center justify-center font-extrabold text-sm shadow-xs">
              PP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold leading-tight">
                  PayPal International Payments
                </h2>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                  mode === 'live' ? 'bg-emerald-500 text-white' : 'bg-blue-900/60 text-blue-100 border border-blue-400/30'
                }`}>
                  {mode === 'live' ? 'Live Mode' : 'Sandbox'}
                </span>
              </div>
              <p className="text-xs text-blue-100/90">
                Receive international USD payments directly to <strong className="font-mono text-white">{primaryEmail}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-blue-100 hover:text-white hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-[#003087] text-[#003087] font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Receiver Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-[#003087] text-[#003087] font-bold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test International Order</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-xs">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>PayPal international settings saved! Receiving email: {primaryEmail}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#003087] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-xs">
                    Dual-Rail Global Checkout Active
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Customers in Kenya pay via M-PESA (IntaSend / Daraja), while international customers worldwide pay in USD directly to your PayPal account (<strong>{primaryEmail}</strong>).
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Primary PayPal Receiving Email</span>
                </label>
                <input
                  type="email"
                  value={primaryEmail}
                  onChange={(e) => setPrimaryEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>PayPal.Me Username / Handle</span>
                  <button
                    type="button"
                    onClick={copyPayPalMe}
                    className="text-[#003087] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? 'Copied Link' : 'Copy PayPal.Me URL'}</span>
                  </button>
                </label>
                <input
                  type="text"
                  value={payPalMeHandle}
                  onChange={(e) => setPayPalMeHandle(e.target.value)}
                  placeholder="nigideon36"
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 font-mono">
                  Direct checkout link: {payPalMeUrl}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('live')}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                    mode === 'live'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Live Production (USD)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('sandbox')}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                    mode === 'sandbox'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Sandbox Testing
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span>REST Client ID (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="PayPal Developer Client ID"
                    className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>REST Client Secret (Optional)</span>
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="PayPal Developer Secret"
                    className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
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
                  className="px-6 py-2.5 bg-[#003087] hover:bg-blue-900 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save PayPal Settings</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4">
              <form onSubmit={handleTestOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Amount (USD)</label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="number"
                        value={testAmount}
                        onChange={(e) => setTestAmount(e.target.value)}
                        min="1"
                        className="w-full pl-8 pr-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Sample Buyer Email</label>
                    <input
                      type="email"
                      value={testBuyerEmail}
                      onChange={(e) => setTestBuyerEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isTesting}
                  className="w-full py-3 bg-[#003087] hover:bg-blue-900 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating PayPal Order...</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      <span>Test ${testAmount} USD International PayPal Order</span>
                    </>
                  )}
                </button>
              </form>

              {testResult && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-2 font-mono text-[11px]">
                  <div className="text-emerald-400 font-bold">PayPal Order Response:</div>
                  <pre className="whitespace-pre-wrap overflow-x-auto text-[10px] text-slate-300">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
