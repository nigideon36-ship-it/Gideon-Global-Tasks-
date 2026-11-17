import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type AllowedCampaignPlatform = 'Facebook' | 'Instagram' | 'TikTok' | 'WhatsApp';
export type AllowedCampaignFormat = 'reel' | 'video' | 'text-post';

export interface CreatorSubmissionRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  productName: string;
  platform: AllowedCampaignPlatform;
  format: AllowedCampaignFormat;
  creatorHandle: string;
  postUrl?: string;
  captionText: string;
  whatsappProofAttached: boolean;
  rewardUsd: number;
  countryCode: string;
  submittedByUid?: string;
  submittedAt: string;
  status: 'Approved' | 'Under Review';
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'creator-submissions.json');
const submissions: CreatorSubmissionRecord[] = [];

const ALLOWED_PLATFORMS: readonly AllowedCampaignPlatform[] = [
  'Facebook',
  'Instagram',
  'TikTok',
  'WhatsApp',
];
const ALLOWED_FORMATS: readonly AllowedCampaignFormat[] = ['reel', 'video', 'text-post'];

function loadSubmissionsFromDisk() {
  try {
    if (!fs.existsSync(SUBMISSIONS_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
    if (Array.isArray(parsed)) {
      submissions.push(...parsed);
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistSubmissionsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist creator submissions:', (err as Error)?.message || err);
  }
}

loadSubmissionsFromDisk();

function isValidUrlForPlatform(platform: AllowedCampaignPlatform, rawUrl: string): boolean {
  const clean = String(rawUrl || '').trim();
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

export function createCreatorCampaignSubmission(params: {
  taskId: string;
  taskTitle: string;
  productName: string;
  platform: string;
  format: string;
  creatorHandle: string;
  postUrl?: string;
  captionText: string;
  whatsappProofAttached?: boolean;
  rewardUsd: number;
  countryCode: string;
  submittedByUid?: string;
}): CreatorSubmissionRecord {
  const platform = params.platform as AllowedCampaignPlatform;
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    throw new Error(
      'Creator product campaigns only support Facebook, Instagram, TikTok, or WhatsApp.'
    );
  }

  const format = params.format as AllowedCampaignFormat;
  if (!ALLOWED_FORMATS.includes(format)) {
    throw new Error('Deliverable format must be reel, video, or text-post.');
  }

  const cleanProduct = String(params.productName || '').trim();
  if (!cleanProduct) {
    throw new Error('Product name is required for product-only creator campaigns.');
  }

  const cleanHandle = String(params.creatorHandle || '').trim();
  if (cleanHandle.length < 2) {
    throw new Error('Enter a valid creator handle or channel name.');
  }

  const cleanCaption = String(params.captionText || '').trim();
  if (cleanCaption.length < 20) {
    throw new Error('Enter the full caption or product text post published for this campaign.');
  }

  const hasProofAttachment = Boolean(params.whatsappProofAttached);
  const cleanUrl = params.postUrl ? String(params.postUrl).trim() : undefined;

  if (platform === 'WhatsApp') {
    if (!hasProofAttachment && (!cleanUrl || !isValidUrlForPlatform('WhatsApp', cleanUrl))) {
      throw new Error(
        'WhatsApp submissions require a valid WhatsApp Channel link (whatsapp.com/channel/...) or screenshot proof.'
      );
    }
  } else if (!cleanUrl || !isValidUrlForPlatform(platform, cleanUrl)) {
    throw new Error(`Please provide a valid ${platform} link for your published content.`);
  }

  const record: CreatorSubmissionRecord = {
    id: `CR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    taskId: String(params.taskId),
    taskTitle: String(params.taskTitle),
    productName: cleanProduct,
    platform,
    format,
    creatorHandle: cleanHandle.slice(0, 100),
    postUrl: cleanUrl,
    captionText: cleanCaption.slice(0, 2000),
    whatsappProofAttached: hasProofAttachment,
    rewardUsd: Number(params.rewardUsd || 0),
    countryCode: String(params.countryCode || 'KE'),
    submittedByUid: params.submittedByUid,
    submittedAt: new Date().toISOString(),
    status: 'Approved',
  };

  submissions.unshift(record);
  persistSubmissionsToDisk();
  return record;
}

export function listCreatorCampaignSubmissions(): CreatorSubmissionRecord[] {
  return [...submissions];
}
