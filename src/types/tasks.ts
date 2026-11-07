export type TaskCategory = 
  | 'survey' 
  | 'annotation' 
  | 'data-entry' 
  | 'writing' 
  | 'meme-content' 
  | 'micro';

export type TaskDifficulty = 'Beginner' | 'Intermediate' | 'Expert';

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
}

export interface PayoutRecord {
  id: string;
  amount: number;
  method: 'M-PESA' | 'PayPal' | 'Wise' | 'Crypto USDT' | 'Bank Wire' | 'Amazon Gift Card';
  accountDetails: string;
  status: 'Completed' | 'Processing';
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
  price: number; // 2, 5, 10
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
  refereeName: string;
  refereeEmailMasked: string;
  refereeCountry: string;
  dateJoined: string;
  passPurchased: string; // e.g. "Starter Pass ($2)", "Pro Tasker Pass ($5)", "VIP Taskmaster Pass ($10)"
  passPrice: number;
  commissionRate: number; // e.g. 0.20 (20%)
  commissionEarned: number; // e.g. 1.00
  paymentMethod: 'M-PESA' | 'Card' | 'Wallet';
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
  commissionPercentage: number; // e.g. 20
  vipTierBonusPercent: number; // e.g. 5
}

