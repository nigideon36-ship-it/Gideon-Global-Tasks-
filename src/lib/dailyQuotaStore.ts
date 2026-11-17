import fs from 'fs';
import path from 'path';
import { MAX_TASK_REWARD_KES, MAX_TASK_REWARD_USD } from './eastAfrica.ts';
import { getQuotaRuleForPackageId, getTodayDateKey, type QuotaTierId } from './passQuotas.ts';

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
  packageId?: string | null;
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
  const dateKey = getTodayDateKey();
  const current = getUserDailyQuotaRecord(params.userKey, dateKey);
  const rule = getQuotaRuleForPackageId(params.packageId);
  const rawReward = Number(params.rewardUsd) || 0;
  const hardCeilingUsd = Math.min(rule.maxAmountUsd, MAX_TASK_REWARD_USD);

  if (!params.isOwner) {
    if (rawReward > hardCeilingUsd + 1e-4) {
      return {
        allowed: false,
        error: `Completed task reward cannot exceed ${MAX_TASK_REWARD_KES} shillings (${rule.name} maximum).`,
        clampedRewardUsd: hardCeilingUsd,
        record: current,
      };
    }

    if (rule.tierId === 'vip' && params.category === 'survey' && current.surveyCount >= rule.dailyLimit) {
      return {
        allowed: false,
        error: `Daily limit reached: VIP Worker Pass allows max ${rule.dailyLimit} surveys daily (not exceeding ${MAX_TASK_REWARD_KES} shillings each).`,
        clampedRewardUsd: hardCeilingUsd,
        record: current,
      };
    }

    if (current.totalCount >= rule.dailyLimit) {
      return {
        allowed: false,
        error: `Daily limit reached (${current.totalCount}/${rule.dailyLimit} for ${rule.name}, max ${MAX_TASK_REWARD_KES} shillings per task).`,
        clampedRewardUsd: hardCeilingUsd,
        record: current,
      };
    }
  }

  const clampedRewardUsd = params.isOwner
    ? +rawReward.toFixed(4)
    : +Math.min(rawReward, hardCeilingUsd).toFixed(4);

  const updated: DailyUserQuotaRecord = {
    userKey: params.userKey,
    dateKey,
    totalCount: current.totalCount + 1,
    surveyCount: current.surveyCount + (params.category === 'survey' ? 1 : 0),
    totalEarnedTodayUsd: +(current.totalEarnedTodayUsd + clampedRewardUsd).toFixed(4),
    entries: [
      {
        taskId: params.taskId,
        category: params.category,
        rewardUsd: clampedRewardUsd,
        tierId: rule.tierId,
        completedAt: new Date().toISOString(),
      },
      ...current.entries,
    ],
  };

  quotaByUserDate.set(makeMapKey(params.userKey, dateKey), updated);
  persistToDisk();

  return {
    allowed: true,
    clampedRewardUsd,
    record: updated,
  };
}
