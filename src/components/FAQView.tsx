import React, { useMemo, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import {
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';
import { HelpCircle, ChevronDown, ChevronUp, Sparkles, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

interface FAQItem {
  question: string;
  category: 'general' | 'payouts' | 'daily' | 'quality';
  answer: string;
}

export const FAQView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const { selectedCountry } = useRegion();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [filter, setFilter] = useState<'all' | 'general' | 'payouts' | 'daily' | 'quality'>('all');

  const faqs = useMemo<FAQItem[]>(() => {
    const threshold = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
    const streakBonus = formatCurrencyFromUsd(5, selectedCountry);

    return [
      {
        category: 'general',
        question: 'What is Gideon Global Tasks and who can use the platform?',
        answer: `Gideon Global Tasks is an East Africa platform built for residents in Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia. Members earn side rewards through consumer surveys, image labeling, and document verification, buy and sell items in 50% PayPal Escrow Product Auctions, or post funny videos and photos free in the Pay-Per-View Status Feed (${formatCurrencyFromKes(5, selectedCountry)}/view).`
      },
      {
        category: 'daily',
        question: 'How does the 08:00 AM EAT daily task drop & reward pricing work?',
        answer: `Access is 100% free with zero Worker Pass required. Exactly 1 vetted task drops every day at 08:00 AM EAT (UTC+3), so contributors must keep time to catch each day's drop. Rewards depend on the specific task type and the budget set by the sponsoring merchant—there is no artificial fixed ceiling.`
      },
      {
        category: 'payouts',
        question: `Why does the PayPal cash-out threshold start at ${threshold} and require National ID KYC?`,
        answer: `Withdrawals start at ${threshold} (150 Kenyan Shillings converted accurately across East Africa currencies) and are paid exclusively via PayPal. Under strict withdrawal KYC rules, you must upload clear photos of BOTH the Front and Back of your country's official ID (${selectedCountry.idDocumentName}) and obtain Platform Owner approval before requesting a PayPal cash-out.`
      },
      {
        category: 'payouts',
        question: 'Which payment gateway is supported for deposits and withdrawals?',
        answer: 'PayPal is the sole supported payment gateway platform-wide for contributor withdrawals, KES 50+ investment pool deposits, and 50% auction security escrow deposits. No M-PESA, Paystack, IntaSend, bank transfers, or crypto rails are used.'
      },
      {
        category: 'daily',
        question: 'How does the Daily Contributor Streak bonus work?',
        answer: `Completing each 08:00 AM EAT daily task consistently builds your streak counter. Reaching Day 7 awards a ${streakBonus} milestone bonus to your wallet alongside a +20% earnings multiplier. Days 1 through 6 carry a +10% streak boost.`
      },
      {
        category: 'general',
        question: 'How do local Product Auctions with 50% PayPal Escrow and Pay-Per-View work?',
        answer: `In Product Auctions, both the seller and the buyer/bidder must pay a 50% security escrow deposit via PayPal first to guarantee real-product trustworthiness—if any auction issue occurs, escrow compensates the buyer or seller fairly. In the Pay-Per-View Status Feed, any registered member can upload funny videos or photos 100% free, earning ${formatCurrencyFromKes(5, selectedCountry)} per unique view settled automatically after 24 hours.`
      },
      {
        category: 'general',
        question: 'How does the 20% Referral Program work?',
        answer: 'Every account receives a personal invite link. When someone registers using your referral link and completes verified qualifying platform activity, 20% referral rewards are tracked transparently in your contributor wallet.'
      },
      {
        category: 'quality',
        question: 'How are submissions, KYC IDs, auctions, and Pay-Per-View statuses checked?',
        answer: 'Task submissions go through reading-speed audits, attention checks, and moderator review. Front and Back National ID uploads are manually verified against the applicant name and ID number, and auction escrow & Pay-Per-View status views are tracked per verified UID to block fraud or duplicate farming.'
      },
      {
        category: 'quality',
        question: 'How are advertising privacy and editorial standards handled?',
        answer: 'Our platform follows Google Publisher Policies, GDPR, and CCPA guidelines. We never sell personal data, clearly separate editorial handbooks from paid ads (Google AdSense and Monetag), and maintain direct human support via nigideon36@gmail.com, +254712727558, and WhatsApp 0785909543.'
      }
    ];
  }, [selectedCountry]);

  const filteredFaqs = faqs.filter((f) => filter === 'all' || f.category === filter);

  const toggle = (idx: number) => {
    setOpenIndex((curr) => (curr === idx ? null : idx));
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-100 px-3 py-1 rounded-full">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Frequently Asked Questions</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Everything You Need to Know
        </h1>
        <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
          Detailed explanations of the 08:00 AM EAT daily task drop, merchant-set rewards, PayPal-only withdrawals from 150 shillings with Front &amp; Back ID KYC, and 50% PayPal auction escrow protection.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          All Questions ({faqs.length})
        </button>
        <button
          onClick={() => setFilter('general')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'general' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Platform Overview
        </button>
        <button
          onClick={() => setFilter('daily')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'daily' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          8:00 AM EAT Drop &amp; Streaks
        </button>
        <button
          onClick={() => setFilter('payouts')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'payouts' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          PayPal &amp; ID KYC ({formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}+)
        </button>
        <button
          onClick={() => setFilter('quality')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'quality' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Quality &amp; Compliance
        </button>
      </div>

      {/* FAQ Accordion List */}
      <div className="max-w-3xl mx-auto space-y-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isOpen ? 'bg-white border-brand-300 shadow-sm' : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <span className="font-bold text-xs md:text-sm text-slate-900">
                  {faq.question}
                </span>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOpen ? 'bg-brand-50 text-brand-600' : 'text-slate-400'}`}>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-6 pb-5 pt-1 text-xs md:text-sm text-slate-600 leading-relaxed border-t border-slate-100 animate-in fade-in">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Banner */}
      <div className="max-w-3xl mx-auto p-6 bg-slate-100 rounded-3xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="space-y-1 text-center sm:text-left">
          <span className="font-bold text-slate-900 text-sm">Have a Question Not Answered Here?</span>
          <p className="text-slate-500 text-[11px]">
            Our support desk is online 24/7. Contact us directly at <code className="bg-white px-1 py-0.5 rounded text-slate-800 font-mono">nigideon36@gmail.com</code>.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('contact')}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors shrink-0 cursor-pointer shadow-sm"
        >
          Open Support Ticket
        </button>
      </div>
    </div>
  );
};
