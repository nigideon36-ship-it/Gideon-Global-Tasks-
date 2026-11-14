import React, { useState, useEffect } from 'react';
import { useTasks, AVAILABLE_PACKAGES } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { EAST_AFRICA_COUNTRIES, isEastAfricaPhone, convertKesToLocal } from '../lib/eastAfrica';
import { X, Check, ShieldCheck, Zap, Sparkles, Phone, CreditCard, Wallet, Smartphone, AlertCircle, Users, MapPin } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requiredForCategory?: string;
}

export const PackagesModal: React.FC<Props> = ({ isOpen, onClose, requiredForCategory }) => {
  const { activePackage, purchasePackage, userStats, setActiveTab } = useTasks();
  const { selectedCountry, setSelectedCountryCode } = useRegion();

  const [selectedPkgId, setSelectedPkgId] = useState<'starter' | 'pro' | 'vip'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'M-PESA' | 'Mobile Money' | 'Card' | 'Wallet'>('M-PESA');
  const [phoneNumber, setPhoneNumber] = useState(selectedCountry.samplePhone);
  const [cardHolder, setCardHolder] = useState('Gideon Contributor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stkStatus, setStkStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setPhoneNumber(selectedCountry.samplePhone);
  }, [selectedCountry.code]);

  if (!isOpen) return null;

  const selectedPkg = AVAILABLE_PACKAGES.find((p) => p.id === selectedPkgId) || AVAILABLE_PACKAGES[1];
  const localAmount = convertKesToLocal(selectedPkg.priceKes, selectedCountry);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStkStatus(null);

    if ((paymentMethod === 'M-PESA' || paymentMethod === 'Mobile Money') && !isEastAfricaPhone(phoneNumber)) {
      setErrorMsg(
        `East Africa Only: Enter a valid ${selectedCountry.name} mobile number (${selectedCountry.dialCode}...).`
      );
      return;
    }

    if (paymentMethod === 'Wallet' && userStats.balance < selectedPkg.price) {
      setErrorMsg(`Insufficient wallet balance ($${userStats.balance.toFixed(2)}) for KES ${selectedPkg.priceKes} (~$${selectedPkg.price.toFixed(2)}) pass.`);
      return;
    }

    setIsProcessing(true);

    if (paymentMethod === 'M-PESA' || paymentMethod === 'Mobile Money') {
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
          // Safe redirect inside current top/iframe view or display clickable Paystack link
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

    setTimeout(() => {
      const success = purchasePackage(
        selectedPkgId,
        paymentMethod,
        paymentMethod === 'Wallet' ? 'Wallet Balance' : `${cardHolder} (${selectedCountry.code} IntaSend Card)`
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
                Activate a worker package via Paystack M-PESA STK Push or East Africa Card to qualify for $20+ withdrawals.
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
          {requiredForCategory && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                To access <strong>{requiredForCategory}</strong> tasks and submit work for bounties, please activate your <strong>KES 50, KES 100, or KES 200</strong> Contributor Pass ({selectedCountry.code !== 'KE' ? `shown in ${selectedCountry.currency}` : 'Kenya Shillings'}).
              </span>
            </div>
          )}

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
                          {selectedCountry.currency} {estLocal.toLocaleString()}
                        </span>
                        {selectedCountry.code !== 'KE' && (
                          <span className="text-xs font-mono font-semibold text-blue-700">
                            (KES {pkg.priceKes})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium font-mono">
                        ≈ ${pkg.price.toFixed(2)} USD {selectedCountry.code === 'KE' ? '· Local Currency' : `· ${selectedCountry.name} Exchange`}
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
                      {isActive ? 'Current Active Tier' : `Select ${selectedCountry.currency} ${estLocal.toLocaleString()}`}
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
                  Instant activation for {selectedPkg.name} (<strong>{selectedCountry.currency} {localAmount.toLocaleString()}</strong> · KES {selectedPkg.priceKes} · ~${selectedPkg.price.toFixed(2)} USD)
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

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <span>M-PESA (Paystack STK)</span>
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
                <span>Mobile Money (KE)</span>
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
                <span>East Africa Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Wallet')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'Wallet'
                    ? 'border-brand-600 bg-brand-50 text-brand-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Wallet className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Wallet (${userStats.balance.toFixed(2)})</span>
              </button>
            </div>

            {/* Payment Inputs */}
            {(paymentMethod === 'M-PESA' || paymentMethod === 'Mobile Money') && (
              <div className="space-y-2 p-4 bg-white rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <label>
                    {selectedCountry.name} Mobile Money Number ({selectedCountry.mobileRails}):
                  </label>
                  <span className="text-emerald-700 font-mono text-[11px]">
                    ~{localAmount.toLocaleString()} {selectedCountry.currency}
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
                <p className="text-[11px] text-slate-500">
                  Processed automatically via <strong>Paystack M-PESA STK Push</strong> (Kenya <code className="bg-slate-100 px-1 rounded">+254</code> numbers receive an instant PIN prompt). Contributors in UG, TZ, RW, BI, SS, ET &amp; SO can use <strong>East Africa Card (Visa/Mastercard)</strong>.
                </p>
              </div>
            )}

            {paymentMethod === 'Wallet' && (
              <div className="p-4 bg-white rounded-xl border border-brand-200 text-xs text-slate-700 space-y-1">
                <div className="font-semibold flex items-center justify-between">
                  <span>Deduct from Gideon Wallet:</span>
                  <span className="font-mono text-emerald-600 font-bold">-${selectedPkg.price.toFixed(2)}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Remaining balance after pass purchase: ${(userStats.balance - selectedPkg.price).toFixed(2)}
                </div>
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

            {stkStatus && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-2.5 font-medium animate-pulse">
                <Smartphone className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{stkStatus}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Referral Partner Promo Box */}
            <div className="p-3 bg-brand-50/70 border border-brand-200/60 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-brand-900 font-medium">
                <Users className="w-4 h-4 text-brand-600 shrink-0" />
                <span>
                  Earn <strong>20% cash commission</strong> (KES 10–KES 40 / ~$0.08–$0.31) when colleagues in East Africa purchase a pass with your link.
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
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>
                  {isProcessing ? 'Processing Payment...' : `Activate ${selectedPkg.name} (${selectedCountry.currency} ${localAmount.toLocaleString()})`}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
