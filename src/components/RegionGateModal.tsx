import React, { useState } from 'react';
import { useRegion } from '../context/RegionContext';
import { useAuth, OWNER_EMAIL } from '../context/AuthContext';
import { EAST_AFRICA_COUNTRIES, isEastAfricaPhone } from '../lib/eastAfrica';
import { MapPin, ShieldAlert, CheckCircle2, X, Smartphone, Lock } from 'lucide-react';

export const RegionGateModal: React.FC = () => {
  const {
    selectedCountry,
    isBlocked,
    blockReason,
    selectorOpen,
    setSelectorOpen,
    confirmEastAfricaAccess,
    markOutsideEastAfrica,
  } = useRegion();
  const { isOwner, signInWithGoogle } = useAuth();

  const [candidateCode, setCandidateCode] = useState(selectedCountry.code);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleConfirmBlocked = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    if (!isEastAfricaPhone(verifyPhone)) {
      setVerifyError(
        `Please enter a valid East Africa mobile number (${EAST_AFRICA_COUNTRIES.find((c) => c.code === candidateCode)?.dialCode || '+254'}...) to confirm East Africa residency.`
      );
      return;
    }
    const ok = await confirmEastAfricaAccess(candidateCode);
    if (!ok) {
      setVerifyError('Region verification failed. Access is strictly limited to East Africa.');
    }
  };

  if (isBlocked && !isOwner) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-6 text-white flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">East Africa Exclusive Access</h2>
              <p className="text-xs text-emerald-200">Regional Availability Policy</p>
            </div>
          </div>

          <div className="p-6 space-y-5 text-xs text-slate-600">
            <p className="leading-relaxed text-slate-700 font-medium">
              {blockReason ||
                'Gideon Global Tasks is exclusively accessible from East African countries with native Mobile Money (M-PESA, IntaSend, MTN MoMo, Airtel Money).'}
            </p>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supported East Africa Countries:</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-emerald-950 font-medium">
                {EAST_AFRICA_COUNTRIES.map((c) => (
                  <div key={c.code} className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-emerald-700">{c.code}</span>
                    <span>{c.name}</span>
                    <span className="text-emerald-600 font-mono">({c.dialCode})</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleConfirmBlocked} className="space-y-3 pt-2 border-t border-slate-100">
              <p className="font-bold text-slate-800">
                Connecting from East Africa behind a VPN/proxy? Verify your East Africa line:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={candidateCode}
                  onChange={(e) => setCandidateCode(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold outline-hidden focus:border-emerald-600"
                >
                  {EAST_AFRICA_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.dialCode})
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Smartphone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="tel"
                    value={verifyPhone}
                    onChange={(e) => setVerifyPhone(e.target.value)}
                    placeholder={
                      EAST_AFRICA_COUNTRIES.find((c) => c.code === candidateCode)?.samplePhone || '+254 7XX XXX XXX'
                    }
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 font-mono outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>
              {verifyError && (
                <p className="text-[11px] text-rose-600 font-medium">{verifyError}</p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Verify East Africa Access
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Platform Owner ({OWNER_EMAIL})?</span>
              </span>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="text-[11px] font-bold text-slate-800 hover:text-emerald-700 underline cursor-pointer"
              >
                Owner Sign In →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectorOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">East Africa Country & Payment Rail</h3>
          </div>
          <button
            type="button"
            onClick={() => setSelectorOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-500">
            This platform operates exclusively across East Africa. Choose your country to localize mobile money prefixes and local currency rates:
          </p>

          <div className="space-y-2">
            {EAST_AFRICA_COUNTRIES.map((c) => {
              const active = selectedCountry.code === c.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => confirmEastAfricaAccess(c.code)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    active
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold flex items-center gap-2">
                      <span className="font-mono text-emerald-700">{c.code}</span>
                      <span>{c.name}</span>
                      <span className="text-[11px] font-mono text-slate-500">({c.dialCode})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {c.mobileRails} · {c.currency}
                    </div>
                  </div>
                  {active && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {!isOwner && (
            <button
              type="button"
              onClick={markOutsideEastAfrica}
              className="w-full py-2 text-[11px] text-slate-500 hover:text-rose-600 underline cursor-pointer"
            >
              I am currently located outside East Africa
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
