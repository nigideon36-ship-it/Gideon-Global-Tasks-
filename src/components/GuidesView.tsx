import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { BookOpen, Sparkles, CheckCircle2, ArrowRight, Clock, User, Bookmark, ChevronRight } from 'lucide-react';

interface GuideArticle {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  readTime: string;
  author: string;
  date: string;
  content: {
    heading: string;
    body: string[];
    takeaways: string[];
  }[];
}

const GUIDES: GuideArticle[] = [
  {
    id: 'ai-data-annotation-manual',
    title: 'The 2026 Manual for AI Training Data: From Pixels to Autonomous Bounding Boxes',
    subtitle: 'How human-in-the-loop annotation bridges the gap between raw camera streams and safe autonomous vehicle perception.',
    category: 'Computer Vision & AI',
    readTime: '6 min read',
    author: 'AI Research Team, Gideon Global',
    date: 'Updated November 2026',
    content: [
      {
        heading: '1. Why Autonomous Vehicles Require Ground-Truth Human Labeling',
        body: [
          'Modern deep learning perception architectures (such as Vision Transformers and Convolutional Neural Networks) are only as dependable as the labeled ground truth on which they are trained. While synthetic data generation has advanced, real-world edge cases—such as low-light pedestrians wearing raincoats, partial occlusions behind delivery vans, and reflective road puddles—routinely cause automated detectors to fail.',
          'Human contributors on Gideon Global Tasks perform spatial localization using strict 2D bounding boxes. By drawing tight rectangular boundaries around target class instances (vehicles, pedestrians, cyclists, and traffic signals), human labelers supply the mathematical coordinates (x_min, y_min, x_max, y_max) needed to calculate Intersection over Union (IoU) loss during neural network backpropagation.'
        ],
        takeaways: [
          'Tight bounding box margins prevent neural networks from learning background noise as object features.',
          'Occluded objects must be labeled if at least 20% of the visible geometry is identifiable.',
          'Class separation between pedestrians, scooters, and cyclists prevents severe trajectory prediction errors.'
        ]
      },
      {
        heading: '2. Avoiding Common Annotation Failure Modes',
        body: [
          'A frequent error in computer vision annotation is "loose bounding," where excess pavement or sky is captured within the box. This degrades detection accuracy by diluting the feature vector gradient. Contributors should ensure boundaries touch the outermost edge of tires, mirrors, and extremities without cutting off essential parts.',
          'At Gideon Global Tasks, our Pro and VIP Contributor passes unlock autonomous driving verification suites featuring automated IoU threshold checks, guaranteeing requesters receive at least 98.5% precision on all delivered datasets.'
        ],
        takeaways: [
          'Maintain a minimum IoU of 0.85 against master gold-standard verification frames.',
          'Always classify emergency vehicles separately from commercial transport.',
          'Use the 7-day streak multiplier bonus to maximize hourly earnings on long annotation sessions.'
        ]
      }
    ]
  },
  {
    id: 'market-research-survey-science',
    title: 'How Global Consumer Surveys Power Billion-Dollar Product Strategy',
    subtitle: 'Inside the quantitative mechanics of demographic sampling, attention checks, and representative polling.',
    category: 'Consumer Intelligence',
    readTime: '5 min read',
    author: 'Market Research Directorate',
    date: 'November 2026',
    content: [
      {
        heading: '1. The Economics of Real-Time Global Polling',
        body: [
          'Before launching a consumer software product, physical beverage, or financial service, global enterprises invest millions validating consumer intent. Blind product development carries catastrophic failure rates; surveyed consumer feedback reduces market risk by matching features to verified consumer pain points.',
          'Gideon Global Tasks distributes surveys across verified demographics in 45+ countries. Rather than relying on outdated telephone polling or easily gamed bot farms, our platform combines cryptographic Google account verification with randomized trap questions to ensure 100% authentic human sentiment.'
        ],
        takeaways: [
          'Enterprises value thoughtful, comprehensive open-ended qualitative feedback over one-word answers.',
          'Attention check questions (e.g., "Select option 3 to prove you are reading") safeguard data integrity.',
          'Consistent quality scores above 95% unlock higher-paying enterprise focus group questionnaires ($5–$15+).'
        ]
      },
      {
        heading: '2. Tips for Contributors to Maximize Survey Earnings',
        body: [
          'To maintain an active survey qualification status, contributors must provide consistent demographic responses. Inconsistencies in age, country, or profession trigger automated security audits. Answering questions patiently and thoroughly ensures faster task approvals and priority placement in the global task queue.'
        ],
        takeaways: [
          'Never rush through questions—survey algorithms flag answers completed faster than human reading speeds.',
          'Check the Tasks Marketplace daily for newly published morning quotas.',
          'Combine survey rewards with the Starter ($2) or Pro ($5) pass to unlock full daily task allowances.'
        ]
      }
    ]
  },
  {
    id: 'receipt-digitization-ocr-guide',
    title: 'Receipt & Invoice OCR Digitization: Achieving 99.5%+ Precision in Accounting',
    subtitle: 'A practical breakdown of optical character recognition limitations and human document extraction queues.',
    category: 'Data Extraction & FinTech',
    readTime: '5 min read',
    author: 'Document Verification Group',
    date: 'November 2026',
    content: [
      {
        heading: '1. The Fragility of Optical Character Recognition (OCR)',
        body: [
          'While automated OCR engines (such as Tesseract or proprietary cloud vision APIs) excel on crisp digital PDFs, they routinely stumble when processing crinkled paper receipts, thermal printed register rolls, and skewed mobile camera snapshots. Characters like "8" and "B", or "0" and "O" are frequently swapped, which in accounting audits can introduce disastrous discrepancies.',
          'Gideon Global Tasks deploys a hybrid pipeline: raw documents are pre-parsed by OCR, and human data entry specialists verify and correct transaction numbers, tax values, and merchant names. This human-in-the-loop workflow elevates overall data extraction accuracy from ~85% to over 99.5%.'
        ],
        takeaways: [
          'Always key in the pre-tax subtotal and total balance due exactly as printed on the receipt.',
          'Do not type currency symbols (e.g., $, €, KSh) into numeric form fields unless requested.',
          'If a receipt is partially torn, transcribe all legible line items and flag the document as damaged.'
        ]
      }
    ]
  },
  {
    id: 'micropayments-mpesa-wise-explained',
    title: 'Demystifying Remote Micropayments: How M-PESA & Wise Power Borderless Work',
    subtitle: 'Why mobile money and instant international transfers are replacing traditional banking for remote digital workers.',
    category: 'FinTech & Payouts',
    readTime: '6 min read',
    author: 'Treasury & Payments Ops',
    date: 'November 2026',
    content: [
      {
        heading: '1. The Challenge of Cross-Border Digital Remittances',
        body: [
          'In many emerging economies across East Africa, Southeast Asia, and Latin America, traditional wire transfers incur $30 to $50 minimum processing fees and take 3–5 business days to clear. For freelance workers earning micro-rewards from surveys and annotations, these predatory fees represent a significant percentage of their earnings.',
          'Gideon Global Tasks solved this problem by integrating direct **M-PESA STK Push** mobile money and **Wise** multi-currency rails. When a contributor reaches our $100.00 withdrawal milestone, funds are disbursed directly into their mobile wallet or local currency bank account with zero platform fees.'
        ],
        takeaways: [
          'The $100.00 minimum withdrawal threshold protects platform liquidity and ensures 0% fee disbursement.',
          'M-PESA payouts generate immediate confirmation codes (e.g., QJH89K2P0L) for real-time mobile verification.',
          'Contributors can also reinvest wallet balances directly into VIP Taskmaster passes without external card fees.'
        ]
      }
    ]
  }
];

export const GuidesView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const [selectedGuide, setSelectedGuide] = useState<GuideArticle>(GUIDES[0]);

  return (
    <div className="space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-2 max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-100 px-3 py-1 rounded-full">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Educational Knowledge Base & Editorial Guides</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Contributor Guides & Machine Learning Research
        </h1>
        <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
          Comprehensive, peer-reviewed educational articles on computer vision annotation, survey methodology, document digitization best practices, and remote micropayment economics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Article Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block px-1">
            Featured Platform Manuals
          </span>
          <div className="space-y-2">
            {GUIDES.map((guide) => {
              const isSelected = guide.id === selectedGuide.id;
              return (
                <button
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide)}
                  className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-white border-brand-500 shadow-md ring-1 ring-brand-500'
                      : 'bg-slate-50 hover:bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
                    <span className="text-brand-600 font-semibold">{guide.category}</span>
                    <span>{guide.readTime}</span>
                  </div>
                  <h3 className={`text-xs font-bold line-clamp-2 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                    {guide.title}
                  </h3>
                </button>
              );
            })}
          </div>

          <div className="p-5 bg-gradient-to-br from-slate-900 to-brand-950 text-white rounded-2xl space-y-3 mt-6">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h4 className="font-bold text-xs">Ready to Apply These Techniques?</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Activate your Starter ($2), Pro ($5), or VIP ($10) worker pass to start completing paid tasks right now.
            </p>
            <button
              onClick={() => setActiveTab('packages')}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
            >
              View Contributor Passes
            </button>
          </div>
        </div>

        {/* Selected Article Full View */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-sm space-y-8">
          {/* Article Header */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="px-2.5 py-0.5 bg-brand-50 text-brand-700 font-semibold rounded-md text-[11px]">
                {selectedGuide.category}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Clock className="w-3 h-3" />
                {selectedGuide.readTime}
              </span>
              <span>·</span>
              <span className="text-[11px]">{selectedGuide.date}</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              {selectedGuide.title}
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {selectedGuide.subtitle}
            </p>

            <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>By <strong className="text-slate-800">{selectedGuide.author}</strong></span>
            </div>
          </div>

          {/* Article Content Sections */}
          <div className="space-y-8 text-xs md:text-sm text-slate-600 leading-relaxed">
            {selectedGuide.content.map((sec, idx) => (
              <div key={idx} className="space-y-4">
                <h3 className="text-base md:text-lg font-bold text-slate-900">
                  {sec.heading}
                </h3>
                {sec.body.map((p, pIdx) => (
                  <p key={pIdx} className="leading-relaxed">
                    {p}
                  </p>
                ))}

                {sec.takeaways && sec.takeaways.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mt-4">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                      Key Contributor Takeaways
                    </span>
                    <div className="space-y-1.5">
                      {sec.takeaways.map((t, tIdx) => (
                        <div key={tIdx} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Article Footer & Action */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <span className="text-slate-400 text-[11px]">
              Published under Gideon Global Open Research Standards · All rights reserved.
            </span>
            <button
              onClick={() => setActiveTab('tasks')}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Back to Tasks Marketplace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
