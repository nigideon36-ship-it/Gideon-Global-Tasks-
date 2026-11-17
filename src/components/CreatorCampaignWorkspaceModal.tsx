import React, { useState, useMemo } from 'react';
import {
  Task,
  CampaignPlatform,
  CampaignContentFormat,
} from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromUsd } from '../lib/eastAfrica';
import {
  X,
  Video,
  Film,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Link as LinkIcon,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface Props {
  task: Task;
  onClose: () => void;
}

const FORMAT_LABELS: Record<CampaignContentFormat, string> = {
  reel: 'Short Reel (9:16)',
  video: 'Product Video',
  'text-post': 'Text Post / Caption',
};

const PLATFORM_URL_HINTS: Record<CampaignPlatform, string> = {
  Facebook: 'https://www.facebook.com/... or https://fb.watch/...',
  Instagram: 'https://www.instagram.com/reel/... or /p/...',
  TikTok: 'https://www.tiktok.com/@yourhandle/video/...',
  WhatsApp: 'https://whatsapp.com/channel/... or attach WhatsApp Status screenshot',
};

function isValidPlatformUrl(platform: CampaignPlatform, rawUrl: string): boolean {
  const clean = rawUrl.trim();
  if (!clean) return false;
  try {
    const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    const host = parsed.hostname.toLowerCase();
    if (platform === 'Facebook') {
      return host.includes('facebook.com') || host === 'fb.watch' || host.endsWith('.fb.watch') || host === 'fb.me';
    }
    if (platform === 'Instagram') {
      return host.includes('instagram.com') || host === 'instagr.am';
    }
    if (platform === 'TikTok') {
      return host.includes('tiktok.com') || host === 'vm.tiktok.com' || host === 'vt.tiktok.com';
    }
    if (platform === 'WhatsApp') {
      return host.includes('whatsapp.com') || host === 'wa.me';
    }
    return false;
  } catch {
    return false;
  }
}

export const CreatorCampaignWorkspaceModal: React.FC<Props> = ({ task, onClose }) => {
  const { completeTask } = useTasks();
  const { activeToken } = useAuth();
  const { selectedCountry } = useRegion();

  const config = task.creatorCampaignConfig || {
    productName: task.title,
    productCategory: 'Featured Product',
    allowedPlatforms: ['Facebook', 'Instagram', 'TikTok', 'WhatsApp'] as CampaignPlatform[],
    allowedFormats: ['reel', 'video', 'text-post'] as CampaignContentFormat[],
    campaignBrief: task.description,
    talkingPoints: task.instructions,
    requiredHashtags: ['#GideonCreator', '#ProductCampaign'],
    minWordCount: 20,
  };

  const allowedPlatforms: CampaignPlatform[] = config.allowedPlatforms.filter((p) =>
    ['Facebook', 'Instagram', 'TikTok', 'WhatsApp'].includes(p)
  );
  const allowedFormats: CampaignContentFormat[] = config.allowedFormats;

  const [selectedPlatform, setSelectedPlatform] = useState<CampaignPlatform>(
    allowedPlatforms[0] || 'Instagram'
  );
  const [selectedFormat, setSelectedFormat] = useState<CampaignContentFormat>(
    allowedFormats[0] || 'reel'
  );
  const [creatorHandle, setCreatorHandle] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [whatsappScreenshotName, setWhatsappScreenshotName] = useState<string | null>(null);
  const [whatsappPreviewUrl, setWhatsappPreviewUrl] = useState<string | null>(null);
  const [productOnlyConfirmed, setProductOnlyConfirmed] = useState(true);
  const [copiedKit, setCopiedKit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hashtagChecks = useMemo(
    () =>
      config.requiredHashtags.map((tag) => ({
        tag,
        present: captionText.toLowerCase().includes(tag.toLowerCase()),
      })),
    [config.requiredHashtags, captionText]
  );

  const allHashtagsPresent = hashtagChecks.every((h) => h.present);
  const wordCount = captionText.trim() ? captionText.trim().split(/\s+/).filter(Boolean).length : 0;
  const minWords = selectedFormat === 'text-post' ? config.minWordCount || 25 : 10;

  const handleCopyCampaignKit = () => {
    const kitText = [
      `Product: ${config.productName}`,
      config.productTagline ? `Highlight: ${config.productTagline}` : '',
      `Talking Points:\n${config.talkingPoints.map((pt, i) => `${i + 1}. ${pt}`).join('\n')}`,
      `Required Hashtags: ${config.requiredHashtags.join(' ')}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      navigator.clipboard.writeText(kitText);
      setCopiedKit(true);
      window.setTimeout(() => setCopiedKit(false), 2000);
    } catch {}
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWhatsappScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setWhatsappPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    setErrorMsg(null);
  };

  const handleInsertSampleCaption = () => {
    const hashtags = config.requiredHashtags.join(' ');
    const leadPoint = config.talkingPoints[0] || `Tested the ${config.productName} and loved the performance.`;
    const secondPoint = config.talkingPoints[1] || 'Built for everyday convenience across East Africa.';
    setCaptionText(
      `Spotlight on ${config.productName}: ${leadPoint}. Plus, ${secondPoint}. Check it out today using our official product campaign guide! ${hashtags}`
    );
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!creatorHandle.trim() || creatorHandle.trim().length < 2) {
      setErrorMsg(`Enter your ${selectedPlatform} creator handle or account name.`);
      return;
    }

    if (selectedPlatform === 'WhatsApp') {
      const hasUrl = Boolean(postUrl.trim() && isValidPlatformUrl('WhatsApp', postUrl));
      const hasProofShot = Boolean(whatsappScreenshotName);
      if (!hasUrl && !hasProofShot) {
        setErrorMsg(
          'For WhatsApp campaigns, paste your WhatsApp Channel link (whatsapp.com/channel/...) or attach a WhatsApp Status/Broadcast screenshot proof.'
        );
        return;
      }
    } else {
      if (!isValidPlatformUrl(selectedPlatform, postUrl)) {
        setErrorMsg(
          `Please enter a valid ${selectedPlatform} ${selectedFormat === 'reel' ? 'Reel' : selectedFormat === 'video' ? 'Video' : 'Post'} link (${PLATFORM_URL_HINTS[selectedPlatform]}).`
        );
        return;
      }
    }

    if (wordCount < minWords) {
      setErrorMsg(
        `Your published ${selectedFormat === 'text-post' ? 'text post' : 'caption/script'} must be at least ${minWords} words (currently ${wordCount} words).`
      );
      return;
    }

    if (!allHashtagsPresent) {
      setErrorMsg(
        `Include all required product campaign hashtags in your post text: ${config.requiredHashtags.join(', ')}.`
      );
      return;
    }

    if (!productOnlyConfirmed) {
      setErrorMsg('Confirm that your post promotes ONLY the specified campaign product per guidelines.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/creator-campaigns/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          taskId: task.id,
          taskTitle: task.title,
          productName: config.productName,
          platform: selectedPlatform,
          format: selectedFormat,
          creatorHandle: creatorHandle.trim(),
          postUrl: postUrl.trim() || undefined,
          captionText: captionText.trim(),
          whatsappProofAttached: Boolean(whatsappScreenshotName),
          rewardUsd: task.reward,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Could not verify creator campaign deliverable.');
        setIsSubmitting(false);
        return;
      }

      completeTask(
        task.id,
        task.reward,
        `${config.productName} · ${selectedPlatform} ${FORMAT_LABELS[selectedFormat]}`
      );
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error verifying creator submission.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="font-semibold text-blue-700">Creator Product Campaign</span>
                <span aria-hidden="true">·</span>
                <span>{task.requesterName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-700 font-bold tabular-nums">
                  {formatCurrencyFromUsd(task.reward, selectedCountry)} Payout
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
                {task.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-Column Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Main Deliverable Form */}
          <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto space-y-5">
            {/* Product Campaign Brief */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    Featured Campaign Product · {config.productCategory}
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {config.productName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCampaignKit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedKit ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKit ? 'Campaign Kit Copied' : 'Copy Product Kit'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {config.campaignBrief}
              </p>
            </div>

            {/* Platform Selector (Strictly Facebook, Instagram, TikTok, WhatsApp) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                1. Select Social Platform (Eligible Channels Only)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Facebook', 'Instagram', 'TikTok', 'WhatsApp'] as CampaignPlatform[]).map((plat) => {
                  const isAllowed = allowedPlatforms.includes(plat);
                  const isActive = selectedPlatform === plat;
                  return (
                    <button
                      key={plat}
                      type="button"
                      disabled={!isAllowed}
                      onClick={() => {
                        setSelectedPlatform(plat);
                        setErrorMsg(null);
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap ${
                        !isAllowed
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                          : isActive
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs cursor-pointer'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      {plat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                2. Select Content Deliverable Format
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['reel', 'video', 'text-post'] as CampaignContentFormat[]).map((fmt) => {
                  const isAllowed = allowedFormats.includes(fmt);
                  const isActive = selectedFormat === fmt;
                  const Icon = fmt === 'reel' ? Film : fmt === 'video' ? Video : FileText;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      disabled={!isAllowed}
                      onClick={() => {
                        setSelectedFormat(fmt);
                        setErrorMsg(null);
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                        !isAllowed
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                          : isActive
                          ? 'bg-blue-700 border-blue-700 text-white shadow-xs cursor-pointer'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{FORMAT_LABELS[fmt]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Creator Handle & Published Link / WhatsApp Proof */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your {selectedPlatform} Handle / Channel Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={creatorHandle}
                  onChange={(e) => {
                    setCreatorHandle(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={selectedPlatform === 'WhatsApp' ? 'e.g. +254712... / Business Name' : '@yourcreatorhandle'}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 font-mono focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedPlatform === 'WhatsApp'
                    ? 'WhatsApp Channel Link (or attach Status screenshot below)'
                    : `Published ${selectedPlatform} ${selectedFormat === 'reel' ? 'Reel' : selectedFormat === 'video' ? 'Video' : 'Post'} URL`}
                  {selectedPlatform !== 'WhatsApp' && <span className="text-rose-600"> *</span>}
                </label>
                <div className="relative">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="url"
                    value={postUrl}
                    onChange={(e) => {
                      setPostUrl(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={PLATFORM_URL_HINTS[selectedPlatform]}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* WhatsApp Status / Channel Screenshot Upload */}
            {selectedPlatform === 'WhatsApp' && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-700" />
                    <span>WhatsApp Status / Broadcast Screenshot Proof</span>
                  </div>
                  <label className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer">
                    <span>{whatsappScreenshotName ? 'Replace Screenshot' : 'Attach Screenshot'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {whatsappScreenshotName && (
                  <div className="flex items-center gap-3 text-xs text-emerald-800 font-medium">
                    {whatsappPreviewUrl && (
                      <img
                        src={whatsappPreviewUrl}
                        alt="WhatsApp status proof"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-300"
                      />
                    )}
                    <span>Attached: {whatsappScreenshotName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Published Post Caption / Text Post Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  {selectedFormat === 'text-post'
                    ? 'Published Product Text Post Copy'
                    : 'Published Reel / Video Caption & Product Script Summary'}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleInsertSampleCaption}
                  className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  Use Product Starter Copy
                </button>
              </div>
              <textarea
                rows={4}
                required
                value={captionText}
                onChange={(e) => {
                  setCaptionText(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder={`Paste the exact text or caption you posted on ${selectedPlatform} for ${config.productName} (include ${config.requiredHashtags.join(' ')})...`}
                className="w-full p-3.5 text-xs rounded-xl border border-slate-300 text-slate-900 leading-relaxed focus:border-blue-600 outline-hidden"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Word count:{' '}
                  <strong className="font-mono tabular-nums text-slate-800">
                    {wordCount} / min {minWords} words
                  </strong>
                </span>
                <span>
                  Must highlight <strong>{config.productName}</strong> only
                </span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={productOnlyConfirmed}
                onChange={(e) => setProductOnlyConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600"
              />
              <span>
                I confirm this Reel, Video, or Text Post was published exclusively for{' '}
                <strong>{config.productName}</strong> on <strong>{selectedPlatform}</strong> using the campaign instructions.
              </span>
            </label>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Verified creator link &amp; caption saved for Owner audit
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Verifying Deliverable...'
                    : `Submit Campaign & Earn ${formatCurrencyFromUsd(task.reward, selectedCountry)}`}
                </span>
              </button>
            </div>
          </form>

          {/* Right Guidelines & Live Checklist Sidebar */}
          <aside className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto space-y-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2.5">
                  Mandatory Product Hashtags
                </h3>
                <div className="space-y-2">
                  {hashtagChecks.map((item) => (
                    <div
                      key={item.tag}
                      className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between ${
                        item.present
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="font-mono font-semibold">{item.tag}</span>
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          item.present ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2.5">
                  Product Campaign Talking Points
                </h3>
                <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                  {config.talkingPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono font-bold text-blue-700 shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Product-Only Content Rule</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Eligible exclusively on Facebook, Instagram, TikTok, and WhatsApp for the brand product listed above. Competing product mentions or off-platform URLs are declined.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
