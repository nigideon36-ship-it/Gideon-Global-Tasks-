import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { useTasks } from '../context/TaskContext';
import { EAST_AFRICA_COUNTRIES, getCountryByCode } from '../lib/eastAfrica';
import {
  ShieldCheck,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  IdCard,
  RefreshCw,
  LogIn,
  Lock,
} from 'lucide-react';

async function compressIdImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      if (!raw) {
        reject(new Error('Selected image file appears empty.'));
        return;
      }
      // If already under ~1.2MB and valid PNG/JPG/WebP, return directly if small enough
      if (raw.length <= 1_400_000 && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(raw)) {
        resolve(raw);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted ID image format. Use PNG, JPG, or WebP.'));
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Image compression failed on this browser.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.86);
        if (compressed.length > 2_600_000) {
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } else {
          resolve(compressed);
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

interface KycVerificationPanelProps {
  compact?: boolean;
  onSuccess?: () => void;
}

export const KycVerificationPanel: React.FC<KycVerificationPanelProps> = ({ compact = false, onSuccess }) => {
  const { isAuthenticated, customerProfile, user, setAuthModalOpen } = useAuth();
  const { selectedCountry } = useRegion();
  const { kycStatus, kycRecord, kycLoading, refreshKycStatus, submitKycVerification } = useTasks();

  const [countryCode, setCountryCode] = useState<string>(
    kycRecord?.countryCode || customerProfile?.countryCode || selectedCountry.code || 'KE'
  );
  const [fullNameOnId, setFullNameOnId] = useState<string>(
    kycRecord?.fullNameOnId || customerProfile?.displayName || user?.displayName || ''
  );
  const [idNumber, setIdNumber] = useState<string>(kycRecord?.idNumber || '');
  const [frontImageDataUrl, setFrontImageDataUrl] = useState<string>('');
  const [backImageDataUrl, setBackImageDataUrl] = useState<string>('');
  const [frontFileName, setFrontFileName] = useState<string>('');
  const [backFileName, setBackFileName] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshKycStatus();
    }
  }, [isAuthenticated, refreshKycStatus]);

  useEffect(() => {
    if (kycRecord?.countryCode) setCountryCode(kycRecord.countryCode);
    if (kycRecord?.fullNameOnId && !fullNameOnId) setFullNameOnId(kycRecord.fullNameOnId);
    if (kycRecord?.idNumber && !idNumber) setIdNumber(kycRecord.idNumber);
  }, [kycRecord?.countryCode, kycRecord?.fullNameOnId, kycRecord?.idNumber]);

  const docCountry = getCountryByCode(countryCode);

  const handleFilePick = async (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(`Please upload a PNG, JPG, or WebP photo for the ${side === 'front' ? 'Front' : 'Back'} of your ${docCountry.idDocumentName}.`);
      return;
    }
    try {
      const dataUrl = await compressIdImageToDataUrl(file);
      if (side === 'front') {
        if (backImageDataUrl && dataUrl === backImageDataUrl) {
          setErrorMsg(`Front and Back photos of your ${docCountry.idDocumentName} must be two different photos.`);
          return;
        }
        setFrontImageDataUrl(dataUrl);
        setFrontFileName(file.name);
      } else {
        if (frontImageDataUrl && dataUrl === frontImageDataUrl) {
          setErrorMsg(`Back and Front photos of your ${docCountry.idDocumentName} must be two different photos.`);
          return;
        }
        setBackImageDataUrl(dataUrl);
        setBackFileName(file.name);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process the selected ID photo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    if (fullNameOnId.trim().length < 3) {
      setErrorMsg(`Enter your full legal name exactly as printed on your ${docCountry.idDocumentName}.`);
      return;
    }
    if (idNumber.trim().length < 4) {
      setErrorMsg(`Enter a valid ${docCountry.idDocumentName} number (${docCountry.idNumberHint}).`);
      return;
    }
    if (!frontImageDataUrl || !backImageDataUrl) {
      setErrorMsg(`Both the Front photo AND Back photo of your ${docCountry.idDocumentName} are required.`);
      return;
    }
    if (frontImageDataUrl === backImageDataUrl) {
      setErrorMsg(`Front and Back images of your ${docCountry.idDocumentName} cannot be identical.`);
      return;
    }

    setSubmitting(true);
    const res = await submitKycVerification({
      countryCode: docCountry.code,
      fullNameOnId: fullNameOnId.trim(),
      idNumber: idNumber.trim(),
      frontImageDataUrl,
      backImageDataUrl,
    });
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Could not submit KYC verification.');
      return;
    }

    setSuccessMsg(
      res.message ||
        `${docCountry.idDocumentName} (Front & Back) submitted! Owner review will unlock PayPal withdrawals once approved.`
    );
    onSuccess?.();
  };

  if (!isAuthenticated) {
    return (
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <IdCard className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Sign In to Complete Strict KYC ({docCountry.idDocumentName})
            </h4>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              PayPal withdrawals from 150 Shillings require an authenticated account and approved upload of BOTH the <strong>Front and Back</strong> of your national ID ({docCountry.idDocumentName}).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In / Register to Verify ID</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border space-y-4 ${compact ? 'p-4 bg-white border-slate-200' : 'p-5 bg-white border-slate-200'}`}>
      {/* Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              kycStatus === 'Approved'
                ? 'bg-emerald-100 text-emerald-700'
                : kycStatus === 'Pending'
                ? 'bg-amber-100 text-amber-800'
                : kycStatus === 'Rejected'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-900 text-white'
            }`}
          >
            {kycStatus === 'Approved' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : kycStatus === 'Pending' ? (
              <Clock className="w-4 h-4" />
            ) : (
              <IdCard className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Strict National ID KYC Verification
              </h4>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                  kycStatus === 'Approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : kycStatus === 'Pending'
                    ? 'bg-amber-100 text-amber-900'
                    : kycStatus === 'Rejected'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {kycStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Accepted document for <strong>{docCountry.name}</strong>:{' '}
              <strong className="text-slate-900">{docCountry.idDocumentName}</strong> (Front &amp; Back photos required).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refreshKycStatus()}
          disabled={kycLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3 h-3 ${kycLoading ? 'animate-spin' : ''}`} />
          <span>Refresh KYC Status</span>
        </button>
      </div>

      {/* Approved Read-Only Summary */}
      {kycStatus === 'Approved' && kycRecord && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>KYC Approved — PayPal Withdrawals Unlocked!</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-emerald-950">
            <div>
              <span className="text-emerald-700 block">Document Type</span>
              <strong>{kycRecord.idDocumentName}</strong>
            </div>
            <div>
              <span className="text-emerald-700 block">Legal Name on ID</span>
              <strong>{kycRecord.fullNameOnId}</strong>
            </div>
            <div>
              <span className="text-emerald-700 block">ID Number</span>
              <strong className="font-mono">{kycRecord.idNumber}</strong>
            </div>
          </div>
          {kycRecord.frontImageDataUrl || kycRecord.backImageDataUrl ? (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {kycRecord.frontImageDataUrl && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Front ID Verified</span>
                  <img
                    src={kycRecord.frontImageDataUrl}
                    alt="Verified Front ID"
                    className="w-full h-24 object-cover rounded-lg border border-emerald-300 bg-white"
                  />
                </div>
              )}
              {kycRecord.backImageDataUrl && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Back ID Verified</span>
                  <img
                    src={kycRecord.backImageDataUrl}
                    alt="Verified Back ID"
                    className="w-full h-24 object-cover rounded-lg border border-emerald-300 bg-white"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 p-2.5 rounded-lg bg-white/80 border border-emerald-200 flex items-center gap-2 text-[11px] font-semibold text-emerald-900">
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Front &amp; Back {kycRecord.idDocumentName} documents verified and permanently archived on file.</span>
            </div>
          )}
        </div>
      )}

      {/* Pending Review Summary */}
      {kycStatus === 'Pending' && kycRecord && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-bold">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>KYC Submitted — Pending Platform Owner Review</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Your <strong>Front &amp; Back photos</strong> of{' '}
            <strong>{kycRecord.idDocumentName}</strong> (ID{' '}
            <code className="font-mono font-bold">{kycRecord.idNumber}</code>) have been submitted to{' '}
            <code className="font-mono">nigideon36@gmail.com</code>. Withdrawals unlock automatically as soon as approved.
          </p>
          {kycRecord.frontImageDataUrl || kycRecord.backImageDataUrl ? (
            <div className="grid grid-cols-2 gap-3">
              {kycRecord.frontImageDataUrl && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-amber-900 mb-1">Front Submitted</div>
                  <img
                    src={kycRecord.frontImageDataUrl}
                    alt="Pending Front ID"
                    className="w-full h-24 object-cover rounded-lg border border-amber-300 bg-white"
                  />
                </div>
              )}
              {kycRecord.backImageDataUrl && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-amber-900 mb-1">Back Submitted</div>
                  <img
                    src={kycRecord.backImageDataUrl}
                    alt="Pending Back ID"
                    className="w-full h-24 object-cover rounded-lg border border-amber-300 bg-white"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200 flex items-center gap-2 text-[11px] font-semibold text-amber-900">
              <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Front &amp; Back {kycRecord.idDocumentName} submitted for owner review — stored securely on file.</span>
            </div>
          )}
        </div>
      )}

      {/* Rejected Banner */}
      {kycStatus === 'Rejected' && kycRecord && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>KYC Submission Rejected — Please Re-upload Clear Front &amp; Back ID Photos</span>
          </div>
          {kycRecord.rejectionReason && (
            <p className="text-[11px] text-rose-800">{kycRecord.rejectionReason}</p>
          )}
        </div>
      )}

      {/* Upload Form (when Not Submitted or Rejected) */}
      {(kycStatus === 'Not Submitted' || kycStatus === 'Rejected') && (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-700">
            <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
            <span>
              Under strict platform security policy, you must upload <strong>BOTH clear Front and Back photos</strong> of your country&apos;s official National ID before any PayPal withdrawal is allowed.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Country &amp; ID Type
              </label>
              <select
                value={docCountry.code}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold outline-hidden focus:border-blue-600"
              >
                {EAST_AFRICA_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} — {c.idDocumentName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Full Name Printed on ID <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={fullNameOnId}
                onChange={(e) => setFullNameOnId(e.target.value)}
                placeholder="Exact legal name on ID"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold outline-hidden focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {docCountry.idDocumentName} Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder={docCountry.idNumberHint}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-900 font-bold outline-hidden focus:border-blue-600"
              />
            </div>
          </div>

          {/* Front & Back Side-by-Side Upload Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* FRONT SIDE */}
            <div className="p-3.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">
                  1. Front Side of {docCountry.idDocumentName} <span className="text-rose-600">*</span>
                </span>
                {frontImageDataUrl && (
                  <span className="text-[10px] font-bold text-emerald-700">Attached</span>
                )}
              </div>
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleFilePick('front', e)}
                className="hidden"
              />
              {frontImageDataUrl ? (
                <div className="space-y-2">
                  <img
                    src={frontImageDataUrl}
                    alt="Front of National ID preview"
                    className="w-full h-32 object-cover rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => frontInputRef.current?.click()}
                    className="w-full py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    Replace Front Photo ({frontFileName || 'selected'})
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => frontInputRef.current?.click()}
                  className="w-full py-6 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-700 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-blue-600" />
                  <span className="font-bold">Upload Front of ID</span>
                  <span className="text-[10px] text-slate-500">Clear photo showing photo &amp; ID number</span>
                </button>
              )}
            </div>

            {/* BACK SIDE */}
            <div className="p-3.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">
                  2. Back Side of {docCountry.idDocumentName} <span className="text-rose-600">*</span>
                </span>
                {backImageDataUrl && (
                  <span className="text-[10px] font-bold text-emerald-700">Attached</span>
                )}
              </div>
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleFilePick('back', e)}
                className="hidden"
              />
              {backImageDataUrl ? (
                <div className="space-y-2">
                  <img
                    src={backImageDataUrl}
                    alt="Back of National ID preview"
                    className="w-full h-32 object-cover rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => backInputRef.current?.click()}
                    className="w-full py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    Replace Back Photo ({backFileName || 'selected'})
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => backInputRef.current?.click()}
                  className="w-full py-6 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-700 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-blue-600" />
                  <span className="font-bold">Upload Back of ID</span>
                  <span className="text-[10px] text-slate-500">Clear photo showing barcode / reverse details</span>
                </button>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500">
              Both Front &amp; Back of {docCountry.idDocumentName} are verified confidentially for anti-fraud compliance.
            </span>
            <button
              type="submit"
              disabled={submitting || !frontImageDataUrl || !backImageDataUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{submitting ? 'Submitting Front & Back ID...' : 'Submit Both Sides for KYC Approval'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
