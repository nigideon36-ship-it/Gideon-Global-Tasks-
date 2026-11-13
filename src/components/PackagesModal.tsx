import React, { useState, useEffect } from 'react';
import { useTasks } from '../context/TaskContext';
import { AVAILABLE_PACKAGES } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { TaskPackage } from '../types/tasks';
import { X, Check, ShieldCheck, Zap, Sparkles, Phone, CreditCard, Wallet, Smartphone, AlertCircle, Users, Globe, Mail, ExternalLink } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requiredForCategory?: string;
}

export const PackagesModal: React.FC<Props> = ({ isOpen, onClose, requiredForCategory }) => {
  const { activePackage, purchasePackage, userStats, setActiveTab } = useTasks();
  const { user } = useAuth();

  const [selectedPkgId, setSelectedPkgId] = useState<'starter' | 'pro' | 'vip'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'M-PESA' | 'PayPal' | 'Wallet' | 'Card'>('M-PESA');
  const [phoneNumber, setPhoneNumber] = useState('+254 712 345 678');
  const [paypalPayerEmail, setPaypalPayerEmail] = useState(user?.email || '');
  const [paypalRecipientEmail, setPaypalRecipientEmail] = useState('nigideon36@gmail.com');
  const [paypalMeHandle, setPaypalMeHandle] = useState('nigideon36');
  const [cardHolder, setCardHolder] = useState('Gideon Contributor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stkStatus, setStkStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email && !paypalPayerEmail) {
      setPaypalPayerEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/paypal/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.primaryEmail) setPaypalRecipientEmail(data.primaryEmail);
        if (data.payPalMeHandle) setPaypalMeHandle(data.payPalMeHandle);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedPkg = AVAILABLE_PACKAGES.find((p) => p.id === selectedPkgId) || AVAILABLE_PACKAGES[1];

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStkStatus(null);

    if (paymentMethod === 'M-PESA' && !phoneNumber.trim()) {
      setErrorMsg('Please enter a valid Safaricom M-PESA mobile number.');
      return;
    }

    if (paymentMethod === 'PayPal' && !paypalPayerEmail.trim().includes('@')) {
      setErrorMsg('Please enter your valid PayPal account email address.');
      return;
    }

    if (paymentMethod === 'Wallet' && userStats.balance < selectedPkg.price) {
      setErrorMsg(`Insufficient wallet balance ($${userStats.balance.toFixed(2)}) for $${selectedPkg.price.toFixed(2)} pass.`);
      return;
    }

    setIsProcessing(true);

    if (paymentMethod === 'M-PESA') {
      try {
        setStkStatus(`Initiating M-PESA STK Push to ${phoneNumber} via IntaSend...`);
        const kesAmount = Math.round(selectedPkg.price * 130);

        let res = await fetch('/api/intasend/stk-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneNumber,
            amount: kesAmount,
            packageId: selectedPkg.id,
            name: cardHolder || 'Gideon Contributor'
          })
        });

        let data = await res.json();
        if (!data.success) {
          // Fallback to direct Daraja route if configured
          res = await fetch('/api/mpesa/stkpush', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: phoneNumber,
              amount: kesAmount,
              packageId: selectedPkg.id
            })
          });
          data = await res.json();
        }

        if (data.success) {
          setStkStatus(`M-PESA prompt sent! Please enter your PIN on your mobile phone to approve KES ${kesAmount}.`);
          setTimeout(() => {
            const success = purchasePackage(
              selectedPkgId,
              'M-PESA',
              `${phoneNumber} (Receipt: ${data.mpesaReceipt || 'IntaSend-OK'})`
            );
            setIsProcessing(false);
            setStkStatus(null);
            if (success) {
              onClose();
            }
          }, 2400);
          return;
        } else {
          setErrorMsg(data.error || 'Payment request could not be processed.');
          setIsProcessing(false);
          setStkStatus(null);
          return;
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to connect to payment gateway.');
        setIsProcessing(false);
        setStkStatus(null);
        return;
      }
    }

    if (paymentMethod === 'PayPal') {
      try {
        setStkStatus(`Processing international PayPal payment ($${selectedPkg.price.toFixed(2)} USD) to ${paypalRecipientEmail}...`);
        // 1. Create Order
        const orderRes = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: selectedPkg.price,
            packageId: selectedPkg.id,
            description: `Gideon Contributor Pass - ${selectedPkg.name}`,
            payerEmail: paypalPayerEmail.trim()
          })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok || !orderData.success) {
          throw new Error(orderData.error || 'Could not initiate PayPal order.');
        }

        // 2. Capture Order
        const captureRes = await fetch('/api/paypal/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.orderId,
            payerEmail: paypalPayerEmail.trim(),
            notes: `Pass: ${selectedPkg.name}`
          })
        });
        const captureData = await captureRes.json();
        if (!captureRes.ok || !captureData.success) {
          throw new Error(captureData.error || 'Could not verify PayPal order.');
        }

        setStkStatus(`PayPal payment of $${selectedPkg.price.toFixed(2)} USD verified! Routed to ${paypalRecipientEmail}. Activating pass...`);

        setTimeout(() => {
          const success = purchasePackage(
            selectedPkgId,
            'PayPal',
            `PayPal (${paypalPayerEmail.trim()} -> ${paypalRecipientEmail}, Txn: ${captureData.transactionId || 'PP-OK'})`
          );
          setIsProcessing(false);
          setStkStatus(null);
          if (success) {
            onClose();
          }
        }, 1400);
        return;
      } catch (err: any) {
        setErrorMsg(err.message || 'PayPal transaction could not be processed.');
        setIsProcessing(false);
        setStkStatus(null);
        return;
      }
    }

    setTimeout(() => {
      const success = purchasePackage(
        selectedPkgId,
        paymentMethod,
        paymentMethod === 'Wallet' ? 'Wallet Balance' : cardHolder
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
                Gideon Contributor Task Passes
              </h2>
              <p className="text-xs text-slate-500">
                Purchase an official worker package to unlock daily task quotas and qualify for $100+ withdrawals.
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
                To access <strong>{requiredForCategory}</strong> tasks and submit work for bounties, please activate your <strong>$2, $5, or $10</strong> Contributor Pass.
              </span>
            </div>
          )}

          {/* Pricing Tier Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {AVAILABLE_PACKAGES.map((pkg) => {
              const isSelected = selectedPkgId === pkg.id;
              const isActive = activePackage?.id === pkg.id;
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

                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                        ${pkg.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        / ~{(pkg.price * 130).toLocaleString()} KES
                      </span>
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
                      {isActive ? 'Current Active Tier' : `Select $${pkg.price.toFixed(2)} Package`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout & Payment Rail Selection */}
          <form onSubmit={handlePurchase} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Payment Method:
                </h3>
                <p className="text-[11px] text-slate-500">
                  Instant activation for {selectedPkg.name} (${selectedPkg.price.toFixed(2)})
                </p>
              </div>

              <div className="text-right font-mono font-bold text-slate-900 text-sm">
                Total Due: ${selectedPkg.price.toFixed(2)}
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
                <span>M-PESA (Kenya)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('PayPal')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'PayPal'
                    ? 'border-[#003087] bg-blue-50 text-[#003087] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Globe className="w-4 h-4 text-[#003087] shrink-0" />
                <span>PayPal (Intl USD)</span>
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
                <span>Debit / Card</span>
              </button>
            </div>

            {/* Payment Inputs */}
            {paymentMethod === 'M-PESA' && (
              <div className="space-y-2 p-4 bg-white rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <label>Safaricom M-PESA Phone Number:</label>
                  <span className="text-emerald-700 font-mono text-[11px]">
                    KES {(selectedPkg.price * 130).toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 font-mono font-semibold focus:border-emerald-500 outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  You will receive an automated M-PESA STK prompt on your mobile phone to enter your PIN.
                </p>
              </div>
            )}

            {paymentMethod === 'PayPal' && (
              <div className="space-y-3 p-4 bg-white rounded-xl border border-blue-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5 text-[#003087] font-bold">
                    <Globe className="w-4 h-4" />
                    International PayPal Checkout (USD)
                  </span>
                  <span className="font-mono text-[#003087] font-bold">
                    ${selectedPkg.price.toFixed(2)} USD
                  </span>
                </div>

                <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-[11px] text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>
                    PayPal Recipient: <strong className="font-mono text-[#003087]">{paypalRecipientEmail}</strong>
                  </span>
                  <a
                    href={`https://paypal.me/${paypalMeHandle.replace(/^@/, '')}/${selectedPkg.price}USD`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#003087] font-bold hover:underline"
                  >
                    <span>Open PayPal.Me (${selectedPkg.price})</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your PayPal Account Email (for payment receipt):
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      value={paypalPayerEmail}
                      onChange={(e) => setPaypalPayerEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:border-[#003087] outline-hidden"
                    />
                  </div>
                </div>
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
                  Earn <strong>20% cash commission</strong> ($0.40–$2.00) when colleagues purchase a worker pass with your link.
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
                <span>Encrypted 256-Bit Escrow · Instant Activation Guarantee</span>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>
                  {isProcessing ? 'Processing M-PESA / Pass...' : `Activate ${selectedPkg.name} ($${selectedPkg.price})`}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
