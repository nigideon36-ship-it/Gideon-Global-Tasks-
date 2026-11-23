import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  Mail,
  Lock,
  User as UserIcon,
  ShieldCheck,
  Smartphone,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Globe,
  BookmarkCheck,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { EAST_AFRICA_COUNTRIES, isEastAfricaPhone } from '../lib/eastAfrica';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    setAuthModalOpen,
    signInWithGoogle,
    requestRegistrationOtp,
    registerWithPhone,
    loginWithPhone,
    verifyTwoFactorLogin,
    rememberedAccount,
    clearRememberedAccount,
  } = useAuth();
  const { selectedCountry, setSelectedCountryCode } = useRegion();

  const [mode, setMode] = useState<'register' | 'login' | '2fa'>('register');
  const [regStep, setRegStep] = useState<'details' | 'otp'>('details');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [withdrawalAccount, setWithdrawalAccount] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [regOtpCode, setRegOtpCode] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [challengeToken, setChallengeToken] = useState('');
  const [challengeMethod, setChallengeMethod] = useState<'sms' | 'totp'>('sms');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [previewSmsCode, setPreviewSmsCode] = useState<string | null>(null);
  const [twoFaCarrierDelivered, setTwoFaCarrierDelivered] = useState(false);
  const [twoFaProviderLabel, setTwoFaProviderLabel] = useState('');
  const [regMaskedPhone, setRegMaskedPhone] = useState('');
  const [regPreviewCode, setRegPreviewCode] = useState<string | null>(null);
  const [regCarrierDelivered, setRegCarrierDelivered] = useState<boolean>(false);
  const [regProviderLabel, setRegProviderLabel] = useState<string>('');
  const [regFallbackReason, setRegFallbackReason] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const loginPasswordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (authModalOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setRegStep('details');
      setRegOtpCode('');
      setRegPreviewCode(null);
      setRegCarrierDelivered(false);
      setRegFallbackReason('');
      try {
        const pendingRef = localStorage.getItem('gideon_pending_ref_code_v1');
        if (pendingRef) setReferralCode(pendingRef.toUpperCase());
      } catch {}
      if (rememberedAccount) {
        setMode('login');
        setLoginIdentifier(rememberedAccount.phone || rememberedAccount.email || '');
        if (rememberedAccount.countryCode) {
          setSelectedCountryCode(rememberedAccount.countryCode as any);
        }
      }
    }
  }, [authModalOpen]);

  useEffect(() => {
    if (regStep === 'otp') {
      setRegStep('details');
      setRegOtpCode('');
      setRegPreviewCode(null);
    }
  }, [selectedCountry.code]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (!authModalOpen) return null;

  const normalizeClientPhone = (raw: string) => {
    let cleaned = raw.trim().replace(/[\s\-().]/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
    if (cleaned.startsWith('+')) {
      return cleaned.replace(/^\+(254|256|255|250|257|211|251|252)0+(\d+)/, '+$1$2');
    }
    if (/^(254|256|255|250|257|211|251|252)/.test(cleaned)) {
      return `+${cleaned}`.replace(/^\+(254|256|255|250|257|211|251|252)0+(\d+)/, '+$1$2');
    }
    if (cleaned.startsWith('0')) {
      return `${selectedCountry.dialCode}${cleaned.slice(1)}`;
    }
    return `${selectedCountry.dialCode}${cleaned}`;
  };

  const isDuplicateError = Boolean(errorMsg && /already registered|duplicate/i.test(errorMsg));

  const handleUseSavedAccount = () => {
    if (!rememberedAccount) return;
    setMode('login');
    setLoginIdentifier(rememberedAccount.phone || rememberedAccount.email || '');
    if (rememberedAccount.countryCode) {
      setSelectedCountryCode(rememberedAccount.countryCode as any);
    }
    setErrorMsg(null);
    window.setTimeout(() => {
      loginPasswordRef.current?.focus();
    }, 50);
  };

  const sendRegSmsOtp = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanedPhone = phone.trim();
    if (!cleanedPhone) {
      setErrorMsg('Mobile number is required to register.');
      return;
    }

    const normalizedPreview = normalizeClientPhone(cleanedPhone);

    if (!isEastAfricaPhone(normalizedPreview)) {
      setErrorMsg(`Enter a valid ${selectedCountry.name} mobile number (${selectedCountry.dialCode}...).`);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Create a PIN / Password of at least 6 characters.');
      return;
    }

    setLoading(true);
    const otpRes = await requestRegistrationOtp({
      phone: normalizedPreview,
      countryCode: selectedCountry.code,
      email: email.trim() || undefined,
      password,
    });
    setLoading(false);

    if (!otpRes.success) {
      setErrorMsg(otpRes.error || 'Could not send verification OTP.');
      return;
    }

    setRegMaskedPhone(otpRes.maskedPhone || normalizedPreview);
    setRegCarrierDelivered(Boolean(otpRes.carrierDelivered));
    setRegProviderLabel(otpRes.providerLabel || 'SMS Gateway');
    setRegFallbackReason(otpRes.fallbackReason || '');
    setRegPreviewCode(otpRes.previewCode || null);
    setRegOtpCode('');
    setRegStep('otp');
    setResendCooldown(30);

    if (otpRes.carrierDelivered) {
      setSuccessMsg(
        `Live SMS OTP dispatched via ${otpRes.providerLabel || 'SMS Gateway'} to ${otpRes.maskedPhone || normalizedPreview}.`
      );
    } else {
      setSuccessMsg(
        `Instant verification code ready for ${otpRes.maskedPhone || normalizedPreview}. Click "Fill Code" or enter it below.`
      );
    }
  };

  const handleRequestRegOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendRegSmsOtp();
  };

  const handleCompleteRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (regOtpCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code sent via SMS to complete registration.');
      return;
    }

    setLoading(true);
    const result = await registerWithPhone({
      phone: phone.trim(),
      countryCode: selectedCountry.code,
      email: email.trim() || undefined,
      displayName: displayName.trim() || undefined,
      city: city.trim() || undefined,
      password,
      otpCode: regOtpCode.trim(),
      withdrawalMethod: withdrawalAccount.trim() ? 'PayPal' : undefined,
      withdrawalAccount: withdrawalAccount.trim() ? withdrawalAccount.trim().toLowerCase() : undefined,
      withdrawalAccountHolder: displayName.trim() || undefined,
      referralCode: referralCode.trim().toUpperCase() || undefined,
      rememberMe,
    });
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Invalid or expired SMS OTP code.');
      return;
    }

    setSuccessMsg('Phone verified via SMS OTP and credentials saved securely on the portal!');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const idToUse = loginIdentifier.trim() || phone.trim();
    if (!idToUse || !password) {
      setErrorMsg('Enter your registered mobile number or email and password/PIN.');
      return;
    }

    setLoading(true);
    const result = await loginWithPhone({
      identifier: idToUse,
      countryCode: selectedCountry.code,
      password,
      rememberMe,
    });
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Sign in failed.');
      return;
    }

    if (result.requires2FA && result.challengeToken) {
      setChallengeToken(result.challengeToken);
      setChallengeMethod(result.twoFactorMethod || 'sms');
      setMaskedPhone(result.maskedPhone || idToUse);
      setTwoFaCarrierDelivered(Boolean(result.carrierDelivered));
      setTwoFaProviderLabel(result.providerLabel || 'SMS Gateway');
      setPreviewSmsCode(result.previewCode || null);
      setOtpCode('');
      setMode('2fa');
    }
  };

  const handleVerify2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (otpCode.trim().length !== 6) {
      setErrorMsg('Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    const result = await verifyTwoFactorLogin(challengeToken, otpCode.trim(), rememberMe);
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Invalid 6-digit code.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-blue-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-blue-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-blue-700 bg-gradient-to-r from-blue-700 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                {mode === '2fa'
                  ? 'Two-Factor Verification'
                  : mode === 'register'
                  ? regStep === 'otp'
                    ? 'Verify SMS Registration OTP'
                    : 'Customer Mobile Registration'
                  : 'Customer Portal Sign In'}
              </h2>
              <p className="text-[11px] text-blue-100">
                Credentials saved on portal · Duplicate accounts prevented
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 text-blue-100 hover:text-white hover:bg-blue-800/40 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Tabs */}
          {mode !== '2fa' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-blue-50 rounded-xl border border-blue-100">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setRegStep('details');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:bg-blue-100/70'
                }`}
              >
                Register (Mobile + SMS OTP)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  if (!loginIdentifier && (phone || rememberedAccount?.phone)) {
                    setLoginIdentifier(phone || rememberedAccount?.phone || '');
                  }
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:bg-blue-100/70'
                }`}
              >
                Sign In
              </button>
            </div>
          )}

          {mode === 'register' && regStep === 'details' && (
            <form onSubmit={handleRequestRegOtpSubmit} method="post" className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  East Africa Country
                </label>
                <select
                  value={selectedCountry.code}
                  onChange={(e) => setSelectedCountryCode(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold focus:border-blue-600 outline-hidden"
                >
                  {EAST_AFRICA_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.dialCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Real Mobile Number <span className="text-rose-600">*</span>{' '}
                  <span className="text-slate-400 font-normal">(Locked after registration)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    name="username"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={selectedCountry.samplePhone}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Mandatory 6-digit SMS OTP sent before activation. 1 account per real mobile number &amp; email.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional · also enables Email Sign In)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com (optional)"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Real Full Name <span className="text-slate-400 font-normal">(One-time lock in My Account)</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Amina Wanjiku"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    City / Town <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Nairobi, Kampala"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-600" />
                    <span>PayPal Payout Email (Optional on Signup)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">PayPal Only · Locks if entered</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                  <div className="px-2.5 py-2 text-xs rounded-lg border border-sky-200 bg-sky-50 text-sky-900 font-bold text-center">
                    PayPal
                  </div>
                  <input
                    type="email"
                    value={withdrawalAccount}
                    onChange={(e) => setWithdrawalAccount(e.target.value)}
                    placeholder="paypal-email@example.com (optional)"
                    className="sm:col-span-2 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono text-slate-900 outline-hidden focus:border-blue-600"
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Withdrawals start from 150 shillings via PayPal once you verify BOTH Front &amp; Back of your {selectedCountry.idDocumentName} in My Account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Create Password / PIN <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Referral / Invite Code <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GIDEON-EA-894"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono uppercase text-slate-900 focus:border-blue-600 outline-hidden"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Save my portal account details on this device for 1-tap login</span>
              </label>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                  {isDuplicateError && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginIdentifier(phone.trim() || email.trim());
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      <span>Go to Sign In Instead</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? 'Sending SMS OTP...' : 'Send SMS Verification OTP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === 'register' && regStep === 'otp' && (
            <form onSubmit={handleCompleteRegistrationSubmit} className="space-y-4">
              {regCarrierDelivered ? (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Live SMS OTP Sent via {regProviderLabel}</span>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Enter the 6-digit SMS code sent to <strong className="font-mono">{regMaskedPhone}</strong>. SMS typically arrives within 5–30 seconds (expires in 10 minutes).
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Instant On-Screen OTP Verification</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Live carrier SMS to <strong className="font-mono">{regMaskedPhone}</strong> is not active right now
                    {regFallbackReason ? ` (${regFallbackReason})` : ''}. Use the verified 6-digit code below to activate your account immediately:
                  </p>
                  {regPreviewCode && (
                    <div className="flex items-center justify-between gap-2 bg-white border border-amber-300 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
                          Your 6-Digit OTP Code
                        </span>
                        <span className="text-lg font-mono font-extrabold tracking-[0.25em] text-blue-900">
                          {regPreviewCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRegOtpCode(regPreviewCode)}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Auto-Fill Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter 6-Digit Verification OTP <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={regOtpCode}
                    onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full pl-9 pr-3 py-2.5 text-center text-base tracking-[0.4em] rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setRegStep('details');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  ← Edit Phone / Details
                </button>
                <button
                  type="button"
                  disabled={loading || (regCarrierDelivered && resendCooldown > 0)}
                  onClick={() => void sendRegSmsOtp()}
                  className="text-blue-700 hover:text-blue-900 font-bold cursor-pointer disabled:opacity-50"
                >
                  {regCarrierDelivered && resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : 'Generate / Resend OTP'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || regOtpCode.trim().length !== 6}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Verifying OTP & Saving Account...' : 'Verify SMS OTP & Complete Registration'}</span>
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} method="post" className="space-y-3.5">
              {rememberedAccount && (
                <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleUseSavedAccount}
                    className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <BookmarkCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700">
                        {rememberedAccount.displayName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 truncate">
                        {rememberedAccount.phone}
                        {rememberedAccount.email ? ` · ${rememberedAccount.email}` : ''}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearRememberedAccount();
                      setLoginIdentifier('');
                    }}
                    title="Forget saved account from this device"
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  East Africa Country
                </label>
                <select
                  value={selectedCountry.code}
                  onChange={(e) => setSelectedCountryCode(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold focus:border-blue-600 outline-hidden"
                >
                  {EAST_AFRICA_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.dialCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Registered Mobile Number or Email
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={`${selectedCountry.samplePhone} or email@example.com`}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password / PIN
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    ref={loginPasswordRef}
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password or PIN"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Keep my portal account remembered for quick login</span>
              </label>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? 'Signing In...' : 'Sign In to Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === '2fa' && (
            <form onSubmit={handleVerify2faSubmit} className="space-y-4">
              {challengeMethod === 'totp' || twoFaCarrierDelivered ? (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>
                      {challengeMethod === 'totp'
                        ? 'Authenticator App Code Required'
                        : `Live SMS Sent via ${twoFaProviderLabel} to ${maskedPhone}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    {challengeMethod === 'totp'
                      ? 'Open Google Authenticator / Authy and enter the 6-digit code for Gideon Global Tasks.'
                      : 'Enter the 6-digit SMS code delivered to your East Africa mobile line.'}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Instant On-Screen 2FA Verification ({maskedPhone})</span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Live SMS carrier is not active right now. Enter or auto-fill your 6-digit verification code below:
                  </p>
                  {previewSmsCode && (
                    <div className="flex items-center justify-between gap-2 bg-white border border-amber-300 rounded-xl px-3 py-2">
                      <span className="text-base font-mono font-extrabold tracking-[0.25em] text-blue-900">
                        {previewSmsCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtpCode(previewSmsCode)}
                        className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Auto-Fill Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6-Digit 2FA Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full pl-9 pr-3 py-2.5 text-center text-base tracking-[0.4em] rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Verifying...' : 'Verify & Complete Sign In'}
                </button>
              </div>
            </form>
          )}

          {mode !== '2fa' && (
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="text-[11px] text-center text-slate-400 font-medium">
                OR CONTINUE WITH GOOGLE (REQUIRED FOR PLATFORM OWNER)
              </div>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Sign In with Google Account</span>
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-[11px] text-center text-slate-600">
            Experiencing issues?{' '}
            <a href="tel:+254712727558" className="font-mono font-bold text-blue-700 hover:underline">
              Call: +254712727558
            </a>
            {' · '}
            <a
              href="https://wa.me/254785909543"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-bold text-emerald-700 hover:underline"
            >
              WhatsApp: 0785909543
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
