import React from 'react';
import { useTasks } from '../context/TaskContext';
import { ShieldCheck, Lock, ExternalLink, Mail, CheckCircle2, ArrowLeft, FileText } from 'lucide-react';

export const PrivacyPolicyView: React.FC = () => {
  const { setActiveTab } = useTasks();

  return (
    <article className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-200 text-slate-800">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('tasks');
          }}
          className="hover:text-slate-900 transition-colors"
        >
          Home
        </a>
        <span>/</span>
        <span className="text-slate-900 font-medium">Privacy Policy</span>
      </nav>

      {/* Header with H1 */}
      <header className="space-y-4 pb-8 border-b border-slate-200">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Google AdSense & GDPR Compliant</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
          Privacy Policy & Comprehensive Cookie Disclosure
        </h1>
        <p className="text-xs md:text-sm text-slate-500">
          Last Updated & Effective Date: November 11, 2026 · Official Domain: <strong className="text-slate-700">https://gideon-global-tasks.ai.studio/</strong>
        </p>
      </header>

      {/* Notice Banner */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-950">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <p className="font-bold">Google AdSense Partner Compliance Notice</p>
          <p className="text-emerald-900 text-[11px]">
            This Privacy Policy details the types of personal information collected by Gideon Global Tasks, how it is processed and protected, and our explicit use of cookies by third-party advertising vendors including Google.
          </p>
        </div>
      </div>

      {/* Section 1 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. Information We Collect</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          At Gideon Global Tasks, we collect personal information when you create an account, authenticate via Google Single Sign-On (OAuth), complete micro tasks, fill out market research surveys, submit data annotations, or request monetary withdrawals.
        </p>
        <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
          <li><strong>Identity & Profile Information:</strong> Your full name, verified email address, Google account identifier (UID), and profile avatar.</li>
          <li><strong>Financial & Payout Information:</strong> Mobile money identifiers (e.g. verified M-PESA phone numbers), Wise account emails, and payout transaction references. We do not store raw credit card numbers; payment processing for worker passes is handled via secure PCI-DSS Level 1 compliant gateways.</li>
          <li><strong>Work Performance Data:</strong> Task completion timestamps, 2D bounding box coordinates, optical character recognition corrections, survey answers, quality audit scores, and daily streak records.</li>
          <li><strong>Log & Technical Data:</strong> Internet Protocol (IP) addresses, browser type, operating system version, referring/exit pages, and clickstream analytics collected automatically to prevent fraud and bot abuse.</li>
        </ul>
      </section>

      {/* Section 2 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. Google AdSense, DoubleClick DART Cookies & Third-Party Advertising</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Gideon Global Tasks partners with Google AdSense and third-party advertising networks to serve advertisements when you visit our website. These companies may use cookies, web beacons, and JavaScript to measure advertising effectiveness and personalize advertising content.
        </p>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">Google DoubleClick DART Cookie Notice:</p>
          <p className="text-slate-600 leading-relaxed">
            Google, as a third-party vendor, uses cookies to serve ads on <code>gideon-global-tasks.ai.studio</code>. Google's use of the DART cookie enables it to serve ads to our users based on their visit to our site and other sites on the Internet.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Users may opt out of the use of the DART cookie by visiting the{' '}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 font-semibold underline inline-flex items-center gap-1"
            >
              Google Ads Settings
              <ExternalLink className="w-3 h-3" />
            </a>.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Alternatively, users can opt out of a third-party vendor's use of cookies for personalized advertising by visiting{' '}
            <a
              href="https://www.aboutads.info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 font-semibold underline inline-flex items-center gap-1"
            >
              aboutads.info
              <ExternalLink className="w-3 h-3" />
            </a>{' '}
            or the European Interactive Digital Advertising Alliance (EDAA) consumer portal at{' '}
            <a
              href="https://www.youronlinechoices.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 font-semibold underline inline-flex items-center gap-1"
            >
              youronlinechoices.eu
              <ExternalLink className="w-3 h-3" />
            </a>.
          </p>
        </div>
      </section>

      {/* Section 3 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. Purpose and Legal Basis for Data Processing</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          We process personal data under the General Data Protection Regulation (GDPR) and international privacy laws based on the following grounds:
        </p>
        <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
          <li><strong>Performance of Contract:</strong> To administer your contributor account, track task history, enforce quality scores, and disburse earned micropayments starting from the $20.00 milestone.</li>
          <li><strong>Legitimate Interests:</strong> To prevent bot spam, secure platform APIs, improve machine learning dataset quality, and analyze platform telemetry.</li>
          <li><strong>Consent:</strong> For non-essential analytics and targeted Google AdSense advertising. You may withdraw cookie consent at any time via our Cookie Consent interface.</li>
          <li><strong>Compliance with Legal Obligations:</strong> To maintain verifiable transaction ledgers for anti-money laundering (AML) and financial accounting.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. Data Security, Cloud Infrastructure & Encryption</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Gideon Global Tasks implements state-of-the-art technical and organizational security controls:
        </p>
        <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
          <li><strong>256-Bit SSL/TLS Encryption:</strong> All data in transit between your browser and our Cloud Run servers is secured via HTTPS with strict transport security.</li>
          <li><strong>Persistent Relational Storage:</strong> User account ledgers, completed task receipts, and referral records are maintained in managed Cloud SQL PostgreSQL databases protected by private virtual network peering.</li>
          <li><strong>Role-Based Access Control (RBAC):</strong> Strict security rules safeguard user profiles so contributors can only view and modify their own records.</li>
        </ul>
      </section>

      {/* Section 5 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. General Data Protection Regulation (GDPR) Rights</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          If you are a resident of the European Economic Area (EEA), you possess specific data protection rights under Regulation (EU) 2016/679 (GDPR):
        </p>
        <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
          <li><strong>Right to Access:</strong> You may request copies of all personal data held in your contributor profile.</li>
          <li><strong>Right to Rectification:</strong> You can update inaccurate account details or phone numbers in your profile settings.</li>
          <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> You may request the permanent deletion of your account and associated task logs by contacting our support desk.</li>
          <li><strong>Right to Restrict or Object to Processing:</strong> You have the right to object to automated profiling or non-essential data aggregation.</li>
          <li><strong>Right to Data Portability:</strong> You may request an export of your completed task history in machine-readable JSON format.</li>
        </ul>
      </section>

      {/* Section 6 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. California Consumer Privacy Act (CCPA / CPRA) Disclosures</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA), California residents have specific statutory rights:
        </p>
        <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
          <li>We do <strong>not</strong> sell your personal information or personal data to third parties.</li>
          <li>You have the right to request disclosure of the categories and specific pieces of personal data collected over the preceding 12 months.</li>
          <li>You have the right to request deletion of your personal data without discrimination in services or rates.</li>
        </ul>
      </section>

      {/* Section 7 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. Children's Online Privacy Protection (COPPA)</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Gideon Global Tasks does not knowingly collect or solicit personal information from individuals under 18 years of age. Our services and worker pass activation are strictly restricted to adults who are legally capable of entering into binding contracts. If we become aware that a child under 18 has registered an account, we will immediately terminate the account and purge their data from our servers.
        </p>
      </section>

      {/* Section 8 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">8. Contact Information & Data Protection Officer (DPO)</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          If you have questions regarding this Privacy Policy, wish to exercise any of your statutory privacy rights, or need assistance with cookie preferences, please contact our designated Data Protection Officer:
        </p>
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
          <p className="font-bold text-slate-900">Gideon Global Tasks Privacy & Legal Office</p>
          <p className="text-slate-600">Email: <a href="mailto:nigideon36@gmail.com" className="text-brand-600 font-semibold underline">nigideon36@gmail.com</a></p>
          <p className="text-slate-600">Online Contact Desk:{' '}
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('contact');
              }}
              className="text-brand-600 underline font-medium"
            >
              Support Center & Ticket Submission
            </a>
          </p>
          <p className="text-slate-500 text-[11px]">Response SLA: Inquiries are acknowledged within 24 business hours.</p>
        </div>
      </section>

      {/* Return to Marketplace Footer */}
      <div className="pt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => setActiveTab('tasks')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Tasks Marketplace</span>
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <a
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('terms');
            }}
            className="hover:text-slate-900 underline"
          >
            Terms of Service
          </a>
          <span>·</span>
          <a
            href="/disclaimer"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('disclaimer');
            }}
            className="hover:text-slate-900 underline"
          >
            Disclaimer
          </a>
          <span>·</span>
          <a
            href="/sitemap"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('sitemap');
            }}
            className="hover:text-slate-900 underline"
          >
            HTML Sitemap
          </a>
        </div>
      </div>
    </article>
  );
};
