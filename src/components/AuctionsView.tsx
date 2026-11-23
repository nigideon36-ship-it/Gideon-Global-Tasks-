import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { db, auth } from '../lib/firebase';
import {
  formatCurrencyFromKes,
  convertKesToLocal,
  KES_PER_USD,
} from '../lib/eastAfrica';
import sampleSmartphoneImg from '../assets/images/auction_smartphone_a54_1794995269614.jpg';
import sampleSolarImg from '../assets/images/auction_solar_inverter_1794995271614.jpg';
import sampleBackpackImg from '../assets/images/auction_leather_backpack_1794995271270.jpg';
import {
  Gavel,
  Plus,
  Search,
  Clock,
  MapPin,
  Upload,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Zap,
  ShieldCheck,
  Tag,
  Package,
  Star,
  User as UserIcon,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';

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
  escrowDepositPct?: number;
  escrowDepositKes?: number;
  escrowDepositUsd?: number;
  sellerDepositPaypalRef?: string;
  escrowStatus?: AuctionEscrowStatus;
  escrowResolutionNote?: string;
  bidderDeposits?: Record<string, AuctionBidderDeposit>;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES: AuctionCategory[] = [
  'Electronics & Phones',
  'Solar & Energy',
  'Fashion & Leather',
  'Home & Kitchen',
  'Computing & Office',
  'Other',
];

const CONDITIONS: AuctionCondition[] = [
  'Brand New',
  'Like New',
  'Refurbished',
  'Pre-Owned',
];

const DURATION_OPTIONS = [
  { hours: 6, label: '6 Hours (Flash Drop)' },
  { hours: 12, label: '12 Hours' },
  { hours: 24, label: '24 Hours (Recommended)' },
  { hours: 72, label: '3 Days (72h)' },
  { hours: 168, label: '7 Days (Weekly)' },
];

export function resolveAuctionImageUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  if (rawUrl === 'sample://smartphone') return sampleSmartphoneImg;
  if (rawUrl === 'sample://solar') return sampleSolarImg;
  if (rawUrl === 'sample://backpack') return sampleBackpackImg;
  if (rawUrl.startsWith('data:image/')) return rawUrl;
  return null;
}

function formatCountdown(endsAtIso: string, nowMs: number): { label: string; expired: boolean; urgent: boolean } {
  const endMs = new Date(endsAtIso).getTime();
  if (!Number.isFinite(endMs)) return { label: 'Ended', expired: true, urgent: false };
  const diff = endMs - nowMs;
  if (diff <= 0) return { label: 'Ended', expired: true, urgent: false };

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) {
    return { label: `${days}d ${hours}h ${mins}m`, expired: false, urgent: false };
  }
  if (hours > 0) {
    return {
      label: `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`,
      expired: false,
      urgent: hours < 2,
    };
  }
  return {
    label: `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`,
    expired: false,
    urgent: true,
  };
}

function compressImageToDataUrl(file: File, maxDim = 840): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => reject(new Error('Could not decode selected image.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });
}

type AuctionFilterTab = 'all' | 'live' | 'completed' | 'my-uploads' | 'my-bids';

export const AuctionsView: React.FC = () => {
  const { user, customerProfile, isOwner, isAuthenticated, setAuthModalOpen, getFreshToken } = useAuth();
  const { selectedCountry } = useRegion();

  const currentUid = customerProfile?.uid || user?.uid || '';

  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<AuctionFilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Upload Product Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AuctionCategory>('Electronics & Phones');
  const [condition, setCondition] = useState<AuctionCondition>('Like New');
  const [location, setLocation] = useState(customerProfile?.city || `${selectedCountry.name}`);
  const [startingBidLocal, setStartingBidLocal] = useState(() => String(convertKesToLocal(1000, selectedCountry)));
  const [minIncrementLocal, setMinIncrementLocal] = useState(() => String(convertKesToLocal(100, selectedCountry)));
  const [buyNowLocal, setBuyNowLocal] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [deliveryTerms, setDeliveryTerms] = useState('Same-day Nairobi courier or tracked East Africa parcel.');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [sellerDepositPaypalRef, setSellerDepositPaypalRef] = useState('');
  const [sellerPayPalLinks, setSellerPayPalLinks] = useState<{ checkoutUrl?: string; payPalMeUrl?: string; amountUsd?: number } | null>(null);
  const [paypalConfig, setPaypalConfig] = useState<{ primaryEmail?: string; payPalMeHandle?: string }>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Selected Auction Modal (Detail + Bid)
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [bidAmountLocal, setBidAmountLocal] = useState('');
  const [bidderDepositPaypalRef, setBidderDepositPaypalRef] = useState('');
  const [bidderPayPalLinks, setBidderPayPalLinks] = useState<{ checkoutUrl?: string; payPalMeUrl?: string; amountUsd?: number } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [bidding, setBidding] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const selectedAuction = useMemo(
    () => auctions.find((a) => a.id === selectedAuctionId) || null,
    [auctions, selectedAuctionId]
  );

  // Live countdown ticker
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const localToKes = useCallback(
    (localVal: number): number => {
      if (!Number.isFinite(localVal) || localVal <= 0) return 0;
      if (selectedCountry.code === 'KE') return Math.round(localVal);
      return Math.round((localVal * KES_PER_USD) / selectedCountry.approxRatePerUsd);
    },
    [selectedCountry]
  );

  const syncSingleAuctionToFirestore = useCallback(async (auction: AuctionItem) => {
    const current = auth.currentUser;
    if (!current || !current.emailVerified) return;
    try {
      const cleanPayload = JSON.parse(JSON.stringify(auction));
      await setDoc(doc(db, 'auctions', auction.id), cleanPayload, { merge: true });
    } catch {
      // non-blocking durable mirror
    }
  }, []);

  const loadAuctions = useCallback(async () => {
    try {
      const res = await fetch('/api/auctions');
      const data = await res.json();
      let serverList: AuctionItem[] = Array.isArray(data?.auctions) ? data.auctions : [];

      // Also read Firestore mirror if signed in and hydrate any missing listings back to server
      if (auth.currentUser && auth.currentUser.emailVerified) {
        try {
          const snap = await getDocs(collection(db, 'auctions'));
          const fsItems: AuctionItem[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data() as AuctionItem;
            if (d && d.id && d.title && d.status !== 'Suspended') {
              fsItems.push(d);
            }
          });
          const serverMap = new Map(serverList.map((a) => [a.id, a]));
          const richerOrMissing = fsItems.filter((fsItem) => {
            const s = serverMap.get(fsItem.id);
            return !s || (fsItem.bidCount || 0) > s.bidCount;
          });
          if (richerOrMissing.length > 0) {
            const token = await getFreshToken();
            if (token) {
              const hRes = await fetch('/api/auctions/hydrate-sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ auctions: richerOrMissing }),
              });
              if (hRes.ok) {
                const hData = await hRes.json();
                if (Array.isArray(hData?.auctions)) {
                  serverList = hData.auctions;
                }
              }
            }
          }
        } catch {
          // ignore offline Firestore read fallback
        }
      }

      setAuctions(serverList);
    } catch {
      // retain existing state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getFreshToken]);

  useEffect(() => {
    void loadAuctions();
    fetch('/api/paypal/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setPaypalConfig({
            primaryEmail: d.primaryEmail,
            payPalMeHandle: d.payPalMeHandle,
          });
        }
      })
      .catch(() => {});
  }, [loadAuctions]);

  useEffect(() => {
    if (selectedAuction) {
      const minNextKes =
        selectedAuction.bidCount > 0
          ? selectedAuction.currentBidKes + selectedAuction.minIncrementKes
          : selectedAuction.startingBidKes;
      setBidAmountLocal(String(convertKesToLocal(minNextKes, selectedCountry)));
      setActiveImageIdx(0);
      setBidderDepositPaypalRef('');
      setBidderPayPalLinks(null);
      setModalError(null);
      setModalSuccess(null);
    }
  }, [selectedAuctionId, selectedCountry.code]);

  const generateAuctionPayPalEscrowLink = async (
    target: 'seller' | 'bidder',
    depositKes: number,
    itemLabel: string
  ) => {
    const token = await getFreshToken();
    setGeneratingLink(true);
    try {
      const amountUsd = Math.max(0.5, +(depositKes / KES_PER_USD).toFixed(2));
      const res = await fetch('/api/paypal/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          itemName: `50% Auction Escrow Deposit - ${itemLabel}`,
          amountUsd,
          packageId: 'auction_escrow_50pct',
        }),
      });
      const data = await res.json();
      if (data?.success && data?.link) {
        if (target === 'seller') {
          setSellerPayPalLinks(data.link);
        } else {
          setBidderPayPalLinks(data.link);
        }
      }
    } catch {
      // ignore link generation failure; PayPal email fallback still shown
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleOpenCreateModal = () => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setCreateError(null);
    setLocation(customerProfile?.city || selectedCountry.name);
    setStartingBidLocal(String(convertKesToLocal(1000, selectedCountry)));
    setMinIncrementLocal(String(convertKesToLocal(100, selectedCountry)));
    setBuyNowLocal('');
    setSellerDepositPaypalRef('');
    setSellerPayPalLinks(null);
    setCreateOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCreateError(null);
    const remainingSlots = 3 - uploadedImages.length;
    if (remainingSlots <= 0) {
      setCreateError('Maximum of 3 product photos allowed per auction.');
      return;
    }
    const chosen = Array.from(files).slice(0, remainingSlots);
    try {
      const compressed = await Promise.all(chosen.map((file) => compressImageToDataUrl(file)));
      setUploadedImages((prev) => [...prev, ...compressed].slice(0, 3));
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to process one of the selected images.');
    }
    e.target.value = '';
  };

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (uploadedImages.length === 0) {
      setCreateError('Please upload at least 1 clear photo of your product.');
      return;
    }

    const token = await getFreshToken();
    if (!token) {
      setAuthModalOpen(true);
      return;
    }

    const startKes = localToKes(parseFloat(startingBidLocal) || 0);
    const incKes = Math.max(25, localToKes(parseFloat(minIncrementLocal) || 0));
    const buyKes = buyNowLocal.trim() ? localToKes(parseFloat(buyNowLocal) || 0) : undefined;

    if (startKes < 50) {
      setCreateError(`Minimum starting bid is ${formatCurrencyFromKes(50, selectedCountry)}.`);
      return;
    }
    if (buyKes !== undefined && buyKes <= startKes) {
      setCreateError('Optional Buy Now price must be higher than your starting bid.');
      return;
    }

    const requiredDepositKes = Math.max(25, Math.round(startKes * 0.5));
    if (sellerDepositPaypalRef.trim().length < 6) {
      setCreateError(
        `Trustworthiness Policy: Pay the 50% security deposit (${formatCurrencyFromKes(requiredDepositKes, selectedCountry)}) via PayPal first and paste your PayPal Transaction/Order ID to protect real buyers & sellers.`
      );
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/auctions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({
          title,
          description,
          category,
          condition,
          location,
          imageUrls: uploadedImages,
          startingBidKes: startKes,
          minIncrementKes: incKes,
          buyNowKes: buyKes,
          durationHours,
          deliveryTerms,
          countryCode: selectedCountry.code,
          sellerDepositPaypalRef: sellerDepositPaypalRef.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.auction) {
        setCreateError(data?.error || 'Could not publish your product auction.');
        return;
      }

      const created: AuctionItem = data.auction;
      setAuctions((prev) => [created, ...prev]);
      void syncSingleAuctionToFirestore(created);
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setUploadedImages([]);
      setSellerDepositPaypalRef('');
      setSellerPayPalLinks(null);
      setBannerSuccess(`Escrow-Protected Auction "${created.title}" is now LIVE with 50% PayPal protection!`);
      setSelectedAuctionId(created.id);
    } catch (err: any) {
      setCreateError(err?.message || 'Network error uploading auction.');
    } finally {
      setCreating(false);
    }
  };

  const handlePlaceBid = async (overrideKes?: number) => {
    if (!selectedAuction) return;
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setModalError(null);
    setModalSuccess(null);

    const hasDeposit = Boolean(currentUid && selectedAuction.bidderDeposits?.[currentUid]);
    if (!hasDeposit && bidderDepositPaypalRef.trim().length < 6) {
      const reqDepositKes = selectedAuction.escrowDepositKes || Math.max(25, Math.round(selectedAuction.startingBidKes * 0.5));
      setModalError(
        `50% Security Deposit Required: Please pay ${formatCurrencyFromKes(reqDepositKes, selectedCountry)} via PayPal first and enter your PayPal Transaction/Order ID to unlock trusted bidding.`
      );
      return;
    }

    const token = await getFreshToken();
    if (!token) {
      setAuthModalOpen(true);
      return;
    }

    const amountKes = overrideKes ?? localToKes(parseFloat(bidAmountLocal) || 0);
    setBidding(true);
    try {
      const res = await fetch(`/api/auctions/${encodeURIComponent(selectedAuction.id)}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({
          amountKes,
          bidderDepositPaypalRef: bidderDepositPaypalRef.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.auction) {
        setModalError(data?.error || 'Could not place bid.');
        return;
      }

      const updated: AuctionItem = data.auction;
      setAuctions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      void syncSingleAuctionToFirestore(updated);
      const nextMinKes = updated.currentBidKes + updated.minIncrementKes;
      setBidAmountLocal(String(convertKesToLocal(nextMinKes, selectedCountry)));
      setModalSuccess(
        `Bid placed at ${formatCurrencyFromKes(updated.currentBidKes, selectedCountry)}! Your 50% escrow deposit is verified and you are the current highest bidder.`
      );
    } catch (err: any) {
      setModalError(err?.message || 'Network error placing bid.');
    } finally {
      setBidding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!selectedAuction || !selectedAuction.buyNowKes) return;
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setModalError(null);
    setModalSuccess(null);

    const hasDeposit = Boolean(currentUid && selectedAuction.bidderDeposits?.[currentUid]);
    if (!hasDeposit && bidderDepositPaypalRef.trim().length < 6) {
      const reqBuyNowDepositKes = Math.max(25, Math.round(selectedAuction.buyNowKes * 0.5));
      setModalError(
        `50% Security Deposit Required: Please pay ${formatCurrencyFromKes(reqBuyNowDepositKes, selectedCountry)} via PayPal first and enter your PayPal Transaction/Order ID before Instant Buy Now.`
      );
      return;
    }

    const token = await getFreshToken();
    if (!token) {
      setAuthModalOpen(true);
      return;
    }

    setBidding(true);
    try {
      const res = await fetch(`/api/auctions/${encodeURIComponent(selectedAuction.id)}/buy-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({
          buyerDepositPaypalRef: bidderDepositPaypalRef.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.auction) {
        setModalError(data?.error || 'Instant Buy Now failed.');
        return;
      }
      const updated: AuctionItem = data.auction;
      setAuctions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      void syncSingleAuctionToFirestore(updated);
      setModalSuccess(
        `Congratulations! You purchased "${updated.title}" immediately for ${formatCurrencyFromKes(updated.currentBidKes, selectedCountry)} with 50% Escrow Protection active.`
      );
    } catch (err: any) {
      setModalError(err?.message || 'Network error completing Buy Now.');
    } finally {
      setBidding(false);
    }
  };

  const handleCloseAuction = async (action: 'accept_highest' | 'cancel') => {
    if (!selectedAuction) return;
    const token = await getFreshToken();
    if (!token) return;
    setBidding(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const res = await fetch(`/api/auctions/${encodeURIComponent(selectedAuction.id)}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data?.auction) {
        setModalError(data?.error || 'Could not update auction status.');
        return;
      }
      const updated: AuctionItem = data.auction;
      setAuctions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      void syncSingleAuctionToFirestore(updated);
      setModalSuccess(
        action === 'accept_highest'
          ? `Highest bid accepted! Sold to ${updated.highestBidderName || 'winner'} for ${formatCurrencyFromKes(updated.currentBidKes, selectedCountry)}.`
          : 'Auction cancelled cleanly.'
      );
    } catch (err: any) {
      setModalError(err?.message || 'Network error closing auction.');
    } finally {
      setBidding(false);
    }
  };

  const handleDeleteAuction = async (id: string) => {
    const token = await getFreshToken();
    if (!token) return;
    setBidding(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/auctions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setModalError(data?.error || 'Could not delete listing.');
        return;
      }
      setAuctions((prev) => prev.filter((a) => a.id !== id));
      if (selectedAuctionId === id) setSelectedAuctionId(null);
      setBannerSuccess('Auction listing permanently removed.');
      if (auth.currentUser && auth.currentUser.emailVerified) {
        deleteDoc(doc(db, 'auctions', id)).catch(() => {});
      }
    } catch (err: any) {
      setModalError(err?.message || 'Network error deleting listing.');
    } finally {
      setBidding(false);
    }
  };

  const filteredAuctions = useMemo(() => {
    return auctions.filter((item) => {
      if (filterTab === 'live' && item.status !== 'Live') return false;
      if (filterTab === 'completed' && item.status === 'Live') return false;
      if (filterTab === 'my-uploads' && (!currentUid || item.sellerUid !== currentUid)) return false;
      if (
        filterTab === 'my-bids' &&
        (!currentUid || !item.bids.some((b) => b.bidderUid === currentUid))
      ) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.sellerName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [auctions, filterTab, categoryFilter, searchQuery, currentUid]);

  const liveCount = auctions.filter((a) => a.status === 'Live').length;
  const myUploadsCount = currentUid ? auctions.filter((a) => a.sellerUid === currentUid).length : 0;
  const myBidsCount = currentUid
    ? auctions.filter((a) => a.bids.some((b) => b.bidderUid === currentUid)).length
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <Gavel className="w-4 h-4" />
            <span>East Africa Customer Product Auctions</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Upload Your Products &amp; Run Live Bidding Auctions
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            List real phones, solar gear, fashion, electronics, or handmade products with photos and a live countdown timer. To ensure{' '}
            <strong className="text-amber-300">100% trustworthiness</strong>, both sellers and bidders pay a{' '}
            <strong className="text-white">mandatory 50% Escrow Security Deposit via PayPal first</strong> so any dispute on real goods can be fairly compensated between buyer and seller.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              void loadAuctions();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Live Bids</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs md:text-sm font-extrabold transition-colors shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Product &amp; Start Auction</span>
          </button>
        </div>
      </div>

      {/* Live Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-slate-200">
          <div className="text-slate-500 font-medium">Active Live Auctions</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">{liveCount}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Open for bidding right now</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200">
          <div className="text-slate-500 font-medium">Total Listed Items</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">{auctions.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across {CATEGORIES.length} East Africa categories</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200">
          <div className="text-slate-500 font-medium">Bids Recorded</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {auctions.reduce((s, a) => s + (a.bidCount || 0), 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Anti-sniping +2m extension active</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200">
          <div className="text-slate-500 font-medium">My Auction Activity</div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-brand-700 tabular-nums">
            {myUploadsCount} / {myBidsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Uploaded items / Auctions bid</div>
        </div>
      </div>

      {bannerSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bannerSuccess}</span>
          </div>
          <button type="button" onClick={() => setBannerSuccess(null)} className="text-emerald-700 hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {bannerError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button type="button" onClick={() => setBannerError(null)} className="text-rose-700 hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All Auctions (${auctions.length})` },
              { id: 'live', label: `Live Now (${liveCount})` },
              { id: 'completed', label: 'Sold / Ended' },
              { id: 'my-uploads', label: `My Uploads (${myUploadsCount})` },
              { id: 'my-bids', label: `My Bids (${myBidsCount})` },
            ] as { id: AuctionFilterTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-hidden"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, city, seller..."
              className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 w-56 focus:border-blue-600 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Auction Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-80 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-dashed border-slate-300 text-center space-y-3">
          <Package className="w-9 h-9 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No auctions match this filter</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload your own product to start a live East Africa auction or switch tabs above to browse open listings.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload First Product</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAuctions.map((item) => {
            const cover = resolveAuctionImageUrl(item.imageUrls?.[0]);
            const countdown = formatCountdown(item.endsAt, nowMs);
            const isSeller = Boolean(currentUid && item.sellerUid === currentUid);
            const isWinning = Boolean(currentUid && item.highestBidderUid === currentUid);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between hover:border-blue-400 transition-all shadow-xs"
              >
                <div>
                  {/* Image */}
                  <div
                    onClick={() => setSelectedAuctionId(item.id)}
                    className="relative aspect-4/3 bg-slate-100 overflow-hidden cursor-pointer group"
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package className="w-10 h-10" />
                      </div>
                    )}

                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide shadow-xs ${
                          item.status === 'Live'
                            ? 'bg-emerald-600 text-white'
                            : item.status === 'Sold'
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-800 text-white'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.featured && (
                        <span className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-extrabold inline-flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" />
                          <span>Featured</span>
                        </span>
                      )}
                      {isSeller && (
                        <span className="px-2 py-1 rounded-lg bg-slate-900/90 text-white text-[10px] font-bold">
                          Your Listing
                        </span>
                      )}
                      {!isSeller && isWinning && (
                        <span className="px-2 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 text-[10px] font-bold">
                          Highest Bidder
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/85 text-white text-[11px] font-mono font-bold flex items-center gap-1.5">
                      <Clock className={`w-3.5 h-3.5 ${countdown.urgent ? 'text-amber-400' : 'text-sky-300'}`} />
                      <span>{item.status === 'Live' ? countdown.label : item.status}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-brand-700">{item.category}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                          <span>50% PayPal Escrow</span>
                        </span>
                        <span className="font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">{item.condition}</span>
                      </div>
                    </div>

                    <h3
                      onClick={() => setSelectedAuctionId(item.id)}
                      className="text-sm font-extrabold text-slate-900 line-clamp-2 hover:text-blue-700 cursor-pointer"
                    >
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          {item.bidCount > 0 ? 'Current Highest Bid' : 'Starting Bid'}
                        </div>
                        <div className="text-base font-extrabold font-mono tabular-nums text-slate-900">
                          {formatCurrencyFromKes(item.currentBidKes, selectedCountry)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          {item.buyNowKes ? 'Instant Buy Now' : 'Bids Placed'}
                        </div>
                        <div className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                          {item.buyNowKes
                            ? formatCurrencyFromKes(item.buyNowKes, selectedCountry)
                            : `${item.bidCount} bid${item.bidCount === 1 ? '' : 's'}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 truncate">
                        <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{item.sellerName}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{item.location}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer CTA */}
                <div className="px-4 pb-4 pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAuctionId(item.id)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      item.status === 'Live'
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>
                      {isSeller
                        ? 'Manage Listing'
                        : item.status === 'Live'
                        ? `Place Bid (${item.bidCount})`
                        : 'View Final Result'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: UPLOAD PRODUCT & CREATE AUCTION */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Upload Product &amp; Start Live Auction</h2>
                  <p className="text-[11px] text-slate-500">
                    Prices display automatically in each customer&apos;s local currency ({selectedCountry.symbol} / KES / UGX / TZS)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAuction} className="p-6 overflow-y-auto space-y-5 text-xs">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Product Photos Upload (1-3) */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 block">
                  Product Photos (Upload 1 to 3 clear photos)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {uploadedImages.map((imgSrc, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <img src={imgSrc} alt={`Product photo ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {uploadedImages.length < 3 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-600 transition-colors">
                      <Upload className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-[11px]">Add Photo ({uploadedImages.length}/3)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={140}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Samsung Galaxy A54 5G 256GB with Box & Receipt"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium outline-hidden focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AuctionCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold outline-hidden"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as AuctionCondition)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold outline-hidden"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Item City / Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Nairobi, Kenya"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Description &amp; Specs</label>
                <textarea
                  rows={3}
                  required
                  minLength={12}
                  maxLength={1500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe specs, battery health, included accessories, and why buyers will love it..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 outline-hidden focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Starting Bid ({selectedCountry.symbol})
                  </label>
                  <input
                    type="number"
                    required
                    min={convertKesToLocal(50, selectedCountry)}
                    value={startingBidLocal}
                    onChange={(e) => setStartingBidLocal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 outline-hidden focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Min Bid Increment ({selectedCountry.symbol})
                  </label>
                  <input
                    type="number"
                    required
                    min={convertKesToLocal(25, selectedCountry)}
                    value={minIncrementLocal}
                    onChange={(e) => setMinIncrementLocal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 outline-hidden focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Optional Buy Now ({selectedCountry.symbol})
                  </label>
                  <input
                    type="number"
                    value={buyNowLocal}
                    onChange={(e) => setBuyNowLocal(e.target.value)}
                    placeholder="Optional instant price"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Auction Duration</label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold outline-hidden"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.hours} value={opt.hours}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Delivery &amp; Handover Terms</label>
                  <input
                    type="text"
                    value={deliveryTerms}
                    onChange={(e) => setDeliveryTerms(e.target.value)}
                    placeholder="Courier or safe CBD meetup"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Mandatory 50% Seller Escrow Security Deposit via PayPal */}
              {(() => {
                const startKes = localToKes(parseFloat(startingBidLocal) || 0);
                const sellerDepositKes = Math.max(25, Math.round(startKes * 0.5));
                const sellerDepositUsd = Math.max(0.5, +(sellerDepositKes / KES_PER_USD).toFixed(2));
                return (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-extrabold text-amber-950 text-xs">
                          Mandatory 50% Seller Escrow Deposit via PayPal (Real-Goods Trust Guarantee)
                        </div>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          To bring full trustworthiness for real physical items, sellers deposit{' '}
                          <strong>50% of the starting product amount</strong> ({formatCurrencyFromKes(sellerDepositKes, selectedCountry)} / ~${sellerDepositUsd.toFixed(2)} USD) first. If any auction dispute occurs, the platform holds this escrow to compensate the harmed buyer or seller.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={generatingLink}
                        onClick={() => void generateAuctionPayPalEscrowLink('seller', sellerDepositKes, title || 'Product Auction')}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer disabled:opacity-50"
                      >
                        {generatingLink
                          ? 'Generating PayPal Link...'
                          : `Pay 50% Deposit ($${sellerDepositUsd.toFixed(2)} USD) via PayPal`}
                      </button>
                      {paypalConfig.primaryEmail && (
                        <span className="text-[11px] text-amber-900 font-mono">
                          PayPal Escrow Receiver: <strong>{paypalConfig.primaryEmail}</strong>
                        </span>
                      )}
                    </div>

                    {sellerPayPalLinks && (
                      <div className="p-2.5 rounded-xl bg-white border border-amber-200 flex flex-wrap items-center gap-2 text-[11px]">
                        {sellerPayPalLinks.checkoutUrl && (
                          <a
                            href={sellerPayPalLinks.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold inline-flex items-center gap-1"
                          >
                            <span>Open PayPal Checkout (${sellerPayPalLinks.amountUsd?.toFixed(2)})</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {sellerPayPalLinks.payPalMeUrl && (
                          <a
                            href={sellerPayPalLinks.payPalMeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-900 font-bold inline-flex items-center gap-1"
                          >
                            <span>PayPal.Me Instant Link</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="font-bold text-amber-950 block mb-1">
                        Seller PayPal Transaction / Order Reference (50% Deposit Proof) *
                      </label>
                      <input
                        type="text"
                        required
                        minLength={6}
                        value={sellerDepositPaypalRef}
                        onChange={(e) => setSellerDepositPaypalRef(e.target.value)}
                        placeholder="e.g. PAYPAL-7H92K104L or PayPal Capture ID"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white font-mono text-slate-900 uppercase outline-hidden focus:border-blue-600"
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer disabled:opacity-50"
                >
                  <Gavel className="w-4 h-4" />
                  <span>{creating ? 'Publishing Auction...' : 'Publish Escrow-Protected Auction'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AUCTION DETAIL, LIVE BIDDING & SELLER CONTROLS */}
      {selectedAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5 min-w-0">
                <Tag className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="font-mono text-xs font-bold text-slate-500">{selectedAuction.id}</span>
                <span className="text-slate-300">·</span>
                <h2 className="text-sm md:text-base font-extrabold text-slate-900 truncate">
                  {selectedAuction.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuctionId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              {/* Left Column: Photo Gallery & Specs */}
              <div className="space-y-4">
                <div className="aspect-4/3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                  {(() => {
                    const activeImg = resolveAuctionImageUrl(selectedAuction.imageUrls?.[activeImageIdx] || selectedAuction.imageUrls?.[0]);
                    return activeImg ? (
                      <img src={activeImg} alt={selectedAuction.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package className="w-12 h-12" />
                      </div>
                    );
                  })()}
                </div>

                {selectedAuction.imageUrls && selectedAuction.imageUrls.length > 1 && (
                  <div className="flex items-center gap-2">
                    {selectedAuction.imageUrls.map((url, idx) => {
                      const thumb = resolveAuctionImageUrl(url);
                      if (!thumb) return null;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIdx(idx)}
                          className={`w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer ${
                            activeImageIdx === idx ? 'border-blue-600' : 'border-slate-200 opacity-75'
                          }`}
                        >
                          <img src={thumb} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">Product Details</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                      {selectedAuction.condition}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {selectedAuction.description}
                  </p>
                  <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] text-slate-600">
                    <div>
                      <strong>Seller:</strong> {selectedAuction.sellerName} ({selectedAuction.location})
                    </div>
                    <div>
                      <strong>Delivery Terms:</strong> {selectedAuction.deliveryTerms}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Bid Controls & Bid History */}
              <div className="space-y-4">
                {(() => {
                  const countdown = formatCountdown(selectedAuction.endsAt, nowMs);
                  const isSeller = Boolean(currentUid && selectedAuction.sellerUid === currentUid);
                  const minNextKes =
                    selectedAuction.bidCount > 0
                      ? selectedAuction.currentBidKes + selectedAuction.minIncrementKes
                      : selectedAuction.startingBidKes;

                  return (
                    <>
                      <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                            {selectedAuction.bidCount > 0 ? 'Current Highest Bid' : 'Starting Price'}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/10 font-mono font-bold text-amber-300 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{selectedAuction.status === 'Live' ? countdown.label : selectedAuction.status}</span>
                          </span>
                        </div>
                        <div className="text-3xl font-extrabold font-mono tabular-nums text-emerald-400">
                          {formatCurrencyFromKes(selectedAuction.currentBidKes, selectedCountry)}
                        </div>
                        <div className="text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {selectedAuction.highestBidderName
                              ? `Leading Bidder: ${selectedAuction.highestBidderName}`
                              : 'Be the first contributor to bid!'}
                          </span>
                          <span className="font-mono">
                            Min increment: {formatCurrencyFromKes(selectedAuction.minIncrementKes, selectedCountry)}
                          </span>
                        </div>
                      </div>

                      {modalError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{modalError}</span>
                        </div>
                      )}

                      {modalSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{modalSuccess}</span>
                        </div>
                      )}

                      {selectedAuction.status === 'Live' && !isSeller && (() => {
                        const existingDeposit = currentUid ? selectedAuction.bidderDeposits?.[currentUid] : undefined;
                        const requiredBidDepositKes =
                          selectedAuction.escrowDepositKes || Math.max(25, Math.round(selectedAuction.startingBidKes * 0.5));
                        const requiredDepositUsd = Math.max(0.5, +(requiredBidDepositKes / KES_PER_USD).toFixed(2));
                        return (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-bold text-slate-900">Place Your Live Bid ({selectedCountry.currency})</div>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                              Escrow: {selectedAuction.escrowStatus || 'Held in Escrow'}
                            </span>
                          </div>

                          {existingDeposit ? (
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>
                                50% Escrow Security Deposit verified via PayPal ({existingDeposit.paypalRef}). You can bid freely on this item.
                              </span>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
                              <div className="text-[11px] text-amber-950 leading-relaxed">
                                <strong>50% PayPal Escrow Deposit Required First:</strong> To protect real buyers &amp; sellers from non-delivery or fake bids, pay{' '}
                                <strong>{formatCurrencyFromKes(requiredBidDepositKes, selectedCountry)} (~${requiredDepositUsd.toFixed(2)} USD)</strong> via PayPal before placing your first bid. If any dispute arises, the escrow compensates the affected party.
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={generatingLink}
                                  onClick={() =>
                                    void generateAuctionPayPalEscrowLink('bidder', requiredBidDepositKes, selectedAuction.title)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer"
                                >
                                  {generatingLink ? 'Preparing Link...' : `Pay 50% Deposit ($${requiredDepositUsd.toFixed(2)} USD) via PayPal`}
                                </button>
                                {paypalConfig.primaryEmail && (
                                  <span className="text-[11px] text-amber-900 font-mono">
                                    PayPal: <strong>{paypalConfig.primaryEmail}</strong>
                                  </span>
                                )}
                              </div>
                              {bidderPayPalLinks && (
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  {bidderPayPalLinks.checkoutUrl && (
                                    <a
                                      href={bidderPayPalLinks.checkoutUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold inline-flex items-center gap-1"
                                    >
                                      <span>Open PayPal Checkout (${bidderPayPalLinks.amountUsd?.toFixed(2)})</span>
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  {bidderPayPalLinks.payPalMeUrl && (
                                    <a
                                      href={bidderPayPalLinks.payPalMeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-900 font-bold inline-flex items-center gap-1"
                                    >
                                      <span>PayPal.Me Link</span>
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              )}
                              <input
                                type="text"
                                value={bidderDepositPaypalRef}
                                onChange={(e) => setBidderDepositPaypalRef(e.target.value)}
                                placeholder="Paste PayPal 50% Deposit TXN / Order ID (min 6 chars)"
                                className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-mono text-slate-900 uppercase outline-hidden focus:border-blue-600"
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-slate-500 font-mono font-bold">
                                {selectedCountry.symbol}
                              </span>
                              <input
                                type="number"
                                min={convertKesToLocal(minNextKes, selectedCountry)}
                                value={bidAmountLocal}
                                onChange={(e) => setBidAmountLocal(e.target.value)}
                                className="w-full pl-14 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white font-mono font-extrabold text-slate-900 outline-hidden focus:border-blue-600"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={bidding}
                              onClick={() => void handlePlaceBid()}
                              className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Gavel className="w-3.5 h-3.5" />
                              <span>{bidding ? 'Bidding...' : 'Place Bid'}</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {[1, 2, 5].map((mult) => {
                              const targetKes =
                                selectedAuction.bidCount > 0
                                  ? selectedAuction.currentBidKes + selectedAuction.minIncrementKes * mult
                                  : selectedAuction.startingBidKes + selectedAuction.minIncrementKes * (mult - 1);
                              return (
                                <button
                                  key={mult}
                                  type="button"
                                  disabled={bidding}
                                  onClick={() => void handlePlaceBid(targetKes)}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-300 font-mono font-bold text-slate-800 cursor-pointer"
                                >
                                  Quick Bid {formatCurrencyFromKes(targetKes, selectedCountry)}
                                </button>
                              );
                            })}
                          </div>

                          {selectedAuction.buyNowKes && (
                            <button
                              type="button"
                              disabled={bidding}
                              onClick={() => void handleBuyNow()}
                              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              <Zap className="w-4 h-4" />
                              <span>
                                Instant Buy Now for {formatCurrencyFromKes(selectedAuction.buyNowKes, selectedCountry)}
                              </span>
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          )}

                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Seller verified 50% escrow deposit (KES {(selectedAuction.escrowDepositKes || Math.round(selectedAuction.startingBidKes * 0.5)).toLocaleString()}). Anti-snipe guard adds +2m on late bids.
                            </span>
                          </div>
                        </div>
                        );
                      })()}

                      {(isSeller || isOwner) && (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
                          <div className="font-bold text-amber-950">
                            {isSeller ? 'Seller Controls (Your Product)' : 'Platform Owner Moderation Controls'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedAuction.status === 'Live' && selectedAuction.bidCount > 0 && (
                              <button
                                type="button"
                                disabled={bidding}
                                onClick={() => void handleCloseAuction('accept_highest')}
                                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                              >
                                Accept Highest Bid &amp; Sell
                              </button>
                            )}
                            {selectedAuction.status === 'Live' && (
                              <button
                                type="button"
                                disabled={bidding}
                                onClick={() => void handleCloseAuction('cancel')}
                                className="px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer"
                              >
                                Cancel Auction
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={bidding}
                              onClick={() => void handleDeleteAuction(selectedAuction.id)}
                              className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Listing</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Bid History */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900">Live Bid History ({selectedAuction.bidCount})</h3>
                          <span className="text-[11px] font-mono text-slate-500">Latest first</span>
                        </div>
                        {selectedAuction.bids.length === 0 ? (
                          <div className="py-6 text-center text-slate-500">
                            No bids placed yet. Starting bid is {formatCurrencyFromKes(selectedAuction.startingBidKes, selectedCountry)}.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                            {selectedAuction.bids.map((b, idx) => (
                              <div key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{b.bidderName}</span>
                                    {idx === 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                        {b.isBuyNow ? 'BUY NOW' : 'HIGHEST'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    {new Date(b.createdAt).toLocaleString()}
                                  </div>
                                </div>
                                <div className="font-mono font-extrabold text-slate-900 tabular-nums">
                                  {formatCurrencyFromKes(b.amountKes, selectedCountry)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
