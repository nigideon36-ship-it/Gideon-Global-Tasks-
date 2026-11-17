import React, { useState, useEffect, useRef } from 'react';
import { useTasks, AVAILABLE_PACKAGES } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { useAuth } from '../context/AuthContext';
import {
  EAST_AFRICA_COUNTRIES,
  isEastAfricaPhone,
  convertKesToLocal,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
  MAX_TASK_REWARD_KES,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';
import {
  X,
  Check,
  ShieldCheck,
  Zap,
  Sparkles,
  Phone,
  CreditCard,
  Wallet,
  Smartphone,
  AlertCircle,
  Users,
  MapPin,
  Link2,
  ExternalLink,
  Copy,
  Upload,
  Image as ImageIcon,
  Ban,
  Clock,
  RefreshCw,
  CheckCircle2,
  Lock,
} from 'lucide-react';

async function compressImageFileToDataUrl(file: File): Promise<string> {
  const rawDataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  if (rawDataUrl.length <= 850_000) {
    return rawDataUrl;
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requiredForCategory?: string;
}

interface PaymentPagesMap {
  starter: string;
  pro: string;
  vip: string;
  customDeposit: string;
}

export const PackagesModal: React.FC<Props> = ({ isOpen, onClose, requiredForCategory }) => {
  const {
    activePackage,
    purchasePackage,
    userStats,
    setActiveTab,
    dailyQuotaStatus,
    passProofs,
    passBannedReason,
    refreshPassProofs,
    submitManualPassProof,
  } = useTasks();
  const { customerProfile } = useAuth();
  const { selectedCountry, setSelectedCountryCode } = useRegion();

  const [selectedPkgId, setSelectedPkgId] = useState<'starter' | 'pro' | 'vip'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'M-PESA' | 'Mobile Money' | 'Card' | 'Paystack Page'>('M-PESA');
  const [mpesaMode, setMpesaMode] = useState<'manual' | 'stk'>('manual');
  const [phoneNumber, setPhoneNumber] = useState(customerProfile?.phone || selectedCountry.samplePhone);
  const [cardHolder, setCardHolder] = useState(customerProfile?.displayName || 'Gideon Contributor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stkStatus, setStkStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentPages, setPaymentPages] = useState<PaymentPagesMap>({
    starter: '',
    pro: '',
    vip: '',
    customDeposit: '',
  });
  const [manualReference, setManualReference] = useState('');
  const [directMpesaCode, setDirectMpesaCode] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [screenshotFileName, setScreenshotFileName] = useState('');
  const [refreshingProofs, setRefreshingProofs] = useState(false);
  const [copiedDirectNumber, setCopiedDirectNumber] = useState(false);
  const [isVerifyingRef, setIsVerifyingRef] = useState(false);
  const [copiedPageUrl, setCopiedPageUrl] = useState(false);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPhoneNumber(customerProfile?.phone || selectedCountry.samplePhone);
  }, [selectedCountry.code, customerProfile?.phone]);

  const effectiveBannedReason =
    passBannedReason || (customerProfile?.banned ? customerProfile.bannedReason || 'Account permanently banned 🚫 forever (no second chance).' : null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/paystack/payment-pages', {
      headers: {
        'x-ea-country': selectedCountry.code,
        'x-ea-verified': 'true',
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.paymentPages) {
          setPaymentPages({
            starter: data.paymentPages.starter || '',
            pro: data.paymentPages.pro || '',
            vip: data.paymentPages.vip || '',
            customDeposit: data.paymentPages.customDeposit || '',
          });
        }
      })
      .catch(() => {});
  }, [isOpen, selectedCountry.code]);

  if (!isOpen) return null;

  const selectedPkg = AVAILABLE_PACKAGES.find((p) => p.id === selectedPkgId) || AVAILABLE_PACKAGES[1];
  const localAmount = convertKesToLocal(selectedPkg.priceKes, selectedCountry);
  const activePaymentPageUrl = paymentPages[selectedPkgId] || '';

  const handleCopyPageLink = () => {
    if (!activePaymentPageUrl) return;
    navigator.clipboard.writeText(activePaymentPageUrl);
    setCopiedPageUrl(true);
    setTimeout(() => setCopiedPageUrl(false), 2000);
  };

  const handleCopyDirectNumber = () => {
    navigator.clipboard.writeText('0758727558');
    setCopiedDirectNumber(true);
    setTimeout(() => setCopiedDirectNumber(false), 2200);
  };

  const handleVerifyPaystackReference = async () => {
    const cleanRef = manualReference.trim();
    if (!cleanRef) {
      setErrorMsg('Enter the Paystack transaction reference from your payment receipt.');
      return;
    }

    setErrorMsg(null);
    setIsVerifyingRef(true);
    setStkStatus(`Verifying Paystack reference ${cleanRef}...`);

    try {
      const res = await fetch(`/api/paystack/verify/${encodeURIComponent(cleanRef)}`, {
        headers: {
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not verify that Paystack transaction reference.');
        setStkStatus(null);
        return;
      }

      if (data.status !== 'success') {
        setErrorMsg(
          `Paystack status for ${cleanRef} is "${data.status || 'pending'}". Complete payment first and verify again.`
        );
        setStkStatus(null);
        return;
      }

      const resolvedPkgId: 'starter' | 'pro' | 'vip' =
        data.packageId === 'starter' || data.packageId === 'pro' || data.packageId === 'vip'
          ? data.packageId
          : selectedPkgId;

      try {
        const raw = localStorage.getItem('gideon_verified_ps_refs');
        const refs: string[] = raw ? JSON.parse(raw) : [];
        if (refs.includes(cleanRef)) {
          setErrorMsg('This Paystack payment reference has already been redeemed on this account.');
          setStkStatus(null);
          return;
        }
        localStorage.setItem('gideon_verified_ps_refs', JSON.stringify([...refs, cleanRef]));
      } catch {}

      const success = purchasePackage(
        resolvedPkgId,
        'Paystack Page',
        `${data.customerEmail || selectedCountry.code} (Ref: ${cleanRef})`
      );
      setStkStatus(null);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification request failed.');
      setStkStatus(null);
    } finally {
      setIsVerifyingRef(false);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStkStatus(null);

    if (effectiveBannedReason) {
      setErrorMsg(`Banned 🚫 Forever (No Second Chance): ${effectiveBannedReason}`);
      return;
    }

    if ((paymentMethod === 'M-PESA' || paymentMethod === 'Mobile Money') && !isEastAfricaPhone(phoneNumber)) {
      setErrorMsg(
        `East Africa Only: Enter a valid ${selectedCountry.name} mobile number (${selectedCountry.dialCode}...).`
      );
      return;
    }

    setIsProcessing(true);

    if (paymentMethod === 'M-PESA' || paymentMethod === 'Mobile Money') {
      if (mpesaMode === 'manual' || paymentMethod === 'Mobile Money') {
        const cleanDirectCode = directMpesaCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{6,20}$/.test(cleanDirectCode)) {
          setErrorMsg(
            'MANDATORY PROOF REQUIRED: Enter your valid M-PESA confirmation code (6–20 letters/numbers from paying 0758727558). Failing to submit proof results in being BANNED 🚫 FOREVER with no second chance.'
          );
          setIsProcessing(false);
          return;
        }
        if (!screenshotDataUrl) {
          setErrorMsg(
            'SCREENSHOT PROOF REQUIRED: Upload a clear screenshot of your M-PESA payment to 0758727558. Failing to submit BOTH code & screenshot results in being BANNED 🚫 FOREVER (no second chance).'
          );
          setIsProcessing(false);
          return;
        }

        setStkStatus(
          `Uploading M-PESA Code ${cleanDirectCode} & Screenshot Proof for ${selectedPkg.name} (KES ${selectedPkg.priceKes}) for Owner verification...`
        );

        const proofRes = await submitManualPassProof({
          packageId: selectedPkgId,
          senderPhone: phoneNumber.trim(),
          mpesaCode: cleanDirectCode,
          screenshotDataUrl,
          screenshotFileName: screenshotFileName || 'mpesa-proof.png',
        });

        setIsProcessing(false);
        if (!proofRes.success) {
          setStkStatus(null);
          setErrorMsg(proofRes.error || 'Could not submit M-PESA payment proof.');
          return;
        }

        setDirectMpesaCode('');
        setScreenshotDataUrl('');
        setScreenshotFileName('');
        if (screenshotInputRef.current) {
          screenshotInputRef.current.value = '';
        }
        setStkStatus(
          `Proof Submitted (Pending Owner Approval)! M-PESA Code ${cleanDirectCode} & Screenshot received. Your Worker Pass will NOT open automatically until the Owner confirms payment on 0758727558, approves it, and sends your confirmation details.`
        );
        return;
      }

      try {
        const kesAmount = selectedPkg.priceKes;

        if (selectedCountry.code === 'KE' || phoneNumber.trim().startsWith('+254') || phoneNumber.trim().startsWith('0')) {
          setStkStatus(
            `Initiating Paystack M-PESA STK Push to ${phoneNumber} (KES ${kesAmount})...`
          );

          const res = await fetch('/api/paystack/stk-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-ea-country': selectedCountry.code,
              'x-ea-verified': 'true',
            },
            body: JSON.stringify({
              countryCode: selectedCountry.code,
              phone: phoneNumber,
              amount: kesAmount,
              amountUsd: selectedPkg.price,
              packageId: selectedPkg.id,
              name: cardHolder || 'Gideon Contributor',
            }),
          });

          const data = await res.json();
          if (data.success) {
            setStkStatus(
              data.message || `Paystack M-PESA prompt sent! Enter PIN on your phone to pay KES ${kesAmount}.`
            );
            setTimeout(() => {
              const success = purchasePackage(
                selectedPkgId,
                paymentMethod,
                `${selectedCountry.code} ${phoneNumber} (Paystack Ref: ${data.reference || data.mpesaReceipt || 'PS-STK'})`
              );
              setIsProcessing(false);
              setStkStatus(null);
              if (success) {
                onClose();
              }
            }, 2200);
            return;
          } else {
            setErrorMsg(data.error || 'Paystack M-PESA STK Push request could not be completed.');
            setIsProcessing(false);
            setStkStatus(null);
            return;
          }
        } else {
          // Non-Kenya East Africa countries: fallback notice or IntaSend mobile money / Paystack Card
          setErrorMsg(
            `Paystack M-PESA STK Push natively supports Kenya (+254) numbers. For ${selectedCountry.name}, please select "East Africa Card (Visa/Mastercard)" powered by Paystack!`
          );
          setIsProcessing(false);
          setStkStatus(null);
          return;
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to connect to Paystack payment gateway.');
        setIsProcessing(false);
        setStkStatus(null);
        return;
      }
    }

    if (paymentMethod === 'Card') {
      try {
        setStkStatus(`Initializing Paystack Visa/Mastercard checkout for ${selectedCountry.name}...`);
        const res = await fetch('/api/paystack/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ea-country': selectedCountry.code,
            'x-ea-verified': 'true',
          },
          body: JSON.stringify({
            amountKes: selectedPkg.priceKes,
            amountUsd: selectedPkg.price,
            countryCode: selectedCountry.code,
            packageId: selectedPkg.id,
            callbackUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setErrorMsg(data.error || 'Could not start Paystack Card checkout.');
          setIsProcessing(false);
          setStkStatus(null);
          return;
        }

        if (data.authorizationUrl && typeof window !== 'undefined') {
          try {
            localStorage.setItem('gideon_pending_paystack_pkg', selectedPkg.id);
          } catch {}
          // Safe redirect inside current view
          window.location.href = data.authorizationUrl;
          return;
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Paystack Card checkout error.');
        setIsProcessing(false);
        setStkStatus(null);
        return;
      }
    }

    if (paymentMethod === 'Paystack Page') {
      setIsProcessing(false);
      if (manualReference.trim()) {
        await handleVerifyPaystackReference();
        return;
      }
      if (!activePaymentPageUrl) {
        setErrorMsg(
          `No Paystack Payment Page URL is saved for the ${selectedPkg.name} yet. Ask the owner to add it in Paystack Gateway Settings, or use M-PESA STK / Card checkout.`
        );
        return;
      }
      try {
        localStorage.setItem('gideon_pending_paystack_pkg', selectedPkg.id);
      } catch {}
      setStkStatus(`Opening Paystack Payment Page for ${selectedPkg.name}...`);
      if (typeof window !== 'undefined') {
        window.location.href = activePaymentPageUrl;
      }
      return;
    }

    setTimeout(() => {
      const success = purchasePackage(
        selectedPkgId,
        paymentMethod,
        `${cardHolder} (${selectedCountry.code} IntaSend Card)`
      );
      setIsProcessing(false);
      if (success) {
        onClose();
      }
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold transition-colors">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                East Africa Contributor Task Passes
              </h2>
              <p className="text-xs text-slate-500">
                Activate a worker package via M-PESA 0758727558, Paystack STK, or East Africa Card to unlock higher daily task limits toward {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}+ withdrawals.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-8">
          {effectiveBannedReason && (
            <div className="p-4 rounded-2xl bg-rose-950 text-white border-2 border-rose-500 flex items-start gap-3 shadow-md">
              <Ban className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-extrabold uppercase tracking-wider text-rose-300">
                  Account Permanently Banned 🚫 Forever — No Second Chance
                </div>
                <p className="text-rose-100 leading-relaxed font-medium">{effectiveBannedReason}</p>
              </div>
            </div>
          )}

          {requiredForCategory && !effectiveBannedReason && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                To access <strong>{requiredForCategory}</strong> tasks and submit work for bounties, please pay for and verify your <strong>{formatCurrencyFromKes(50, selectedCountry)}, {formatCurrencyFromKes(100, selectedCountry)}, or {formatCurrencyFromKes(200, selectedCountry)}</strong> Contributor Pass.
              </span>
            </div>
          )}

          {/* High-Visibility Bold M-PESA Direct Payment Number + Mandatory Proof & Owner Approval Warning */}
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 space-y-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                  <span>Pay for Your Worker Pass via M-PESA Send Money</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="text-xs font-semibold text-slate-700">M-PESA Number:</span>
                  <strong className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-emerald-950 select-all">
                    0758727558
                  </strong>
                </div>
                <p className="text-xs text-slate-700">
                  Send <strong className="font-bold text-slate-900">{formatCurrencyFromKes(50, selectedCountry)}</strong> (Starter), <strong className="font-bold text-slate-900">{formatCurrencyFromKes(100, selectedCountry)}</strong> (Pro), or <strong className="font-bold text-slate-900">{formatCurrencyFromKes(200, selectedCountry)}</strong> (VIP) to <strong className="font-bold font-mono text-emerald-950">0758727558</strong>, then upload your M-PESA code and payment screenshot below.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyDirectNumber}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                {copiedDirectNumber ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedDirectNumber ? 'Copied 0758727558!' : 'Copy 0758727558'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-950 text-xs flex items-start gap-2.5">
              <Ban className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <div className="font-black uppercase tracking-wide text-rose-900">
                  Strict Proof &amp; Owner Approval Policy — Banned 🚫 Forever If Violated (No Second Chance)
                </div>
                <p>
                  <strong className="font-bold">1. Mandatory Proof:</strong> Customers paying manually to <strong className="font-mono font-bold">0758727558</strong> <strong className="font-bold">MUST submit BOTH their genuine M-PESA Confirmation Code AND a Payment Screenshot</strong>. Failure to submit proof or submitting fake details will get you <strong className="font-black text-rose-900">BANNED 🚫 FOREVER with NO SECOND CHANCE</strong>.
                </p>
                <p>
                  <strong className="font-bold">2. Manual Owner Unlock:</strong> Worker Passes <strong className="font-bold">DO NOT open automatically</strong> after manual payment. Your pass remains locked until the Platform Owner confirms payment has been paid on <strong className="font-mono font-bold">0758727558</strong>, approves it, and sends your confirmation details.
                </p>
              </div>
            </div>
          </div>

          {/* Daily Task Quotas & Amount Limits Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Daily Task Limits &amp; Maximum Amount Per Task / Survey
              </h3>
              <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                Your Current Plan: {dailyQuotaStatus.rule.name} ({dailyQuotaStatus.usedToday}/{dailyQuotaStatus.rule.dailyLimit} used today)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <div className="font-bold text-slate-900">Free Tier ({selectedCountry.symbol} 0)</div>
                <div className="text-slate-600 mt-0.5 font-mono font-semibold">1 Free Task Daily</div>
                <div className="text-[11px] text-emerald-700 font-bold">
                  Max {formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)} / task
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <div className="font-bold text-slate-900">Starter Pass ({formatCurrencyFromKes(50, selectedCountry)})</div>
                <div className="text-slate-600 mt-0.5 font-mono font-semibold">2 Tasks Daily</div>
                <div className="text-[11px] text-emerald-700 font-bold">
                  Max {formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)} / task
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-blue-200">
                <div className="font-bold text-slate-900">2nd Pass · Pro ({formatCurrencyFromKes(100, selectedCountry)})</div>
                <div className="text-slate-600 mt-0.5 font-mono font-semibold">3 Tasks Daily</div>
                <div className="text-[11px] text-blue-700 font-bold">
                  Max {formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)} / task
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-emerald-300">
                <div className="font-bold text-slate-900">VIP Pass ({formatCurrencyFromKes(200, selectedCountry)})</div>
                <div className="text-slate-600 mt-0.5 font-mono font-semibold">4 Surveys Daily</div>
                <div className="text-[11px] text-emerald-800 font-bold">
                  Max {formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)} / survey
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Tier Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {AVAILABLE_PACKAGES.map((pkg) => {
              const isSelected = selectedPkgId === pkg.id;
              const isActive = activePackage?.id === pkg.id;
              const estLocal = convertKesToLocal(pkg.priceKes, selectedCountry);
              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPkgId(pkg.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/30 shadow-md ring-2 ring-brand-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {pkg.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm transition-colors">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-slate-900">{pkg.name}</h3>
                      {isActive && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                          Active Pass
                        </span>
                      )}
                    </div>

                    <div className="my-3 space-y-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl md:text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                          {selectedCountry.symbol} {estLocal.toLocaleString()}
                        </span>
                        {selectedCountry.code !== 'KE' && (
                          <span className="text-xs font-mono font-semibold text-blue-700">
                            (KSh {pkg.priceKes})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium font-mono">
                        {selectedCountry.code === 'KE' ? 'Local Shillings · Kenya' : `${selectedCountry.name} (${selectedCountry.currency})`}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      {pkg.description}
                    </p>

                    <div className="text-xs font-semibold text-brand-700 bg-brand-50/80 p-2 rounded-lg mb-4">
                      {pkg.taskAllowance}
                    </div>

                    <ul className="space-y-2 text-xs text-slate-600">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {isActive ? 'Current Active Tier' : `Select ${selectedCountry.symbol} ${estLocal.toLocaleString()}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout & East Africa Payment Rail Selection */}
          <form onSubmit={handlePurchase} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  East Africa Checkout (Paystack STK &amp; Card):
                </h3>
                <p className="text-[11px] text-slate-500">
                  Instant activation for {selectedPkg.name} (<strong>{selectedCountry.symbol} {localAmount.toLocaleString()}</strong>{selectedCountry.code !== 'KE' ? ` · KSh ${selectedPkg.priceKes}` : ''})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <select
                  value={selectedCountry.code}
                  onChange={(e) => setSelectedCountryCode(e.target.value as any)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 outline-hidden focus:border-emerald-600"
                >
                  {EAST_AFRICA_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.dialCode} · {c.currency})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deposit-Only Worker Pass Notice */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-950">
              Deposit-Only Policy: Worker Passes must be paid by fresh deposit (M-PESA 0758727558, Paystack STK, Card, or Mobile Money) — Wallet balance cannot be used.
            </div>

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('M-PESA')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'M-PESA'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>M-PESA STK</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Mobile Money')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'Mobile Money'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Mobile Money</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Card')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'Card'
                    ? 'border-brand-600 bg-brand-50 text-brand-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 text-slate-600 shrink-0" />
                <span>EA Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Paystack Page')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'Paystack Page'
                    ? 'border-[#09A5DB] bg-sky-50 text-[#0576A0] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Link2 className="w-4 h-4 text-[#0576A0] shrink-0" />
                <span>Paystack Link</span>
              </button>
            </div>

            {/* Payment Inputs */}
            {(paymentMethod === 'M-PESA' || paymentMethod === 'Mobile Money') && (
              <div className="space-y-4 p-4 bg-white rounded-xl border border-emerald-200">
                {/* Mode Toggle: Manual 0758727558 Proof (Default) vs Automatic Paystack STK */}
                {paymentMethod === 'M-PESA' && (
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMpesaMode('manual');
                        setErrorMsg(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        mpesaMode === 'manual'
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Manual Pay to 0758727558 (Code + Screenshot Required)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMpesaMode('stk');
                        setErrorMsg(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        mpesaMode === 'stk'
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Paystack M-PESA STK Push
                    </button>
                  </div>
                )}

                {/* Bold Direct M-PESA Payment Number Inside Checkout */}
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-emerald-950">
                    <span className="font-semibold">Direct M-PESA Pay Number: </span>
                    <strong className="text-base sm:text-lg font-black font-mono tracking-wider text-emerald-950 select-all">
                      0758727558
                    </strong>
                    <span className="block text-[11px] text-emerald-800 mt-0.5">
                      Amount for {selectedPkg.name}: <strong className="font-bold">{selectedCountry.symbol} {localAmount.toLocaleString()}</strong>{selectedCountry.code !== 'KE' ? ` (KSh ${selectedPkg.priceKes})` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyDirectNumber}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer shrink-0"
                  >
                    {copiedDirectNumber ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDirectNumber ? 'Copied!' : 'Copy 0758727558'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                      <label>
                        Your Sending {selectedCountry.name} Phone ({selectedCountry.mobileRails}):
                      </label>
                      <span className="text-emerald-700 font-mono text-[11px]">
                        {selectedCountry.symbol} {localAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder={selectedCountry.samplePhone}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 font-mono font-semibold focus:border-emerald-500 outline-hidden"
                      />
                    </div>
                  </div>

                  {(mpesaMode === 'manual' || paymentMethod === 'Mobile Money') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        M-PESA Confirmation Code * (Paid to <strong className="font-bold font-mono text-emerald-900">0758727558</strong>):
                      </label>
                      <input
                        type="text"
                        required
                        value={directMpesaCode}
                        onChange={(e) => setDirectMpesaCode(e.target.value.toUpperCase())}
                        placeholder="Required e.g. UA84K92P1M"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono font-bold uppercase focus:border-emerald-500 outline-hidden"
                      />
                    </div>
                  )}
                </div>

                {(mpesaMode === 'manual' || paymentMethod === 'Mobile Money') ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        Upload M-PESA Payment Screenshot Proof * (Required — PNG / JPG / WEBP):
                      </label>
                      <div className="p-3.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <div className="text-xs min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {screenshotFileName || 'No screenshot selected yet'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Upload your SMS/M-PESA payment receipt screenshot showing <strong>0758727558</strong> &amp; <strong>KES {selectedPkg.priceKes}</strong>.
                            </div>
                          </div>
                        </div>

                        <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{screenshotDataUrl ? 'Change Screenshot' : 'Choose Screenshot'}</span>
                          <input
                            ref={screenshotInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!file.type.startsWith('image/')) {
                                setErrorMsg('Please select a valid screenshot image (PNG, JPG, or WEBP).');
                                return;
                              }
                              setErrorMsg(null);
                              try {
                                const dataUrl = await compressImageFileToDataUrl(file);
                                setScreenshotDataUrl(dataUrl);
                                setScreenshotFileName(file.name);
                              } catch {
                                setErrorMsg('Could not load screenshot image. Please try another screenshot.');
                              }
                            }}
                          />
                        </label>
                      </div>

                      {screenshotDataUrl && (
                        <div className="mt-2.5 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={screenshotDataUrl}
                              alt="M-PESA Payment Screenshot Proof Preview"
                              className="w-16 h-16 object-cover rounded-lg border border-slate-300 bg-white shrink-0"
                            />
                            <div className="text-xs">
                              <div className="font-bold text-emerald-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Screenshot Proof Attached</span>
                              </div>
                              <div className="text-[11px] text-slate-600 truncate max-w-xs">{screenshotFileName}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setScreenshotDataUrl('');
                              setScreenshotFileName('');
                              if (screenshotInputRef.current) screenshotInputRef.current.value = '';
                            }}
                            className="text-xs font-semibold text-rose-700 hover:underline cursor-pointer shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-950 font-semibold flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        Pass remains <strong>LOCKED</strong> after submission until Owner (<code className="font-mono">nigideon36@gmail.com</code>) verifies your code + screenshot on <strong>0758727558</strong> and sends approval details. Missing or fake proof = <strong>BANNED 🚫 FOREVER (no second chance)</strong>.
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Automatic <strong>Paystack M-PESA STK Push</strong> works on Kenya (<code className="bg-slate-100 px-1 rounded">+254</code>) numbers. Or switch to <strong>Manual Pay to 0758727558</strong> above to submit M-PESA code + screenshot for Owner approval.
                  </p>
                )}
              </div>
            )}

            {paymentMethod === 'Card' && (
              <div className="space-y-3 p-4 bg-white rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-600">
                  Pay using East African bank Visa / Mastercard cards across all 8 East Africa countries, processed securely via <strong>Paystack</strong>.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cardholder Name:
                  </label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-medium outline-hidden focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Card Number:
                  </label>
                  <input
                    type="text"
                    defaultValue="•••• •••• •••• 4242"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono outline-hidden focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'Paystack Page' && (
              <div className="space-y-4 p-4 bg-white rounded-xl border border-sky-200 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      Hosted Paystack Payment Page ({selectedPkg.name} · KES {selectedPkg.priceKes})
                    </span>
                    {activePaymentPageUrl && (
                      <button
                        type="button"
                        onClick={handleCopyPageLink}
                        className="text-[#0576A0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPageUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPageUrl ? 'Copied Link' : 'Copy Link'}</span>
                      </button>
                    )}
                  </div>

                  {activePaymentPageUrl ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <span className="font-mono text-[11px] text-slate-600 truncate">
                        {activePaymentPageUrl}
                      </span>
                      <a
                        href={activePaymentPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          try {
                            localStorage.setItem('gideon_pending_paystack_pkg', selectedPkg.id);
                          } catch {}
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#09A5DB] hover:bg-[#0576A0] text-white font-semibold rounded-lg transition-colors shrink-0"
                      >
                        <span>Open Paystack Payment Page</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      A direct Payment Page link is not configured for <strong>{selectedPkg.name}</strong> yet. You can still paste an existing Paystack payment reference below, or pay immediately via <strong>M-PESA STK</strong> or <strong>EA Card</strong>.
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <label className="block font-semibold text-slate-700">
                    Already paid on a Paystack Payment Page? Verify your Reference:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                      placeholder="Paste Paystack reference (e.g. T849201948 or PS_CARD_...)"
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono outline-hidden focus:border-[#09A5DB]"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPaystackReference}
                      disabled={isVerifyingRef}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isVerifyingRef ? 'Verifying...' : 'Verify & Unlock Pass'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {stkStatus && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-2.5 font-medium">
                <Smartphone className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{stkStatus}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                {activePaymentPageUrl && paymentMethod !== 'Paystack Page' && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setPaymentMethod('Paystack Page');
                    }}
                    className="text-xs font-bold text-[#0576A0] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Use Paystack Payment Page →
                  </button>
                )}
              </div>
            )}

            {/* Referral Partner Promo Box */}
            <div className="p-3 bg-brand-50/70 border border-brand-200/60 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-brand-900 font-medium">
                <Users className="w-4 h-4 text-brand-600 shrink-0" />
                <span>
                  Earn <strong>20% cash commission</strong> ({formatCurrencyFromKes(10, selectedCountry)}–{formatCurrencyFromKes(40, selectedCountry)}) when colleagues in East Africa purchase a pass with your link.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setActiveTab('referrals');
                }}
                className="text-xs font-bold text-brand-700 hover:text-brand-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Referral Hub →
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>East Africa Escrow · Paystack STK &amp; Card Verified</span>
              </div>

              <button
                type="submit"
                disabled={isProcessing || Boolean(effectiveBannedReason)}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>
                  {isProcessing
                    ? 'Submitting Proof...'
                    : (paymentMethod === 'M-PESA' && mpesaMode === 'manual') || paymentMethod === 'Mobile Money'
                    ? `Submit M-PESA Code & Screenshot for Approval (KES ${selectedPkg.priceKes})`
                    : `Activate ${selectedPkg.name} (${selectedCountry.symbol} ${localAmount.toLocaleString()})`}
                </span>
              </button>
            </div>
          </form>

          {/* Submitted Manual M-PESA Proofs & Owner Approval Tracker */}
          {passProofs.length > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>My Manual M-PESA (0758727558) Worker Pass Submissions ({passProofs.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Your Worker Pass unlocks automatically here as soon as the Owner approves your payment and sends confirmation details.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={refreshingProofs}
                  onClick={async () => {
                    setRefreshingProofs(true);
                    await refreshPassProofs();
                    setRefreshingProofs(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingProofs ? 'animate-spin' : ''}`} />
                  <span>Check Owner Approval</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {passProofs.map((prf) => (
                  <div
                    key={prf.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      prf.status === 'Approved'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : prf.status === 'Banned'
                        ? 'bg-rose-950 text-white border-rose-500'
                        : prf.status === 'Rejected'
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold">
                        {prf.packageName} (KES {prf.amountKes}) · Code:{' '}
                        <span className="font-mono">{prf.mpesaCode}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase ${
                          prf.status === 'Approved'
                            ? 'bg-emerald-700 text-white'
                            : prf.status === 'Banned'
                            ? 'bg-rose-600 text-white'
                            : prf.status === 'Rejected'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-amber-200 text-amber-950'
                        }`}
                      >
                        {prf.status === 'Pending'
                          ? 'Pending Owner Approval (Locked)'
                          : prf.status === 'Banned'
                          ? 'Banned 🚫 Forever'
                          : prf.status}
                      </span>
                    </div>

                    <div className="text-[11px] opacity-90 font-mono">
                      Sent From: {prf.senderPhone} → 0758727558 · Submitted: {new Date(prf.createdAt).toLocaleString()}
                    </div>

                    {prf.status === 'Pending' && (
                      <div className="text-[11px] font-semibold text-amber-900">
                        Waiting for Platform Owner to verify M-PESA payment on 0758727558 and send approval details.
                      </div>
                    )}

                    {prf.ownerApprovalDetails && (
                      <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-300 text-emerald-950 text-xs font-semibold">
                        Owner Confirmation Details: {prf.ownerApprovalDetails}
                      </div>
                    )}

                    {prf.rejectionOrBanReason && (
                      <div className="p-2.5 rounded-lg bg-rose-900/20 border border-rose-400 text-xs font-semibold">
                        Notice: {prf.rejectionOrBanReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
