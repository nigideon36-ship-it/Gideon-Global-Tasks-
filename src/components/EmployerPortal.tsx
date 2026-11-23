import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useTasks } from '../context/TaskContext';
import { useAuth, OWNER_EMAIL } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { db, auth } from '../lib/firebase';
import { type AuctionItem, type AuctionCategory, type AuctionCondition, type AuctionStatus, resolveAuctionImageUrl } from './AuctionsView';
import { type PpvStatusPostItem, resolvePpvMediaSrc } from './PayPerViewView';
import fbProfileImg from '../assets/images/fb_profile_logo_1795191798991.jpg';
import fbCoverImg from '../assets/images/fb_cover_clean_1795191811809.jpg';
import todayPromoImg from '../assets/images/gideon_daily_promo_1795436280290.jpg';
import { CANONICAL_PLATFORM_ORIGIN, CANONICAL_PLATFORM_URL } from '../utils/platformUrl';
import {
  convertKesToLocal,
  convertUsdToLocal,
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
  getCountryByCode,
  localAmountToUsd,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';
import { TaskCategory, TaskDifficulty, CampaignPlatform, CampaignContentFormat } from '../types/tasks';
import {
  PlusCircle,
  Users,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Smartphone,
  Zap,
  Lock,
  Globe,
  MapPin,
  Wallet,
  Clock,
  XCircle,
  RefreshCw,
  Receipt,
  ListChecks,
  Search,
  DollarSign,
  MessageSquare,
  Send,
  ShieldCheck,
  UserCheck,
  Unlock,
  Ban,
  Image as ImageIcon,
  Eye,
  X,
  TrendingUp,
  MessageSquareHeart,
  Trash2,
  Edit3,
  Power,
  Star,
  Save,
  Gavel,
  Mail,
  BellRing,
  Copy,
  Check,
  ExternalLink,
  Code,
  Link2,
  Download,
} from 'lucide-react';

interface OwnerWithdrawalItem {
  id: string;
  userUid: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  countryCode: string;
  amountUsd: number;
  method: string;
  accountDetails: string;
  status: 'Processing' | 'Completed' | 'Rejected';
  mpesaReceipt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
}

type TransactionKind =
  | 'withdrawal'
  | 'paypal_checkout'
  | 'task_reward'
  | 'referral_commission'
  | 'investment_deposit'
  | 'auction_sale'
  | 'ppv_payout';

interface PlatformTransactionItem {
  id: string;
  kind: TransactionKind;
  title: string;
  customerLabel: string;
  gatewayOrMethod: string;
  currency: string;
  amountLocal?: number;
  amountUsd: number;
  status: 'Completed' | 'Processing' | 'Pending' | 'Rejected' | 'Failed';
  reference: string;
  countryCode: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  createdAt: string;
  updatedAt: string;
}

interface TransactionSummary {
  totalTransactions: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsUsd: number;
  approvedWithdrawalsUsd: number;
  paypalVolumeUsd: number;
  taskRewardsUsd: number;
  investmentDepositsUsd?: number;
}

type ConsoleSectionTab =
  | 'withdrawals'
  | 'kyc'
  | 'investments'
  | 'auctions'
  | 'ppv'
  | 'testimonials'
  | 'transactions'
  | 'tasks'
  | 'customers'
  | 'support'
  | 'sms'
  | 'admin-alerts'
  | 'paypal-zapier'
  | 'brand-kit';
type TxKindFilter = 'all' | TransactionKind;

interface OwnerSupportTicketItem {
  id: string;
  userUid?: string;
  customerName: string;
  contactInfo: string;
  countryCode: string;
  category: string;
  subject: string;
  message: string;
  aiConversationSummary?: string;
  status: 'Open' | 'Resolved';
  ownerReply?: string;
  createdAt: string;
  updatedAt: string;
}

interface OwnerKycItem {
  uid: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  countryCode: string;
  idDocumentName: string;
  fullNameOnId: string;
  idNumber: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt: string;
}

interface SavedCustomerItem {
  uid: string;
  phone: string;
  phoneLocked?: boolean;
  accountDetailsLocked?: boolean;
  accountDetailsLockedAt?: string;
  countryCode: string;
  email?: string;
  displayName: string;
  city?: string;
  bio?: string;
  socialHandles?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    whatsapp?: string;
  };
  withdrawalDetails?: {
    method: string;
    accountDetails: string;
    accountHolderName: string;
    locked: boolean;
    lockedAt: string;
  };
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'sms' | 'totp';
  phoneVerified: boolean;
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
  deactivated?: boolean;
  deactivatedReason?: string;
  deactivatedAt?: string;
  loginCount: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface CustomerStateSummaryItem {
  balanceUsd: number;
  lifetimeEarnedUsd: number;
  completedTasksCount: number;
  vipReferralCount: number;
  referredByCode?: string;
  activePackageId: string | null;
}

interface OwnerInvestmentItem {
  id: string;
  transactionId: string;
  userUid: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  countryCode: string;
  planId: 'starter-7d' | 'growth-14d' | 'vip-30d';
  planName: string;
  amountKes: number;
  amountUsd: number;
  returnPct: number;
  expectedReturnKes: number;
  expectedReturnUsd: number;
  durationDays: number;
  depositMethod: string;
  payToNumber?: string;
  senderPhone?: string;
  paymentReference: string;
  screenshotDataUrl?: string;
  status: 'Pending Owner Approval' | 'Active' | 'Matured & Paid' | 'Rejected';
  ownerNotes?: string;
  payoutReceipt?: string;
  maturesAt?: string;
  settledAt?: string;
  createdAt: string;
}

interface OwnerTestimonialItem {
  id: string;
  userUid: string;
  authorName: string;
  city: string;
  countryCode: string;
  rating: number;
  headline: string;
  message: string;
  experienceCategory: string;
  verifiedCustomer: boolean;
  status: 'Published' | 'Featured' | 'Hidden';
  ownerReply?: string;
  createdAt: string;
}

interface OwnerCreatorSubmissionItem {
  id: string;
  taskId: string;
  taskTitle: string;
  productName: string;
  platform: CampaignPlatform;
  format: CampaignContentFormat;
  creatorHandle: string;
  postUrl?: string;
  captionText: string;
  whatsappProofAttached: boolean;
  rewardUsd: number;
  countryCode: string;
  submittedAt: string;
  status: string;
}

interface SmsLogItem {
  id: string;
  timestamp: string;
  maskedPhone: string;
  purpose: string;
  provider: string;
  status: 'delivered' | 'sandbox' | 'failed' | 'instant-fallback';
  detail: string;
  messageId?: string;
}

export const EmployerPortal: React.FC = () => {
  const {
    tasks,
    taskHistory,
    postTask,
    updateTask,
    deleteTask,
    setActiveTab,
    setPublisherModalOpen,
  } = useTasks();
  const { user, customerProfile, idToken, getFreshToken, refreshCustomerProfile, isOwner, signInWithGoogle } = useAuth();
  const { selectedCountry } = useRegion();

  const [consoleTab, setConsoleTab] = useState<ConsoleSectionTab>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<OwnerWithdrawalItem[]>([]);
  const [transactions, setTransactions] = useState<PlatformTransactionItem[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({
    totalTransactions: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsUsd: 0,
    approvedWithdrawalsUsd: 0,
    paypalVolumeUsd: 0,
    taskRewardsUsd: 0,
  });

  const [loadingData, setLoadingData] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [receiptInputs, setReceiptInputs] = useState<Record<string, string>>({});
  const [gatewayMode, setGatewayMode] = useState<'auto' | 'paypal' | 'manual'>('auto');
  const [gatewayStatus, setGatewayStatus] = useState<{
    paypal?: { configured: boolean; live: boolean; mode: string };
    anyLiveGatewayConfigured?: boolean;
  } | null>(null);
  const [withdrawalFeedback, setWithdrawalFeedback] = useState<string | null>(null);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'Processing' | 'Completed' | 'Rejected'>('all');

  const [txKindFilter, setTxKindFilter] = useState<TxKindFilter>('all');
  const [txSearch, setTxSearch] = useState('');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [customers, setCustomers] = useState<SavedCustomerItem[]>([]);
  const [stateSummaryByUid, setStateSummaryByUid] = useState<Record<string, CustomerStateSummaryItem>>({});
  const [lockedPayoutCount, setLockedPayoutCount] = useState<number>(0);
  const [unlockingUid, setUnlockingUid] = useState<string | null>(null);
  const [banningUid, setBanningUid] = useState<string | null>(null);
  const [unbanningUid, setUnbanningUid] = useState<string | null>(null);
  const [unbanPhoneInput, setUnbanPhoneInput] = useState('0712727558');
  const [unbanningPhone, setUnbanningPhone] = useState(false);
  const [customerFeedback, setCustomerFeedback] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [creatorSubmissions, setCreatorSubmissions] = useState<OwnerCreatorSubmissionItem[]>([]);
  const [kycSubmissions, setKycSubmissions] = useState<OwnerKycItem[]>([]);
  const [kycNoteInputs, setKycNoteInputs] = useState<Record<string, string>>({});
  const [processingKycUid, setProcessingKycUid] = useState<string | null>(null);
  const [kycFeedback, setKycFeedback] = useState<string | null>(null);
  const [previewKyc, setPreviewKyc] = useState<OwnerKycItem | null>(null);

  // Full Owner Super-Admin state: Customers, Investments, Testimonials, Tasks
  const [investments, setInvestments] = useState<OwnerInvestmentItem[]>([]);
  const [processingInvId, setProcessingInvId] = useState<string | null>(null);
  const [invNoteInputs, setInvNoteInputs] = useState<Record<string, string>>({});
  const [invFeedback, setInvFeedback] = useState<string | null>(null);
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [editInvDraft, setEditInvDraft] = useState<{
    amountKes: string;
    returnPct: string;
    status: OwnerInvestmentItem['status'];
    ownerNotes: string;
  }>({ amountKes: '50', returnPct: '12', status: 'Pending Owner Approval', ownerNotes: '' });
  const [confirmDeleteInvId, setConfirmDeleteInvId] = useState<string | null>(null);
  const [previewInvScreenshot, setPreviewInvScreenshot] = useState<OwnerInvestmentItem | null>(null);

  const [testimonials, setTestimonials] = useState<OwnerTestimonialItem[]>([]);
  const [processingTestiId, setProcessingTestiId] = useState<string | null>(null);
  const [testiReplyInputs, setTestiReplyInputs] = useState<Record<string, string>>({});
  const [testiFeedback, setTestiFeedback] = useState<string | null>(null);
  const [editingTestiId, setEditingTestiId] = useState<string | null>(null);
  const [editTestiDraft, setEditTestiDraft] = useState<{
    headline: string;
    message: string;
    rating: number;
  }>({ headline: '', message: '', rating: 5 });
  const [confirmDeleteTestiId, setConfirmDeleteTestiId] = useState<string | null>(null);

  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [processingAuctionId, setProcessingAuctionId] = useState<string | null>(null);
  const [auctionFeedback, setAuctionFeedback] = useState<string | null>(null);
  const [editingAuctionId, setEditingAuctionId] = useState<string | null>(null);
  const [editAuctionDraft, setEditAuctionDraft] = useState<{
    title: string;
    category: AuctionCategory;
    condition: AuctionCondition;
    status: AuctionStatus;
    startingBidKes: string;
    minIncrementKes: string;
    buyNowKes: string;
    featured: boolean;
  }>({
    title: '',
    category: 'Electronics & Phones',
    condition: 'Like New',
    status: 'Live',
    startingBidKes: '1000',
    minIncrementKes: '100',
    buyNowKes: '',
    featured: false,
  });
  const [confirmDeleteAuctionId, setConfirmDeleteAuctionId] = useState<string | null>(null);

  const [ppvPosts, setPpvPosts] = useState<PpvStatusPostItem[]>([]);
  const [ppvFeedback, setPpvFeedback] = useState<string | null>(null);
  const [processingPpvId, setProcessingPpvId] = useState<string | null>(null);
  const [previewPpvPost, setPreviewPpvPost] = useState<PpvStatusPostItem | null>(null);
  const [taskAlertSummary, setTaskAlertSummary] = useState<{
    activeCount: number;
    totalCount: number;
    smtpConfigured: boolean;
    recentDispatches: Array<{
      id: string;
      emailMasked: string;
      taskTitle: string;
      taskRewardKes: number;
      deliveryChannel: string;
      deliveryStatus: string;
      createdAt: string;
    }>;
  } | null>(null);
  const [supportTickets, setSupportTickets] = useState<OwnerSupportTicketItem[]>([]);
  const [processingTicketId, setProcessingTicketId] = useState<string | null>(null);

  const [editingCustomerUid, setEditingCustomerUid] = useState<string | null>(null);
  const [customerEditDraft, setCustomerEditDraft] = useState<{
    displayName: string;
    phone: string;
    email: string;
    countryCode: string;
    city: string;
    bio: string;
    withdrawalMethod: string;
    withdrawalAccountDetails: string;
    withdrawalAccountHolderName: string;
    phoneLocked: boolean;
    accountDetailsLocked: boolean;
    withdrawalLocked: boolean;
    phoneVerified: boolean;
    resetTwoFactor: boolean;
    vipReferralCount: string;
    balanceLocal: string;
  }>({
    displayName: '',
    phone: '',
    email: '',
    countryCode: 'KE',
    city: '',
    bio: '',
    withdrawalMethod: 'PayPal',
    withdrawalAccountDetails: '',
    withdrawalAccountHolderName: '',
    phoneLocked: true,
    accountDetailsLocked: true,
    withdrawalLocked: true,
    phoneVerified: true,
    resetTwoFactor: false,
    vipReferralCount: '0',
    balanceLocal: '0',
  });
  const [savingCustomerEdit, setSavingCustomerEdit] = useState(false);
  const [deactivatingUid, setDeactivatingUid] = useState<string | null>(null);
  const [deletingCustomerUid, setDeletingCustomerUid] = useState<string | null>(null);
  const [confirmDeleteCustomerUid, setConfirmDeleteCustomerUid] = useState<string | null>(null);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskDraft, setEditTaskDraft] = useState<{
    title: string;
    reward: string;
    totalSpots: string;
    spotsRemaining: string;
    category: TaskCategory;
  }>({ title: '', reward: '50', totalSpots: '50', spotsRemaining: '50', category: 'survey' });
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  // SMS OTP Gateway state
  const [smsProvider, setSmsProvider] = useState<'none' | 'africastalking' | 'textsms' | 'twilio'>('none');
  const [smsLiveReady, setSmsLiveReady] = useState(false);
  const [smsAtSandbox, setSmsAtSandbox] = useState(false);
  const [smsLogs, setSmsLogs] = useState<SmsLogItem[]>([]);
  const [atUsername, setAtUsername] = useState('');
  const [atApiKey, setAtApiKey] = useState('');
  const [atSenderId, setAtSenderId] = useState('');
  const [textsmsPartnerId, setTextsmsPartnerId] = useState('');
  const [textsmsApiKey, setTextsmsApiKey] = useState('');
  const [textsmsShortcode, setTextsmsShortcode] = useState('TextSMS');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');
  const [smsTestPhone, setSmsTestPhone] = useState('+254712727558');
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);

  // Admin SMTP Email Notifications & Serverless Webhook state
  const [adminAlertsEnabled, setAdminAlertsEnabled] = useState(true);
  const [adminAlertEmail, setAdminAlertEmail] = useState(OWNER_EMAIL);
  const [adminHighRewardKes, setAdminHighRewardKes] = useState('40');
  const [adminEventToggles, setAdminEventToggles] = useState<Record<string, boolean>>({
    new_registration: true,
    high_reward_task: true,
    kyc_submitted: true,
    withdrawal_requested: true,
    investment_deposit: true,
    support_ticket: true,
    ppv_status_uploaded: true,
    auction_activity: true,
  });
  const [adminSmtpStatus, setAdminSmtpStatus] = useState<{
    configured: boolean;
    host: string;
    port: number;
    userMasked: string;
    fromLabel: string;
  } | null>(null);
  const [adminAlertLogs, setAdminAlertLogs] = useState<
    Array<{
      id: string;
      eventType: string;
      title: string;
      summary: string;
      recipientMasked: string;
      deliveryStatus: 'Sent' | 'Queued' | 'Skipped' | 'Failed';
      deliveryNote: string;
      actorLabel?: string;
      amountLabel?: string;
      source: string;
      createdAt: string;
    }>
  >([]);
  const [adminAlertsSaving, setAdminAlertsSaving] = useState(false);
  const [adminAlertsTesting, setAdminAlertsTesting] = useState(false);
  const [adminAlertsFeedback, setAdminAlertsFeedback] = useState<string | null>(null);

  // PayPal (International Buyers) & Zapier Automation Workflow state (non-secret fields only)
  const [paypalEnabled, setPaypalEnabled] = useState(true);
  const [paypalEmail, setPaypalEmail] = useState('nigideon36@gmail.com');
  const [paypalMeHandle, setPaypalMeHandle] = useState('nigideon36');
  const [paypalMode, setPaypalMode] = useState<'live' | 'sandbox'>('live');
  const [paypalRestReady, setPaypalRestReady] = useState(false);
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState('');
  const [inboundZapierUrl, setInboundZapierUrl] = useState('');
  const [paypalGeneratedLinks, setPaypalGeneratedLinks] = useState<
    Array<{
      id: string;
      itemName: string;
      amountUsd: number;
      packageId?: string;
      checkoutUrl: string;
      payPalMeUrl: string;
      htmlButtonSnippet: string;
      createdAt: string;
    }>
  >([]);
  const [zapierLogs, setZapierLogs] = useState<
    Array<{
      id: string;
      direction: 'outbound' | 'inbound';
      event: string;
      status: 'Sent' | 'Received' | 'Skipped' | 'Failed';
      detail: string;
      amountUsd?: number;
      transactionId?: string;
      createdAt: string;
    }>
  >([]);
  const [paypalGenItemName, setPaypalGenItemName] = useState('Merchant Task Campaign Escrow');
  const [paypalGenAmountUsd, setPaypalGenAmountUsd] = useState('5.00');
  const [paypalGenPackageId, setPaypalGenPackageId] = useState('escrow');
  const [paypalLatestLink, setPaypalLatestLink] = useState<{
    id: string;
    itemName: string;
    amountUsd: number;
    checkoutUrl: string;
    payPalMeUrl: string;
    htmlButtonSnippet: string;
  } | null>(null);
  const [paypalSaving, setPaypalSaving] = useState(false);
  const [paypalGenerating, setPaypalGenerating] = useState(false);
  const [paypalTestingZapier, setPaypalTestingZapier] = useState(false);
  const [paypalFeedback, setPaypalFeedback] = useState<string | null>(null);
  const [copiedPayPalField, setCopiedPayPalField] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('survey');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState<string>(() => String(convertKesToLocal(40, selectedCountry)));
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('4');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('Beginner');
  const [totalSpots, setTotalSpots] = useState<string>('50');
  const [campaignProductName, setCampaignProductName] = useState('');
  const [campaignPlatforms, setCampaignPlatforms] = useState<CampaignPlatform[]>([
    'Facebook',
    'Instagram',
    'TikTok',
    'WhatsApp',
  ]);
  const [campaignFormats, setCampaignFormats] = useState<CampaignContentFormat[]>([
    'reel',
    'video',
    'text-post',
  ]);
  const [campaignHashtags, setCampaignHashtags] = useState('#ProductCampaign #GideonCreatorEA');
  const [instructionsText, setInstructionsText] = useState(
    '1. Review the provided materials carefully.\n2. Ensure answers are objective and accurate.\n3. Submit for instant automated verification.'
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const applySmsStatusPayload = (data: any) => {
    if (!data) return;
    setSmsLiveReady(Boolean(data.liveCarrierReady));
    setSmsAtSandbox(Boolean(data.atIsSandbox));
    if (Array.isArray(data.recentLogs)) setSmsLogs(data.recentLogs);
    const c = data.config;
    if (c) {
      if (c.provider) setSmsProvider(c.provider);
      if (c.atUsername) setAtUsername(c.atUsername);
      if (c.atSenderId) setAtSenderId(c.atSenderId);
      if (c.textsmsPartnerId) setTextsmsPartnerId(c.textsmsPartnerId);
      if (c.textsmsShortcode) setTextsmsShortcode(c.textsmsShortcode);
      if (c.twilioAccountSid) setTwilioAccountSid(c.twilioAccountSid);
      if (c.twilioFromNumber) setTwilioFromNumber(c.twilioFromNumber);
    }
  };

  const loadOwnerConsoleData = useCallback(async () => {
    const token = await getFreshToken();
    if (!isOwner || !token) return;
    setLoadingData(true);
    try {
      const [wdRes, txRes, gwRes, smsRes, custRes, creatorRes, kycRes, invRes, testiRes, aucRes] = await Promise.all([
        fetch('/api/owner/withdrawals', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/transactions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/payout-gateways/status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/sms-config', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/customers', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/creator-submissions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/kyc', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/investments', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/testimonials', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/owner/auctions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (wdRes.ok) {
        const wdData = await wdRes.json();
        if (Array.isArray(wdData?.withdrawals)) {
          setWithdrawals(wdData.withdrawals);
        }
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        if (Array.isArray(txData?.transactions)) {
          setTransactions(txData.transactions);
        }
        if (txData?.summary) {
          setSummary(txData.summary);
        }
      }

      if (gwRes.ok) {
        const gwData = await gwRes.json();
        setGatewayStatus(gwData);
      }

      if (smsRes.ok) {
        const smsData = await smsRes.json();
        applySmsStatusPayload(smsData);
      }

      if (custRes.ok) {
        const custData = await custRes.json();
        if (Array.isArray(custData?.customers)) {
          setCustomers(custData.customers);
        }
        if (custData?.stateSummaryByUid && typeof custData.stateSummaryByUid === 'object') {
          setStateSummaryByUid(custData.stateSummaryByUid);
        }
        if (typeof custData?.stats?.lockedPayoutCount === 'number') {
          setLockedPayoutCount(custData.stats.lockedPayoutCount);
        }
      }

      if (creatorRes.ok) {
        const creatorData = await creatorRes.json();
        if (Array.isArray(creatorData?.submissions)) {
          setCreatorSubmissions(creatorData.submissions);
        }
      }

      if (kycRes.ok) {
        const kycData = await kycRes.json();
        if (Array.isArray(kycData?.submissions)) {
          setKycSubmissions(kycData.submissions);
        }
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        if (Array.isArray(invData?.investments)) {
          setInvestments(invData.investments);
        }
      }

      if (testiRes.ok) {
        const testiData = await testiRes.json();
        if (Array.isArray(testiData?.testimonials)) {
          setTestimonials(testiData.testimonials);
        }
      }

      if (aucRes.ok) {
        const aucData = await aucRes.json();
        if (Array.isArray(aucData?.auctions)) {
          setAuctions(aucData.auctions);
        }
      }
      const [ppvRes, alertRes, ticketRes, adminNotifRes, paypalRes] = await Promise.all([
        fetch('/api/ppv', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/owner/task-alerts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/owner/support-tickets', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/owner/admin-notifications', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/paypal/config'),
      ]);
      if (ppvRes.ok) {
        const ppvData = await ppvRes.json();
        if (Array.isArray(ppvData?.posts)) {
          setPpvPosts(ppvData.posts);
        }
      }
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        if (alertData?.success) {
          setTaskAlertSummary({
            activeCount: Number(alertData.activeCount) || 0,
            totalCount: Number(alertData.totalCount) || 0,
            smtpConfigured: Boolean(alertData.smtpConfigured),
            recentDispatches: Array.isArray(alertData.recentDispatches) ? alertData.recentDispatches.slice(0, 8) : [],
          });
        }
      }
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        if (Array.isArray(ticketData?.tickets)) {
          setSupportTickets(ticketData.tickets);
        }
      }
      if (adminNotifRes.ok) {
        const notifData = await adminNotifRes.json();
        if (notifData?.success) {
          setAdminAlertsEnabled(notifData.enabled !== false);
          if (notifData.adminEmail) setAdminAlertEmail(String(notifData.adminEmail));
          if (notifData.highRewardThresholdKes) {
            setAdminHighRewardKes(String(notifData.highRewardThresholdKes));
          }
          if (notifData.events && typeof notifData.events === 'object') {
            setAdminEventToggles(notifData.events);
          }
          if (notifData.smtp) setAdminSmtpStatus(notifData.smtp);
          if (Array.isArray(notifData.logs)) setAdminAlertLogs(notifData.logs);
        }
      }
      if (paypalRes.ok) {
        const ppData = await paypalRes.json();
        if (ppData?.success) {
          setPaypalEnabled(ppData.enabled !== false);
          if (ppData.primaryEmail) setPaypalEmail(String(ppData.primaryEmail));
          if (ppData.payPalMeHandle !== undefined) setPaypalMeHandle(String(ppData.payPalMeHandle));
          setPaypalMode(ppData.mode === 'sandbox' ? 'sandbox' : 'live');
          setPaypalRestReady(Boolean(ppData.restApiConfigured));
          if (ppData.zapierWebhookUrl !== undefined) setZapierWebhookUrl(String(ppData.zapierWebhookUrl));
          if (ppData.inboundZapierWebhookUrl) setInboundZapierUrl(String(ppData.inboundZapierWebhookUrl));
          if (Array.isArray(ppData.generatedLinks)) {
            setPaypalGeneratedLinks(ppData.generatedLinks);
            if (!paypalLatestLink && ppData.generatedLinks.length > 0) {
              setPaypalLatestLink(ppData.generatedLinks[0]);
            }
          }
          if (Array.isArray(ppData.zapierLogs)) setZapierLogs(ppData.zapierLogs);
        }
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoadingData(false);
    }
  }, [isOwner, getFreshToken]);

  const handleSaveAdminNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getFreshToken();
    if (!token) return;
    setAdminAlertsSaving(true);
    setAdminAlertsFeedback(null);
    try {
      const res = await fetch('/api/owner/admin-notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adminEmail: adminAlertEmail.trim(),
          enabled: adminAlertsEnabled,
          highRewardThresholdKes: Number(adminHighRewardKes) || 40,
          events: adminEventToggles,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setAdminAlertsFeedback(data?.error || 'Could not update admin notification settings.');
        return;
      }
      if (data.smtp) setAdminSmtpStatus(data.smtp);
      if (Array.isArray(data.logs)) setAdminAlertLogs(data.logs);
      setAdminAlertsFeedback(
        `Saved! Real-time platform alerts will route to ${data.adminEmail} (threshold KES ${data.highRewardThresholdKes}).`
      );
    } catch (err: any) {
      setAdminAlertsFeedback(err?.message || 'Network error saving admin notifications.');
    } finally {
      setAdminAlertsSaving(false);
    }
  };

  const handleSendTestAdminEmail = async () => {
    const token = await getFreshToken();
    if (!token) return;
    setAdminAlertsTesting(true);
    setAdminAlertsFeedback(null);
    try {
      const res = await fetch('/api/owner/admin-notifications/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (Array.isArray(data?.logs)) setAdminAlertLogs(data.logs);
      if (data?.smtp) setAdminSmtpStatus(data.smtp);
      const statusLabel = data?.dispatch?.deliveryStatus || (data?.success ? 'Sent' : 'Queued');
      setAdminAlertsFeedback(
        `${statusLabel}: ${data?.dispatch?.deliveryNote || data?.error || 'Admin test trigger completed.'}`
      );
    } catch (err: any) {
      setAdminAlertsFeedback(err?.message || 'Failed to send test admin email.');
    } finally {
      setAdminAlertsTesting(false);
    }
  };

  const handleCopyPayPalValue = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPayPalField(key);
      setTimeout(() => setCopiedPayPalField((prev) => (prev === key ? null : prev)), 2000);
    } catch {}
  };

  const handleSavePayPalZapier = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getFreshToken();
    if (!token) return;
    setPaypalSaving(true);
    setPaypalFeedback(null);
    try {
      const res = await fetch('/api/paypal/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: paypalEnabled,
          primaryEmail: paypalEmail.trim(),
          payPalMeHandle: paypalMeHandle.trim(),
          mode: paypalMode,
          zapierWebhookUrl: zapierWebhookUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setPaypalFeedback(data?.error || 'Could not save PayPal & Zapier configuration.');
        return;
      }
      if (Array.isArray(data.generatedLinks)) setPaypalGeneratedLinks(data.generatedLinks);
      if (Array.isArray(data.zapierLogs)) setZapierLogs(data.zapierLogs);
      setPaypalFeedback('Saved! PayPal International Checkout & Zapier workflow settings updated.');
    } catch (err: any) {
      setPaypalFeedback(err?.message || 'Network error saving PayPal & Zapier config.');
    } finally {
      setPaypalSaving(false);
    }
  };

  const handleGeneratePayPalButtonLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getFreshToken();
    setPaypalGenerating(true);
    setPaypalFeedback(null);
    try {
      const res = await fetch('/api/paypal/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          itemName: paypalGenItemName.trim() || 'Gideon Global Tasks Order',
          amountUsd: Number(paypalGenAmountUsd) || 1.54,
          packageId: paypalGenPackageId.trim() || 'custom',
          returnUrl: CANONICAL_PLATFORM_ORIGIN,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.link) {
        setPaypalFeedback(data?.error || 'Could not generate PayPal checkout button/link.');
        return;
      }
      setPaypalLatestLink(data.link);
      setPaypalGeneratedLinks((prev) => [data.link, ...prev.filter((l) => l.id !== data.link.id)].slice(0, 20));
      setPaypalFeedback(`Generated PayPal Checkout Link & HTML Button for $${Number(data.link.amountUsd).toFixed(2)} USD!`);
    } catch (err: any) {
      setPaypalFeedback(err?.message || 'Failed to generate PayPal link.');
    } finally {
      setPaypalGenerating(false);
    }
  };

  const handleTestZapierWorkflow = async () => {
    const token = await getFreshToken();
    if (!token) return;
    setPaypalTestingZapier(true);
    setPaypalFeedback(null);
    try {
      const res = await fetch('/api/paypal/zapier-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.status?.zapierLogs) {
        setZapierLogs(data.status.zapierLogs);
      }
      setPaypalFeedback(data?.log?.detail || data?.error || 'Zapier workflow test triggered.');
    } catch (err: any) {
      setPaypalFeedback(err?.message || 'Network error testing Zapier webhook.');
    } finally {
      setPaypalTestingZapier(false);
    }
  };

  const handleSaveSmsGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSmsSaving(true);
    setSmsFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/owner/sms-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          provider: smsProvider,
          atUsername,
          ...(atApiKey.trim() ? { atApiKey: atApiKey.trim() } : {}),
          atSenderId,
          textsmsPartnerId,
          ...(textsmsApiKey.trim() ? { textsmsApiKey: textsmsApiKey.trim() } : {}),
          textsmsShortcode,
          twilioAccountSid,
          ...(twilioAuthToken.trim() ? { twilioAuthToken: twilioAuthToken.trim() } : {}),
          twilioFromNumber,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        applySmsStatusPayload(data);
        setAtApiKey('');
        setTextsmsApiKey('');
        setTwilioAuthToken('');
        setSmsFeedback(
          data.liveCarrierReady
            ? `SMS OTP Gateway saved & LIVE (${data.activeProvider}).`
            : 'SMS settings saved. Note: Live carrier SMS requires non-sandbox production credentials.'
        );
      } else {
        setErrorMsg(data?.error || 'Failed to save SMS gateway settings.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error saving SMS gateway.');
    } finally {
      setSmsSaving(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!idToken) return;
    setSmsTesting(true);
    setSmsFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/owner/sms-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ phone: smsTestPhone }),
      });
      const data = await res.json();
      if (data?.status) applySmsStatusPayload(data.status);
      if (data?.carrierDelivered) {
        setSmsFeedback(`Live test SMS sent to ${data.phone} via ${data.providerLabel} (Ref: ${data.carrierMessageId}).`);
      } else {
        setErrorMsg(data?.fallbackReason || data?.error || 'Live SMS could not reach handset.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to run live SMS test.');
    } finally {
      setSmsTesting(false);
    }
  };

  useEffect(() => {
    void loadOwnerConsoleData();
  }, [loadOwnerConsoleData]);

  const handleApproveWithdrawal = async (item: OwnerWithdrawalItem) => {
    if (!idToken) return;
    setProcessingId(item.id);
    setWithdrawalFeedback(null);
    setErrorMsg(null);
    try {
      const customReceipt = (receiptInputs[item.id] || '').trim();
      const res = await fetch(`/api/owner/withdrawals/${encodeURIComponent(item.id)}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          gatewayMode: customReceipt ? 'manual' : gatewayMode,
          ...(customReceipt ? { receiptCode: customReceipt } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data?.withdrawal) {
        setWithdrawals((prev) => prev.map((w) => (w.id === item.id ? data.withdrawal : w)));
        const channelText = data?.transfer?.disbursementChannel || item.method;
        setWithdrawalFeedback(
          `Disbursed ${formatCurrencyFromUsd(item.amountUsd, getCountryByCode(item.countryCode))} (${item.id}) to ${item.accountDetails} via ${channelText}. Ref: ${data.withdrawal.mpesaReceipt || 'Settled'}`
        );
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Failed to execute outbound withdrawal.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error approving withdrawal.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async (item: OwnerWithdrawalItem) => {
    if (!idToken) return;
    setProcessingId(item.id);
    setWithdrawalFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/withdrawals/${encodeURIComponent(item.id)}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reason: 'Declined by Platform Owner during verification review.',
        }),
      });
      const data = await res.json();
      if (res.ok && data?.withdrawal) {
        setWithdrawals((prev) => prev.map((w) => (w.id === item.id ? data.withdrawal : w)));
        setWithdrawalFeedback(
          `Rejected withdrawal ${item.id} (${formatCurrencyFromUsd(item.amountUsd, getCountryByCode(item.countryCode))}). Funds returned to customer wallet balance.`
        );
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Failed to reject withdrawal.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error rejecting withdrawal.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnlockCustomerPayout = async (cust: SavedCustomerItem) => {
    if (!idToken) return;
    setUnlockingUid(cust.uid);
    setCustomerFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/customers/${encodeURIComponent(cust.uid)}/unlock-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data?.customer) {
        setCustomers((prev) =>
          prev.map((item) => (item.uid === cust.uid ? data.customer : item))
        );
        setLockedPayoutCount((prev) => Math.max(0, prev - 1));
        setCustomerFeedback(
          `Unlocked withdrawal details for ${cust.displayName} (${cust.phone || cust.email || cust.uid}). They can set a new payout destination once in My Account.`
        );
      } else {
        setErrorMsg(data?.error || 'Failed to unlock customer payout details.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error unlocking payout details.');
    } finally {
      setUnlockingUid(null);
    }
  };

  const handleBanCustomer = async (cust: SavedCustomerItem) => {
    if (!idToken) return;
    setBanningUid(cust.uid);
    setCustomerFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/customers/${encodeURIComponent(cust.uid)}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reason:
            'Permanently banned forever by Platform Owner for violating platform KYC or compliance rules.',
        }),
      });
      const data = await res.json();
      if (res.ok && data?.customer) {
        setCustomers((prev) =>
          prev.map((item) => (item.uid === cust.uid ? data.customer : item))
        );
        setCustomerFeedback(
          `Permanently banned ${cust.displayName} (${cust.phone || cust.email || cust.uid}) 🚫 forever — no second chance.`
        );
      } else {
        setErrorMsg(data?.error || 'Could not permanently ban customer.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error banning customer.');
    } finally {
      setBanningUid(null);
    }
  };

  const handleUnbanCustomer = async (cust: SavedCustomerItem) => {
    if (!idToken) return;
    setUnbanningUid(cust.uid);
    setCustomerFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/customers/${encodeURIComponent(cust.uid)}/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (data.customer) {
          setCustomers((prev) =>
            prev.map((item) => (item.uid === cust.uid ? data.customer : item))
          );
        }
        setCustomerFeedback(
          `Recovered & unbanned ${cust.displayName} (${cust.phone || cust.email || cust.uid}). Account access is restored.`
        );
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Could not unban customer account.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error unbanning customer.');
    } finally {
      setUnbanningUid(null);
    }
  };

  const handleUnbanPhone = async (rawPhone?: string) => {
    if (!idToken) return;
    const phoneToRecover = (rawPhone ?? unbanPhoneInput).trim();
    if (!phoneToRecover) {
      setErrorMsg('Enter a phone number to unban (e.g. 0712727558).');
      return;
    }
    setUnbanningPhone(true);
    setCustomerFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/owner/unban-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ phone: phoneToRecover, countryCode: 'KE' }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setCustomerFeedback(
          `Unbanned phone ${data.normalizedPhone || phoneToRecover} (cleared ${data.clearedKeys?.length || 0} ban key(s) & ${data.proofsCleared || 0} proof record(s)).`
        );
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Could not unban phone number.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error unbanning phone number.');
    } finally {
      setUnbanningPhone(false);
    }
  };

  const handleApproveKyc = async (kyc: OwnerKycItem) => {
    if (!idToken) return;
    setProcessingKycUid(kyc.uid);
    setKycFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/kyc/${encodeURIComponent(kyc.uid)}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data?.submission) {
        setKycSubmissions((prev) => prev.map((k) => (k.uid === kyc.uid ? data.submission : k)));
        setKycFeedback(
          `Approved ${kyc.idDocumentName} KYC for ${kyc.fullNameOnId} (${kyc.idNumber}). Customer PayPal withdrawals are now unlocked.`
        );
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Failed to approve KYC submission.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error approving KYC verification.');
    } finally {
      setProcessingKycUid(null);
    }
  };

  const handleRejectKyc = async (kyc: OwnerKycItem) => {
    if (!idToken) return;
    setProcessingKycUid(kyc.uid);
    setKycFeedback(null);
    setErrorMsg(null);
    try {
      const customReason = (kycNoteInputs[kyc.uid] || '').trim();
      const res = await fetch(`/api/owner/kyc/${encodeURIComponent(kyc.uid)}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reason:
            customReason ||
            'Front & Back National ID images were blurry, cropped, or did not match your legal name/ID number. Please upload clear photos of both sides.',
        }),
      });
      const data = await res.json();
      if (res.ok && data?.submission) {
        setKycSubmissions((prev) => prev.map((k) => (k.uid === kyc.uid ? data.submission : k)));
        setKycFeedback(`Rejected KYC for ${kyc.customerName}. Customer notified to re-upload clear Front & Back ID photos.`);
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Failed to reject KYC submission.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error rejecting KYC submission.');
    } finally {
      setProcessingKycUid(null);
    }
  };

  // --- Full Owner Customer Admin Handlers (Edit / Deactivate / Reactivate / Delete) ---
  const openEditCustomer = (cust: SavedCustomerItem) => {
    const summaryRow = stateSummaryByUid[cust.uid];
    const custCountry = getCountryByCode(cust.countryCode);
    setEditingCustomerUid(cust.uid);
    setConfirmDeleteCustomerUid(null);
    setCustomerEditDraft({
      displayName: cust.displayName || '',
      phone: cust.phone || '',
      email: cust.email || '',
      countryCode: cust.countryCode || 'KE',
      city: cust.city || '',
      bio: cust.bio || '',
      withdrawalMethod: 'PayPal',
      withdrawalAccountDetails: cust.withdrawalDetails?.accountDetails || '',
      withdrawalAccountHolderName: cust.withdrawalDetails?.accountHolderName || cust.displayName || '',
      phoneLocked: cust.phoneLocked ?? Boolean(cust.phone),
      accountDetailsLocked: Boolean(cust.accountDetailsLocked),
      withdrawalLocked: cust.withdrawalDetails?.locked ?? false,
      phoneVerified: cust.phoneVerified ?? false,
      resetTwoFactor: false,
      vipReferralCount: String(summaryRow?.vipReferralCount ?? 0),
      balanceLocal: String(convertUsdToLocal(summaryRow?.balanceUsd ?? 0, custCountry)),
    });
  };

  const handleSaveCustomerEdit = async (uid: string) => {
    const token = await getFreshToken();
    if (!token) return;
    setSavingCustomerEdit(true);
    setCustomerFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/customers/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: customerEditDraft.displayName,
          phone: customerEditDraft.phone,
          email: customerEditDraft.email,
          countryCode: customerEditDraft.countryCode,
          city: customerEditDraft.city,
          bio: customerEditDraft.bio,
          withdrawalMethod: 'PayPal',
          withdrawalAccount: customerEditDraft.withdrawalAccountDetails,
          withdrawalAccountDetails: customerEditDraft.withdrawalAccountDetails,
          withdrawalAccountHolder: customerEditDraft.withdrawalAccountHolderName,
          withdrawalAccountHolderName: customerEditDraft.withdrawalAccountHolderName,
          phoneLocked: customerEditDraft.phoneLocked,
          accountDetailsLocked: customerEditDraft.accountDetailsLocked,
          withdrawalLocked: customerEditDraft.withdrawalLocked,
          phoneVerified: customerEditDraft.phoneVerified,
          resetTwoFactor: customerEditDraft.resetTwoFactor,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.customer) {
        const custCountry = getCountryByCode(customerEditDraft.countryCode || 'KE');
        const desiredBalanceUsd = localAmountToUsd(Math.max(0, Number(customerEditDraft.balanceLocal) || 0), custCountry);
        const desiredVipCount = Math.max(0, Math.floor(Number(customerEditDraft.vipReferralCount) || 0));
        const stateRes = await fetch(`/api/owner/customers/${encodeURIComponent(uid)}/state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            setBalanceUsd: desiredBalanceUsd,
            setVipReferralCount: desiredVipCount,
          }),
        });
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (stateData?.state) {
            setStateSummaryByUid((prev) => ({
              ...prev,
              [uid]: {
                balanceUsd: stateData.state.userStats?.balance ?? desiredBalanceUsd,
                lifetimeEarnedUsd: stateData.state.userStats?.lifetimeEarned ?? desiredBalanceUsd,
                completedTasksCount: stateData.state.userStats?.completedTasksCount ?? (prev[uid]?.completedTasksCount || 0),
                vipReferralCount: stateData.state.vipReferralCount ?? desiredVipCount,
                referredByCode: stateData.state.referredByCode,
                activePackageId: stateData.state.activePackageId ?? null,
              },
            }));
          }
        }
        setCustomers((prev) => prev.map((c) => (c.uid === uid ? data.customer : c)));
        setEditingCustomerUid(null);
        setCustomerFeedback(`Updated full profile, persisted balance & pass settings for ${data.customer.displayName}.`);
        if (uid === user?.uid || uid === customerProfile?.uid) {
          await refreshCustomerProfile(token);
        }
      } else {
        setErrorMsg(data?.error || 'Could not save customer changes.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error updating customer.');
    } finally {
      setSavingCustomerEdit(false);
    }
  };

  const handleToggleDeactivateCustomer = async (cust: SavedCustomerItem) => {
    if (!idToken) return;
    setDeactivatingUid(cust.uid);
    setCustomerFeedback(null);
    setErrorMsg(null);
    const endpoint = cust.deactivated ? 'reactivate' : 'deactivate';
    try {
      const res = await fetch(`/api/owner/customers/${encodeURIComponent(cust.uid)}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(
          cust.deactivated
            ? {}
            : { reason: 'Temporarily deactivated by Platform Owner. Contact Support (+254712727558).' }
        ),
      });
      const data = await res.json();
      if (res.ok && data?.customer) {
        setCustomers((prev) => prev.map((c) => (c.uid === cust.uid ? data.customer : c)));
        setCustomerFeedback(
          cust.deactivated
            ? `Reactivated customer ${cust.displayName} (${cust.phone || cust.uid}).`
            : `Deactivated customer ${cust.displayName} (${cust.phone || cust.uid}).`
        );
      } else {
        setErrorMsg(data?.error || `Could not ${endpoint} customer.`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || `Network error calling ${endpoint}.`);
    } finally {
      setDeactivatingUid(null);
    }
  };

  const handleDeleteCustomerPermanently = async (cust: SavedCustomerItem) => {
    if (!idToken) return;
    setDeletingCustomerUid(cust.uid);
    setCustomerFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/customers/${encodeURIComponent(cust.uid)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setCustomers((prev) => prev.filter((c) => c.uid !== cust.uid));
        setConfirmDeleteCustomerUid(null);
        setCustomerFeedback(`Permanently deleted customer ${cust.displayName} (${cust.phone || cust.uid}).`);
      } else {
        setErrorMsg(data?.error || 'Could not delete customer permanently.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error deleting customer.');
    } finally {
      setDeletingCustomerUid(null);
    }
  };

  // --- Owner Investments Handlers ---
  const handleInvestmentAction = async (
    inv: OwnerInvestmentItem,
    action: 'approve' | 'reject' | 'settle'
  ) => {
    if (!idToken) return;
    setProcessingInvId(inv.id);
    setInvFeedback(null);
    setErrorMsg(null);
    const note = (invNoteInputs[inv.id] || '').trim();
    try {
      const res = await fetch(`/api/owner/investments/${encodeURIComponent(inv.id)}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(
          action === 'approve'
            ? { ...(note ? { ownerNotes: note } : {}) }
            : action === 'reject'
            ? { reason: note || 'Deposit could not be confirmed.' }
            : { ...(note ? { payoutReceipt: note } : {}) }
        ),
      });
      const data = await res.json();
      if (res.ok && data?.investment) {
        setInvestments((prev) => prev.map((i) => (i.id === inv.id ? data.investment : i)));
        setInvFeedback(`Investment ${inv.id} updated to "${data.investment.status}".`);
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || `Failed to ${action} investment.`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || `Network error on investment ${action}.`);
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleSaveInvestmentEdit = async (id: string) => {
    if (!idToken) return;
    setProcessingInvId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/investments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amountKes: Number(editInvDraft.amountKes) || 50,
          returnPct: Number(editInvDraft.returnPct) || 0,
          status: editInvDraft.status,
          ownerNotes: editInvDraft.ownerNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.investment) {
        setInvestments((prev) => prev.map((i) => (i.id === id ? data.investment : i)));
        setEditingInvId(null);
        setInvFeedback(`Saved edits on investment ${id}.`);
      } else {
        setErrorMsg(data?.error || 'Could not update investment.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error editing investment.');
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!idToken) return;
    setProcessingInvId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/investments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        setInvestments((prev) => prev.filter((i) => i.id !== id));
        setConfirmDeleteInvId(null);
        setInvFeedback(`Deleted investment record ${id}.`);
      } else {
        const data = await res.json();
        setErrorMsg(data?.error || 'Could not delete investment.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error deleting investment.');
    } finally {
      setProcessingInvId(null);
    }
  };

  // --- Owner Testimonials Handlers ---
  const handleUpdateTestimonial = async (
    id: string,
    patch: Partial<Pick<OwnerTestimonialItem, 'status' | 'ownerReply' | 'headline' | 'message' | 'rating'>>
  ) => {
    if (!idToken) return;
    setProcessingTestiId(id);
    setTestiFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/testimonials/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok && data?.testimonial) {
        setTestimonials((prev) => prev.map((t) => (t.id === id ? data.testimonial : t)));
        setEditingTestiId(null);
        setTestiFeedback(`Updated testimonial ${id}.`);
      } else {
        setErrorMsg(data?.error || 'Could not update testimonial.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating testimonial.');
    } finally {
      setProcessingTestiId(null);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!idToken) return;
    setProcessingTestiId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/testimonials/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        setTestimonials((prev) => prev.filter((t) => t.id !== id));
        setConfirmDeleteTestiId(null);
        setTestiFeedback(`Permanently deleted testimonial ${id}.`);
      } else {
        const data = await res.json();
        setErrorMsg(data?.error || 'Could not delete testimonial.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error deleting testimonial.');
    } finally {
      setProcessingTestiId(null);
    }
  };

  // --- Owner Auctions Moderation & Management ---
  const handleOwnerUpdateAuction = async (id: string, patch: Record<string, any>) => {
    const token = await getFreshToken();
    if (!token) return;
    setProcessingAuctionId(id);
    setAuctionFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/auctions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok && data?.auction) {
        setAuctions((prev) => prev.map((a) => (a.id === id ? data.auction : a)));
        setEditingAuctionId(null);
        setAuctionFeedback(`Updated product auction "${data.auction.title}" (${data.auction.status}).`);
        if (auth.currentUser?.emailVerified) {
          setDoc(doc(db, 'auctions', id), JSON.parse(JSON.stringify(data.auction)), { merge: true }).catch(() => {});
        }
      } else {
        setErrorMsg(data?.error || 'Could not update product auction.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error updating auction.');
    } finally {
      setProcessingAuctionId(null);
    }
  };

  const handleOwnerCloseAuction = async (id: string, action: 'accept_highest' | 'cancel') => {
    const token = await getFreshToken();
    if (!token) return;
    setProcessingAuctionId(id);
    setAuctionFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/auctions/${encodeURIComponent(id)}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data?.auction) {
        setAuctions((prev) => prev.map((a) => (a.id === id ? data.auction : a)));
        setAuctionFeedback(`Auction ${id} marked as ${data.auction.status}.`);
        if (auth.currentUser?.emailVerified) {
          setDoc(doc(db, 'auctions', id), JSON.parse(JSON.stringify(data.auction)), { merge: true }).catch(() => {});
        }
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Could not close auction.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error closing auction.');
    } finally {
      setProcessingAuctionId(null);
    }
  };

  const handleOwnerDeleteAuction = async (id: string) => {
    const token = await getFreshToken();
    if (!token) return;
    setProcessingAuctionId(id);
    setAuctionFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/auctions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAuctions((prev) => prev.filter((a) => a.id !== id));
        setConfirmDeleteAuctionId(null);
        setAuctionFeedback(`Permanently deleted auction ${id}.`);
        if (auth.currentUser?.emailVerified) {
          deleteDoc(doc(db, 'auctions', id)).catch(() => {});
        }
      } else {
        const data = await res.json();
        setErrorMsg(data?.error || 'Could not delete auction.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error deleting auction.');
    } finally {
      setProcessingAuctionId(null);
    }
  };

  const handleOwnerSettlePpvNow = async (postId: string) => {
    const token = await getFreshToken();
    if (!token) return;
    setProcessingPpvId(postId);
    setPpvFeedback(null);
    try {
      const res = await fetch(`/api/owner/ppv/posts/${encodeURIComponent(postId)}/settle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (Array.isArray(data.posts)) setPpvPosts(data.posts);
        if (auth.currentUser?.emailVerified && data.post && !data.post.isSeeded) {
          setDoc(doc(db, 'ppv_posts', postId), JSON.parse(JSON.stringify(data.post)), { merge: true }).catch(() => {});
        }
        setPpvFeedback(`Status ${postId} settled immediately & creator wallet credited (${data.post?.paidOutKes || 0} KSh).`);
      } else {
        setErrorMsg(data?.error || 'Could not settle Pay-Per-View post.');
      }
    } finally {
      setProcessingPpvId(null);
    }
  };

  const handleOwnerDeletePpvPost = async (postId: string) => {
    const token = await getFreshToken();
    if (!token) return;
    setProcessingPpvId(postId);
    setPpvFeedback(null);
    try {
      const res = await fetch(`/api/owner/ppv/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (Array.isArray(data.posts)) setPpvPosts(data.posts);
        if (auth.currentUser?.emailVerified) {
          deleteDoc(doc(db, 'ppv_posts', postId)).catch(() => {});
        }
        setPpvFeedback(`Deleted status ${postId}.`);
      }
    } finally {
      setProcessingPpvId(null);
    }
  };

  const numRewardLocal = parseFloat(reward) || 0;
  const rawRewardUsd = localAmountToUsd(numRewardLocal, selectedCountry);
  const numReward = Math.max(0.05, rawRewardUsd);
  const numSpots = parseInt(totalSpots, 10) || 0;
  const totalCampaignBudgetFormatted = formatCurrencyFromUsd(numReward * numSpots, selectedCountry);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please specify a descriptive task title.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Please provide a brief summary of what the task involves.');
      return;
    }

    if (numRewardLocal < convertKesToLocal(10, selectedCountry)) {
      setErrorMsg(`Minimum merchant reward per task is ${formatCurrencyFromKes(10, selectedCountry)}.`);
      return;
    }

    if (numSpots < 5) {
      setErrorMsg('Minimum worker quota is 5 spots.');
      return;
    }

    const instructions = instructionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (category === 'creator-campaign') {
      if (!campaignProductName.trim()) {
        setErrorMsg('Specify the exact brand product name for Creator Product Campaigns.');
        return;
      }
      if (campaignPlatforms.length === 0) {
        setErrorMsg('Select at least one social channel (Facebook, Instagram, TikTok, or WhatsApp).');
        return;
      }
      if (campaignFormats.length === 0) {
        setErrorMsg('Select at least one content format (Reel, Video, or Text Post).');
        return;
      }
    }

    const hashtagsList = campaignHashtags
      .split(/[\s,]+/)
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => (h.startsWith('#') ? h : `#${h}`));

    const created = {
      title: title.trim(),
      category,
      description: description.trim(),
      reward: numReward,
      estimatedMinutes: parseInt(estimatedMinutes, 10) || 3,
      difficulty,
      totalSpots: numSpots,
      requesterName: category === 'creator-campaign' ? `${campaignProductName.trim()} Brand Team` : 'You (Gideon Requester)',
      requesterRating: 5.0,
      requesterVerified: true,
      tags:
        category === 'creator-campaign'
          ? [...campaignPlatforms, ...campaignFormats.map((f) => f.replace('-', ' '))]
          : [category.toUpperCase(), 'Verified Bounty'],
      instructions,
      ...(category === 'creator-campaign'
        ? {
            creatorCampaignConfig: {
              productName: campaignProductName.trim(),
              productCategory: 'Featured Brand Product',
              allowedPlatforms: campaignPlatforms,
              allowedFormats: campaignFormats,
              campaignBrief: description.trim(),
              talkingPoints: instructions.length > 0 ? instructions : ['Highlight product features accurately'],
              requiredHashtags: hashtagsList.length > 0 ? hashtagsList : ['#GideonCreatorEA'],
              minWordCount: 25,
            },
          }
        : {}),
    };

    postTask(created);
    setSuccessMsg(`Task "${title}" created and posted to the marketplace!`);
    setTitle('');
    setDescription('');
    setCampaignProductName('');
    setIsCreating(false);
    setConsoleTab('tasks');
  };

  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'Processing').length;
  const pendingKycCount = kycSubmissions.filter((k) => k.status === 'Pending').length;
  const pendingWithdrawalsUsd = withdrawals
    .filter((w) => w.status === 'Processing')
    .reduce((acc, w) => acc + w.amountUsd, 0);
  const approvedWithdrawalsUsd = withdrawals
    .filter((w) => w.status === 'Completed')
    .reduce((acc, w) => acc + w.amountUsd, 0);

  const filteredWithdrawals = useMemo(() => {
    if (withdrawalFilter === 'all') return withdrawals;
    return withdrawals.filter((w) => w.status === withdrawalFilter);
  }, [withdrawals, withdrawalFilter]);

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (txKindFilter !== 'all' && tx.kind !== txKindFilter) return false;
      if (!q) return true;
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        tx.title.toLowerCase().includes(q) ||
        tx.customerLabel.toLowerCase().includes(q) ||
        tx.gatewayOrMethod.toLowerCase().includes(q)
      );
    });
  }, [transactions, txKindFilter, txSearch]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      if (taskCategoryFilter !== 'all' && t.category !== taskCategoryFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.requesterName.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [tasks, taskCategoryFilter, taskSearch]);

  const customerByUid = useMemo(() => {
    const map = new Map<string, SavedCustomerItem>();
    for (const c of customers) {
      map.set(c.uid, c);
    }
    return map;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.displayName.toLowerCase().includes(q) ||
      (c.uid || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.countryCode || '').toLowerCase().includes(q) ||
      (c.withdrawalDetails?.method || '').toLowerCase().includes(q) ||
      (c.withdrawalDetails?.accountDetails || '').toLowerCase().includes(q) ||
      (c.withdrawalDetails?.accountHolderName || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const serverTaskCompletions = useMemo(
    () => transactions.filter((t) => t.kind === 'task_reward'),
    [transactions]
  );

  const kindLabel = (kind: TransactionKind) => {
    switch (kind) {
      case 'withdrawal':
        return 'Withdrawal';
      case 'paypal_checkout':
        return 'PayPal Checkout';
      case 'task_reward':
        return 'Task Reward';
      case 'referral_commission':
        return 'Referral 20%';
      case 'investment_deposit':
        return 'Investment Deposit';
      case 'auction_sale':
        return 'Auction Sale';
      case 'ppv_payout':
        return 'Pay-Per-View Payout';
      default:
        return kind;
    }
  };

  if (!isOwner) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-lg text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">
            Owner Authorization Required
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Only the verified platform owner (<strong className="font-mono text-slate-900">{OWNER_EMAIL}</strong>) has authority to access the Owner Portal, approve customer withdrawals, track transactions, or configure payment gateways.
          </p>
          {user && (
            <p className="text-[11px] text-rose-700 font-mono bg-rose-50 px-3 py-1.5 rounded-lg inline-block">
              Signed in as: {user.email} (Customer Account)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {!user && (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Sign In as Owner ({OWNER_EMAIL})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Go to Tasks Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-7 bg-white rounded-3xl border border-slate-200 shadow-sm my-4">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Owner &amp; Administrator Console ({OWNER_EMAIL})</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Platform, Payouts &amp; Transactions Console
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Approve PayPal withdrawals (150+ KSh after strict KYC), verify Front &amp; Back National ID submissions, audit PayPal &amp; Zapier flows, and set merchant task rewards across East Africa.
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-800">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>East Africa Access Lock Active · Owner Authority Verified</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => void loadOwnerConsoleData()}
            disabled={loadingData}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            type="button"
            onClick={() => setConsoleTab('brand-kit')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-blue-700" />
            <span>FB Brand Kit</span>
          </button>

          <button
            type="button"
            onClick={() => setPublisherModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4 text-blue-600" />
            <span>Monetag &amp; AdSense</span>
          </button>

          <button
            type="button"
            onClick={() => setConsoleTab('paypal-zapier')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4 text-sky-700" />
            <span>PayPal &amp; Zapier</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isCreating ? 'Close Form' : 'Post a New Task'}</span>
          </button>
        </div>
      </div>

      {/* Live Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setConsoleTab('withdrawals')}
          className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
            <span>Pending Withdrawals</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {formatCurrencyFromUsd(pendingWithdrawalsUsd, selectedCountry)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-amber-900">
            {pendingWithdrawalsCount} awaiting your approval
          </div>
        </div>

        <div
          onClick={() => setConsoleTab('withdrawals')}
          className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 cursor-pointer hover:border-emerald-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
            <span>Approved Payouts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {formatCurrencyFromUsd(approvedWithdrawalsUsd, selectedCountry)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-900">
            {withdrawals.filter((w) => w.status === 'Completed').length} customer payouts settled
          </div>
        </div>

        <div
          onClick={() => setConsoleTab('transactions')}
          className="p-4 rounded-2xl border border-blue-200 bg-blue-50/70 cursor-pointer hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
            <span>PayPal Gateway Volume</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {formatCurrencyFromUsd(summary.paypalVolumeUsd, selectedCountry)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-blue-900">
            {summary.totalTransactions} total platform transactions
          </div>
        </div>

        <div
          onClick={() => setConsoleTab('tasks')}
          className="p-4 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Active Tasks &amp; Rewards</span>
            <ListChecks className="w-4 h-4 text-blue-700" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {tasks.length} Tasks
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-600">
            {formatCurrencyFromUsd(summary.taskRewardsUsd, selectedCountry)} logged rewards · {taskHistory.length} local logs
          </div>
        </div>
      </div>

      {/* Feedback & Errors */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="text-emerald-900 font-bold hover:underline cursor-pointer"
          >
            View in Marketplace →
          </button>
        </div>
      )}

      {withdrawalFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{withdrawalFeedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Creation Form Section */}
      {isCreating && (
        <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Configure New Crowdsourced Task
              </h2>
              <p className="text-xs text-slate-600">
                Define the requirements and budget for East Africa contributors.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-300">
              Total Campaign Budget: {totalCampaignBudgetFormatted}
            </div>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Categorize 20 E-Commerce Customer Inquiries"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 outline-hidden font-medium bg-white text-slate-900"
                >
                  <option value="creator-campaign">Creator Product Campaign (FB, IG, TikTok, WA)</option>
                  <option value="survey">Survey (Market Research)</option>
                  <option value="annotation">Data Annotation (AI Training)</option>
                  <option value="data-entry">Data Entry &amp; Extraction</option>
                  <option value="writing">Writing &amp; Copywriting</option>
                  <option value="meme-content">Meme &amp; Content Creation</option>
                  <option value="micro">Fast Micro Tasks (30s)</option>
                </select>
              </div>
            </div>

            {category === 'creator-campaign' && (
              <div className="p-4 rounded-xl bg-white border border-blue-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Campaign Product Name (Product-Only Rule):
                    </label>
                    <input
                      type="text"
                      value={campaignProductName}
                      onChange={(e) => setCampaignProductName(e.target.value)}
                      placeholder="e.g., SunKing Solar Home Hub Pro"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mandatory Product Hashtags:
                    </label>
                    <input
                      type="text"
                      value={campaignHashtags}
                      onChange={(e) => setCampaignHashtags(e.target.value)}
                      placeholder="#BrandProduct #GideonCreatorEA"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono text-slate-900 focus:border-blue-600 outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Allowed Social Platforms (Strictly FB, IG, TikTok &amp; WhatsApp):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['Facebook', 'Instagram', 'TikTok', 'WhatsApp'] as CampaignPlatform[]).map((p) => {
                        const checked = campaignPlatforms.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() =>
                              setCampaignPlatforms((prev) =>
                                prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                              checked
                                ? 'bg-blue-700 border-blue-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-700'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Allowed Content Formats:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'reel', label: 'Reels' },
                          { id: 'video', label: 'Videos' },
                          { id: 'text-post', label: 'Text Posts' },
                        ] as { id: CampaignContentFormat; label: string }[]
                      ).map((fmt) => {
                        const checked = campaignFormats.includes(fmt.id);
                        return (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() =>
                              setCampaignFormats((prev) =>
                                prev.includes(fmt.id) ? prev.filter((item) => item !== fmt.id) : [...prev, fmt.id]
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                              checked
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-700'
                            }`}
                          >
                            {fmt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Description:
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the goal and what the worker will produce..."
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merchant Task Reward ({selectedCountry.symbol})
                </label>
                <input
                  type="number"
                  step="1"
                  min={convertKesToLocal(10, selectedCountry)}
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-semibold focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Worker Quota
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={totalSpots}
                  onChange={(e) => setTotalSpots(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as TaskDifficulty)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 outline-hidden bg-white text-slate-900"
                >
                  <option value="Beginner">Beginner (Anyone)</option>
                  <option value="Intermediate">Intermediate (Verified)</option>
                  <option value="Expert">Expert (Gold/Diamond Tier)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Step-by-Step Instructions (One per line):
              </label>
              <textarea
                rows={3}
                value={instructionsText}
                onChange={(e) => setInstructionsText(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:border-blue-600 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-blue-200" />
                <span>Deploy Campaign to East Africa Network</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Prominent Console Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setConsoleTab('withdrawals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'withdrawals'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Withdrawal Approvals</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'withdrawals'
                ? 'bg-white/20 text-white'
                : pendingWithdrawalsCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {pendingWithdrawalsCount} Pending
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('kyc')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'kyc'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>National ID KYC (Front &amp; Back)</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'kyc'
                ? 'bg-white/20 text-white'
                : pendingKycCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {pendingKycCount} Pending
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'transactions'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>All Transactions</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'transactions'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {transactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'tasks'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>All Tasks &amp; Submissions</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'tasks'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {tasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'customers'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Saved Customers</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'customers'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {customers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('investments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'investments'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Investments (KES 50+)</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'investments'
                ? 'bg-white/20 text-white'
                : investments.filter((i) => i.status === 'Pending Owner Approval').length > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {investments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('auctions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'auctions'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Gavel className="w-4 h-4" />
          <span>Auctions</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'auctions'
                ? 'bg-white/20 text-white'
                : auctions.filter((a) => a.status === 'Live').length > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {auctions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('ppv')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'ppv'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Pay-Per-View</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'ppv'
                ? 'bg-white/20 text-white'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            {ppvPosts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('testimonials')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'testimonials'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <MessageSquareHeart className="w-4 h-4" />
          <span>Testimonials</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'testimonials'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {testimonials.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('support')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'support'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Support Inbox</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'support'
                ? 'bg-white/20 text-white'
                : supportTickets.some((t) => t.status === 'Open')
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {supportTickets.filter((t) => t.status === 'Open').length} Open
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('sms')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'sms'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>SMS OTP Gateway</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'sms'
                ? 'bg-white/20 text-white'
                : smsLiveReady
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {smsLiveReady ? 'Live SMS' : 'Setup Needed'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('admin-alerts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'admin-alerts'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>Admin Email Alerts</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'admin-alerts'
                ? 'bg-white/20 text-white'
                : adminSmtpStatus?.configured
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {adminSmtpStatus?.configured ? 'SMTP Live' : `${adminAlertLogs.length} Logs`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('paypal-zapier')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'paypal-zapier'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>PayPal &amp; Zapier</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'paypal-zapier'
                ? 'bg-white/20 text-white'
                : paypalEnabled
                ? 'bg-sky-100 text-sky-900'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {zapierWebhookUrl ? 'Zapier Live' : 'Global USD'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('brand-kit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'brand-kit'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>FB Brand Kit</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'brand-kit'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            Download Ready
          </span>
        </button>
      </div>

      {/* TAB: INVESTMENTS MANAGEMENT (APPROVE / SETTLE / EDIT / DELETE) */}
      {consoleTab === 'investments' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-emerald-950">
            <div>
              <strong className="font-extrabold">Full Owner Control Over Investment Deposits (KES 50+):</strong> Verify PayPal deposits, activate pools, edit principal/yield %, settle matured payouts, or permanently delete entries.
            </div>
            <div className="font-mono font-bold whitespace-nowrap">
              {investments.filter((i) => i.status === 'Pending Owner Approval').length} Pending · {investments.filter((i) => i.status === 'Active').length} Active
            </div>
          </div>

          {invFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{invFeedback}</span>
            </div>
          )}

          {investments.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
              No customer investment deposits submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {investments.map((inv) => {
                const busy = processingInvId === inv.id;
                const isEditing = editingInvId === inv.id;
                return (
                  <div
                    key={inv.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 text-xs"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">{inv.customerName}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold">
                            {inv.planName} (+{inv.returnPct}% / {inv.durationDays}d)
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                              inv.status === 'Matured & Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.status === 'Active'
                                ? 'bg-blue-100 text-blue-800'
                                : inv.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-600">
                          ID: <strong>{inv.id}</strong> · Phone: <strong>{inv.senderPhone || inv.customerPhone}</strong> · Rail: <strong>{inv.depositMethod}</strong> · Ref: <strong className="text-slate-950">{inv.paymentReference}</strong>
                        </div>
                        <div className="font-mono text-xs text-slate-900">
                          Principal: <strong className="font-black">KES {inv.amountKes.toLocaleString()}</strong> → Expected Payout: <strong className="text-emerald-700 font-black">KES {inv.expectedReturnKes.toLocaleString()}</strong>
                          {inv.payoutReceipt ? ` · Receipt: ${inv.payoutReceipt}` : ''}
                        </div>
                        {inv.ownerNotes && (
                          <div className="text-[11px] text-slate-600">Owner Note: {inv.ownerNotes}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {inv.screenshotDataUrl && inv.screenshotDataUrl.startsWith('data:image') && (
                          <button
                            type="button"
                            onClick={() => setPreviewInvScreenshot(inv)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Screenshot</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) {
                              setEditingInvId(null);
                            } else {
                              setEditingInvId(inv.id);
                              setEditInvDraft({
                                amountKes: String(inv.amountKes),
                                returnPct: String(inv.returnPct),
                                status: inv.status,
                                ownerNotes: inv.ownerNotes || '',
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isEditing ? 'Close Edit' : 'Edit'}</span>
                        </button>
                        {confirmDeleteInvId === inv.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDeleteInvestment(inv.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-700 text-white font-bold cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteInvId(null)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteInvId(inv.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (KES)</label>
                          <input
                            type="number"
                            value={editInvDraft.amountKes}
                            onChange={(e) => setEditInvDraft((d) => ({ ...d, amountKes: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Return %</label>
                          <input
                            type="number"
                            value={editInvDraft.returnPct}
                            onChange={(e) => setEditInvDraft((d) => ({ ...d, returnPct: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Status</label>
                          <select
                            value={editInvDraft.status}
                            onChange={(e) => setEditInvDraft((d) => ({ ...d, status: e.target.value as any }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                          >
                            <option value="Pending Owner Approval">Pending Owner Approval</option>
                            <option value="Active">Active</option>
                            <option value="Matured & Paid">Matured &amp; Paid</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <input
                            type="text"
                            value={editInvDraft.ownerNotes}
                            onChange={(e) => setEditInvDraft((d) => ({ ...d, ownerNotes: e.target.value }))}
                            placeholder="Owner notes..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleSaveInvestmentEdit(inv.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-700 text-white font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="text"
                        value={invNoteInputs[inv.id] || ''}
                        onChange={(e) =>
                          setInvNoteInputs((prev) => ({ ...prev, [inv.id]: e.target.value }))
                        }
                        placeholder="Optional approval note, payout receipt, or reject reason..."
                        className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                      {inv.status !== 'Active' && inv.status !== 'Matured & Paid' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleInvestmentAction(inv, 'approve')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                        >
                          Approve &amp; Activate
                        </button>
                      )}
                      {inv.status !== 'Matured & Paid' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleInvestmentAction(inv, 'settle')}
                          className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold cursor-pointer disabled:opacity-50"
                        >
                          Mark Matured &amp; Paid
                        </button>
                      )}
                      {inv.status !== 'Rejected' && inv.status !== 'Matured & Paid' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleInvestmentAction(inv, 'reject')}
                          className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold cursor-pointer disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: PRODUCT AUCTIONS MODERATION & SUPER-ADMIN CONTROLS */}
      {consoleTab === 'auctions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="font-extrabold">Full Owner Control Over Customer Product Auctions:</strong>{' '}
              Feature top products, edit prices or status, suspend suspicious listings, accept highest bids, or permanently delete auctions.
            </div>
            <span className="font-mono font-bold">
              {auctions.filter((a) => a.status === 'Live').length} Live · {auctions.filter((a) => a.status === 'Sold').length} Sold
            </span>
          </div>

          {auctionFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{auctionFeedback}</span>
            </div>
          )}

          {auctions.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
              No customer product auctions listed yet.
            </div>
          ) : (
            <div className="space-y-3">
              {auctions.map((auc) => {
                const busy = processingAuctionId === auc.id;
                const isEditing = editingAuctionId === auc.id;
                const thumb = resolveAuctionImageUrl(auc.imageUrls?.[0]);
                return (
                  <div key={auc.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 text-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {thumb && (
                          <img src={thumb} alt={auc.title} className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0" />
                        )}
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900">{auc.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                                auc.status === 'Live'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : auc.status === 'Sold'
                                  ? 'bg-blue-100 text-blue-800'
                                  : auc.status === 'Suspended'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {auc.status}
                            </span>
                            {auc.featured && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                                Featured
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-600">
                            ID: <strong>{auc.id}</strong> · Seller: <strong>{auc.sellerName}</strong> ({auc.sellerPhone || auc.sellerCountryCode}) · Category: <strong>{auc.category}</strong>
                          </div>
                          <div className="font-mono text-xs text-slate-900">
                            Current Bid: <strong className="font-black text-emerald-700">KES {auc.currentBidKes.toLocaleString()}</strong> · Bids: <strong>{auc.bidCount}</strong>
                            {auc.highestBidderName ? ` · Leading: ${auc.highestBidderName}` : ''}
                            {auc.buyNowKes ? ` · Buy Now: KES ${auc.buyNowKes.toLocaleString()}` : ''}
                          </div>
                          <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-bold">50% Escrow: {auc.escrowStatus || 'Held in Escrow'}</span>
                            <span className="font-mono">
                              Deposit: KES {(auc.escrowDepositKes || Math.round(auc.startingBidKes * 0.5)).toLocaleString()} · Seller PayPal Ref: {auc.sellerDepositPaypalRef || 'Verified'} · Buyer Deposits: {Object.keys(auc.bidderDeposits || {}).length}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleOwnerUpdateAuction(auc.id, { featured: !auc.featured })}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                            auc.featured ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>{auc.featured ? 'Unfeature' : 'Feature'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) {
                              setEditingAuctionId(null);
                            } else {
                              setEditingAuctionId(auc.id);
                              setEditAuctionDraft({
                                title: auc.title,
                                category: auc.category,
                                condition: auc.condition,
                                status: auc.status,
                                startingBidKes: String(auc.startingBidKes),
                                minIncrementKes: String(auc.minIncrementKes),
                                buyNowKes: auc.buyNowKes ? String(auc.buyNowKes) : '',
                                featured: Boolean(auc.featured),
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isEditing ? 'Close Edit' : 'Edit'}</span>
                        </button>

                        {auc.status === 'Live' && auc.bidCount > 0 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleOwnerCloseAuction(auc.id, 'accept_highest')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                          >
                            Close &amp; Award Highest
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleOwnerUpdateAuction(auc.id, {
                              escrowStatus: 'Released to Seller',
                              escrowResolutionNote: 'Verified real item handover — escrow released.',
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold cursor-pointer disabled:opacity-50"
                        >
                          Release Escrow
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleOwnerUpdateAuction(auc.id, {
                              escrowStatus: 'Compensated Buyer',
                              escrowResolutionNote: '50% security escrow paid to buyer for item issue.',
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-bold cursor-pointer disabled:opacity-50"
                        >
                          Compensate Buyer
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleOwnerUpdateAuction(auc.id, {
                              escrowStatus: 'Compensated Seller',
                              escrowResolutionNote: '50% security escrow paid to seller for buyer default.',
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold cursor-pointer disabled:opacity-50"
                        >
                          Compensate Seller
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleOwnerUpdateAuction(auc.id, {
                              status: auc.status === 'Suspended' ? 'Live' : 'Suspended',
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                            auc.status === 'Suspended'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {auc.status === 'Suspended' ? 'Restore Live' : 'Suspend'}
                        </button>

                        {confirmDeleteAuctionId === auc.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleOwnerDeleteAuction(auc.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-700 text-white font-bold cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAuctionId(null)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAuctionId(auc.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Product Title</label>
                          <input
                            type="text"
                            value={editAuctionDraft.title}
                            onChange={(e) => setEditAuctionDraft((d) => ({ ...d, title: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Status</label>
                          <select
                            value={editAuctionDraft.status}
                            onChange={(e) => setEditAuctionDraft((d) => ({ ...d, status: e.target.value as AuctionStatus }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="Live">Live</option>
                            <option value="Sold">Sold</option>
                            <option value="Ended">Ended</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="Suspended">Suspended</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Starting Bid (KES)</label>
                          <input
                            type="number"
                            value={editAuctionDraft.startingBidKes}
                            onChange={(e) => setEditAuctionDraft((d) => ({ ...d, startingBidKes: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Min Increment (KES)</label>
                          <input
                            type="number"
                            value={editAuctionDraft.minIncrementKes}
                            onChange={(e) => setEditAuctionDraft((d) => ({ ...d, minIncrementKes: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Buy Now Price (KES)</label>
                          <input
                            type="number"
                            value={editAuctionDraft.buyNowKes}
                            onChange={(e) => setEditAuctionDraft((d) => ({ ...d, buyNowKes: e.target.value }))}
                            placeholder="Optional"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-end justify-end">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleOwnerUpdateAuction(auc.id, {
                                title: editAuctionDraft.title,
                                status: editAuctionDraft.status,
                                startingBidKes: Number(editAuctionDraft.startingBidKes),
                                minIncrementKes: Number(editAuctionDraft.minIncrementKes),
                                buyNowKes: editAuctionDraft.buyNowKes.trim() ? Number(editAuctionDraft.buyNowKes) : null,
                                featured: editAuctionDraft.featured,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-700 text-white font-bold cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Auction Changes</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: PAY-PER-VIEW STATUS FEED & 24H AUTO-PAYOUT MANAGEMENT */}
      {consoleTab === 'ppv' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong className="font-extrabold">Pay-Per-View Status Feed Authority:</strong>{' '}
              Uploads are 100% free (0 purchase needed). Registered members view statuses inside the platform, earning creators <strong>KSh 5 / view</strong>. The server automatically settles views to creator wallets after 24 hours; Owner can inspect media, force early settlement, or moderate posts below.
            </div>
            <div className="font-mono font-bold">
              Live: {ppvPosts.filter((p) => !p.paidOut).length} · Paid: {ppvPosts.filter((p) => p.paidOut).length}
            </div>
          </div>

          {ppvFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{ppvFeedback}</span>
            </div>
          )}

          {previewPpvPost && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4" onClick={() => setPreviewPpvPost(null)}>
              <div className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900">
                    {previewPpvPost.authorName} · {previewPpvPost.category} · {previewPpvPost.viewsCount} views
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewPpvPost(null)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {previewPpvPost.mediaType === 'video' ? (
                  <video
                    src={resolvePpvMediaSrc(previewPpvPost)}
                    controls
                    playsInline
                    className="w-full max-h-[60vh] rounded-xl bg-black"
                  />
                ) : (
                  <img
                    src={resolvePpvMediaSrc(previewPpvPost)}
                    alt={previewPpvPost.caption}
                    className="w-full max-h-[60vh] object-contain rounded-xl border border-slate-200 bg-slate-900"
                  />
                )}
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {previewPpvPost.caption}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {ppvPosts.map((post) => (
              <div key={post.id} className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setPreviewPpvPost(post)}
                    className="w-16 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shrink-0 cursor-pointer"
                    title="Preview uploaded media"
                  >
                    {post.mediaType === 'video' ? (
                      <video src={resolvePpvMediaSrc(post)} muted className="w-full h-full object-cover" />
                    ) : (
                      <img src={resolvePpvMediaSrc(post)} alt={post.caption} className="w-full h-full object-cover" />
                    )}
                  </button>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px]">
                        {post.category}
                      </span>
                      <strong className="text-slate-900">{post.authorName}</strong>
                      <span className="text-slate-500">· {post.city} ({post.countryCode})</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          post.paidOut ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                    <div className="text-slate-600 truncate max-w-xl">{post.caption}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      Views: <strong>{post.viewsCount}</strong> · Value: <strong>{post.paidOut ? post.paidOutKes : post.pendingEarningsKes} KSh</strong> · Expires: {new Date(post.expiresAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewPpvPost(post)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
                  >
                    Preview
                  </button>
                  {!post.paidOut && !post.isSeeded && (
                    <button
                      type="button"
                      disabled={processingPpvId === post.id}
                      onClick={() => void handleOwnerSettlePpvNow(post.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      Settle 24h Payout Now
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={processingPpvId === post.id}
                    onClick={() => void handleOwnerDeletePpvPost(post.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: TESTIMONIALS MODERATION & MANAGEMENT */}
      {consoleTab === 'testimonials' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="font-extrabold">Full Owner Control Over Customer Testimonials:</strong> Feature top reviews, publish or hide submissions, post official Owner replies, edit text, or permanently delete reviews.
            </div>
            <span className="font-mono font-bold">{testimonials.length} Total Reviews</span>
          </div>

          {testiFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{testiFeedback}</span>
            </div>
          )}

          {testimonials.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
              No customer testimonials submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {testimonials.map((t) => {
                const busy = processingTestiId === t.id;
                const isEditing = editingTestiId === t.id;
                return (
                  <div key={t.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 text-xs">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">{t.headline}</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                              t.status === 'Featured'
                                ? 'bg-amber-100 text-amber-900'
                                : t.status === 'Hidden'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {t.status}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-amber-500 font-mono font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {t.rating}.0
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {t.authorName} · {t.city}, {t.countryCode} · {t.experienceCategory} · {new Date(t.createdAt).toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-700 mt-1">{t.message}</p>
                        {t.ownerReply && (
                          <div className="p-2 rounded-lg bg-blue-50 text-blue-900 text-[11px] font-medium mt-1">
                            Owner Reply: {t.ownerReply}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleUpdateTestimonial(t.id, { status: 'Featured' })}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold cursor-pointer"
                        >
                          Feature
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleUpdateTestimonial(t.id, { status: 'Published' })}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold cursor-pointer"
                        >
                          Publish
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleUpdateTestimonial(t.id, { status: 'Hidden' })}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                        >
                          Hide
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) {
                              setEditingTestiId(null);
                            } else {
                              setEditingTestiId(t.id);
                              setEditTestiDraft({
                                headline: t.headline,
                                message: t.message,
                                rating: t.rating,
                              });
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                        >
                          {isEditing ? 'Close Edit' : 'Edit'}
                        </button>
                        {confirmDeleteTestiId === t.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDeleteTestimonial(t.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-700 text-white font-bold cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTestiId(null)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTestiId(t.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editTestiDraft.headline}
                            onChange={(e) => setEditTestiDraft((d) => ({ ...d, headline: e.target.value }))}
                            className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                          />
                          <select
                            value={editTestiDraft.rating}
                            onChange={(e) => setEditTestiDraft((d) => ({ ...d, rating: Number(e.target.value) }))}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          >
                            {[5, 4, 3, 2, 1].map((r) => (
                              <option key={r} value={r}>{r} Stars</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          value={editTestiDraft.message}
                          onChange={(e) => setEditTestiDraft((d) => ({ ...d, message: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleUpdateTestimonial(t.id, {
                              headline: editTestiDraft.headline,
                              message: editTestiDraft.message,
                              rating: editTestiDraft.rating,
                            })
                          }
                          className="px-3.5 py-1.5 rounded-lg bg-blue-700 text-white font-bold cursor-pointer"
                        >
                          Save Edits
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="text"
                        value={testiReplyInputs[t.id] ?? t.ownerReply ?? ''}
                        onChange={(e) =>
                          setTestiReplyInputs((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        placeholder="Write official Platform Owner reply..."
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleUpdateTestimonial(t.id, {
                            ownerReply: (testiReplyInputs[t.id] ?? t.ownerReply ?? '').trim(),
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                      >
                        Save Reply
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1B: STRICT NATIONAL ID KYC VERIFICATIONS (FRONT & BACK PHOTOS) */}
      {consoleTab === 'kyc' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <div className="font-black uppercase tracking-wide text-blue-900">
                Strict PayPal Withdrawal KYC Rule (Front &amp; Back National ID Required)
              </div>
              <p>
                Every worker requesting a PayPal withdrawal (from <strong>KSh 150 / {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</strong>) must first upload clear photos of{' '}
                <strong>BOTH the Front AND Back</strong> of their country&apos;s official National ID (e.g., Kenyan Kitambulisho, Uganda NIRA, Tanzania NIDA, Rwanda Indangamuntu, Burundi CNI, South Sudan ID, Ethiopia Fayda/Kebele, Somalia NIRA). Withdrawals stay locked until you approve their KYC below.
              </p>
            </div>
          </div>

          {kycFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{kycFeedback}</span>
            </div>
          )}

          {kycSubmissions.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
              No National ID KYC submissions received yet. Front &amp; Back ID uploads will appear here for your verification.
            </div>
          ) : (
            <div className="space-y-4">
              {kycSubmissions.map((kyc) => {
                const isBusy = processingKycUid === kyc.uid;
                return (
                  <div
                    key={kyc.uid}
                    className={`p-5 rounded-2xl border bg-white shadow-xs flex flex-col xl:flex-row gap-5 ${
                      kyc.status === 'Rejected'
                        ? 'border-rose-300 bg-rose-50/20'
                        : kyc.status === 'Approved'
                        ? 'border-emerald-300'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Front & Back ID Photo Previews */}
                    <div className="w-full xl:w-80 shrink-0 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase text-slate-500">Front of ID</div>
                          <div className="rounded-xl border border-slate-300 overflow-hidden bg-slate-100 aspect-[4/3] flex items-center justify-center">
                            {kyc.frontImageDataUrl && kyc.frontImageDataUrl.startsWith('data:image') ? (
                              <img
                                src={kyc.frontImageDataUrl}
                                alt={`${kyc.idDocumentName} Front`}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => setPreviewKyc(kyc)}
                              />
                            ) : (
                              <span className="text-[10px] text-slate-500 px-2 text-center">Front Missing</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase text-slate-500">Back of ID</div>
                          <div className="rounded-xl border border-slate-300 overflow-hidden bg-slate-100 aspect-[4/3] flex items-center justify-center">
                            {kyc.backImageDataUrl && kyc.backImageDataUrl.startsWith('data:image') ? (
                              <img
                                src={kyc.backImageDataUrl}
                                alt={`${kyc.idDocumentName} Back`}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => setPreviewKyc(kyc)}
                              />
                            ) : (
                              <span className="text-[10px] text-slate-500 px-2 text-center">Back Missing</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewKyc(kyc)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Full Front &amp; Back ID</span>
                      </button>
                    </div>

                    {/* Details & Owner Controls */}
                    <div className="flex-1 space-y-3 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900 flex flex-wrap items-center gap-2">
                            <span>{kyc.fullNameOnId || kyc.customerName}</span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-mono text-xs">
                              {kyc.idDocumentName} ({kyc.countryCode})
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-700 mt-1">
                            ID Number: <strong className="text-slate-950 font-black">{kyc.idNumber}</strong> · Account:{' '}
                            <strong>{kyc.customerName}</strong> ({kyc.customerPhone || kyc.customerEmail || kyc.uid})
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Submitted: {new Date(kyc.submittedAt).toLocaleString()}
                            {kyc.reviewedAt ? ` · Reviewed: ${new Date(kyc.reviewedAt).toLocaleString()}` : ''}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] uppercase ${
                            kyc.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : kyc.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {kyc.status}
                        </span>
                      </div>

                      {kyc.rejectionReason && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-semibold">
                          Rejection Reason: {kyc.rejectionReason}
                        </div>
                      )}

                      {kyc.status !== 'Approved' && (
                        <div className="pt-2 border-t border-slate-100 space-y-2.5">
                          <input
                            type="text"
                            value={kycNoteInputs[kyc.uid] || ''}
                            onChange={(e) =>
                              setKycNoteInputs((prev) => ({ ...prev, [kyc.uid]: e.target.value }))
                            }
                            placeholder="Optional rejection reason if Front/Back ID photos are unclear..."
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleApproveKyc(kyc)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isBusy ? 'Approving...' : 'Approve KYC & Unlock PayPal Withdrawals'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleRejectKyc(kyc)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject &amp; Request Clear ID</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: WITHDRAWAL APPROVALS */}
      {consoleTab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>PayPal Withdrawal Approvals ({pendingWithdrawalsCount} Pending)</span>
              </h2>
              <p className="text-xs text-slate-600">
                <strong>Approve &amp; Pay</strong> dispatches payouts exclusively via PayPal (REST API v2 Payouts or manual PayPal transaction confirmation). Strict Front &amp; Back National ID KYC is verified prior to withdrawal submission.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'Processing', 'Completed', 'Rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setWithdrawalFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    withdrawalFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? `All (${withdrawals.length})` : st}
                </button>
              ))}
            </div>
          </div>

          {/* Outbound PayPal Payout Gateway Status */}
          <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800">Active Payout Rail:</span>
              <span
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold ${
                  gatewayStatus?.paypal?.live
                    ? 'bg-emerald-100 text-emerald-800'
                    : gatewayStatus?.paypal?.configured
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-900'
                }`}
              >
                PayPal Only ({gatewayStatus?.paypal?.mode || 'manual_ready'})
              </span>
              <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Min Withdrawal: KSh 150 + Front/Back ID KYC
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700 whitespace-nowrap">PayPal Dispatch Mode:</label>
              <select
                value={gatewayMode}
                onChange={(e) => setGatewayMode(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold outline-hidden focus:border-blue-600"
              >
                <option value="auto">Auto (PayPal Payouts API)</option>
                <option value="paypal">PayPal REST v2 Payout</option>
                <option value="manual">Manual PayPal Transfer (Enter TXN Receipt)</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
            <table className="w-full text-xs text-left min-w-[760px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference / Date</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Rail &amp; Destination</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Owner Approval Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                      No withdrawal requests match this filter yet. When contributors submit a {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}+ cash-out, it appears here immediately for your approval.
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((w) => {
                    const matchedCustomer = customerByUid.get(w.userUid);
                    const lockedWd = matchedCustomer?.withdrawalDetails;
                    const matchesLocked =
                      Boolean(lockedWd?.locked) &&
                      lockedWd?.method === w.method &&
                      (lockedWd?.accountDetails || '').replace(/\s+/g, '').toLowerCase() ===
                        (w.accountDetails || '').replace(/\s+/g, '').toLowerCase();

                    return (
                    <tr key={w.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">{w.id}</div>
                        <div className="text-[11px] text-slate-500">{new Date(w.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {matchedCustomer?.displayName || w.customerName || 'Contributor'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {matchedCustomer?.phone || w.customerPhone || w.customerEmail || w.userUid} · {matchedCustomer?.countryCode || w.countryCode}
                        </div>
                        {matchedCustomer?.city && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" />
                            <span>{matchedCustomer.city}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{w.method}</div>
                        <div className="text-[11px] text-slate-600 font-mono">{w.accountDetails}</div>
                        {lockedWd?.locked ? (
                          <div
                            className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              matchesLocked
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>
                              {matchesLocked
                                ? `Matches Reg Lock (${lockedWd.accountHolderName || matchedCustomer?.displayName})`
                                : `Differs from Reg Lock: ${lockedWd.method} ${lockedWd.accountDetails}`}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-slate-400 font-mono">
                            Reg phone: {matchedCustomer?.phone || w.customerPhone || 'N/A'}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyFromUsd(w.amountUsd, getCountryByCode(w.countryCode))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            w.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : w.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {w.status === 'Completed' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : w.status === 'Rejected' ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>{w.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {w.status === 'Processing' ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <input
                              type="text"
                              value={receiptInputs[w.id] || ''}
                              onChange={(e) =>
                                setReceiptInputs((prev) => ({ ...prev, [w.id]: e.target.value }))
                              }
                              placeholder="Manual Ref (optional)"
                              className="w-36 px-2 py-1 text-[11px] font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
                            />
                            <button
                              type="button"
                              disabled={processingId === w.id}
                              onClick={() => void handleApproveWithdrawal(w)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              {processingId === w.id ? 'Processing...' : 'Approve & Pay'}
                            </button>
                            <button
                              type="button"
                              disabled={processingId === w.id}
                              onClick={() => void handleRejectWithdrawal(w)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] font-mono text-slate-500">
                            {w.mpesaReceipt ? `Ref: ${w.mpesaReceipt}` : w.rejectionReason || 'Reviewed'}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ALL PLATFORM TRANSACTIONS LEDGER */}
      {consoleTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-700" />
                <span>Complete Transaction Ledger ({filteredTransactions.length})</span>
              </h2>
              <p className="text-xs text-slate-600">
                Real-time audit trail of every PayPal checkout, PayPal withdrawal request/approval, task reward, investment deposit, and referral commission.
              </p>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search ID, customer, method..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'all', label: `All (${transactions.length})` },
                { key: 'withdrawal', label: 'PayPal Withdrawals' },
                { key: 'paypal_checkout', label: 'PayPal Checkouts' },
                { key: 'investment_deposit', label: 'Investments (KES 50+)' },
                { key: 'task_reward', label: 'Task Rewards' },
                { key: 'referral_commission', label: 'Referrals' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTxKindFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  txKindFilter === f.key
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
            <table className="w-full text-xs text-left min-w-[780px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference / Time</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Gateway / Rail</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                      No transactions recorded yet for this filter. New pass checkouts, completed tasks, referrals, and withdrawals appear here automatically.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">{tx.reference || tx.id}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(tx.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {kindLabel(tx.kind)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs">
                        {tx.title}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {tx.customerLabel} · {tx.countryCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {tx.gatewayOrMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-bold text-slate-900">
                          {formatCurrencyFromUsd(tx.amountUsd, getCountryByCode(tx.countryCode))}
                        </div>
                        {typeof tx.amountLocal === 'number' && tx.currency !== 'USD' && (
                          <div className="text-[11px] text-slate-500">
                            {tx.currency} {tx.amountLocal.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            tx.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.status === 'Rejected' || tx.status === 'Failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL TASKS & SUBMISSION TRACKER */}
      {consoleTab === 'tasks' && (
        <div className="space-y-8">
          {taskAlertSummary && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="font-extrabold text-indigo-950 flex items-center gap-2">
                  <span>High-Reward Task Email Alert Subscribers:</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-700 text-white font-mono">
                    {taskAlertSummary.activeCount} Active ({taskAlertSummary.totalCount} Total)
                  </span>
                </div>
                <p className="text-indigo-900/80 text-[11px]">
                  SMTP Delivery:{' '}
                  <strong>{taskAlertSummary.smtpConfigured ? 'Configured (Live Emails Enabled)' : 'Not configured in env — dispatches saved to Subscriber In-App Alert Feed'}</strong>
                  {taskAlertSummary.recentDispatches.length > 0 && (
                    <> · Latest dispatch: {taskAlertSummary.recentDispatches[0].taskTitle} ({taskAlertSummary.recentDispatches[0].deliveryStatus})</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* All Platform Task Campaigns */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  All Platform Tasks &amp; Campaigns ({filteredTasks.length} of {tasks.length})
                </h2>
                <p className="text-xs text-slate-600">
                  Full visibility across every active task campaign, bounty rate, claimed spots, and remaining worker quota.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Filter tasks..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
                <select
                  value={taskCategoryFilter}
                  onChange={(e) => setTaskCategoryFilter(e.target.value as 'all' | TaskCategory)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:border-blue-600 outline-hidden"
                >
                  <option value="all">All Categories</option>
                  <option value="creator-campaign">Creator Product Campaigns</option>
                  <option value="survey">Surveys</option>
                  <option value="annotation">AI Annotation</option>
                  <option value="data-entry">Data Entry</option>
                  <option value="writing">Writing</option>
                  <option value="meme-content">Meme Content</option>
                  <option value="micro">Micro Tasks</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
              <table className="w-full text-xs text-left min-w-[760px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-5 font-semibold">Campaign Title</th>
                    <th className="py-3 px-5 font-semibold">Category</th>
                    <th className="py-3 px-5 font-semibold text-right">Bounty</th>
                    <th className="py-3 px-5 font-semibold text-right">Claimed / Remaining / Total</th>
                    <th className="py-3 px-5 font-semibold text-right">Status &amp; Owner Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => {
                    const claimed = Math.max(0, task.totalSpots - task.spotsRemaining);
                    const isEditing = editingTaskId === task.id;
                    return (
                      <React.Fragment key={task.id}>
                        <tr className="hover:bg-slate-50/60">
                          <td className="py-3 px-5 font-medium text-slate-900">
                            <div>{task.title}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {task.requesterName} · {task.id}
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <span className="capitalize text-slate-700 font-medium">
                              {task.category.replace('-', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatCurrencyFromUsd(task.reward, selectedCountry)}
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-slate-700 tabular-nums">
                            {claimed} claimed · {task.spotsRemaining} / {task.totalSpots} left
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              <span
                                className={`font-semibold mr-1 ${
                                  task.spotsRemaining > 0 ? 'text-emerald-600' : 'text-amber-700'
                                }`}
                              >
                                {task.spotsRemaining > 0 ? 'Active' : 'Filled'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingTaskId(null);
                                  } else {
                                    setEditingTaskId(task.id);
                                    setEditTaskDraft({
                                      title: task.title,
                                      reward: String(convertUsdToLocal(task.reward, selectedCountry)),
                                      totalSpots: String(task.totalSpots),
                                      spotsRemaining: String(task.spotsRemaining),
                                      category: task.category,
                                    });
                                  }
                                }}
                                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                              >
                                {isEditing ? 'Close' : 'Edit'}
                              </button>
                              {confirmDeleteTaskId === task.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deleteTask(task.id);
                                      setConfirmDeleteTaskId(null);
                                    }}
                                    className="px-2 py-1 rounded-md bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteTaskId(null)}
                                    className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTaskId(task.id)}
                                  className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isEditing && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end text-xs">
                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Task Title</label>
                                  <input
                                    type="text"
                                    value={editTaskDraft.title}
                                    onChange={(e) => setEditTaskDraft((d) => ({ ...d, title: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Merchant Reward ({selectedCountry.symbol})
                                  </label>
                                  <input
                                    type="number"
                                    step="1"
                                    min={convertKesToLocal(10, selectedCountry)}
                                    value={editTaskDraft.reward}
                                    onChange={(e) => setEditTaskDraft((d) => ({ ...d, reward: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Remaining / Total</label>
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      value={editTaskDraft.spotsRemaining}
                                      onChange={(e) => setEditTaskDraft((d) => ({ ...d, spotsRemaining: e.target.value }))}
                                      className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                    />
                                    <input
                                      type="number"
                                      value={editTaskDraft.totalSpots}
                                      onChange={(e) => setEditTaskDraft((d) => ({ ...d, totalSpots: e.target.value }))}
                                      className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const parsedUsd = localAmountToUsd(Number(editTaskDraft.reward) || 0, selectedCountry);
                                      const nextReward = Math.max(0.05, parsedUsd || task.reward);
                                      updateTask(task.id, {
                                        title: editTaskDraft.title.trim() || task.title,
                                        reward: nextReward,
                                        totalSpots: Math.max(1, Number(editTaskDraft.totalSpots) || task.totalSpots),
                                        spotsRemaining: Math.max(0, Number(editTaskDraft.spotsRemaining) || 0),
                                      });
                                      setEditingTaskId(null);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-blue-700 text-white font-bold cursor-pointer"
                                  >
                                    Save Task
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Creator Campaign Social Deliverables (Facebook, Instagram, TikTok, WhatsApp) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Creator Social Deliverables — FB, IG, TikTok &amp; WhatsApp ({creatorSubmissions.length})
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
              <table className="w-full text-xs text-left min-w-[760px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Submission / Date</th>
                    <th className="py-3 px-4 font-semibold">Campaign Product</th>
                    <th className="py-3 px-4 font-semibold">Platform &amp; Format</th>
                    <th className="py-3 px-4 font-semibold">Creator Handle &amp; Proof Link</th>
                    <th className="py-3 px-4 font-semibold text-right">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creatorSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-slate-500">
                        No creator campaign reels, videos, or text posts submitted yet.
                      </td>
                    </tr>
                  ) : (
                    creatorSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono">
                          <div className="font-bold text-slate-900">{sub.id}</div>
                          <div className="text-[11px] text-slate-500">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {sub.productName}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {sub.platform} · <span className="capitalize">{sub.format.replace('-', ' ')}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-slate-800">{sub.creatorHandle}</div>
                          <div className="text-[11px] text-blue-700 truncate max-w-xs">
                            {sub.postUrl || (sub.whatsappProofAttached ? 'WhatsApp Screenshot Attached' : 'Verified')}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                          {formatCurrencyFromUsd(sub.rewardUsd, getCountryByCode(sub.countryCode))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Completed Task Activity & Reward Submissions */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Recent Task Submissions &amp; Reward Payouts ({serverTaskCompletions.length + taskHistory.length})
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
              <table className="w-full text-xs text-left min-w-[680px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Reference</th>
                    <th className="py-3 px-4 font-semibold">Task Completed</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Contributor</th>
                    <th className="py-3 px-4 font-semibold text-right">Reward</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {serverTaskCompletions.map((tx) => (
                    <tr key={`srv-${tx.id}`} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.reference}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{tx.title}</td>
                      <td className="py-3 px-4 text-slate-700">{tx.gatewayOrMethod}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{tx.customerLabel}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        +{formatCurrencyFromUsd(tx.amountUsd, getCountryByCode(tx.countryCode))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {taskHistory.map((h) => (
                    <tr key={`loc-${h.id}`} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{h.transactionRef}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{h.taskTitle}</td>
                      <td className="py-3 px-4 capitalize text-slate-700">{h.category.replace('-', ' ')}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{h.completedAt}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        +{formatCurrencyFromUsd(h.reward, selectedCountry)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SAVED CUSTOMER CREDENTIALS, REGISTRATION LOCKS & PROFILE DIRECTORY */}
      {consoleTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-700" />
                <span>Saved Customer Accounts &amp; Registration Locks ({filteredCustomers.length})</span>
              </h2>
              <p className="text-xs text-slate-600">
                Full view of registered contributors, updated profile info, immutable registered phone numbers, and locked payout destinations.
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search name, +254..., city, payout rail..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-emerald-950">
              <strong className="font-bold">Owner Ban Recovery:</strong> Accidentally banned an admin or verified phone number? Enter the mobile number (e.g.{' '}
              <span className="font-mono font-bold">0712727558</span>) to restore access immediately.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={unbanPhoneInput}
                onChange={(e) => setUnbanPhoneInput(e.target.value)}
                placeholder="0712727558"
                className="w-40 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-slate-900 font-mono text-xs focus:border-emerald-600 outline-hidden"
              />
              <button
                type="button"
                disabled={unbanningPhone}
                onClick={() => void handleUnbanPhone()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>{unbanningPhone ? 'Unbanning...' : 'Unban Number'}</span>
              </button>
            </div>
          </div>

          {customerFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{customerFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Saved Accounts</span>
              <span className="font-mono font-extrabold text-slate-900 text-base tabular-nums">{customers.length}</span>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-between">
              <span className="font-semibold text-emerald-800">SMS OTP Verified</span>
              <span className="font-mono font-extrabold text-emerald-900 text-base tabular-nums">
                {customers.filter((c) => c.phoneVerified).length}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center justify-between">
              <span className="font-semibold text-amber-900">Locked Payout Accounts</span>
              <span className="font-mono font-extrabold text-amber-950 text-base tabular-nums">
                {lockedPayoutCount || customers.filter((c) => c.withdrawalDetails?.locked).length}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center justify-between">
              <span className="font-semibold text-blue-800">Duplicate Lock</span>
              <span className="inline-flex items-center gap-1 font-bold text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Phone + Payout Fixed</span>
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
            <table className="w-full text-xs text-left min-w-[980px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Contributor &amp; Updated Profile</th>
                  <th className="py-3 px-4 font-semibold">Locked Phone &amp; Email</th>
                  <th className="py-3 px-4 font-semibold">Locked Withdrawal Details</th>
                  <th className="py-3 px-4 font-semibold text-center">Security</th>
                  <th className="py-3 px-4 font-semibold text-right">Activity / Owner Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                      No registered customer accounts match your search yet.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const handles = cust.socialHandles;
                    const handleList = [
                      handles?.facebook ? `FB: ${handles.facebook}` : null,
                      handles?.instagram ? `IG: ${handles.instagram}` : null,
                      handles?.tiktok ? `TT: ${handles.tiktok}` : null,
                      handles?.whatsapp ? `WA: ${handles.whatsapp}` : null,
                    ].filter(Boolean) as string[];

                    return (
                      <React.Fragment key={cust.uid}>
                      <tr className="hover:bg-slate-50/60 align-top">
                        <td className="py-3.5 px-4 max-w-[260px]">
                          <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                            <span>{cust.displayName}</span>
                            {cust.accountDetailsLocked && (
                              <span
                                title="All My Account profile details permanently locked"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>Profile Locked</span>
                              </span>
                            )}
                            {cust.banned && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-700 text-white text-[10px] font-black uppercase">
                                Banned 🚫 Forever
                              </span>
                            )}
                            {cust.deactivated && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-700 text-white text-[10px] font-black uppercase">
                                Deactivated
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {cust.countryCode}{cust.city ? ` · ${cust.city}` : ''} · {cust.uid}
                          </div>
                          {cust.bannedReason && (
                            <p className="text-[11px] text-rose-700 font-semibold mt-1">{cust.bannedReason}</p>
                          )}
                          {cust.bio && (
                            <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{cust.bio}</p>
                          )}
                          {handleList.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {handleList.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                            <span>{cust.phone || 'Not linked'}</span>
                            {(cust.phoneLocked || cust.phone) && (
                              <span
                                title="Immutable Registered Phone Number"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-600 mt-1">
                            {cust.email || 'No email'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {cust.withdrawalDetails ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{cust.withdrawalDetails.method}</span>
                                <span
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                    cust.withdrawalDetails.locked
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {cust.withdrawalDetails.locked ? (
                                    <>
                                      <Lock className="w-2.5 h-2.5" />
                                      <span>Locked</span>
                                    </>
                                  ) : (
                                    <span>Unlocked</span>
                                  )}
                                </span>
                              </div>
                              <div className="font-mono text-xs font-semibold text-blue-900">
                                {cust.withdrawalDetails.accountDetails}
                              </div>
                              <div className="text-[11px] text-slate-600">
                                Holder: <strong className="text-slate-800">{cust.withdrawalDetails.accountHolderName || cust.displayName}</strong>
                              </div>
                              {cust.withdrawalDetails.lockedAt && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  Locked: {new Date(cust.withdrawalDetails.lockedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              No withdrawal destination saved yet
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                cust.phoneVerified
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {cust.phoneVerified ? 'OTP Verified' : 'Unverified'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                cust.twoFactorEnabled
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              2FA: {cust.twoFactorEnabled ? cust.twoFactorMethod : 'Off'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                              Logins: {cust.loginCount || 1}
                            </span>
                            {stateSummaryByUid[cust.uid] && (
                              <div className="mt-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-700 space-y-0.5 text-left">
                                <div>
                                  Bal: <strong>{formatCurrencyFromUsd(stateSummaryByUid[cust.uid].balanceUsd, getCountryByCode(cust.countryCode))}</strong>
                                </div>
                                <div>
                                  Tasks: <strong>{stateSummaryByUid[cust.uid].completedTasksCount}</strong> · VIP Refs: <strong>{stateSummaryByUid[cust.uid].vipReferralCount}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-500 space-y-1.5">
                          <div>Joined: {new Date(cust.createdAt).toLocaleDateString()}</div>
                          {cust.updatedAt && (
                            <div>Updated: {new Date(cust.updatedAt).toLocaleDateString()}</div>
                          )}
                          {cust.lastLoginAt && (
                            <div>Last: {new Date(cust.lastLoginAt).toLocaleString()}</div>
                          )}
                          <div className="pt-1 flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                editingCustomerUid === cust.uid
                                  ? setEditingCustomerUid(null)
                                  : openEditCustomer(cust)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-sans font-bold cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{editingCustomerUid === cust.uid ? 'Close Edit' : 'Edit All Details'}</span>
                            </button>

                            {cust.withdrawalDetails?.locked && (
                              <button
                                type="button"
                                disabled={unlockingUid === cust.uid}
                                onClick={() => void handleUnlockCustomerPayout(cust)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-sans font-bold transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>{unlockingUid === cust.uid ? 'Unlocking...' : 'Unlock Payout'}</span>
                              </button>
                            )}

                            {cust.phone === '+254712727558' ||
                            cust.email?.toLowerCase() === 'nigideon36@gmail.com' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-sans font-bold">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Admin Protected</span>
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={deactivatingUid === cust.uid}
                                  onClick={() => void handleToggleDeactivateCustomer(cust)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-sans font-bold cursor-pointer disabled:opacity-50 ${
                                    cust.deactivated
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                                  }`}
                                >
                                  <Power className="w-3 h-3" />
                                  <span>
                                    {deactivatingUid === cust.uid
                                      ? 'Updating...'
                                      : cust.deactivated
                                      ? 'Reactivate'
                                      : 'Deactivate'}
                                  </span>
                                </button>

                                {cust.banned ? (
                                  <button
                                    type="button"
                                    disabled={unbanningUid === cust.uid}
                                    onClick={() => void handleUnbanCustomer(cust)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-sans font-bold transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <Unlock className="w-3 h-3" />
                                    <span>{unbanningUid === cust.uid ? 'Unbanning...' : 'Unban'}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={banningUid === cust.uid}
                                    onClick={() => void handleBanCustomer(cust)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-sans font-bold transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>{banningUid === cust.uid ? 'Banning...' : 'Ban 🚫'}</span>
                                  </button>
                                )}

                                {confirmDeleteCustomerUid === cust.uid ? (
                                  <span className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={deletingCustomerUid === cust.uid}
                                      onClick={() => void handleDeleteCustomerPermanently(cust)}
                                      className="px-2 py-1 rounded-lg bg-rose-800 text-white text-[10px] font-sans font-bold cursor-pointer"
                                    >
                                      Confirm Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCustomerUid(null)}
                                      className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-sans cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteCustomerUid(cust.uid)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[10px] font-sans font-bold cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {editingCustomerUid === cust.uid && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={5} className="p-4">
                            <div className="space-y-3 text-xs">
                              <div className="font-extrabold text-slate-900">
                                Owner Super-Admin Editor — {cust.displayName} ({cust.uid})
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Display Name</label>
                                  <input
                                    type="text"
                                    value={customerEditDraft.displayName}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, displayName: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Registered Phone</label>
                                  <input
                                    type="text"
                                    value={customerEditDraft.phone}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, phone: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email</label>
                                  <input
                                    type="email"
                                    value={customerEditDraft.email}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, email: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">City / Country</label>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      value={customerEditDraft.city}
                                      onChange={(e) => setCustomerEditDraft((d) => ({ ...d, city: e.target.value }))}
                                      placeholder="City"
                                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                                    />
                                    <input
                                      type="text"
                                      value={customerEditDraft.countryCode}
                                      onChange={(e) => setCustomerEditDraft((d) => ({ ...d, countryCode: e.target.value.toUpperCase() }))}
                                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payout Method</label>
                                  <select
                                    value={customerEditDraft.withdrawalMethod}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, withdrawalMethod: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                                  >
                                    <option value="PayPal">PayPal (Exclusive Gateway)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">PayPal Account Email</label>
                                  <input
                                    type="email"
                                    value={customerEditDraft.withdrawalAccountDetails}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, withdrawalAccountDetails: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">PayPal Account Holder</label>
                                  <input
                                    type="text"
                                    value={customerEditDraft.withdrawalAccountHolderName}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, withdrawalAccountHolderName: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Persisted Wallet Balance ({getCountryByCode(customerEditDraft.countryCode).symbol})
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={customerEditDraft.balanceLocal}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, balanceLocal: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Partner Referrals Count (20% Commission)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={customerEditDraft.vipReferralCount}
                                    onChange={(e) => setCustomerEditDraft((d) => ({ ...d, vipReferralCount: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-700">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={customerEditDraft.phoneVerified}
                                      onChange={(e) => setCustomerEditDraft((d) => ({ ...d, phoneVerified: e.target.checked }))}
                                    />
                                    <span>OTP Verified</span>
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={customerEditDraft.phoneLocked}
                                      onChange={(e) => setCustomerEditDraft((d) => ({ ...d, phoneLocked: e.target.checked }))}
                                    />
                                    <span>Lock Phone</span>
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={customerEditDraft.withdrawalLocked}
                                      onChange={(e) => setCustomerEditDraft((d) => ({ ...d, withdrawalLocked: e.target.checked }))}
                                    />
                                    <span>Lock Payout Details</span>
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-blue-800">
                                    <input
                                      type="checkbox"
                                      checked={customerEditDraft.accountDetailsLocked}
                                      onChange={(e) => setCustomerEditDraft((d) => ({ ...d, accountDetailsLocked: e.target.checked }))}
                                    />
                                    <span>Lock All My Account Details</span>
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-rose-700">
                                    <input
                                      type="checkbox"
                                      checked={customerEditDraft.resetTwoFactor}
                                      onChange={(e) => setCustomerEditDraft((d) => ({ ...d, resetTwoFactor: e.target.checked }))}
                                    />
                                    <span>Reset 2FA</span>
                                  </label>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCustomerUid(null)}
                                    className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingCustomerEdit}
                                    onClick={() => void handleSaveCustomerEdit(cust.uid)}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{savingCustomerEdit ? 'Saving...' : 'Save Customer Changes'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: CUSTOMER SUPPORT TICKETS (COLLECTED BY AI HELPDESK & CONTACT FORM) */}
      {consoleTab === 'support' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-800">
            <div>
              <strong className="font-extrabold">Customer Support Inbox (24/7 AI Escalation):</strong>{' '}
              Tickets left inside the AI Support Chat or Contact Us form appear here automatically whenever customers need manual follow-up while you are away.
            </div>
            <div className="font-mono font-bold whitespace-nowrap">
              {supportTickets.filter((t) => t.status === 'Open').length} Open · {supportTickets.length} Total
            </div>
          </div>

          {supportTickets.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No support tickets submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {supportTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-900">{ticket.id}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-bold text-slate-900">{ticket.customerName}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-blue-700">{ticket.contactInfo}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600">{ticket.category}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(ticket.createdAt).toLocaleString()} · {ticket.countryCode}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                          ticket.status === 'Open'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {ticket.status}
                      </span>
                      <button
                        type="button"
                        disabled={processingTicketId === ticket.id}
                        onClick={async () => {
                          const token = await getFreshToken();
                          if (!token) return;
                          setProcessingTicketId(ticket.id);
                          try {
                            const nextStatus = ticket.status === 'Open' ? 'Resolved' : 'Open';
                            const res = await fetch(
                              `/api/owner/support-tickets/${encodeURIComponent(ticket.id)}`,
                              {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ status: nextStatus }),
                              }
                            );
                            const data = await res.json();
                            if (res.ok && data?.ticket) {
                              setSupportTickets((prev) =>
                                prev.map((t) => (t.id === ticket.id ? data.ticket : t))
                              );
                            }
                          } finally {
                            setProcessingTicketId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        {ticket.status === 'Open' ? 'Mark Resolved' : 'Reopen'}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {ticket.message}
                  </p>

                  {ticket.aiConversationSummary && (
                    <div className="text-[11px] text-slate-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100 whitespace-pre-wrap">
                      <strong className="text-blue-900 block mb-1">AI Chat Context:</strong>
                      {ticket.aiConversationSummary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SMS OTP GATEWAY & DIAGNOSTICS */}
      {consoleTab === 'sms' && (
        <div className="space-y-6">
          <div
            className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              smsLiveReady
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                {smsLiveReady ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Live SMS Carrier Connected ({smsProvider})</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-700" />
                    <span>
                      Why Customers Aren&apos;t Receiving Handset SMS:{' '}
                      {smsAtSandbox
                        ? "Africa's Talking is currently in Sandbox mode (no real phone delivery)"
                        : 'No live SMS carrier API key configured yet'}
                    </span>
                  </>
                )}
              </div>
              <p className="text-[11px] opacity-90">
                {smsLiveReady
                  ? 'Registration OTPs are dispatched directly to East Africa mobile phones via your active carrier.'
                  : 'While carrier SMS is pending setup, customers see an Instant On-Screen OTP Verification code with 1-click Auto-Fill so nobody is blocked from registering. Add Africa\'s Talking, TextSMS Kenya, or Twilio keys below to send real handset SMS.'}
              </p>
            </div>
          </div>

          {smsFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{smsFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleSaveSmsGateway} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configure Live SMS Provider</h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Choose Africa&apos;s Talking, TextSMS East Africa, or Twilio to deliver registration &amp; 2FA OTPs directly to handsets.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Active SMS Provider</label>
                <select
                  value={smsProvider}
                  onChange={(e) => setSmsProvider(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
                >
                  <option value="none">Instant On-Screen Fallback Only (No Carrier)</option>
                  <option value="africastalking">Africa&apos;s Talking (KE, UG, TZ, RW, ET)</option>
                  <option value="textsms">TextSMS / Advanta Africa (Kenya &amp; EA)</option>
                  <option value="twilio">Twilio Programmable SMS</option>
                </select>
              </div>

              {smsProvider === 'africastalking' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Africa&apos;s Talking Username (use production username, NOT sandbox)
                    </label>
                    <input
                      type="text"
                      value={atUsername}
                      onChange={(e) => setAtUsername(e.target.value)}
                      placeholder="e.g. gideontasks"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Africa&apos;s Talking Live API Key
                    </label>
                    <input
                      type="password"
                      value={atApiKey}
                      onChange={(e) => setAtApiKey(e.target.value)}
                      placeholder="Leave blank to keep existing key"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Approved Sender ID <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={atSenderId}
                      onChange={(e) => setAtSenderId(e.target.value)}
                      placeholder="e.g. GIDEONTASKS"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {smsProvider === 'textsms' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Partner ID</label>
                    <input
                      type="text"
                      value={textsmsPartnerId}
                      onChange={(e) => setTextsmsPartnerId(e.target.value)}
                      placeholder="e.g. 12345"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">TextSMS API Key</label>
                    <input
                      type="password"
                      value={textsmsApiKey}
                      onChange={(e) => setTextsmsApiKey(e.target.value)}
                      placeholder="Leave blank to keep existing key"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Shortcode / Sender ID</label>
                    <input
                      type="text"
                      value={textsmsShortcode}
                      onChange={(e) => setTextsmsShortcode(e.target.value)}
                      placeholder="TextSMS"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {smsProvider === 'twilio' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account SID</label>
                    <input
                      type="text"
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Auth Token</label>
                    <input
                      type="password"
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      placeholder="Leave blank to keep existing token"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Twilio From Number</label>
                    <input
                      type="text"
                      value={twilioFromNumber}
                      onChange={(e) => setTwilioFromNumber(e.target.value)}
                      placeholder="+1..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={smsSaving}
                className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {smsSaving ? 'Saving SMS Configuration...' : 'Save SMS OTP Gateway'}
              </button>
            </form>

            {/* Test SMS & Live Delivery Logs */}
            <div className="space-y-4">
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Send Live Test SMS OTP</h3>
                <p className="text-[11px] text-slate-600">
                  Verify real phone delivery to your East Africa mobile number immediately.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={smsTestPhone}
                    onChange={(e) => setSmsTestPhone(e.target.value)}
                    placeholder="+254712727558"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900"
                  />
                  <button
                    type="button"
                    disabled={smsTesting}
                    onClick={handleSendTestSms}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{smsTesting ? 'Testing...' : 'Send Test SMS'}</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">Recent OTP Delivery Logs ({smsLogs.length})</h4>
                  <button
                    type="button"
                    onClick={loadOwnerConsoleData}
                    className="text-[11px] text-blue-700 font-semibold hover:underline cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
                {smsLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No OTP dispatch logs recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {smsLogs.map((log) => (
                      <div key={log.id} className="p-3 text-[11px] flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-mono font-bold text-slate-900">
                            {log.maskedPhone} · <span className="text-slate-600 font-normal">{log.provider}</span>
                          </div>
                          <div className="text-slate-600 break-words">{log.detail}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 ${
                            log.status === 'delivered'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: REAL-TIME ADMIN EMAIL ALERTS & SERVERLESS SMTP NOTIFIER */}
      {consoleTab === 'admin-alerts' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-700" />
                <span>Real-Time Admin Email Notifications &amp; Serverless SMTP Trigger</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Automatically emails <strong>{adminAlertEmail}</strong> whenever new customers register, high-reward tasks launch, Front &amp; Back National ID KYC submissions arrive, PayPal withdrawals are requested, or support tickets open.
              </p>
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                adminSmtpStatus?.configured
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              {adminSmtpStatus?.configured
                ? `SMTP Ready (${adminSmtpStatus.host}:${adminSmtpStatus.port})`
                : 'SMTP Env Variables Needed (SMTP_HOST / SMTP_USER / SMTP_PASS)'}
            </div>
          </div>

          {adminAlertsFeedback && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-900">
              {adminAlertsFeedback}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <form
              onSubmit={handleSaveAdminNotifications}
              className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Admin Alert Preferences</h3>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminAlertsEnabled}
                    onChange={(e) => setAdminAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
                  />
                  <span>Enable Real-Time Alerts</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin Recipient Email
                  </label>
                  <input
                    type="email"
                    required
                    value={adminAlertEmail}
                    onChange={(e) => setAdminAlertEmail(e.target.value)}
                    placeholder="nigideon36@gmail.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    High-Reward Task Threshold (KES)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={10000}
                    value={adminHighRewardKes}
                    onChange={(e) => setAdminHighRewardKes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="text-xs font-bold text-slate-800">Trigger Email Alerts On:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(
                    [
                      { key: 'new_registration', label: 'New Customer Registrations' },
                      { key: 'high_reward_task', label: 'High-Reward Task Published' },
                      { key: 'kyc_submitted', label: 'National ID KYC (Front & Back)' },
                      { key: 'withdrawal_requested', label: 'PayPal Withdrawals' },
                      { key: 'investment_deposit', label: 'Investment Deposits' },
                      { key: 'support_ticket', label: 'Customer Support Tickets' },
                      { key: 'ppv_status_uploaded', label: 'Free PPV Status Uploads' },
                      { key: 'auction_activity', label: 'Live Auction Listings' },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-blue-300"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(adminEventToggles[item.key])}
                        onChange={(e) =>
                          setAdminEventToggles((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={adminAlertsSaving}
                  className="flex-1 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {adminAlertsSaving ? 'Saving...' : 'Save Admin Alert Settings'}
                </button>
                <button
                  type="button"
                  disabled={adminAlertsTesting}
                  onClick={handleSendTestAdminEmail}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{adminAlertsTesting ? 'Sending...' : 'Send Test Admin Email'}</span>
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="font-bold text-slate-900">Server-Side SMTP Environment Status</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
                  <div>
                    <span className="text-slate-500 block">SMTP_HOST</span>
                    <strong className="text-slate-900">{adminSmtpStatus?.host || 'Not set'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SMTP_PORT</span>
                    <strong className="text-slate-900">{adminSmtpStatus?.port || 587}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SMTP_USER</span>
                    <strong className="text-slate-900">{adminSmtpStatus?.userMasked || 'Not set'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SMTP_FROM</span>
                    <strong className="text-slate-900 truncate block">{adminSmtpStatus?.fromLabel || 'Not set'}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Configure <code className="bg-slate-100 px-1 rounded">SMTP_HOST</code>, <code className="bg-slate-100 px-1 rounded">SMTP_PORT</code>, <code className="bg-slate-100 px-1 rounded">SMTP_USER</code>, and <code className="bg-slate-100 px-1 rounded">SMTP_PASS</code> securely in your project environment / Secrets. Serverless webhook endpoint: <code className="bg-slate-100 px-1 rounded font-mono">POST /api/serverless/admin-notify</code>.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    Admin Activity Email Dispatch Log ({adminAlertLogs.length})
                  </h4>
                  <button
                    type="button"
                    onClick={loadOwnerConsoleData}
                    className="text-[11px] text-blue-700 font-semibold hover:underline cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
                {adminAlertLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No admin notifications logged yet. Trigger a test email above or wait for live customer activity.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {adminAlertLogs.map((log) => (
                      <div key={log.id} className="p-3 text-[11px] flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-slate-900 break-words">
                            {log.title}
                            {log.amountLabel && (
                              <span className="ml-1.5 font-mono text-emerald-700">({log.amountLabel})</span>
                            )}
                          </div>
                          <div className="text-slate-600 break-words">{log.summary}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {log.deliveryNote} · {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 ${
                            log.deliveryStatus === 'Sent'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.deliveryStatus === 'Failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : log.deliveryStatus === 'Skipped'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {log.deliveryStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PAYPAL INTERNATIONAL CHECKOUT & ZAPIER AUTOMATION WORKFLOWS */}
      {consoleTab === 'paypal-zapier' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-700" />
                <span>PayPal (International Buyers) &amp; Zapier Automation Workflows</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Accept international USD payments via PayPal checkout links &amp; HTML buttons, and automate receipts with Zapier + Google AI Studio workflows.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span
                className={`px-3 py-1.5 rounded-xl border ${
                  paypalRestReady
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-sky-50 border-sky-300 text-sky-900'
                }`}
              >
                {paypalRestReady ? 'PayPal REST API v2 Ready' : 'PayPal Direct Checkout & PayPal.Me Ready'}
              </span>
              <span
                className={`px-3 py-1.5 rounded-xl border ${
                  zapierWebhookUrl
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                {zapierWebhookUrl ? 'Zapier Outbound Active' : 'Add Zapier Catch Hook'}
              </span>
            </div>
          </div>

          {paypalFeedback && (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-950 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-700 shrink-0" />
              <span>{paypalFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Non-secret PayPal & Zapier Configuration */}
            <form
              onSubmit={handleSavePayPalZapier}
              className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">1. PayPal Account &amp; Zapier Catch Hook</h3>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paypalEnabled}
                    onChange={(e) => setPaypalEnabled(e.target.checked)}
                    className="w-4 h-4 accent-sky-700 rounded cursor-pointer"
                  />
                  <span>Enable PayPal Checkout</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PayPal Business Email
                  </label>
                  <input
                    type="email"
                    required
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="nigideon36@gmail.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PayPal.Me Username / Handle
                  </label>
                  <input
                    type="text"
                    value={paypalMeHandle}
                    onChange={(e) => setPaypalMeHandle(e.target.value)}
                    placeholder="nigideon36"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Environment Mode
                  </label>
                  <select
                    value={paypalMode}
                    onChange={(e) => setPaypalMode(e.target.value === 'sandbox' ? 'sandbox' : 'live')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-900"
                  >
                    <option value="live">Live (Production)</option>
                    <option value="sandbox">Sandbox (Testing)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Zapier Outbound Catch Hook URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={zapierWebhookUrl}
                    onChange={(e) => setZapierWebhookUrl(e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 text-[11px]">
                <div className="font-bold text-slate-800 flex items-center justify-between gap-2">
                  <span>Inbound Zapier → Google AI Studio Webhook Endpoint:</span>
                  {inboundZapierUrl && (
                    <button
                      type="button"
                      onClick={() => void handleCopyPayPalValue('inbound-zap', inboundZapierUrl)}
                      className="inline-flex items-center gap-1 text-sky-700 font-bold hover:underline cursor-pointer"
                    >
                      {copiedPayPalField === 'inbound-zap' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayPalField === 'inbound-zap' ? 'Copied' : 'Copy Endpoint'}</span>
                    </button>
                  )}
                </div>
                <code className="block p-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-900 break-all">
                  {inboundZapierUrl && !/run\.app/i.test(inboundZapierUrl)
                    ? inboundZapierUrl
                    : `${CANONICAL_PLATFORM_ORIGIN}/api/paypal/zapier-webhook`}
                </code>
                <p className="text-slate-600 leading-relaxed">
                  In Zapier, connect <strong>PayPal (New Sale / IPN)</strong> → <strong>Webhooks by Zapier (POST)</strong> to this URL. Optional API keys (<code className="bg-slate-100 px-1 rounded">PAYPAL_CLIENT_ID</code>, <code className="bg-slate-100 px-1 rounded">PAYPAL_CLIENT_SECRET</code>, <code className="bg-slate-100 px-1 rounded">ZAPIER_WEBHOOK_SECRET</code>) stay encrypted in server environment secrets.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={paypalSaving}
                  className="flex-1 py-2.5 px-4 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {paypalSaving ? 'Saving Settings...' : 'Save PayPal & Zapier Settings'}
                </button>
                <button
                  type="button"
                  disabled={paypalTestingZapier}
                  onClick={handleTestZapierWorkflow}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{paypalTestingZapier ? 'Testing...' : 'Send Test Zapier Webhook'}</span>
                </button>
              </div>
            </form>

            {/* Right: Instant PayPal Checkout Link & HTML Button Generator */}
            <form
              onSubmit={handleGeneratePayPalButtonLink}
              className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-sky-700" />
                  <span>2. PayPal Checkout Link &amp; HTML Button Generator</span>
                </h3>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {[
                  { label: 'Client Escrow ($10.00)', item: 'Enterprise Task Escrow Deposit', usd: '10.00', pkg: 'escrow' },
                  { label: 'Merchant Campaign ($25.00)', item: 'Custom Survey & Creator Campaign Funding', usd: '25.00', pkg: 'campaign' },
                  { label: 'Growth Pool ($2.00)', item: 'Growth Pool Deposit via PayPal', usd: '2.00', pkg: 'pool' },
                  { label: 'Auction Settlement ($15.00)', item: 'Community Auction Product Purchase', usd: '15.00', pkg: 'auction' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setPaypalGenItemName(preset.item);
                      setPaypalGenAmountUsd(preset.usd);
                      setPaypalGenPackageId(preset.pkg);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Checkout Item / Order Description
                  </label>
                  <input
                    type="text"
                    required
                    value={paypalGenItemName}
                    onChange={(e) => setPaypalGenItemName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    min="0.50"
                    step="0.01"
                    required
                    value={paypalGenAmountUsd}
                    onChange={(e) => setPaypalGenAmountUsd(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={paypalGenerating}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                <Code className="w-4 h-4 text-sky-300" />
                <span>{paypalGenerating ? 'Generating...' : 'Generate PayPal Checkout Link & Button Code'}</span>
              </button>

              {paypalLatestLink && (
                <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      {paypalLatestLink.itemName} (${Number(paypalLatestLink.amountUsd).toFixed(2)} USD)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={paypalLatestLink.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0070ba] text-white font-bold text-[11px]"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleCopyPayPalValue('checkout-url', paypalLatestLink.checkoutUrl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-[11px] cursor-pointer"
                      >
                        {copiedPayPalField === 'checkout-url' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPayPalField === 'checkout-url' ? 'Copied URL' : 'Copy Link'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyPayPalValue('paypal-me', paypalLatestLink.payPalMeUrl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-[11px] cursor-pointer"
                      >
                        {copiedPayPalField === 'paypal-me' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPayPalField === 'paypal-me' ? 'Copied PayPal.Me' : 'Copy PayPal.Me'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>Embeddable PayPal HTML Checkout Button Snippet:</span>
                      <button
                        type="button"
                        onClick={() => void handleCopyPayPalValue('html-btn', paypalLatestLink.htmlButtonSnippet)}
                        className="text-sky-700 hover:underline cursor-pointer"
                      >
                        {copiedPayPalField === 'html-btn' ? 'Copied HTML!' : 'Copy HTML Code'}
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-lg bg-slate-900 text-sky-100 text-[10px] font-mono overflow-x-auto max-h-28">
                      {paypalLatestLink.htmlButtonSnippet}
                    </pre>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Bottom: Generated Links History & Zapier Automation Event Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  Generated PayPal Checkout Links ({paypalGeneratedLinks.length})
                </h4>
                <button
                  type="button"
                  onClick={loadOwnerConsoleData}
                  className="text-[11px] text-blue-700 font-semibold hover:underline cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              {paypalGeneratedLinks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No PayPal checkout links generated yet. Use the generator above to create one for international buyers.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {paypalGeneratedLinks.map((lnk) => (
                    <div key={lnk.id} className="p-3 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {lnk.itemName}{' '}
                          <span className="font-mono text-sky-700">(${Number(lnk.amountUsd).toFixed(2)})</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {lnk.id} · {new Date(lnk.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleCopyPayPalValue(lnk.id, lnk.checkoutUrl)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-800 cursor-pointer"
                        >
                          {copiedPayPalField === lnk.id ? 'Copied' : 'Copy URL'}
                        </button>
                        <a
                          href={lnk.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[11px] font-bold text-sky-800"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  PayPal &amp; Zapier Workflow Automation Logs ({zapierLogs.length})
                </h4>
                <button
                  type="button"
                  onClick={loadOwnerConsoleData}
                  className="text-[11px] text-blue-700 font-semibold hover:underline cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              {zapierLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No Zapier or PayPal webhook events logged yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {zapierLogs.map((zlog) => (
                    <div key={zlog.id} className="p-3 text-[11px] flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-slate-900">
                          <span className="uppercase font-mono text-[10px] text-sky-700 mr-1.5">
                            [{zlog.direction}]
                          </span>
                          {zlog.event}
                          {zlog.amountUsd !== undefined && (
                            <span className="ml-1.5 font-mono text-emerald-700">
                              (${Number(zlog.amountUsd).toFixed(2)} USD)
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 break-words">{zlog.detail}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {zlog.transactionId ? `${zlog.transactionId} · ` : ''}
                          {new Date(zlog.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 ${
                          zlog.status === 'Sent' || zlog.status === 'Received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : zlog.status === 'Failed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {zlog.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: FACEBOOK PAGE BRAND KIT (PROFILE PHOTO, COVER PHOTO, BIO & WELCOME POST) */}
      {consoleTab === 'brand-kit' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-700" />
                <span>Gideon Global Tasks — Facebook Page Brand Kit</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Download your custom clean Profile Photo and Cover Photo below, then copy your Bio and Welcome Post straight to Facebook.
              </p>
            </div>
          </div>

          {/* Live Facebook Page Mockup Preview */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 text-xs font-bold text-slate-700">
              Live Facebook Page Preview
            </div>
            <div className="relative bg-slate-900">
              <img
                src={fbCoverImg}
                alt="Gideon Global Tasks Facebook Cover Photo"
                referrerPolicy="no-referrer"
                className="w-full h-44 sm:h-64 object-cover"
              />
            </div>
            <div className="px-6 pb-6 pt-0 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 relative z-10">
                <div className="flex items-end gap-4">
                  <img
                    src={fbProfileImg}
                    alt="Gideon Global Tasks Facebook Profile Photo"
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-lg object-cover bg-blue-900"
                  />
                  <div className="pb-1">
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">Gideon Global Tasks</h3>
                    <p className="text-xs text-slate-600">
                      1 verified task drops daily at 8:00 AM EAT. Merchant-set rewards &amp; KES 150+ PayPal payouts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Download Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">1. Clean Profile Photo (1:1 Square / Circle Safe)</h3>
                  <p className="text-[11px] text-slate-500">Centered cobalt &amp; emerald vector logo sized for Facebook avatar crop.</p>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center">
                <img
                  src={fbProfileImg}
                  alt="Profile Photo Full Preview"
                  referrerPolicy="no-referrer"
                  className="w-44 h-44 rounded-full object-cover shadow-md border-4 border-white"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/brand/facebook-profile.jpg?download=1"
                  download="gideon-facebook-profile.jpg"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Profile Photo (.JPG)</span>
                </a>
                <a
                  href="/brand/facebook-profile.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full</span>
                </a>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">2. Full-Bleed Cover Photo (16:9 Banner)</h3>
                  <p className="text-[11px] text-slate-500">High-contrast navy/emerald corporate header for Desktop &amp; Mobile.</p>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <img
                  src={fbCoverImg}
                  alt="Cover Photo Full Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-44 object-cover rounded-lg shadow-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/brand/facebook-cover.jpg?download=1"
                  download="gideon-facebook-cover.jpg"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Cover Photo (.JPG)</span>
                </a>
                <a
                  href="/brand/facebook-cover.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full</span>
                </a>
              </div>
            </div>
          </div>

          {/* Copyable Bio & Welcome Post */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-900">Facebook Bio (101-Character Limit)</span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyPayPalValue(
                        'fb-bio',
                        '1 daily task at 8:00 AM EAT. Merchant-set rewards & KES 150+ PayPal payouts after ID KYC.'
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    {copiedPayPalField === 'fb-bio' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPayPalField === 'fb-bio' ? 'Copied Bio!' : 'Copy Bio'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed">
                  1 daily task at 8:00 AM EAT. Merchant-set rewards &amp; KES 150+ PayPal payouts after ID KYC.
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-900">Extended Page Intro / About</span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyPayPalValue(
                        'fb-about',
                        'Gideon Global Tasks is an East Africa & international crowdsourced digital work marketplace. Access is 100% free (no Worker Pass required) with 1 verified task dropped daily at 8:00 AM EAT and rewards set per task and merchant budget. Withdrawals start from KES 150 via PayPal after uploading clear Front & Back photos of your National ID.'
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    {copiedPayPalField === 'fb-about' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPayPalField === 'fb-about' ? 'Copied Intro!' : 'Copy Intro'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  Gideon Global Tasks is an East Africa &amp; international crowdsourced digital work marketplace. Access is 100% free (no Worker Pass required) with 1 verified task dropped daily at 8:00 AM EAT and rewards set per task and merchant budget. Withdrawals start from KES 150 via PayPal after uploading clear Front &amp; Back photos of your National ID.
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">Pinned Welcome Post (Ready to Publish)</span>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyPayPalValue(
                      'fb-post',
                      `Welcome to the official Facebook page for Gideon Global Tasks!\n\nWe connect hardworking digital contributors across East Africa and global merchants through simple, verifiable online tasks you can complete right from your smartphone or computer.\n\nHow You Can Earn on Gideon Global Tasks:\n- Daily 8:00 AM EAT Task Drop: Access is 100% free with no Worker Pass fees. One task drops every day at exactly 8:00 AM EAT — keep time and complete it while spots remain! Task rewards depend on the task type and merchant budget.\n- Free Pay-Per-View (PPV) Status Feed: Upload your own original photos or funny short videos at zero cost and earn 5 shillings per verified view, automatically settled to your wallet after 24 hours.\n- 20% Partner Referrals: Share tasks or invite colleagues using your referral link to earn commissions on verified activity.\n- Growth Pools & Auctions: Explore live community product auctions and verified short-term yield pools.\n\nTrusted PayPal Payouts & KYC:\nWithdrawals start from just KES 150 exclusively via PayPal, subject to strict National ID KYC (upload clear Front & Back photos of your country's National ID in My Account).\n\nGet Started Today:\n${CANONICAL_PLATFORM_URL}\n\nSupport: nigideon36@gmail.com | +254 712 727 558`
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  {copiedPayPalField === 'fb-post' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPayPalField === 'fb-post' ? 'Copied Welcome Post!' : 'Copy Welcome Post'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
{`Welcome to the official Facebook page for Gideon Global Tasks!

We connect hardworking digital contributors across East Africa and global merchants through simple, verifiable online tasks you can complete right from your smartphone or computer.

How You Can Earn on Gideon Global Tasks:
- Daily 8:00 AM EAT Task Drop: Access is 100% free with no Worker Pass fees. One task drops every day at exactly 8:00 AM EAT — keep time and complete it while spots remain! Task rewards depend on the task type and merchant budget.
- Free Pay-Per-View (PPV) Status Feed: Upload your own original photos or funny short videos at zero cost and earn 5 shillings per verified view, automatically settled to your wallet after 24 hours.
- 20% Partner Referrals: Share tasks or invite colleagues using your referral link to earn commissions on verified activity.
- Growth Pools & Auctions: Explore live community product auctions and verified short-term yield pools.

Trusted PayPal Payouts & KYC:
Withdrawals start from just KES 150 exclusively via PayPal, subject to strict National ID KYC (upload clear Front & Back photos of your country's National ID in My Account).

Get Started Today:
${CANONICAL_PLATFORM_URL}

Support: nigideon36@gmail.com | +254 712 727 558`}
              </pre>
            </div>
          </div>

          {/* 3. Today's Promotional Post & Clean Photo */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  3. Today&apos;s Promotional Post &amp; Clean Photo (Ready to Publish)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Clean, distraction-free promotional photo paired with high-converting copy covering every way to earn and withdraw on {CANONICAL_PLATFORM_URL}.
                </p>
              </div>
              <a
                href={todayPromoImg}
                download="gideon-today-promo-post.jpg"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Clean Promo Photo (.JPG)</span>
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <img
                  src={todayPromoImg}
                  alt="Gideon Global Tasks Today Promotional Photo"
                  referrerPolicy="no-referrer"
                  className="w-full rounded-xl object-cover shadow-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <a
                    href={todayPromoImg}
                    download="gideon-today-promo-post.jpg"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save Promo Image (.JPG)</span>
                  </a>
                  <a
                    href={todayPromoImg}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Full</span>
                  </a>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">Today&apos;s Social Post Caption (Copy &amp; Paste)</span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyPayPalValue(
                        'today-promo-post',
                        `Earn Online Every Day with Gideon Global Tasks — 100% Free to Join (Zero Worker Pass Fees)!\n\nLooking for transparent digital work, creator rewards, and protected online trading across East Africa & globally? Join Gideon Global Tasks today:\n\n1. Daily 8:00 AM EAT Task Drop\nOne verified task drops daily at exactly 8:00 AM EAT — keep time and tap "Open Task" as soon as the live countdown hits zero! Task rewards depend on the specific task and sponsoring merchant budget.\n\n2. Free Pay-Per-View (PPV) Status Feed\nPost your own original photos or short comedy clips for free and earn 5 Shillings per verified view, automatically credited to your wallet after 24 hours.\n\n3. Escrow-Protected Real Auctions (50% Deposit)\nBid or auction real physical items with confidence — every auction requires a mandatory 50% PayPal escrow deposit first to protect both buyers and sellers.\n\n4. Growth Pools (From KES 50) & 20% Partner Referrals\nParticipate in short-term growth pools starting from KES 50 and earn 20% recurring commission from every referred contributor.\n\n5. Fast PayPal Payouts from KES 150 + Strict KYC\nWithdraw your earnings exclusively via PayPal starting from just 150 Shillings (KES 150) once your account completes strict Front & Back National ID KYC verification.\n\nStart earning now:\n${CANONICAL_PLATFORM_URL}\n\nSupport: nigideon36@gmail.com | Call: +254 712 727 558 | WhatsApp: 0785909543`
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    {copiedPayPalField === 'today-promo-post' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPayPalField === 'today-promo-post' ? "Copied Today's Post!" : "Copy Today's Post"}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
{`Earn Online Every Day with Gideon Global Tasks — 100% Free to Join (Zero Worker Pass Fees)!

Looking for transparent digital work, creator rewards, and protected online trading across East Africa & globally? Join Gideon Global Tasks today:

1. Daily 8:00 AM EAT Task Drop
One verified task drops daily at exactly 8:00 AM EAT — keep time and tap "Open Task" as soon as the live countdown hits zero! Task rewards depend on the specific task and sponsoring merchant budget.

2. Free Pay-Per-View (PPV) Status Feed
Post your own original photos or short comedy clips for free and earn 5 Shillings per verified view, automatically credited to your wallet after 24 hours.

3. Escrow-Protected Real Auctions (50% Deposit)
Bid or auction real physical items with confidence — every auction requires a mandatory 50% PayPal escrow deposit first to protect both buyers and sellers.

4. Growth Pools (From KES 50) & 20% Partner Referrals
Participate in short-term growth pools starting from KES 50 and earn 20% recurring commission from every referred contributor.

5. Fast PayPal Payouts from KES 150 + Strict KYC
Withdraw your earnings exclusively via PayPal starting from just 150 Shillings (KES 150) once your account completes strict Front & Back National ID KYC verification.

Start earning now:
${CANONICAL_PLATFORM_URL}

Support: nigideon36@gmail.com | Call: +254 712 727 558 | WhatsApp: 0785909543`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full National ID KYC Front & Back Viewer Modal */}
      {previewKyc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setPreviewKyc(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="text-xs font-bold text-slate-900">
                {previewKyc.idDocumentName} ({previewKyc.countryCode}) · {previewKyc.fullNameOnId} · ID: <span className="font-mono">{previewKyc.idNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewKyc(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[75vh] overflow-auto">
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-300 uppercase">Front of {previewKyc.idDocumentName}</div>
                <img
                  src={previewKyc.frontImageDataUrl}
                  alt={`Front ID ${previewKyc.idNumber}`}
                  className="w-full max-h-[60vh] object-contain rounded-lg bg-slate-800"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-300 uppercase">Back of {previewKyc.idDocumentName}</div>
                <img
                  src={previewKyc.backImageDataUrl}
                  alt={`Back ID ${previewKyc.idNumber}`}
                  className="w-full max-h-[60vh] object-contain rounded-lg bg-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Investment Screenshot Proof Viewer Modal */}
      {previewInvScreenshot && previewInvScreenshot.screenshotDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setPreviewInvScreenshot(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="text-xs font-bold text-slate-900">
                Investment Proof: <span className="font-mono">{previewInvScreenshot.paymentReference}</span> · {previewInvScreenshot.customerName} (KES {previewInvScreenshot.amountKes})
              </div>
              <button
                type="button"
                onClick={() => setPreviewInvScreenshot(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewInvScreenshot.screenshotDataUrl}
                alt={`Investment Screenshot ${previewInvScreenshot.paymentReference}`}
                className="max-w-full max-h-[68vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
