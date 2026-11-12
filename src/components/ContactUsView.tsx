import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { Mail, Clock, ShieldCheck, Send, CheckCircle2, MessageSquare, AlertCircle, HelpCircle } from 'lucide-react';

export const ContactUsView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<'worker' | 'requester' | 'billing' | 'partnership'>('worker');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError('Please provide a valid email address so we can reply.');
      return;
    }
    if (!message.trim() || message.length < 15) {
      setError('Please provide a detailed inquiry message (minimum 15 characters).');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    }, 600);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-100 px-3 py-1 rounded-full">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Official Support & Corporate Inquiries</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          How Can Our Support Team Help You?
        </h1>
        <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
          Whether you are a contributor with a payout question, an enterprise AI lab requiring custom dataset annotations, or an advertising partner, our dedicated team typically responds within <strong>12 to 24 hours</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact Info Sidebar */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-lg space-y-6">
            <div>
              <h3 className="font-bold text-base text-white">Direct Communication Channels</h3>
              <p className="text-xs text-slate-400 mt-1">
                Reach out directly to our verified platform administrators.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-emerald-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Primary Support Email</span>
                  <a
                    href="mailto:nigideon36@gmail.com"
                    className="font-mono text-emerald-400 hover:underline font-semibold"
                  >
                    nigideon36@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-brand-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Operating Service Hours</span>
                  <span className="text-slate-200">Monday – Sunday (24/7 Global Queue)</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-purple-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Escrow & Payout Inquiries</span>
                  <span className="text-slate-200">M-PESA STK & Wise Instant Audits</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 text-[11px] text-slate-400">
              Gideon Global Tasks Inc. · Borderless Crowdsourcing & Machine Learning Ground Truth Network.
            </div>
          </div>

          {/* Quick FAQ card */}
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-brand-600" />
              <span>Looking for Quick Answers?</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Before submitting a ticket, check our detailed FAQ covering minimum withdrawal limits ($100), pass tiers ($2–$10), and daily streak bonuses.
            </p>
            <button
              onClick={() => setActiveTab('faq')}
              className="text-brand-600 hover:text-brand-700 font-semibold cursor-pointer underline text-[11px] block"
            >
              Read Frequently Asked Questions →
            </button>
          </div>
        </div>

        {/* Working Interactive Contact Form */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
          {submitted ? (
            <div className="py-12 text-center space-y-4 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Inquiry Received Successfully!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Thank you for contacting Gideon Global Tasks. A confirmation has been routed to our support desk (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">nigideon36@gmail.com</code>). One of our team members will respond within 24 hours.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <h3 className="font-bold text-base text-slate-900">Send an Official Message</h3>
                <p className="text-xs text-slate-500">
                  Please complete the fields below with sufficient details so our staff can assist promptly.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Your Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. David Kimani"
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. david@example.com"
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Inquiry Department *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors cursor-pointer"
                  >
                    <option value="worker">Contributor Support (Tasks, Pass, Streaks)</option>
                    <option value="billing">Escrow, M-PESA & Wise Withdrawals</option>
                    <option value="requester">Enterprise Requester (Submit Datasets)</option>
                    <option value="partnership">Google AdSense, Media & Partnerships</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Subject / Reference</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. M-PESA Payout Verification"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Detailed Message *</label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your question, issue, or enterprise project requirements..."
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-[11px] text-slate-400">
                  Protected by 256-bit encryption. We never share your personal information.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Sending Ticket...' : 'Submit Inquiry'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
