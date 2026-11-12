export interface SitemapEntry {
  url: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
  lastmod?: string;
  comment?: string;
}

const FEATURED_TASK_BOUNTIES = [
  { id: 'task-anno-101', title: 'Autonomous Driving CV: Tag Vehicles & Pedestrians', reward: 4.50 },
  { id: 'task-anno-102', title: 'Retail Shelf Stocking: Bounding Box Detection', reward: 3.80 },
  { id: 'task-entry-201', title: 'Apex Tech Retail Receipt Digitization & Extraction', reward: 3.40 },
  { id: 'task-entry-202', title: 'Medical Equipment Supply Invoice Audit & Keying', reward: 4.20 },
  { id: 'task-surv-301', title: 'Global Remote Work & AI Tooling Survey 2026', reward: 2.80 },
  { id: 'task-surv-302', title: 'Fintech Mobile App Usability & Payment Preferences', reward: 3.10 },
  { id: 'task-write-501', title: 'Product Copywriting: "HyperCharge 140W GaN Hub"', reward: 5.50 },
  { id: 'task-write-502', title: 'Technical Blog Post: "Zero-Knowledge Rollups Explained"', reward: 7.20 },
  { id: 'task-meme-401', title: 'Tech Startup Burnout Meme Creation Bounty', reward: 2.50 },
  { id: 'task-meme-402', title: 'Crypto Bull Market Reaction GIF / Meme Bounty', reward: 3.00 },
  { id: 'task-micro-601', title: 'Rapid A/B Usability Poll: Fintech Dark Mode Button', reward: 1.20 },
  { id: 'task-micro-602', title: 'Search Query Relevance Verification (5 Queries)', reward: 1.50 }
];

export function generateSitemapXml(baseUrl: string = 'https://gideon-global-tasks.ai.studio'): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const today = new Date().toISOString().split('T')[0];

  const entries: SitemapEntry[] = [
    // 1. Core Marketplace Root & Views
    {
      url: `${cleanBase}/`,
      changefreq: 'daily',
      priority: '1.0',
      lastmod: today,
      comment: 'Homepage & Crowdsourced Task Marketplace'
    },
    {
      url: `${cleanBase}/#tasks`,
      changefreq: 'daily',
      priority: '0.9',
      lastmod: today,
      comment: 'Live Marketplace Task Listings'
    },
    {
      url: `${cleanBase}/#task-history`,
      changefreq: 'daily',
      priority: '0.8',
      lastmod: today,
      comment: 'Task History Ledger & Approval Tracking'
    },
    {
      url: `${cleanBase}/#packages`,
      changefreq: 'weekly',
      priority: '0.9',
      lastmod: today,
      comment: 'Contributor Passes: Starter ($2), Pro ($5), VIP ($10)'
    },

    // 2. All Task Category Hubs (Filtering & Indexing)
    {
      url: `${cleanBase}/?category=survey`,
      changefreq: 'daily',
      priority: '0.9',
      lastmod: today,
      comment: 'Market Research Surveys & Consumer Polls'
    },
    {
      url: `${cleanBase}/?category=annotation`,
      changefreq: 'daily',
      priority: '0.9',
      lastmod: today,
      comment: 'AI Computer Vision & Bounding Box Data Annotation'
    },
    {
      url: `${cleanBase}/?category=data-entry`,
      changefreq: 'daily',
      priority: '0.8',
      lastmod: today,
      comment: 'Receipt & Invoice OCR Document Keying'
    },
    {
      url: `${cleanBase}/?category=writing`,
      changefreq: 'daily',
      priority: '0.8',
      lastmod: today,
      comment: 'High-Paying Copywriting & Product Descriptions'
    },
    {
      url: `${cleanBase}/?category=meme-content`,
      changefreq: 'daily',
      priority: '0.8',
      lastmod: today,
      comment: 'Gideon Meme Studio Bounties & Content Feed'
    },
    {
      url: `${cleanBase}/?category=micro`,
      changefreq: 'daily',
      priority: '0.9',
      lastmod: today,
      comment: 'Fast Micro Tasks, Usability A/B Polls & Quick Votes'
    },

    // 3. Specialized Platform Portals
    {
      url: `${cleanBase}/#referrals`,
      changefreq: 'weekly',
      priority: '0.9',
      lastmod: today,
      comment: 'Referral Partner Dashboard (20% Recurring Commission)'
    },
    {
      url: `${cleanBase}/#meme-studio`,
      changefreq: 'daily',
      priority: '0.8',
      lastmod: today,
      comment: 'Creator Meme Studio & Tipping Arena'
    },
    {
      url: `${cleanBase}/#employer`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: today,
      comment: 'Employer & Enterprise Requester Task Publishing Portal'
    },
    {
      url: `${cleanBase}/#ai-media`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: today,
      comment: 'AI Media Studio, Audio Transcription & Gemini Models'
    },
    {
      url: `${cleanBase}/#three-globe`,
      changefreq: 'weekly',
      priority: '0.7',
      lastmod: today,
      comment: 'Interactive 3D Procedural Earth Telemetry Scene'
    },
    {
      url: `${cleanBase}/#game`,
      changefreq: 'weekly',
      priority: '0.7',
      lastmod: today,
      comment: 'Task Rush 60fps Contributor Arcade Game'
    },
    {
      url: `${cleanBase}/#maps-explorer`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: today,
      comment: 'Google Maps Explorer & Geolocation Field Tasks'
    },
    {
      url: `${cleanBase}/#leaderboard`,
      changefreq: 'daily',
      priority: '0.8',
      lastmod: today,
      comment: 'Top Global Earners & Quality Score Leaderboard'
    },
    {
      url: `${cleanBase}/#wallet`,
      changefreq: 'weekly',
      priority: '0.7',
      lastmod: today,
      comment: 'Escrow Wallet & Payout Center (M-PESA & Wise $100+)'
    },
    {
      url: `${cleanBase}/#about`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: today,
      comment: 'About Us, Executive Mission & Corporate Governance'
    },
    {
      url: `${cleanBase}/#contact`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: today,
      comment: 'Contact Us, Support Tickets & DPO Communications'
    },
    {
      url: `${cleanBase}/#guides`,
      changefreq: 'weekly',
      priority: '0.9',
      lastmod: today,
      comment: 'Authoritative Contributor Guides, AI Manual & Documentation'
    },
    {
      url: `${cleanBase}/#faq`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: today,
      comment: 'Frequently Asked Questions, Payout Rules & Pass Terms'
    },
    {
      url: `${cleanBase}/#privacy`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: today,
      comment: 'AdSense-Compliant Privacy Policy & Cookie Disclosure'
    },
    {
      url: `${cleanBase}/privacy`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: today,
      comment: 'Dedicated Privacy Policy Page'
    },
    {
      url: `${cleanBase}/#terms`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: today,
      comment: 'Contributor Terms of Service & Anti-Fraud Standards'
    },
    {
      url: `${cleanBase}/terms`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: today,
      comment: 'Dedicated Terms of Service Page'
    },
    {
      url: `${cleanBase}/#disclaimer`,
      changefreq: 'monthly',
      priority: '0.6',
      lastmod: today,
      comment: 'Earnings & Advertising Legal Disclaimer'
    },
    {
      url: `${cleanBase}/disclaimer`,
      changefreq: 'monthly',
      priority: '0.6',
      lastmod: today,
      comment: 'Dedicated Legal Disclaimer Page'
    },
    {
      url: `${cleanBase}/#sitemap`,
      changefreq: 'weekly',
      priority: '0.6',
      lastmod: today,
      comment: 'HTML Sitemap & Navigation Directory'
    },
    {
      url: `${cleanBase}/sitemap`,
      changefreq: 'weekly',
      priority: '0.6',
      lastmod: today,
      comment: 'Dedicated HTML Sitemap Page'
    }
  ];

  // 4. Individual Task Bounties (Dynamic deep links for search indexing)
  FEATURED_TASK_BOUNTIES.forEach((task) => {
    entries.push({
      url: `${cleanBase}/#task/${task.id}`,
      changefreq: 'daily',
      priority: '0.7',
      lastmod: today,
      comment: `${task.title} - $${task.reward.toFixed(2)}`
    });
  });

  const xmlUrls = entries.map((e) => {
    return [
      '  <url>',
      `    <loc>${e.url}</loc>`,
      `    <lastmod>${e.lastmod || today}</lastmod>`,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      '  </url>'
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
    '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
    xmlUrls.join('\n'),
    '</urlset>'
  ].join('\n') + '\n';
}
