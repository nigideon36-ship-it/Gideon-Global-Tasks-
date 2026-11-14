import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Smartphone,
  QrCode,
  KeyRound,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  ShieldOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';

export const TwoFactorModal: React.FC = () => {
  const {
    securityModalOpen,
    setSecurityModalOpen,
    customerProfile,
    activeToken,
    updateCustomerProfileLocal,
  } = useAuth();
  const { selectedCountry } = useRegion();

  const [selectedMethod, setSelectedMethod] = useState<'sms' | 'totp'>('totp');
  const [smsPhone, setSmsPhone] = useState(customerProfile?.phone || selectedCountry.samplePhone);
  const [setupData, setSetupData] = useState<{
    method: 'sms' | 'totp';
    qrCodeDataUrl?: string;
    secret?: string;
    maskedPhone?: string;
    previewCode?: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customerProfile?.phone) {
      setSmsPhone(customerProfile.phone);
    } else {
      setSmsPhone(selectedCountry.samplePhone);
    }
  }, [customerProfile?.phone, selectedCountry.samplePhone]);

  useEffect(() => {
    if (securityModalOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setSetupData(null);
      setVerifyCode('');
    }
  }, [securityModalOpen]);

  if (!securityModalOpen) return null;

  const handleStartSetup = async (method: 'sms' | 'totp') => {
    if (!activeToken) {
      setErrorMsg('Please sign in first to configure Two-Factor Authentication.');
      return;
    }
    setSelectedMethod(method);
    setErrorMsg(null);
    setSuccessMsg(null);
    setVerifyCode('');
    setLoading(true);

    try {
      const res = await fetch('/api/customer/2fa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          method,
          phone: method === 'sms' ? smsPhone.trim() : undefined,
          countryCode: selectedCountry.code,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Could not initialize 2FA setup.');
      } else {
        setSetupData({
          method,
          qrCodeDataUrl: data.qrCodeDataUrl,
          secret: data.secret,
          maskedPhone: data.maskedPhone,
          previewCode: data.previewCode,
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error starting 2FA setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken || !setupData) return;

    if (verifyCode.trim().length !== 6) {
      setErrorMsg('Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/customer/2fa/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          method: setupData.method,
          code: verifyCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Verification failed.');
      } else {
        updateCustomerProfileLocal(data.customer);
        setSetupData(null);
        setVerifyCode('');
        setSuccessMsg(
          setupData.method === 'totp'
            ? 'Authenticator App 2FA is now active on your account!'
            : 'SMS Two-Factor Authentication is now active on your mobile number!'
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not verify code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!activeToken) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/customer/2fa/disable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateCustomerProfileLocal(data.customer);
        setSetupData(null);
        setSuccessMsg('Two-Factor Authentication has been disabled.');
      } else {
        setErrorMsg(data.error || 'Failed to disable 2FA.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-blue-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-blue-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-blue-800 bg-gradient-to-r from-blue-800 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                Two-Factor Authentication (2FA)
              </h2>
              <p className="text-[11px] text-blue-100">
                Protect your wallet &amp; account using SMS or Authenticator App
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSecurityModalOpen(false)}
            className="p-1.5 text-blue-100 hover:text-white hover:bg-blue-900/40 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Current Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              customerProfile?.twoFactorEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  Status:{' '}
                  {customerProfile?.twoFactorEnabled
                    ? `Enabled (${customerProfile.twoFactorMethod === 'totp' ? 'Authenticator App' : 'SMS OTP'})`
                    : 'Not Enabled (Recommended)'}
                </span>
              </div>
              <p className="text-[11px] opacity-80">
                {customerProfile?.phone
                  ? `Registered Mobile: ${customerProfile.phone}`
                  : 'Optional Email & Mobile 2FA supported'}
              </p>
            </div>

            {customerProfile?.twoFactorEnabled && (
              <button
                type="button"
                onClick={handleDisable2fa}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] cursor-pointer shrink-0"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                <span>Disable 2FA</span>
              </button>
            )}
          </div>

          {/* Method Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleStartSetup('totp')}
              disabled={loading}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedMethod === 'totp' && setupData?.method === 'totp'
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                  : 'border-slate-200 hover:border-blue-400 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Authenticator App</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Google Authenticator, Authy, or Microsoft Authenticator (6-digit TOTP).
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('sms')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedMethod === 'sms'
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                  : 'border-slate-200 hover:border-blue-400 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>SMS Verification</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Receive a 6-digit login code directly on your East Africa mobile line.
              </p>
            </button>
          </div>

          {/* SMS Phone Confirmation before triggering code */}
          {selectedMethod === 'sms' && setupData?.method !== 'sms' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <label className="block font-bold text-slate-800">
                East Africa Mobile Number for SMS 2FA
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder={selectedCountry.samplePhone}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-blue-600 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleStartSetup('sms')}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Send SMS Code'}
                </button>
              </div>
            </div>
          )}

          {/* Setup Verification Step */}
          {setupData && (
            <form onSubmit={handleConfirm2fa} className="p-5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-4">
              {setupData.method === 'totp' && (
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">
                    1. Scan QR Code with Authenticator App
                  </div>
                  {setupData.qrCodeDataUrl && (
                    <div className="flex justify-center bg-white p-3 rounded-2xl border border-blue-200 w-fit mx-auto">
                      <img
                        src={setupData.qrCodeDataUrl}
                        alt="Authenticator App 2FA QR Code"
                        className="w-44 h-44"
                      />
                    </div>
                  )}
                  {setupData.secret && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-600">
                        Or enter setup key manually:
                      </span>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                        <code className="flex-1 font-mono text-[11px] text-blue-900 break-all">
                          {setupData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={copySecret}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {setupData.method === 'sms' && (
                <div className="space-y-1 text-blue-900">
                  <div className="font-bold">
                    SMS Code Sent to {setupData.maskedPhone}
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Enter the 6-digit verification code sent to your mobile line.
                  </p>
                  {setupData.previewCode && (
                    <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl font-mono text-[11px]">
                      SMS Test Code: <strong>{setupData.previewCode}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="block font-bold text-slate-800">
                  {setupData.method === 'totp'
                    ? '2. Enter 6-Digit Code from Authenticator App'
                    : 'Enter 6-Digit SMS Code'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-300 font-mono font-bold tracking-widest text-slate-900 focus:border-blue-600 outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
                  >
                    {loading ? 'Activating...' : 'Enable 2FA'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
