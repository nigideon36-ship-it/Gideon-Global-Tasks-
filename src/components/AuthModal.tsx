import React, { useState, useEffect } from 'react';
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
  } = useAuth();
  const { selectedCountry, setSelectedCountryCode } = useRegion();

  const [mode, setMode] = useState<'register' | 'login' | '2fa'>('register');
  const [regStep, setRegStep] = useState<'details' | 'otp'>('details');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [regOtpCode, setRegOtpCode] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [challengeToken, setChallengeToken] = useState('');
  const [challengeMethod, setChallengeMethod] = useState<'sms' | 'totp'>('sms');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [previewSmsCode, setPreviewSmsCode] = useState<string | null>(null);
  const [regMaskedPhone, setRegMaskedPhone] = useState('');
  const [regPreviewCode, setRegPreviewCode] = useState<string | null>(null);
  const [regSmsMode, setRegSmsMode] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authModalOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setRegStep('details');
      setRegOtpCode('');
      setRegPreviewCode(null);
    }
  }, [authModalOpen]);

  useEffect(() => {
    setPhone('');
    setRegStep('details');
    setRegOtpCode('');
    setRegPreviewCode(null);
  }, [selectedCountry.code]);

  if (!authModalOpen) return null;

  const sendRegSmsOtp = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanedPhone = phone.trim();
    if (!cleanedPhone) {
      setErrorMsg('Mobile number is required to register.');
      return;
    }

    const normalizedPreview = cleanedPhone.startsWith('+')
      ? cleanedPhone
      : cleanedPhone.startsWith('0')
      ? `${selectedCountry.dialCode}${cleanedPhone.slice(1)}`
      : `${selectedCountry.dialCode}${cleanedPhone}`;

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
      phone: cleanedPhone,
      countryCode: selectedCountry.code,
      email: email.trim() || undefined,
      password,
    });
    setLoading(false);

    if (!otpRes.success) {
      setErrorMsg(otpRes.error || 'Could not send SMS verification OTP.');
      return;
    }

    setRegMaskedPhone(otpRes.maskedPhone || normalizedPreview);
    setRegSmsMode(otpRes.smsDeliveryMode || 'sms');
    setRegPreviewCode(otpRes.previewCode || null);
    setRegOtpCode('');
    setRegStep('otp');
    setSuccessMsg(`A 6-digit SMS OTP has been sent to ${otpRes.maskedPhone || normalizedPreview}.`);
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
      password,
      otpCode: regOtpCode.trim(),
    });
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Invalid or expired SMS OTP code.');
      return;
    }

    setSuccessMsg('Phone verified via SMS OTP and account created!');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!phone.trim() || !password) {
      setErrorMsg('Enter your registered mobile number and password/PIN.');
      return;
    }

    setLoading(true);
    const result = await loginWithPhone({
      phone: phone.trim(),
      countryCode: selectedCountry.code,
      password,
    });
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Sign in failed.');
      return;
    }

    if (result.requires2FA && result.challengeToken) {
      setChallengeToken(result.challengeToken);
      setChallengeMethod(result.twoFactorMethod || 'sms');
      setMaskedPhone(result.maskedPhone || phone);
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
    const result = await verifyTwoFactorLogin(challengeToken, otpCode.trim());
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
                  : 'Customer Sign In'}
              </h2>
              <p className="text-[11px] text-blue-100">
                East Africa Mobile Registration &amp; Mandatory SMS OTP
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
            <form onSubmit={handleRequestRegOtpSubmit} className="space-y-3.5">
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
                  Mobile Number <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={selectedCountry.samplePhone}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Mandatory: We will send a 6-digit SMS OTP to this number before your account is created.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com (optional)"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Amina Wanjiku"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Create Password / PIN <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

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
                <span>{loading ? 'Sending SMS OTP...' : 'Send SMS Verification OTP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === 'register' && regStep === 'otp' && (
            <form onSubmit={handleCompleteRegistrationSubmit} className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>SMS OTP Required for Registration</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Enter the 6-digit SMS code sent to <strong className="font-mono">{regMaskedPhone}</strong> ({regSmsMode === 'preview' ? 'SMS Gateway Preview' : 'Mobile SMS'}) to verify your phone and create your account.
                </p>
                {regPreviewCode && (
                  <p className="text-[11px] font-mono bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-blue-900">
                    SMS Test OTP Code: <strong>{regPreviewCode}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter 6-Digit SMS OTP <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    inputMode="numeric"
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
                  disabled={loading}
                  onClick={() => void sendRegSmsOtp()}
                  className="text-blue-700 hover:text-blue-900 font-bold cursor-pointer disabled:opacity-50"
                >
                  Resend SMS OTP
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || regOtpCode.trim().length !== 6}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Verifying OTP & Creating Account...' : 'Verify SMS OTP & Complete Registration'}</span>
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
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
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={selectedCountry.samplePhone}
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
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password or PIN"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

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
                <span>{loading ? 'Signing In...' : 'Sign In with Mobile Number'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === '2fa' && (
            <form onSubmit={handleVerify2faSubmit} className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>
                    {challengeMethod === 'totp'
                      ? 'Authenticator App Code Required'
                      : `SMS Code Sent to ${maskedPhone}`}
                  </span>
                </div>
                <p className="text-[11px] text-blue-800">
                  {challengeMethod === 'totp'
                    ? 'Open Google Authenticator / Authy and enter the 6-digit code for Gideon Global Tasks.'
                    : 'Enter the 6-digit SMS code delivered to your East Africa mobile line.'}
                </p>
                {previewSmsCode && (
                  <p className="text-[11px] font-mono bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-blue-900 mt-1">
                    SMS Test Code: <strong>{previewSmsCode}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6-Digit 2FA Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    inputMode="numeric"
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
        </div>
      </div>
    </div>
  );
};
