import type { TaskCategory } from '../types/tasks.ts';
import {
  EAST_AFRICA_COUNTRIES,
  MAX_TASK_REWARD_KES,
  MAX_TASK_REWARD_USD,
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
  type EastAfricaCountry,
} from './eastAfrica.ts';

export type QuotaTierId = 'free' | 'starter' | 'pro' | 'vip';

export interface PassQuotaRule {
  tierId: QuotaTierId;
  name: string;
  priceKes: number;
  dailyLimit: number;
  maxAmountKes: number;
  maxAmountUsd: number;
  dailyUnitLabel: string;
  shortRuleLabel: string;
  surveyFocused?: boolean;
}

export const PASS_QUOTA_RULES: Record<QuotaTierId, PassQuotaRule> = {
  free: {
    tierId: 'free',
    name: 'Free Tier (No Worker Pass)',
    priceKes: 0,
    dailyLimit: 1,
    maxAmountKes: MAX_TASK_REWARD_KES,
    maxAmountUsd: MAX_TASK_REWARD_USD,
    dailyUnitLabel: '1 free task daily',
    shortRuleLabel: `Only 1 free task/day · Max ${MAX_TASK_REWARD_KES} shillings`,
  },
  starter: {
    tierId: 'starter',
    name: 'Starter Contributor Pass',
    priceKes: 50,
    dailyLimit: 2,
    maxAmountKes: MAX_TASK_REWARD_KES,
    maxAmountUsd: MAX_TASK_REWARD_USD,
    dailyUnitLabel: '2 tasks daily',
    shortRuleLabel: `2 tasks/day · Max ${MAX_TASK_REWARD_KES} shillings/task`,
  },
  pro: {
    tierId: 'pro',
    name: 'Pro Tasker Pass (Second Pass)',
    priceKes: 100,
    dailyLimit: 3,
    maxAmountKes: MAX_TASK_REWARD_KES,
    maxAmountUsd: MAX_TASK_REWARD_USD,
    dailyUnitLabel: '3 tasks daily',
    shortRuleLabel: `3 tasks/day · Max ${MAX_TASK_REWARD_KES} shillings/task`,
  },
  vip: {
    tierId: 'vip',
    name: 'VIP Taskmaster Pass',
    priceKes: 200,
    dailyLimit: 4,
    maxAmountKes: MAX_TASK_REWARD_KES,
    maxAmountUsd: MAX_TASK_REWARD_USD,
    dailyUnitLabel: '4 surveys daily',
    shortRuleLabel: `4 surveys/day · Max ${MAX_TASK_REWARD_KES} shillings/survey`,
    surveyFocused: true,
  },
};

export function getQuotaRuleForPackageId(packageId?: string | null): PassQuotaRule {
  if (packageId === 'starter') return PASS_QUOTA_RULES.starter;
  if (packageId === 'pro') return PASS_QUOTA_RULES.pro;
  if (packageId === 'vip') return PASS_QUOTA_RULES.vip;
  return PASS_QUOTA_RULES.free;
}

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface TaskEligibilityResult {
  allowed: boolean;
  reasonCode?: 'DAILY_LIMIT_REACHED' | 'AMOUNT_EXCEEDS_TIER' | 'CATEGORY_LOCKED' | 'VIP_SURVEY_LIMIT_REACHED';
  reason?: string;
  rule: PassQuotaRule;
  requiredMinTier?: QuotaTierId;
}

export function getMinimumTierForReward(_rewardUsd: number): QuotaTierId {
  return 'free';
}

export function evaluateTaskEligibility(params: {
  packageId?: string | null;
  unlockedCategories?: TaskCategory[];
  taskReward: number;
  taskCategory: TaskCategory;
  completedTodayCount: number;
  surveysCompletedTodayCount: number;
  isOwner?: boolean;
  country?: EastAfricaCountry;
}): TaskEligibilityResult {
  const rule = getQuotaRuleForPackageId(params.packageId);
  const country = params.country || EAST_AFRICA_COUNTRIES[0];
  const maxLocalLabel = formatCurrencyFromKes(rule.maxAmountKes, country);

  if (params.isOwner) {
    return { allowed: true, rule };
  }

  const reward = Number(params.taskReward) || 0;
  const rewardLocalLabel = formatCurrencyFromUsd(reward, country);

  // 1. Check hard 50-shilling per-task / per-survey reward ceiling
  if (reward > rule.maxAmountUsd + 1e-4) {
    return {
      allowed: false,
      reasonCode: 'AMOUNT_EXCEEDS_TIER',
      rule,
      reason: `Reward ${rewardLocalLabel} exceeds the maximum allowed per completed task (${maxLocalLabel} / 50 shillings max across all Worker Passes).`,
    };
  }

  // 2. Check category unlock for paid passes
  if (rule.tierId !== 'free' && Array.isArray(params.unlockedCategories) && !params.unlockedCategories.includes(params.taskCategory)) {
    return {
      allowed: false,
      reasonCode: 'CATEGORY_LOCKED',
      rule,
      requiredMinTier: 'pro',
      reason: `${rule.name} does not include "${params.taskCategory}" tasks. Upgrade to Second Worker Pass (${formatCurrencyFromKes(100, country)}) or VIP Pass (${formatCurrencyFromKes(200, country)}).`,
    };
  }

  // 3. For VIP Worker Pass: enforce 4 surveys daily cap (and 4 total daily cap)
  if (rule.tierId === 'vip') {
    if (params.taskCategory === 'survey' && params.surveysCompletedTodayCount >= rule.dailyLimit) {
      return {
        allowed: false,
        reasonCode: 'VIP_SURVEY_LIMIT_REACHED',
        rule,
        reason: `Daily limit reached: VIP Worker Pass allows ${rule.dailyLimit} surveys daily (not exceeding ${maxLocalLabel}). Your limit resets tomorrow.`,
      };
    }
    if (params.completedTodayCount >= rule.dailyLimit) {
      return {
        allowed: false,
        reasonCode: 'DAILY_LIMIT_REACHED',
        rule,
        reason: `Daily limit reached: VIP Worker Pass allows ${rule.dailyLimit} surveys/tasks daily (not exceeding ${maxLocalLabel}). Come back tomorrow!`,
      };
    }
    return { allowed: true, rule };
  }

  // 4. Daily task count limits for Free (1), Starter (2), Pro (3)
  if (params.completedTodayCount >= rule.dailyLimit) {
    const nextTier: QuotaTierId =
      rule.tierId === 'free' ? 'starter' : rule.tierId === 'starter' ? 'pro' : 'vip';
    const nextRule = PASS_QUOTA_RULES[nextTier];
    return {
      allowed: false,
      reasonCode: 'DAILY_LIMIT_REACHED',
      rule,
      requiredMinTier: nextTier,
      reason: `Daily limit reached (${params.completedTodayCount}/${rule.dailyLimit} for ${rule.name}, max ${maxLocalLabel}/task). Upgrade to ${nextRule.name} (${nextRule.dailyUnitLabel}, max ${maxLocalLabel}/task).`,
    };
  }

  return { allowed: true, rule };
}
