import fs from 'fs';
import path from 'path';
import {
  getEatNowInfo,
  getTodayDateKey,
  getDailyDroppedTaskId,
  formatCountdownHms,
  OPEN_ACCESS_DAILY_LIMIT,
  DAILY_DROP_TASK_IDS,
  evaluateTaskEligibility,
  type QuotaTierId,
  type TaskEligibilityResult,
} from './taskEligibility.ts';

export {
  getEatNowInfo,
  getTodayDateKey,
  getDailyDroppedTaskId,
  formatCountdownHms,
  OPEN_ACCESS_DAILY_LIMIT,
  DAILY_DROP_TASK_IDS,
  evaluateTaskEligibility,
};
export type { QuotaTierId, TaskEligibilityResult };

export interface DailyTaskEntry {
  taskId: string;
  category: string;
  rewardUsd: number;
  tierId: QuotaTierId;
  completedAt: string;
}

export interface DailyUserQuotaRecord {
  userKey: string;
  dateKey: string;
  totalCount: number;
  surveyCount: number;
  totalEarnedTodayUsd: number;
  entries: DailyTaskEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const QUOTA_FILE = path.join(DATA_DIR, 'daily-task-usage.json');

const quotaByUserDate = new Map<string, DailyUserQuotaRecord>();

function makeMapKey(userKey: string, dateKey: string): string {
  return `${userKey}::${dateKey}`;
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(QUOTA_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const rec of raw) {
        if (rec && rec.userKey && rec.dateKey) {
          quotaByUserDate.set(makeMapKey(rec.userKey, rec.dateKey), rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load daily task quota store:', (err as Error)?.message || err);
  }
}

function persistToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const today = getTodayDateKey();
    const cutoff = Date.now() - 14 * 86400 * 1000;
    const items = Array.from(quotaByUserDate.values()).filter((r) => {
      if (r.dateKey === today) return true;
      const t = Date.parse(r.dateKey);
      return Number.isNaN(t) ? true : t >= cutoff;
    });
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist daily task quota store:', (err as Error)?.message || err);
  }
}

loadFromDisk();

export function getUserDailyQuotaRecord(userKey: string, dateKey: string = getTodayDateKey()): DailyUserQuotaRecord {
  const k = makeMapKey(userKey, dateKey);
  const existing = quotaByUserDate.get(k);
  if (existing) return existing;
  return {
    userKey,
    dateKey,
    totalCount: 0,
    surveyCount: 0,
    totalEarnedTodayUsd: 0,
    entries: [],
  };
}

export function validateAndRecordDailyTaskUsage(params: {
  userKey: string;
  taskId: string;
  category: string;
  rewardUsd: number;
  isOwner?: boolean;
}): {
  allowed: boolean;
  error?: string;
  clampedRewardUsd: number;
  record: DailyUserQuotaRecord;
} {
  const now = new Date();
  const eatInfo = getEatNowInfo(now);
  const dateKey = eatInfo.dateKey;
  const current = getUserDailyQuotaRecord(params.userKey, dateKey);
  const rawReward = Math.max(0.01, Number(params.rewardUsd) || 0.25);

  if (!params.isOwner) {
    if (!eatInfo.isDropWindowOpen) {
      return {
        allowed: false,
        error: `Today's 1 daily task drops at exactly 08:00 AM EAT (in ${formatCountdownHms(eatInfo.msUntilNextDrop)}). Keep time!`,
        clampedRewardUsd: 0,
        record: current,
      };
    }

    if (current.totalCount >= OPEN_ACCESS_DAILY_LIMIT) {
      return {
        allowed: false,
        error: `Daily limit reached (${current.totalCount}/${OPEN_ACCESS_DAILY_LIMIT} task today). Next task drops tomorrow at 08:00 AM EAT.`,
        clampedRewardUsd: 0,
        record: current,
      };
    }
  }

  const awardedRewardUsd = +rawReward.toFixed(4);

  const updated: DailyUserQuotaRecord = {
    userKey: params.userKey,
    dateKey,
    totalCount: current.totalCount + 1,
    surveyCount: current.surveyCount + (params.category === 'survey' ? 1 : 0),
    totalEarnedTodayUsd: +(current.totalEarnedTodayUsd + awardedRewardUsd).toFixed(4),
    entries: [
      {
        taskId: params.taskId,
        category: params.category,
        rewardUsd: awardedRewardUsd,
        tierId: 'open',
        completedAt: now.toISOString(),
      },
      ...current.entries,
    ],
  };

  quotaByUserDate.set(makeMapKey(params.userKey, dateKey), updated);
  persistToDisk();

  return {
    allowed: true,
    clampedRewardUsd: awardedRewardUsd,
    record: updated,
  };
}
