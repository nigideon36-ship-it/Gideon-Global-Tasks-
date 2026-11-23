import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import { convertKesToUsd, KES_PER_USD } from './eastAfrica.ts';
import { upsertPlatformTransaction } from './transactionsStore.ts';

export type AuctionCategory =
  | 'Electronics & Phones'
  | 'Solar & Energy'
  | 'Fashion & Leather'
  | 'Home & Kitchen'
  | 'Computing & Office'
  | 'Other';

export type AuctionCondition = 'Brand New' | 'Like New' | 'Refurbished' | 'Pre-Owned';
export type AuctionStatus = 'Live' | 'Sold' | 'Ended' | 'Cancelled' | 'Suspended';
export type AuctionEscrowStatus =
  | 'Held in Escrow'
  | 'Released to Seller'
  | 'Compensated Buyer'
  | 'Compensated Seller'
  | 'Disputed';

export interface AuctionBidderDeposit {
  amountKes: number;
  amountUsd: number;
  paypalRef: string;
  paidAt: string;
}

export interface AuctionBid {
  id: string;
  bidderUid: string;
  bidderName: string;
  bidderPhone?: string;
  amountKes: number;
  amountUsd: number;
  createdAt: string;
  isBuyNow?: boolean;
}

export interface AuctionItem {
  id: string;
  sellerUid: string;
  sellerName: string;
  sellerPhone?: string;
  sellerCountryCode: string;
  title: string;
  description: string;
  category: AuctionCategory;
  condition: AuctionCondition;
  location: string;
  imageUrls: string[];
  startingBidKes: number;
  startingBidUsd: number;
  minIncrementKes: number;
  minIncrementUsd: number;
  buyNowKes?: number;
  buyNowUsd?: number;
  currentBidKes: number;
  currentBidUsd: number;
  highestBidderUid?: string;
  highestBidderName?: string;
  highestBidderPhone?: string;
  bidCount: number;
  bids: AuctionBid[];
  status: AuctionStatus;
  featured?: boolean;
  deliveryTerms: string;
  escrowDepositPct: number;
  escrowDepositKes: number;
  escrowDepositUsd: number;
  sellerDepositPaypalRef: string;
  escrowStatus: AuctionEscrowStatus;
  escrowResolutionNote?: string;
  bidderDeposits: Record<string, AuctionBidderDeposit>;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export const AUCTION_ESCROW_DEPOSIT_PCT = 50;

export function computeAuctionEscrowDepositKes(productKes: number): number {
  return Math.max(25, Math.round((Number(productKes) || 0) * (AUCTION_ESCROW_DEPOSIT_PCT / 100)));
}

export const AUCTION_CATEGORIES: AuctionCategory[] = [
  'Electronics & Phones',
  'Solar & Energy',
  'Fashion & Leather',
  'Home & Kitchen',
  'Computing & Office',
  'Other',
];

export const AUCTION_CONDITIONS: AuctionCondition[] = [
  'Brand New',
  'Like New',
  'Refurbished',
  'Pre-Owned',
];

const DATA_DIR = path.resolve(process.cwd(), '.data');
const AUCTIONS_FILE = path.join(DATA_DIR, 'auctions.json');
const FIRESTORE_AUCTIONS_COLLECTION = 'auctions';

const auctionsById = new Map<string, AuctionItem>();

function buildInitialSampleAuctions(): AuctionItem[] {
  const now = Date.now();
  const created = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'AUC-EA-PHN01',
      sellerUid: 'seed-seller-ke-01',
      sellerName: 'Wanjiku Kamau',
      sellerPhone: '+254712***890',
      sellerCountryCode: 'KE',
      title: 'Vertex 5G Dual-SIM Smartphone (256GB, Matte Graphite)',
      description:
        'Factory-unlocked 256GB 5G Android smartphone with 50MP triple camera system, 120Hz OLED display, and original USB-C fast charger. Tested in Nairobi.',
      category: 'Electronics & Phones',
      condition: 'Like New',
      location: 'Nairobi, Kenya',
      imageUrls: ['sample://smartphone'],
      startingBidKes: 12000,
      startingBidUsd: convertKesToUsd(12000),
      minIncrementKes: 500,
      minIncrementUsd: convertKesToUsd(500),
      buyNowKes: 22500,
      buyNowUsd: convertKesToUsd(22500),
      currentBidKes: 14500,
      currentBidUsd: convertKesToUsd(14500),
      highestBidderUid: 'seed-bidder-ke-02',
      highestBidderName: 'Brian Ochieng',
      bidCount: 4,
      bids: [
        {
          id: 'BID-SEED-104',
          bidderUid: 'seed-bidder-ke-02',
          bidderName: 'Brian Ochieng',
          amountKes: 14500,
          amountUsd: convertKesToUsd(14500),
          createdAt: new Date(now - 18 * 60 * 1000).toISOString(),
        },
        {
          id: 'BID-SEED-103',
          bidderUid: 'seed-bidder-ug-01',
          bidderName: 'Grace Namukasa',
          amountKes: 13500,
          amountUsd: convertKesToUsd(13500),
          createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
        },
      ],
      status: 'Live',
      featured: true,
      deliveryTerms: 'Nairobi same-day boda dropoff or G4S insured parcel East Africa-wide.',
      escrowDepositPct: AUCTION_ESCROW_DEPOSIT_PCT,
      escrowDepositKes: computeAuctionEscrowDepositKes(12000),
      escrowDepositUsd: convertKesToUsd(computeAuctionEscrowDepositKes(12000)),
      sellerDepositPaypalRef: 'PP-ESC-PHN01-50PCT',
      escrowStatus: 'Held in Escrow',
      bidderDeposits: {
        'seed-bidder-ke-02': {
          amountKes: computeAuctionEscrowDepositKes(12000),
          amountUsd: convertKesToUsd(computeAuctionEscrowDepositKes(12000)),
          paypalRef: 'PP-BID-KE02-50PCT',
          paidAt: new Date(now - 20 * 60 * 1000).toISOString(),
        },
        'seed-bidder-ug-01': {
          amountKes: computeAuctionEscrowDepositKes(12000),
          amountUsd: convertKesToUsd(computeAuctionEscrowDepositKes(12000)),
          paypalRef: 'PP-BID-UG01-50PCT',
          paidAt: new Date(now - 48 * 60 * 1000).toISOString(),
        },
      },
      endsAt: new Date(now + 22 * 60 * 60 * 1000).toISOString(),
      createdAt: created,
      updatedAt: new Date(now - 18 * 60 * 1000).toISOString(),
    },
    {
      id: 'AUC-EA-SOL02',
      sellerUid: 'seed-seller-tz-01',
      sellerName: 'Juma Mwamba',
      sellerPhone: '+255754***321',
      sellerCountryCode: 'TZ',
      title: 'Portable 500W LiFePO4 Solar Power Station & Dual AC Inverter',
      description:
        'Pure sine-wave 500W off-grid portable power station with solar XT60 input, dual AC outlets, 100W USB-C PD, and bright LED runtime display.',
      category: 'Solar & Energy',
      condition: 'Brand New',
      location: 'Arusha, Tanzania',
      imageUrls: ['sample://solar'],
      startingBidKes: 18000,
      startingBidUsd: convertKesToUsd(18000),
      minIncrementKes: 1000,
      minIncrementUsd: convertKesToUsd(1000),
      buyNowKes: 32000,
      buyNowUsd: convertKesToUsd(32000),
      currentBidKes: 19000,
      currentBidUsd: convertKesToUsd(19000),
      highestBidderUid: 'seed-bidder-ke-05',
      highestBidderName: 'Kiprop Mutai',
      bidCount: 2,
      bids: [
        {
          id: 'BID-SEED-202',
          bidderUid: 'seed-bidder-ke-05',
          bidderName: 'Kiprop Mutai',
          amountKes: 19000,
          amountUsd: convertKesToUsd(19000),
          createdAt: new Date(now - 35 * 60 * 1000).toISOString(),
        },
      ],
      status: 'Live',
      featured: true,
      deliveryTerms: 'Ships across Kenya, Tanzania & Uganda with 12-month warranty receipt.',
      escrowDepositPct: AUCTION_ESCROW_DEPOSIT_PCT,
      escrowDepositKes: computeAuctionEscrowDepositKes(18000),
      escrowDepositUsd: convertKesToUsd(computeAuctionEscrowDepositKes(18000)),
      sellerDepositPaypalRef: 'PP-ESC-SOL02-50PCT',
      escrowStatus: 'Held in Escrow',
      bidderDeposits: {
        'seed-bidder-ke-05': {
          amountKes: computeAuctionEscrowDepositKes(18000),
          amountUsd: convertKesToUsd(computeAuctionEscrowDepositKes(18000)),
          paypalRef: 'PP-BID-KE05-50PCT',
          paidAt: new Date(now - 36 * 60 * 1000).toISOString(),
        },
      },
      endsAt: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
      createdAt: created,
      updatedAt: new Date(now - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'AUC-EA-LTH03',
      sellerUid: 'seed-seller-ke-03',
      sellerName: 'Amina Hassan',
      sellerPhone: '+254722***114',
      sellerCountryCode: 'KE',
      title: 'Handcrafted Full-Grain Kenyan Cognac Leather Laptop Backpack',
      description:
        '100% locally tanned Kenyan cowhide leather backpack fitting 16-inch laptops, solid brass buckles, padded shoulder harness, and weather-resistant lining.',
      category: 'Fashion & Leather',
      condition: 'Brand New',
      location: 'Mombasa, Kenya',
      imageUrls: ['sample://backpack'],
      startingBidKes: 3500,
      startingBidUsd: convertKesToUsd(3500),
      minIncrementKes: 250,
      minIncrementUsd: convertKesToUsd(250),
      buyNowKes: 7500,
      buyNowUsd: convertKesToUsd(7500),
      currentBidKes: 4250,
      currentBidUsd: convertKesToUsd(4250),
      highestBidderUid: 'seed-bidder-rw-01',
      highestBidderName: 'Jean-Paul Habimana',
      bidCount: 3,
      bids: [
        {
          id: 'BID-SEED-303',
          bidderUid: 'seed-bidder-rw-01',
          bidderName: 'Jean-Paul Habimana',
          amountKes: 4250,
          amountUsd: convertKesToUsd(4250),
          createdAt: new Date(now - 50 * 60 * 1000).toISOString(),
        },
      ],
      status: 'Live',
      featured: false,
      deliveryTerms: 'Courier delivery via Wells Fargo or Pickup in Mombasa / Nairobi CBD.',
      escrowDepositPct: AUCTION_ESCROW_DEPOSIT_PCT,
      escrowDepositKes: computeAuctionEscrowDepositKes(3500),
      escrowDepositUsd: convertKesToUsd(computeAuctionEscrowDepositKes(3500)),
      sellerDepositPaypalRef: 'PP-ESC-LTH03-50PCT',
      escrowStatus: 'Held in Escrow',
      bidderDeposits: {
        'seed-bidder-rw-01': {
          amountKes: computeAuctionEscrowDepositKes(3500),
          amountUsd: convertKesToUsd(computeAuctionEscrowDepositKes(3500)),
          paypalRef: 'PP-BID-RW01-50PCT',
          paidAt: new Date(now - 52 * 60 * 1000).toISOString(),
        },
      },
      endsAt: new Date(now + 14 * 60 * 60 * 1000).toISOString(),
      createdAt: created,
      updatedAt: new Date(now - 50 * 60 * 1000).toISOString(),
    },
  ];
}

function normalizeAuctionEscrowDefaults(item: AuctionItem): AuctionItem {
  const pct = AUCTION_ESCROW_DEPOSIT_PCT;
  const depositKes = item.escrowDepositKes || computeAuctionEscrowDepositKes(item.startingBidKes);
  return {
    ...item,
    escrowDepositPct: pct,
    escrowDepositKes: depositKes,
    escrowDepositUsd: item.escrowDepositUsd || convertKesToUsd(depositKes),
    sellerDepositPaypalRef: item.sellerDepositPaypalRef || `PP-ESC-${item.id}`,
    escrowStatus: item.escrowStatus || 'Held in Escrow',
    bidderDeposits: item.bidderDeposits || {},
  };
}

function loadAuctionsFromDisk() {
  try {
    if (!fs.existsSync(AUCTIONS_FILE)) {
      const seeds = buildInitialSampleAuctions();
      for (const item of seeds) {
        auctionsById.set(item.id, item);
      }
      persistAuctionsToDisk();
      return;
    }
    const raw = JSON.parse(fs.readFileSync(AUCTIONS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && item.id) {
          auctionsById.set(item.id, normalizeAuctionEscrowDefaults(item));
        }
      }
    }
  } catch (err) {
    console.warn('Could not load auctions store:', (err as Error)?.message || err);
  }
}

function persistAuctionsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(auctionsById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    fs.writeFileSync(AUCTIONS_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist auctions store:', (err as Error)?.message || err);
  }
}

function syncAuctionToFirestore(item: AuctionItem) {
  if (!adminDb) return;
  try {
    adminDb
      .collection(FIRESTORE_AUCTIONS_COLLECTION)
      .doc(item.id)
      .set(JSON.parse(JSON.stringify(item)), { merge: true })
      .catch(() => {});
  } catch {
    // non-blocking
  }
}

loadAuctionsFromDisk();

function refreshAuctionExpiry(item: AuctionItem): boolean {
  if (item.status !== 'Live') return false;
  const endMs = new Date(item.endsAt).getTime();
  if (Number.isFinite(endMs) && endMs <= Date.now()) {
    item.status = item.bidCount > 0 ? 'Sold' : 'Ended';
    item.updatedAt = new Date().toISOString();
    if (item.status === 'Sold' && item.highestBidderName) {
      upsertPlatformTransaction({
        id: `AUC-SALE-${item.id}`,
        kind: 'auction_sale',
        title: `Auction Won: ${item.title}`,
        customerLabel: `${item.highestBidderName} (from ${item.sellerName})`,
        gatewayOrMethod: 'Auction Settlement',
        currency: 'KES',
        amountLocal: item.currentBidKes,
        amountUsd: item.currentBidUsd,
        status: 'Completed',
        reference: item.id,
        countryCode: item.sellerCountryCode || 'KE',
        metadata: {
          auctionId: item.id,
          sellerUid: item.sellerUid,
          winnerUid: item.highestBidderUid,
        },
      });
    }
    syncAuctionToFirestore(item);
    return true;
  }
  return false;
}

export function listAuctions(options?: { includeSuspended?: boolean }): AuctionItem[] {
  let dirty = false;
  for (const item of auctionsById.values()) {
    if (refreshAuctionExpiry(item)) {
      dirty = true;
    }
  }
  if (dirty) persistAuctionsToDisk();

  return Array.from(auctionsById.values())
    .filter((item) => (options?.includeSuspended ? true : item.status !== 'Suspended'))
    .sort((a, b) => {
      if (a.status === 'Live' && b.status !== 'Live') return -1;
      if (b.status === 'Live' && a.status !== 'Live') return 1;
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function getAuctionById(id: string): AuctionItem | null {
  const item = auctionsById.get(id);
  if (!item) return null;
  if (refreshAuctionExpiry(item)) {
    persistAuctionsToDisk();
  }
  return item;
}

export function createAuction(params: {
  sellerUid: string;
  sellerName: string;
  sellerPhone?: string;
  sellerCountryCode?: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  location: string;
  imageUrls: string[];
  startingBidKes: number;
  minIncrementKes?: number;
  buyNowKes?: number;
  durationHours: number;
  deliveryTerms?: string;
  sellerDepositPaypalRef: string;
}): AuctionItem {
  const title = String(params.title || '').trim().slice(0, 140);
  const description = String(params.description || '').trim().slice(0, 1500);
  if (title.length < 4) {
    throw new Error('Product title must be at least 4 characters.');
  }
  if (description.length < 12) {
    throw new Error('Product description must be at least 12 characters.');
  }

  const category: AuctionCategory = AUCTION_CATEGORIES.includes(params.category as AuctionCategory)
    ? (params.category as AuctionCategory)
    : 'Other';
  const condition: AuctionCondition = AUCTION_CONDITIONS.includes(params.condition as AuctionCondition)
    ? (params.condition as AuctionCondition)
    : 'Like New';

  const startKes = Math.round(Number(params.startingBidKes) || 0);
  if (startKes < 50) {
    throw new Error('Starting bid must be at least 50 Shillings.');
  }

  const sellerDepositRef = String(params.sellerDepositPaypalRef || '').trim().toUpperCase().slice(0, 64);
  if (sellerDepositRef.length < 6) {
    const reqDeposit = computeAuctionEscrowDepositKes(startKes);
    throw new Error(
      `Trust & Escrow Policy: Sellers must pay the 50% product security deposit (KES ${reqDeposit.toLocaleString()}) via PayPal first and enter the PayPal Transaction/Order ID before publishing real-product auctions.`
    );
  }

  const incrementKes = Math.max(25, Math.round(Number(params.minIncrementKes) || Math.max(50, Math.round(startKes * 0.05))));
  const rawBuyNow = Number(params.buyNowKes) || 0;
  const buyNowKes = rawBuyNow > startKes ? Math.round(rawBuyNow) : undefined;
  if (rawBuyNow > 0 && rawBuyNow <= startKes) {
    throw new Error('Buy Now price must be higher than the starting bid.');
  }

  const escrowDepositKes = computeAuctionEscrowDepositKes(startKes);
  const escrowDepositUsd = convertKesToUsd(escrowDepositKes);

  const durationHours = Math.min(168, Math.max(1, Number(params.durationHours) || 24));
  const cleanedImages = (Array.isArray(params.imageUrls) ? params.imageUrls : [])
    .map((u) => String(u || '').trim())
    .filter((u) => u.startsWith('data:image/') || u.startsWith('sample://'))
    .slice(0, 3);

  const now = new Date();
  const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();
  const id = `AUC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const item: AuctionItem = {
    id,
    sellerUid: params.sellerUid,
    sellerName: String(params.sellerName || 'Verified Seller').trim().slice(0, 80),
    sellerPhone: params.sellerPhone ? String(params.sellerPhone).trim().slice(0, 40) : undefined,
    sellerCountryCode: String(params.sellerCountryCode || 'KE').toUpperCase().slice(0, 4),
    title,
    description,
    category,
    condition,
    location: String(params.location || 'Nairobi, Kenya').trim().slice(0, 80),
    imageUrls: cleanedImages,
    startingBidKes: startKes,
    startingBidUsd: convertKesToUsd(startKes),
    minIncrementKes: incrementKes,
    minIncrementUsd: convertKesToUsd(incrementKes),
    ...(buyNowKes ? { buyNowKes, buyNowUsd: convertKesToUsd(buyNowKes) } : {}),
    currentBidKes: startKes,
    currentBidUsd: convertKesToUsd(startKes),
    bidCount: 0,
    bids: [],
    status: 'Live',
    featured: false,
    deliveryTerms:
      String(params.deliveryTerms || '').trim().slice(0, 240) ||
      'Tracked East Africa courier or safe meetup handover.',
    escrowDepositPct: AUCTION_ESCROW_DEPOSIT_PCT,
    escrowDepositKes,
    escrowDepositUsd,
    sellerDepositPaypalRef: sellerDepositRef,
    escrowStatus: 'Held in Escrow',
    bidderDeposits: {},
    endsAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  upsertPlatformTransaction({
    id: `ESC-SEL-${item.id}`,
    kind: 'paypal_checkout',
    title: `50% Seller Auction Escrow Deposit: ${item.title}`,
    customerLabel: item.sellerName,
    gatewayOrMethod: 'PayPal 50% Escrow',
    currency: 'KES',
    amountLocal: escrowDepositKes,
    amountUsd: escrowDepositUsd,
    status: 'Completed',
    reference: sellerDepositRef,
    countryCode: item.sellerCountryCode || 'KE',
    metadata: {
      auctionId: item.id,
      role: 'seller',
      escrowPct: AUCTION_ESCROW_DEPOSIT_PCT,
    },
  });

  auctionsById.set(item.id, item);
  persistAuctionsToDisk();
  syncAuctionToFirestore(item);
  return item;
}

export function placeAuctionBid(params: {
  auctionId: string;
  bidderUid: string;
  bidderName: string;
  bidderPhone?: string;
  amountKes: number;
  bidderDepositPaypalRef?: string;
}): AuctionItem {
  const item = getAuctionById(params.auctionId);
  if (!item) {
    throw new Error('Auction listing not found.');
  }
  if (item.status !== 'Live') {
    throw new Error(`Auction is ${item.status} and is no longer accepting bids.`);
  }
  if (item.sellerUid === params.bidderUid) {
    throw new Error('Sellers cannot bid on their own uploaded product.');
  }

  const bidKes = Math.round(Number(params.amountKes) || 0);
  const minAllowedKes = item.bidCount > 0 ? item.currentBidKes + item.minIncrementKes : item.startingBidKes;
  if (bidKes < minAllowedKes) {
    throw new Error(`Minimum next bid is KSh ${minAllowedKes.toLocaleString()}.`);
  }

  item.bidderDeposits = item.bidderDeposits || {};
  const existingDeposit = item.bidderDeposits[params.bidderUid];
  const requiredDepositKes = item.escrowDepositKes || computeAuctionEscrowDepositKes(item.startingBidKes);
  const now = new Date();

  if (!existingDeposit) {
    const cleanRef = String(params.bidderDepositPaypalRef || '').trim().toUpperCase().slice(0, 64);
    if (cleanRef.length < 6) {
      throw new Error(
        `Trust & Escrow Policy: Before bidding on real products, you must pay a 50% security deposit (KES ${requiredDepositKes.toLocaleString()}) via PayPal first to protect both buyer and seller.`
      );
    }
    const depositUsd = convertKesToUsd(requiredDepositKes);
    item.bidderDeposits[params.bidderUid] = {
      amountKes: requiredDepositKes,
      amountUsd: depositUsd,
      paypalRef: cleanRef,
      paidAt: now.toISOString(),
    };
    upsertPlatformTransaction({
      id: `ESC-BID-${item.id}-${params.bidderUid.slice(0, 8)}`,
      kind: 'paypal_checkout',
      title: `50% Bidder Escrow Deposit: ${item.title}`,
      customerLabel: String(params.bidderName || 'Bidder').trim().slice(0, 80),
      gatewayOrMethod: 'PayPal 50% Escrow',
      currency: 'KES',
      amountLocal: requiredDepositKes,
      amountUsd: depositUsd,
      status: 'Completed',
      reference: cleanRef,
      countryCode: item.sellerCountryCode || 'KE',
      metadata: {
        auctionId: item.id,
        role: 'buyer',
        escrowPct: AUCTION_ESCROW_DEPOSIT_PCT,
      },
    });
  }

  const bidRecord: AuctionBid = {
    id: `BID-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    bidderUid: params.bidderUid,
    bidderName: String(params.bidderName || 'Bidder').trim().slice(0, 80),
    bidderPhone: params.bidderPhone ? String(params.bidderPhone).trim().slice(0, 40) : undefined,
    amountKes: bidKes,
    amountUsd: +(bidKes / KES_PER_USD).toFixed(4),
    createdAt: now.toISOString(),
  };

  item.currentBidKes = bidKes;
  item.currentBidUsd = bidRecord.amountUsd;
  item.highestBidderUid = params.bidderUid;
  item.highestBidderName = bidRecord.bidderName;
  item.highestBidderPhone = bidRecord.bidderPhone;
  item.bidCount += 1;
  item.bids = [bidRecord, ...item.bids].slice(0, 100);

  // Anti-snipe extension: add 2 minutes if bid arrives under 2 minutes remaining
  const remainingMs = new Date(item.endsAt).getTime() - now.getTime();
  if (remainingMs > 0 && remainingMs < 2 * 60 * 1000) {
    item.endsAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
  }

  item.updatedAt = now.toISOString();
  auctionsById.set(item.id, item);
  persistAuctionsToDisk();
  syncAuctionToFirestore(item);
  return item;
}

export function buyNowAuction(params: {
  auctionId: string;
  buyerUid: string;
  buyerName: string;
  buyerPhone?: string;
  buyerDepositPaypalRef?: string;
}): AuctionItem {
  const item = getAuctionById(params.auctionId);
  if (!item) {
    throw new Error('Auction listing not found.');
  }
  if (item.status !== 'Live') {
    throw new Error(`Auction is ${item.status} and is no longer available.`);
  }
  if (!item.buyNowKes) {
    throw new Error('Buy Now is not enabled on this auction.');
  }
  if (item.sellerUid === params.buyerUid) {
    throw new Error('Sellers cannot buy their own uploaded product.');
  }

  const now = new Date().toISOString();
  item.bidderDeposits = item.bidderDeposits || {};
  const existingDeposit = item.bidderDeposits[params.buyerUid];
  const requiredBuyNowDepositKes = computeAuctionEscrowDepositKes(item.buyNowKes);
  if (!existingDeposit) {
    const cleanRef = String(params.buyerDepositPaypalRef || '').trim().toUpperCase().slice(0, 64);
    if (cleanRef.length < 6) {
      throw new Error(
        `Trust & Escrow Policy: Please complete the mandatory 50% product security deposit (KES ${requiredBuyNowDepositKes.toLocaleString()}) via PayPal before Instant Buy Now.`
      );
    }
    const depositUsd = convertKesToUsd(requiredBuyNowDepositKes);
    item.bidderDeposits[params.buyerUid] = {
      amountKes: requiredBuyNowDepositKes,
      amountUsd: depositUsd,
      paypalRef: cleanRef,
      paidAt: now,
    };
    upsertPlatformTransaction({
      id: `ESC-BUY-${item.id}-${params.buyerUid.slice(0, 8)}`,
      kind: 'paypal_checkout',
      title: `50% Buy Now Escrow Deposit: ${item.title}`,
      customerLabel: String(params.buyerName || 'Buyer').trim().slice(0, 80),
      gatewayOrMethod: 'PayPal 50% Escrow',
      currency: 'KES',
      amountLocal: requiredBuyNowDepositKes,
      amountUsd: depositUsd,
      status: 'Completed',
      reference: cleanRef,
      countryCode: item.sellerCountryCode || 'KE',
      metadata: {
        auctionId: item.id,
        role: 'buyer_buy_now',
        escrowPct: AUCTION_ESCROW_DEPOSIT_PCT,
      },
    });
  }

  const bidRecord: AuctionBid = {
    id: `BUY-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    bidderUid: params.buyerUid,
    bidderName: String(params.buyerName || 'Buyer').trim().slice(0, 80),
    bidderPhone: params.buyerPhone ? String(params.buyerPhone).trim().slice(0, 40) : undefined,
    amountKes: item.buyNowKes,
    amountUsd: item.buyNowUsd || convertKesToUsd(item.buyNowKes),
    createdAt: now,
    isBuyNow: true,
  };

  item.currentBidKes = bidRecord.amountKes;
  item.currentBidUsd = bidRecord.amountUsd;
  item.highestBidderUid = params.buyerUid;
  item.highestBidderName = bidRecord.bidderName;
  item.highestBidderPhone = bidRecord.bidderPhone;
  item.bidCount += 1;
  item.bids = [bidRecord, ...item.bids].slice(0, 100);
  item.status = 'Sold';
  item.endsAt = now;
  item.updatedAt = now;

  upsertPlatformTransaction({
    id: `AUC-BUY-${item.id}`,
    kind: 'auction_sale',
    title: `Buy Now Auction: ${item.title}`,
    customerLabel: `${bidRecord.bidderName} (from ${item.sellerName})`,
    gatewayOrMethod: 'PayPal 50% Escrow + Settlement',
    currency: 'KES',
    amountLocal: item.currentBidKes,
    amountUsd: item.currentBidUsd,
    status: 'Completed',
    reference: item.id,
    countryCode: item.sellerCountryCode || 'KE',
    metadata: {
      auctionId: item.id,
      sellerUid: item.sellerUid,
      winnerUid: params.buyerUid,
    },
  });

  auctionsById.set(item.id, item);
  persistAuctionsToDisk();
  syncAuctionToFirestore(item);
  return item;
}

export function closeOrCancelAuction(params: {
  auctionId: string;
  actorUid: string;
  isOwner: boolean;
  action?: 'accept_highest' | 'cancel';
}): AuctionItem {
  const item = getAuctionById(params.auctionId);
  if (!item) {
    throw new Error('Auction listing not found.');
  }
  if (!params.isOwner && item.sellerUid !== params.actorUid) {
    throw new Error('Only the product seller or Platform Owner can close this auction.');
  }

  const now = new Date().toISOString();
  if (params.action === 'accept_highest' && item.bidCount > 0) {
    item.status = 'Sold';
    upsertPlatformTransaction({
      id: `AUC-CLS-${item.id}`,
      kind: 'auction_sale',
      title: `Auction Closed & Sold: ${item.title}`,
      customerLabel: `${item.highestBidderName || 'Bidder'} (from ${item.sellerName})`,
      gatewayOrMethod: 'Seller Accepted Highest Bid',
      currency: 'KES',
      amountLocal: item.currentBidKes,
      amountUsd: item.currentBidUsd,
      status: 'Completed',
      reference: item.id,
      countryCode: item.sellerCountryCode || 'KE',
    });
  } else {
    item.status = item.bidCount > 0 && params.action !== 'cancel' ? 'Sold' : 'Cancelled';
  }
  item.endsAt = now;
  item.updatedAt = now;
  auctionsById.set(item.id, item);
  persistAuctionsToDisk();
  syncAuctionToFirestore(item);
  return item;
}

export function ownerUpdateAuction(
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    category: AuctionCategory;
    condition: AuctionCondition;
    status: AuctionStatus;
    escrowStatus: AuctionEscrowStatus;
    escrowResolutionNote: string;
    featured: boolean;
    startingBidKes: number;
    minIncrementKes: number;
    buyNowKes: number | null;
    endsAt: string;
  }>
): AuctionItem {
  const item = auctionsById.get(id);
  if (!item) {
    throw new Error('Auction listing not found.');
  }

  if (updates.title && updates.title.trim().length >= 3) {
    item.title = updates.title.trim().slice(0, 140);
  }
  if (updates.description && updates.description.trim().length >= 6) {
    item.description = updates.description.trim().slice(0, 1500);
  }
  if (updates.category && AUCTION_CATEGORIES.includes(updates.category)) {
    item.category = updates.category;
  }
  if (updates.condition && AUCTION_CONDITIONS.includes(updates.condition)) {
    item.condition = updates.condition;
  }
  if (updates.status && ['Live', 'Sold', 'Ended', 'Cancelled', 'Suspended'].includes(updates.status)) {
    item.status = updates.status;
  }
  if (
    updates.escrowStatus &&
    ['Held in Escrow', 'Released to Seller', 'Compensated Buyer', 'Compensated Seller', 'Disputed'].includes(
      updates.escrowStatus
    )
  ) {
    item.escrowStatus = updates.escrowStatus;
  }
  if (typeof updates.escrowResolutionNote === 'string') {
    item.escrowResolutionNote = updates.escrowResolutionNote.trim().slice(0, 300);
  }
  if (typeof updates.featured === 'boolean') {
    item.featured = updates.featured;
  }
  if (typeof updates.startingBidKes === 'number' && updates.startingBidKes >= 50) {
    item.startingBidKes = Math.round(updates.startingBidKes);
    item.startingBidUsd = convertKesToUsd(item.startingBidKes);
    item.escrowDepositKes = computeAuctionEscrowDepositKes(item.startingBidKes);
    item.escrowDepositUsd = convertKesToUsd(item.escrowDepositKes);
    if (item.bidCount === 0) {
      item.currentBidKes = item.startingBidKes;
      item.currentBidUsd = item.startingBidUsd;
    }
  }
  if (typeof updates.minIncrementKes === 'number' && updates.minIncrementKes >= 10) {
    item.minIncrementKes = Math.round(updates.minIncrementKes);
    item.minIncrementUsd = convertKesToUsd(item.minIncrementKes);
  }
  if (updates.buyNowKes === null) {
    delete item.buyNowKes;
    delete item.buyNowUsd;
  } else if (typeof updates.buyNowKes === 'number' && updates.buyNowKes > item.startingBidKes) {
    item.buyNowKes = Math.round(updates.buyNowKes);
    item.buyNowUsd = convertKesToUsd(item.buyNowKes);
  }
  if (updates.endsAt && Number.isFinite(new Date(updates.endsAt).getTime())) {
    item.endsAt = new Date(updates.endsAt).toISOString();
  }

  item.updatedAt = new Date().toISOString();
  auctionsById.set(item.id, item);
  persistAuctionsToDisk();
  syncAuctionToFirestore(item);
  return item;
}

export function deleteAuction(id: string, actorUid: string, isOwner: boolean): boolean {
  const item = auctionsById.get(id);
  if (!item) return false;
  if (!isOwner && item.sellerUid !== actorUid) {
    throw new Error('Only the seller or Platform Owner can delete this auction.');
  }
  auctionsById.delete(id);
  persistAuctionsToDisk();
  if (adminDb) {
    try {
      adminDb.collection(FIRESTORE_AUCTIONS_COLLECTION).doc(id).delete().catch(() => {});
    } catch {}
  }
  return true;
}

export function hydrateAuctionFromClient(incoming: AuctionItem): void {
  if (!incoming || !incoming.id || !incoming.title) return;
  const normalized = normalizeAuctionEscrowDefaults(incoming);
  const existing = auctionsById.get(normalized.id);
  if (!existing || (normalized.bidCount || 0) > existing.bidCount || (normalized.updatedAt || '') > existing.updatedAt) {
    auctionsById.set(normalized.id, normalized);
    persistAuctionsToDisk();
  }
}
