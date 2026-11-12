import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { HelpCircle, ChevronDown, ChevronUp, Sparkles, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

interface FAQItem {
  question: string;
  category: 'general' | 'payouts' | 'passes' | 'quality';
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    category: 'general',
    question: 'What is Gideon Global Tasks and how does the platform operate?',
    answer: 'Gideon Global Tasks is a borderless crowdsourcing network that connects global contributors with verified micro tasks, consumer market research surveys, artificial intelligence computer vision annotation, receipt and invoice OCR digitization, and creative copywriting. Contributors complete tasks from anywhere in the world and earn direct cash micropayments that disburse once they reach the $100.00 milestone.'
  },
  {
    category: 'passes',
    question: 'Why are worker passes ($2, $5, $10) required to complete tasks?',
    answer: 'Worker passes fund platform compute, anti-bot biometric verification, and dedicated cloud annotation workspaces. By requiring a nominal pass—Starter ($2 for 25 tasks/day), Pro ($5 for 75 tasks/day), or VIP ($10 for unlimited tasks)—we filter out automated spam scripts and fraudulent submissions. This ensures that 100% of the bounty funds deposited by enterprise requesters go directly into contributor balances with 0% platform take-rates.'
  },
  {
    category: 'payouts',
    question: 'Why is the minimum withdrawal threshold set at $100.00?',
    answer: 'International payment gateways and mobile money networks charge substantial fixed transaction fees on small transfers. By aggregating payouts starting at $100.00, Gideon Global Tasks guarantees a 0% fee policy for workers on M-PESA and Wise disbursements. Users can easily track their balance and completed tasks in the Task History Ledger as they work toward the milestone.'
  },
  {
    category: 'payouts',
    question: 'Which withdrawal and payment methods are supported?',
    answer: 'We natively support M-PESA mobile money (with instant STK verification codes across Kenya and East Africa), Wise multi-currency international bank transfers (available in 80+ countries), standard debit/credit cards, and internal wallet re-investments.'
  },
  {
    category: 'passes',
    question: 'How does the Daily Contributor Streak system work?',
    answer: 'Contributors who log in daily build a consecutive contributor streak. Reaching a 7-day streak awards an immediate $5.00 cash bonus directly to your wallet balance plus an ongoing +20% earnings multiplier across all completed task rewards. Logging in between Days 1–6 grants a +10% earnings bonus.'
  },
  {
    category: 'general',
    question: 'How does the 20% Referral Commission program work?',
    answer: 'Every contributor receives a unique referral code and tracking link. When new users join via your link and activate any worker pass ($2 Starter, $5 Pro, or $10 VIP), you automatically receive an instant 20% cash commission credited directly to your withdrawable wallet balance (e.g., $1.00 on a $5 pass, $2.00 on a $10 pass).'
  },
  {
    category: 'quality',
    question: 'How are task submissions reviewed and quality scores maintained?',
    answer: 'Submissions undergo automated precision audits (such as IoU bounding box calculations for computer vision or regex checks for receipt figures) alongside peer spot-checks. Contributors maintain an accuracy quality score (target 95%+). High-performing contributors unlock high-paying VIP writing bounties and priority verification queues.'
  },
  {
    category: 'quality',
    question: 'How does Gideon Global Tasks comply with Google AdSense and privacy regulations?',
    answer: 'Our platform strictly complies with Google Publisher Policies, GDPR, and CCPA. We do not sell personally identifiable information. Contextual advertisements served via Google AdSense use standard cookies that users can manage or opt out of via Google Ads Settings or aboutads.info. We maintain transparent terms, an active contact desk (nigideon36@gmail.com), and rigorous human content standards.'
  }
];

export const FAQView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [filter, setFilter] = useState<'all' | 'general' | 'payouts' | 'passes' | 'quality'>('all');

  const filteredFaqs = FAQS.filter((f) => filter === 'all' || f.category === filter);

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
          Detailed explanations of platform mechanics, worker pass tiers, withdrawal thresholds, M-PESA mobile money disbursements, and quality standards.
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
          All Questions ({FAQS.length})
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
          onClick={() => setFilter('passes')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'passes' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Worker Passes ($2–$10)
        </button>
        <button
          onClick={() => setFilter('payouts')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'payouts' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Payouts & M-PESA ($100+)
        </button>
        <button
          onClick={() => setFilter('quality')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'quality' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Quality & Compliance
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
