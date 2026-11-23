import { CANONICAL_PLATFORM_ORIGIN, resolvePlatformOrigin } from './platformUrl.ts';

export interface SitemapEntry {
  url: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
  lastmod?: string;
}

const DEFAULT_PUBLIC_BASE_URL = CANONICAL_PLATFORM_ORIGIN;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateSitemapXml(baseUrl: string = DEFAULT_PUBLIC_BASE_URL): string {
  const cleanBase = resolvePlatformOrigin(baseUrl);
  const today = new Date().toISOString().split('T')[0];

  const entries: SitemapEntry[] = [
    // 1. Core Marketplace Root & Primary App Routes
    { url: `${cleanBase}/`, changefreq: 'daily', priority: '1.0', lastmod: today },
    { url: `${cleanBase}/referrals`, changefreq: 'weekly', priority: '0.9', lastmod: today },
    { url: `${cleanBase}/task-history`, changefreq: 'daily', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/leaderboard`, changefreq: 'daily', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/auctions`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { url: `${cleanBase}/pay-per-view`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { url: `${cleanBase}/investments`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/employer`, changefreq: 'weekly', priority: '0.8', lastmod: today },

    // 2. Task Category Filtering Hubs
    { url: `${cleanBase}/?category=creator-campaign`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { url: `${cleanBase}/?category=survey`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { url: `${cleanBase}/?category=annotation`, changefreq: 'daily', priority: '0.9', lastmod: today },
    { url: `${cleanBase}/?category=data-entry`, changefreq: 'daily', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/?category=writing`, changefreq: 'daily', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/?category=meme-content`, changefreq: 'daily', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/?category=micro`, changefreq: 'daily', priority: '0.9', lastmod: today },

    // 3. Specialized Studios & Interactive Experiences
    { url: `${cleanBase}/meme-studio`, changefreq: 'daily', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/ai-media`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/maps-explorer`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/three-globe`, changefreq: 'weekly', priority: '0.7', lastmod: today },
    { url: `${cleanBase}/game`, changefreq: 'weekly', priority: '0.7', lastmod: today },

    // 4. Guides, Trust & Legal Documentation
    { url: `${cleanBase}/guides`, changefreq: 'weekly', priority: '0.9', lastmod: today },
    { url: `${cleanBase}/faq`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/about`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/contact`, changefreq: 'weekly', priority: '0.8', lastmod: today },
    { url: `${cleanBase}/privacy`, changefreq: 'monthly', priority: '0.7', lastmod: today },
    { url: `${cleanBase}/terms`, changefreq: 'monthly', priority: '0.7', lastmod: today },
    { url: `${cleanBase}/disclaimer`, changefreq: 'monthly', priority: '0.6', lastmod: today },
    { url: `${cleanBase}/sitemap`, changefreq: 'weekly', priority: '0.6', lastmod: today },
  ];

  const xmlUrls = entries.map((e) => {
    return [
      '  <url>',
      `    <loc>${escapeXml(e.url)}</loc>`,
      `    <lastmod>${escapeXml(e.lastmod || today)}</lastmod>`,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      '  </url>',
    ].join('\n');
  });

  return (
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
      '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
      xmlUrls.join('\n'),
      '</urlset>',
    ].join('\n') + '\n'
  );
}
