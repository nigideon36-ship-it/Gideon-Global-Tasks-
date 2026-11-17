export type TaskCategory = 
  | 'survey' 
  | 'annotation' 
  | 'data-entry' 
  | 'writing' 
  | 'meme-content' 
  | 'creator-campaign'
  | 'micro';

export type TaskDifficulty = 'Beginner' | 'Intermediate' | 'Expert';

export type CampaignPlatform = 'Facebook' | 'Instagram' | 'TikTok' | 'WhatsApp';

export type CampaignContentFormat = 'reel' | 'video' | 'text-post';

export interface CreatorCampaignConfig {
  productName: string;
  productCategory: string;
  allowedPlatforms: CampaignPlatform[];
  allowedFormats: CampaignContentFormat[];
  campaignBrief: string;
  talkingPoints: string[];
  requiredHashtags: string[];
  minDurationSeconds?: number;
  minWordCount?: number;
  productTagline?: string;
}

export interface CreatorCampaignSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  productName: string;
  platform: CampaignPlatform;
  format: CampaignContentFormat;
  creatorHandle: string;
  postUrl?: string;
  captionText: string;
  whatsappProofAttached?: boolean;
  rewardUsd: number;
  countryCode: string;
  submittedAt: string;
  status: 'Approved' | 'Under Review';
}

export interface SurveyQuestion {
  id: string;
  type: 'single-choice' | 'multiple-choice' | 'scale' | 'text';
  question: string;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  required?: boolean;
  minChars?: number;
}

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

export interface AnnotationConfig {
  type: 'bounding-box' | 'sentiment' | 'entity';
  imageUrl?: string;
  targetLabels: string[];
  expectedCount?: number;
  sentimentText?: string;
  instructions: string;
}

export interface DataEntryConfig {
  documentUrl: string;
  documentType: 'receipt' | 'invoice' | 'business-card';
  fields: {
    key: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'currency';
    expectedValue?: string;
    hint: string;
  }[];
}

export interface WritingConfig {
  prompt: string;
  targetWordCount: { min: number; max: number };
  mandatoryKeywords: string[];
  tone: 'Professional' | 'Casual' | 'Creative' | 'Technical';
  rubric: string[];
}

export interface MicroTaskConfig {
  type: 'quick-poll' | 'app-vote' | 'ui-audit' | 'tagging';
  title: string;
  steps: string[];
  options?: string[];
}

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  description: string;
  reward: number; // in USD
  estimatedMinutes: number;
  difficulty: TaskDifficulty;
  spotsRemaining: number;
  totalSpots: number;
  requesterName: string;
  requesterRating: number;
  requesterVerified: boolean;
  tags: string[];
  createdAt: string;
  instructions: string[];
  // Domain configs
  surveyQuestions?: SurveyQuestion[];
  annotationConfig?: AnnotationConfig[];
  dataEntryConfig?: DataEntryConfig;
  writingConfig?: WritingConfig;
  microConfig?: MicroTaskConfig;
  creatorCampaignConfig?: CreatorCampaignConfig;
}

export interface PayoutRecord {
  id: string;
  amount: number;
  method: 'M-PESA' | 'Airtel / MTN MoMo' | 'East Africa Bank' | 'Wise' | 'Crypto USDT';
  accountDetails: string;
  status: 'Completed' | 'Processing' | 'Rejected';
  timestamp: string;
  mpesaReceipt?: string;
}

export interface TaskHistoryRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  category: TaskCategory;
  reward: number;
  status: 'Approved' | 'Under Review';
  completedAt: string;
  accuracyScore: number;
  transactionRef: string;
}

export interface TaskPackage {
  id: 'starter' | 'pro' | 'vip';
  name: string;
  price: number; // USD equivalent of priceKes
  priceKes: number; // Base price in Kenya Shillings: 50, 100, 200
  description: string;
  taskAllowance: string;
  unlockedCategories: TaskCategory[];
  features: string[];
  isPopular?: boolean;
}

export interface MemeItem {
  id: string;
  title: string;
  author: string;
  authorCountry: string;
  authorAvatar?: string;
  imageUrl: string;
  upvotes: number;
  tipsEarned: number;
  category: string;
  createdAt: string;
  userUpvoted?: boolean;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  country: string;
  countryCode: string;
  avatar: string;
  tasksCompleted: number;
  earnings: number;
  accuracyRate: number;
  tier: 'Diamond' | 'Gold' | 'Silver' | 'Bronze';
}

export interface ReferralRecord {
  id: string;
  referredUserUid?: string;
  packageId?: string;
  refereeName: string;
  refereeEmailMasked: string;
  refereeCountry: string;
  dateJoined: string;
  passPurchased: string;
  passPrice: number;
  commissionRate: number;
  commissionEarned: number;
  paymentMethod: 'M-PESA' | 'Card' | 'Mobile Money';
  status: 'Credited' | 'Pending';
  transactionId: string;
}

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalClicks: number;
  totalSignups: number;
  passesPurchasedCount: number;
  totalCommissionEarned: number;
  pendingCommission: number;
  commissionPercentage: number;
  vipTierBonusPercent: number;
  vipReferralCount?: number;
}
