import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  MapPin,
  Lock,
  Phone,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import {
  useAuth,
  type CustomerWithdrawalMethod,
} from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { useTasks } from '../context/TaskContext';
import { WithdrawalEligibilityGate } from './WithdrawalEligibilityGate';
import {
  WITHDRAWAL_THRESHOLD_USD,
  convertUsdToLocal,
  localAmountToUsd,
  formatCurrencyFromUsd,
} from '../lib/eastAfrica';

const WITHDRAWAL_METHODS: CustomerWithdrawalMethod[] = [
  'M-PESA',
  'Airtel / MTN MoMo',
  'East Africa Bank',
  'Wise',
  'Crypto USDT',
];

export const CustomerProfileModal: React.FC = () => {
  const {
    profileModalOpen,
    setProfileModalOpen,
    profileModalTab,
    setProfileModalTab,
    customerProfile,
    user,
    updateCustomerProfile,
  } = useAuth();
  const { userStats, requestPayout, activePackage, setActiveTab } = useTasks();
  const { selectedCountry } = useRegion();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // One-time binding fields (only editable when NOT yet locked)
  const [pendingPhone, setPendingPhone] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState<CustomerWithdrawalMethod>('M-PESA');
  const [withdrawalAccount, setWithdrawalAccount] = useState('');
  const [withdrawalAccountHolder, setWithdrawalAccountHolder] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const minLocalAmount = convertUsdToLocal(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
  const thresholdLabel = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);

  // Withdrawal tab state (strictly bound to locked real registration details)
  const [withdrawAmount, setWithdrawAmount] = useState<string>(String(minLocalAmount));
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  useEffect(() => {
    setWithdrawAmount(String(convertUsdToLocal(WITHDRAWAL_THRESHOLD_USD, selectedCountry)));
  }, [selectedCountry.code]);

  useEffect(() => {
    if (!profileModalOpen) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setWithdrawError(null);
    setWithdrawSuccess(null);

    setDisplayName(customerProfile?.displayName || user?.displayName || '');
    setEmail(customerProfile?.email || user?.email || '');
    setCity(customerProfile?.city || '');
    setBio(customerProfile?.bio || '');
    setFacebook(customerProfile?.socialHandles?.facebook || '');
    setInstagram(customerProfile?.socialHandles?.instagram || '');
    setTiktok(customerProfile?.socialHandles?.tiktok || '');
    setWhatsapp(customerProfile?.socialHandles?.whatsapp || '');

    setPendingPhone(customerProfile?.phone || '');
    const defaultMethod: CustomerWithdrawalMethod =
      (customerProfile?.countryCode || selectedCountry.code) === 'KE'
        ? 'M-PESA'
        : 'Airtel / MTN MoMo';
    setWithdrawalMethod(customerProfile?.withdrawalDetails?.method || defaultMethod);
    setWithdrawalAccount(
      customerProfile?.withdrawalDetails?.accountDetails || customerProfile?.phone || ''
    );
    setWithdrawalAccountHolder(
      customerProfile?.withdrawalDetails?.accountHolderName ||
        customerProfile?.displayName ||
        user?.displayName ||
        ''
    );
  }, [profileModalOpen, customerProfile, user, selectedCountry.code]);

  if (!profileModalOpen) return null;

  const isPhoneLocked = Boolean(customerProfile?.phone);
  const lockedWithdrawal = customerProfile?.withdrawalDetails?.locked
    ? customerProfile.withdrawalDetails
    : null;
  const isWithdrawalLocked = Boolean(lockedWithdrawal);

  const maxLocalBalance = convertUsdToLocal(userStats.balance, selectedCountry);
  const numWithdrawLocal = parseFloat(withdrawAmount) || 0;
  const resolvedWithdrawUsd =
    Math.abs(numWithdrawLocal - maxLocalBalance) <= 1 && userStats.balance >= WITHDRAWAL_THRESHOLD_USD
      ? userStats.balance
      : localAmountToUsd(numWithdrawLocal, selectedCountry);
  const canRequestPayout =
    Boolean(lockedWithdrawal) &&
    numWithdrawLocal >= minLocalAmount &&
    resolvedWithdrawUsd <= userStats.balance + 1e-4;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (displayName.trim().length < 2) {
      setErrorMsg('Display name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    const payload: Parameters<typeof updateCustomerProfile>[0] = {
      displayName: displayName.trim(),
      email: email.trim(),
      city: city.trim(),
      bio: bio.trim(),
      socialHandles: {
        facebook: facebook.trim(),
        instagram: instagram.trim(),
        tiktok: tiktok.trim(),
        whatsapp: whatsapp.trim(),
      },
    };

    if (!isPhoneLocked && pendingPhone.trim()) {
      payload.phone = pendingPhone.trim();
    }

    if (!isWithdrawalLocked && withdrawalAccount.trim()) {
      payload.withdrawalMethod = withdrawalMethod;
      payload.withdrawalAccount = withdrawalAccount.trim();
      payload.withdrawalAccountHolder = withdrawalAccountHolder.trim() || displayName.trim();
    }

    const res = await updateCustomerProfile(payload);
    setSaving(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Could not save your My Account details.');
      return;
    }

    setSuccessMsg(
      res.message || 'My Account updated. Your real phone number and withdrawal details remain locked.'
    );
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    if (!lockedWithdrawal) {
      setWithdrawError(
        'Please save and lock your real mobile phone & withdrawal details in the My Details tab first.'
      );
      return;
    }

    if (numWithdrawLocal < minLocalAmount) {
      setWithdrawError(
        `Withdrawals start from ${thresholdLabel}. Continue completing tasks to reach ${thresholdLabel}.`
      );
      return;
    }

    if (resolvedWithdrawUsd > userStats.balance + 1e-4) {
      setWithdrawError(
        `Withdrawal amount exceeds your available balance (${formatCurrencyFromUsd(userStats.balance, selectedCountry)}).`
      );
      return;
    }

    const ok = requestPayout(
      resolvedWithdrawUsd,
      lockedWithdrawal.method,
      lockedWithdrawal.accountDetails
    );
    if (ok) {
      setWithdrawSuccess(
        `${formatCurrencyFromUsd(resolvedWithdrawUsd, selectedCountry)} withdrawal submitted to your locked ${lockedWithdrawal.method} destination (${lockedWithdrawal.accountDetails}) for Owner verification.`
      );
      setWithdrawAmount(String(minLocalAmount));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                My Account
              </h2>
              <p className="text-xs text-slate-500">
                Update your details &amp; request withdrawals using your locked real registration details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setProfileModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Summary Strip + Section Tabs */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-200 bg-white space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
              <span className="text-slate-300 font-medium">Available Balance</span>
              <span className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                {formatCurrencyFromUsd(userStats.balance, selectedCountry)}
              </span>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium">Locked Phone</span>
              <span className="font-mono font-bold text-slate-900 truncate">
                {customerProfile?.phone || 'Not locked yet'}
              </span>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium">Payout Rail</span>
              <span className="font-bold text-slate-900 truncate">
                {lockedWithdrawal ? `${lockedWithdrawal.method}` : 'Setup required'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileModalTab('details')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                profileModalTab === 'details'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>My Details &amp; Locked Info</span>
            </button>
            <button
              type="button"
              onClick={() => setProfileModalTab('withdraw')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                profileModalTab === 'withdraw'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Request Withdrawal ({formatCurrencyFromUsd(userStats.balance, selectedCountry)})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileModalOpen(false);
                setActiveTab('dashboard');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer ml-auto"
            >
              <span>Customer Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TAB 1: MY DETAILS & LOCKED REAL REGISTRATION INFO */}
        {profileModalTab === 'details' && (
          <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 text-xs">
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Section 1: Editable Customer Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900">
                  Update My Details Information
                </h3>
                <span className="text-[11px] text-slate-500">
                  Synced with Owner Portal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Real Full / Display Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Amani Kiprop"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>City / County</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Nairobi, Kampala, Kigali"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Skills / Creator Focus (Bio)
                  </label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g. AI annotation, TikTok product Reels, Swahili QA"
                    maxLength={300}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              {/* Social Media Handles */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">
                  Creator Social Handles (Facebook, Instagram, TikTok &amp; WhatsApp)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="Facebook Page / Profile URL"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="Instagram @handle"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                  <input
                    type="text"
                    value={tiktok}
                    onChange={(e) => setTiktok(e.target.value)}
                    placeholder="TikTok @handle"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="WhatsApp Business / Status Name"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Immutable Real Registration Phone & Withdrawal Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-700" />
                    <span>Locked Real Phone &amp; Withdrawal Details (Cannot Change)</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Your real registration mobile number and withdrawal destination cannot be edited by customers. All withdrawals in My Account are paid strictly to these details.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-600 whitespace-nowrap shrink-0">
                  Country: {customerProfile?.countryCode || selectedCountry.code}
                </span>
              </div>

              {/* Registered Mobile Number */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Registered Real Mobile Number</span>
                  </span>
                  {isPhoneLocked && (
                    <span className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Locked · Cannot change</span>
                    </span>
                  )}
                </label>

                {isPhoneLocked ? (
                  <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-800 font-mono font-semibold flex items-center justify-between">
                    <span>{customerProfile?.phone}</span>
                    <span className="text-[11px] font-sans text-emerald-700 font-medium">
                      {customerProfile?.phoneVerified ? 'OTP Verified' : 'Registered'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="tel"
                      value={pendingPhone}
                      onChange={(e) => setPendingPhone(e.target.value)}
                      placeholder={selectedCountry.samplePhone}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:border-blue-600 outline-hidden"
                    />
                    <p className="text-[11px] text-amber-700">
                      One-time lock: Enter your real mobile number. Once saved, it cannot be changed.
                    </p>
                  </div>
                )}
              </div>

              {/* Withdrawal Method & Account */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-slate-500" />
                    <span>Real Withdrawal Details</span>
                  </span>
                  {isWithdrawalLocked ? (
                    <span className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Locked · Cannot change</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700">
                      One-time setup with real details (locks on save)
                    </span>
                  )}
                </div>

                {lockedWithdrawal ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-100">
                      <div className="text-[10px] text-slate-500">Payout Method</div>
                      <div className="font-bold text-slate-900">
                        {lockedWithdrawal.method}
                      </div>
                    </div>
                    <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-100">
                      <div className="text-[10px] text-slate-500">Account / Number</div>
                      <div className="font-mono font-bold text-slate-900 break-all">
                        {lockedWithdrawal.accountDetails}
                      </div>
                    </div>
                    <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-100">
                      <div className="text-[10px] text-slate-500">Real Account Name</div>
                      <div className="font-bold text-slate-900 truncate">
                        {lockedWithdrawal.accountHolderName || customerProfile?.displayName}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Payout Method
                      </label>
                      <select
                        value={withdrawalMethod}
                        onChange={(e) => setWithdrawalMethod(e.target.value as CustomerWithdrawalMethod)}
                        className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold outline-hidden focus:border-blue-600"
                      >
                        {WITHDRAWAL_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Real Account / Mobile Number
                      </label>
                      <input
                        type="text"
                        value={withdrawalAccount}
                        onChange={(e) => setWithdrawalAccount(e.target.value)}
                        placeholder={
                          withdrawalMethod === 'M-PESA' || withdrawalMethod === 'Airtel / MTN MoMo'
                            ? selectedCountry.samplePhone
                            : withdrawalMethod === 'Wise'
                            ? 'wise@email.com'
                            : 'Bank Account / USDT Address'
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900 outline-hidden focus:border-blue-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Registered Real Name
                      </label>
                      <input
                        type="text"
                        value={withdrawalAccountHolder}
                        onChange={(e) => setWithdrawalAccountHolder(e.target.value)}
                        placeholder="Full legal name"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 outline-hidden focus:border-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Need to recover or verify locked details? Call <strong className="font-mono">+254712727558</strong> or WhatsApp <strong className="font-mono">0785909543</strong> for Owner verification.
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProfileModalTab('withdraw')}
                className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Go to Request Withdrawal</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save My Details'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: REQUEST WITHDRAWAL USING LOCKED REAL DETAILS */}
        {profileModalTab === 'withdraw' && (
          <div className="p-6 overflow-y-auto space-y-6 text-xs">
            {/* Balance Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900 text-white">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Available to Withdraw
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                  {formatCurrencyFromUsd(userStats.balance, selectedCountry)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Pass: {activePackage?.name || 'Locked (No Active Pass)'}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Pending Verification
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrencyFromUsd(userStats.pendingBalance, selectedCountry)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Clears within 24 hours</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Lifetime Earned
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrencyFromUsd(userStats.lifetimeEarned, selectedCountry)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {userStats.completedTasksCount} completed tasks
                </div>
              </div>
            </div>

            <WithdrawalEligibilityGate onCloseParent={() => setProfileModalOpen(false)}>
              {!lockedWithdrawal ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-950">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-sm">
                        Lock Your Real Withdrawal Details First
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Before requesting a withdrawal in My Account, bind your real mobile phone number and payout destination in <strong>My Details &amp; Locked Info</strong>. Once saved, your withdrawal details are locked and used for all payouts.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileModalTab('details')}
                    className="px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Set &amp; Lock Real Details Now →</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleWithdrawSubmit} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-700" />
                      <span>Withdraw Using Locked Real Details</span>
                    </h3>
                    <span className="font-mono font-semibold text-emerald-700">0% Fee</span>
                  </div>

                  {/* Locked Real Destination Read-Only Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500">Locked Rail</div>
                      <div className="font-bold text-slate-900 mt-0.5">{lockedWithdrawal.method}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500">Locked Account / Number</div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5 break-all">
                        {lockedWithdrawal.accountDetails}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500">Registered Holder</div>
                      <div className="font-bold text-slate-900 mt-0.5 truncate">
                        {lockedWithdrawal.accountHolderName || customerProfile?.displayName}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500">Registered Phone</div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        {customerProfile?.phone || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">
                        Withdrawal Amount ({selectedCountry.symbol}) — Min {thresholdLabel}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 font-mono">{selectedCountry.symbol}</span>
                        <input
                          type="number"
                          step="50"
                          min={minLocalAmount}
                          max={maxLocalBalance}
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="w-full pl-14 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:border-blue-600 outline-hidden"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          {(lockedWithdrawal.method === 'M-PESA' ||
                            lockedWithdrawal.method === 'Airtel / MTN MoMo')
                            ? `Est: ${selectedCountry.symbol} ${Math.round(numWithdrawLocal).toLocaleString()} ${selectedCountry.currency}`
                            : 'Zero withdrawal fees'}
                        </span>
                        {userStats.balance >= WITHDRAWAL_THRESHOLD_USD && (
                          <button
                            type="button"
                            onClick={() => setWithdrawAmount(String(maxLocalBalance))}
                            className="text-blue-700 hover:underline font-semibold cursor-pointer"
                          >
                            Withdraw All ({formatCurrencyFromUsd(userStats.balance, selectedCountry)})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!canRequestPayout}
                        className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold inline-flex items-center justify-center gap-1.5 text-white transition-colors ${
                          canRequestPayout
                            ? 'bg-emerald-700 hover:bg-emerald-800 shadow-xs cursor-pointer'
                            : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <span>Request Withdrawal</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {withdrawError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-medium">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{withdrawError}</span>
                    </div>
                  )}

                  {withdrawSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{withdrawSuccess}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    Customers cannot alter payout destinations during withdrawal. All requests appear in the Owner Portal (<strong className="font-mono text-slate-700">nigideon36@gmail.com</strong>) matched against your registration lock.
                  </p>
                </form>
              )}
            </WithdrawalEligibilityGate>

            {/* Recent Withdrawals Ledger */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  My Recent Withdrawals
                </h3>
                <span className="text-[11px] text-slate-500">
                  Support: +254712727558 · WhatsApp 0785909543
                </span>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Ref</th>
                      <th className="py-2.5 px-4 font-semibold">Method</th>
                      <th className="py-2.5 px-4 font-semibold">Destination</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Amount</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {userStats.payoutHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 px-4 text-center text-slate-400">
                          No withdrawals submitted yet. Reach {thresholdLabel} to unlock cash-out requests above.
                        </td>
                      </tr>
                    ) : (
                      userStats.payoutHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                            <div>{rec.id}</div>
                            {rec.mpesaReceipt && (
                              <div className="text-[10px] text-emerald-700">{rec.mpesaReceipt}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-900">{rec.method}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{rec.accountDetails}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatCurrencyFromUsd(rec.amount, selectedCountry)}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                rec.status === 'Completed'
                                  ? 'text-emerald-600'
                                  : rec.status === 'Rejected'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {rec.status === 'Completed' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : rec.status === 'Rejected' ? (
                                <AlertCircle className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              <span>{rec.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
