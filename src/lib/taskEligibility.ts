import type { EastAfricaCountry } from './eastAfrica';
import type { TaskCategory } from '../types/tasks';

export type QuotaTierId = 'open';

export const OPEN_ACCESS_DAILY_LIMIT = 1;
export const DAILY_DROP_HOUR_EAT = 8;
export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000; // East Africa Time (Africa/Nairobi UTC+3, no DST)

export const DAILY_DROP_TASK_IDS: string[] = [
  'task-anno-101',
  'task-entry-201',
  'task-surv-301',
  'task-meme-401',
  'task-write-501',
  'task-micro-601',
  'task-surv-302',
  'task-anno-102',
  'task-micro-602',
  'task-creator-701',
  'task-creator-702',
  'task-creator-703',
  'task-creator-704',
  'task-surv-300',
  'task-surv-303',
  'task-micro-603',
  'task-surv-304',
];

export interface QuotaRule {
  tierId: QuotaTierId;
  name: string;
  priceKes: number;
  dailyLimit: number;
  dailyUnitLabel: string;
  shortRuleLabel: string;
}

export const OPEN_ACCESS_QUOTA_RULE: QuotaRule = {
  tierId: 'open',
  name: 'Daily 8:00 AM EAT Task Drop (No Worker Pass)',
  priceKes: 0,
  dailyLimit: OPEN_ACCESS_DAILY_LIMIT,
  dailyUnitLabel: '1 task daily at 08:00 AM EAT',
  shortRuleLabel: 'Free access · 1 daily drop at 8:00 AM EAT · Merchant-set rewards',
};

export interface EatNowInfo {
  year: number;
  month: number;
  day: number;
  dateKey: string;
  hour: number;
  minute: number;
  second: number;
  isDropWindowOpen: boolean;
  msUntilNextDrop: number;
  nextDropLabel: string;
  eatTimeLabel: string;
  epochDay: number;
}

export function getEatNowInfo(now: Date = new Date()): EatNowInfo {
  const eatMs = now.getTime() + EAT_OFFSET_MS;
  const eatDate = new Date(eatMs);
  const year = eatDate.getUTCFullYear();
  const month = eatDate.getUTCMonth() + 1;
  const day = eatDate.getUTCDate();
  const hour = eatDate.getUTCHours();
  const minute = eatDate.getUTCMinutes();
  const second = eatDate.getUTCSeconds();

  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isDropWindowOpen = hour >= DAILY_DROP_HOUR_EAT;
  const epochDay = Math.floor(eatMs / 86400000);

  const nextDropEatMs = isDropWindowOpen
    ? Date.UTC(year, month - 1, day + 1, DAILY_DROP_HOUR_EAT, 0, 0, 0)
    : Date.UTC(year, month - 1, day, DAILY_DROP_HOUR_EAT, 0, 0, 0);

  const msUntilNextDrop = Math.max(0, nextDropEatMs - eatMs);
  const eatTimeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} EAT`;

  return {
    year,
    month,
    day,
    dateKey,
    hour,
    minute,
    second,
    isDropWindowOpen,
    msUntilNextDrop,
    nextDropLabel: isDropWindowOpen ? 'Tomorrow 08:00 AM EAT' : 'Today 08:00 AM EAT',
    eatTimeLabel,
    epochDay,
  };
}

export function formatCountdownHms(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getTodayDateKey(date: Date = new Date()): string {
  return getEatNowInfo(date).dateKey;
}

export function getDailyDroppedTaskId(
  tasksOrIds: Array<{ id: string; spotsRemaining?: number } | string>,
  date: Date = new Date()
): string | null {
  if (!Array.isArray(tasksOrIds) || tasksOrIds.length === 0) return null;

  const normalized = tasksOrIds.map((item) =>
    typeof item === 'string' ? { id: item, spotsRemaining: 1 } : item
  );
  const withSpots = normalized.filter((t) => t.id && (t.spotsRemaining ?? 1) > 0);
  const pool = (withSpots.length > 0 ? withSpots : normalized).map((t) => t.id).filter(Boolean);
  if (pool.length === 0) return null;

  const { epochDay } = getEatNowInfo(date);
  const idx = ((epochDay % pool.length) + pool.length) % pool.length;
  return pool[idx];
}

export interface TaskEligibilityResult {
  allowed: boolean;
  rule: QuotaRule;
  reasonCode?: 'BEFORE_8AM_DROP' | 'NOT_TODAY_DROP' | 'DAILY_LIMIT_REACHED';
  reason?: string;
}

export function evaluateTaskEligibility(params: {
  taskId?: string;
  droppedTaskId?: string | null;
  now?: Date;
  taskReward: number;
  taskCategory?: TaskCategory;
  completedTodayCount: number;
  isOwner?: boolean;
  country?: EastAfricaCountry;
}): TaskEligibilityResult {
  if (params.isOwner) {
    return { allowed: true, rule: OPEN_ACCESS_QUOTA_RULE };
  }

  const eatInfo = getEatNowInfo(params.now);

  if (!eatInfo.isDropWindowOpen) {
    const countdown = formatCountdownHms(eatInfo.msUntilNextDrop);
    return {
      allowed: false,
      rule: OPEN_ACCESS_QUOTA_RULE,
      reasonCode: 'BEFORE_8AM_DROP',
      reason: `Today's 1 daily task drops at exactly 08:00 AM EAT (in ${countdown}). Keep time!`,
    };
  }

  if (params.completedTodayCount >= OPEN_ACCESS_DAILY_LIMIT) {
    return {
      allowed: false,
      rule: OPEN_ACCESS_QUOTA_RULE,
      reasonCode: 'DAILY_LIMIT_REACHED',
      reason: `Daily limit reached (${params.completedTodayCount}/${OPEN_ACCESS_DAILY_LIMIT} task today). Next task drops tomorrow at 08:00 AM EAT!`,
    };
  }

  if (params.droppedTaskId && params.taskId && params.taskId !== params.droppedTaskId) {
    return {
      allowed: false,
      rule: OPEN_ACCESS_QUOTA_RULE,
      reasonCode: 'NOT_TODAY_DROP',
      reason: 'Only 1 selected task drops daily at 08:00 AM EAT. Complete Today\'s 8:00 AM Drop or wait for tomorrow\'s drop!',
    };
  }

  return { allowed: true, rule: OPEN_ACCESS_QUOTA_RULE };
}

