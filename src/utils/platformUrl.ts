export const CANONICAL_PLATFORM_ORIGIN = 'https://gideon-global-tasks.ai.studio';
export const CANONICAL_PLATFORM_URL = 'https://gideon-global-tasks.ai.studio/';

const EPHEMERAL_HOST_REGEX =
  /(?:^https?:\/\/)?(?:[a-z0-9.-]*\.run\.app|(?:www\.)?gideonglobal\.com|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?|0\.0\.0\.0(?::\d+)?)/i;

/**
 * Rewrites any ephemeral preview host (.run.app), legacy domain (gideonglobal.com),
 * or localhost origin inside a URL string to https://gideon-global-tasks.ai.studio.
 */
export function normalizePlatformUrl(url: string): string {
  return String(url || '')
    .replace(/https?:\/\/[a-z0-9.-]*\.run\.app/gi, CANONICAL_PLATFORM_ORIGIN)
    .replace(/https?:\/\/(?:www\.)?gideonglobal\.com/gi, CANONICAL_PLATFORM_ORIGIN);
}

/**
 * Resolves a candidate origin/APP_URL into a clean base origin without trailing slash,
 * always enforcing https://gideon-global-tasks.ai.studio when empty or ephemeral.
 */
export function resolvePlatformOrigin(candidate?: string | null): string {
  const raw = String(candidate || '').trim().replace(/\/+$/, '');
  if (!raw || raw === 'MY_APP_URL' || EPHEMERAL_HOST_REGEX.test(raw)) {
    return CANONICAL_PLATFORM_ORIGIN;
  }
  return raw;
}
