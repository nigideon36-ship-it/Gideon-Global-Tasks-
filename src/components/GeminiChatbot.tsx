import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  X,
  Globe,
  ExternalLink,
  RefreshCw,
  Trash2,
  Phone,
  MessageSquare,
  AlertCircle,
  Zap,
  CheckCircle2,
  LifeBuoy,
} from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { useAuth } from '../context/AuthContext';
import {
  PPV_RATE_PER_VIEW_KES,
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; uri: string }[];
  timestamp: string;
  isError?: boolean;
  retryPrompt?: string;
}

export const GeminiChatbot: React.FC = () => {
  const { userStats } = useTasks();
  const { selectedCountry } = useRegion();
  const { user, customerProfile, activeToken, getFreshToken } = useAuth();

  const buildWelcomeMessage = useCallback((): ChatMessage => {
    const minWithdraw = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
    const ppvRate = formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry);
    return {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hello! I'm Gideon's 24/7 AI Customer Support Assistant. Even when Gideon is away, I can help you with the Daily 8:00 AM EAT Task Drop (100% free, merchant-set rewards), Front & Back National ID KYC, PayPal-only withdrawals from ${minWithdraw}, 50% PayPal Escrow Auctions, and Free Pay-Per-View statuses (${ppvRate}/view auto-paid in 24h).`,
      timestamp: 'Just now',
    };
  }, [selectedCountry]);

  const quickPrompts = React.useMemo(
    () => [
      'When does the single daily task drop (8:00 AM EAT)?',
      `How do PayPal withdrawals (${formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} min) & Front/Back National ID KYC work?`,
      'How does the 50% PayPal Escrow Deposit protect auction buyers & sellers?',
      `How does Free Pay-Per-View (${formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)}/view, 24h payout) work?`,
    ],
    [selectedCountry]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [useSearch, setUseSearch] = useState(false);
  const [modelMode, setModelMode] = useState<'hydrogen' | 'fast'>('hydrogen');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);

  // Offline support ticket escalation state (when Gideon is away)
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketName, setTicketName] = useState('');
  const [ticketContact, setTicketContact] = useState('');
  const [ticketCategory, setTicketCategory] = useState('PayPal Payout / KYC');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketSubmittedId, setTicketSubmittedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const handleSendRef = useRef<(textToSend?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    if (customerProfile?.displayName && !ticketName) {
      setTicketName(customerProfile.displayName);
    }
    const preferredContact = customerProfile?.phone || customerProfile?.email || user?.email || '';
    if (preferredContact && !ticketContact) {
      setTicketContact(preferredContact);
    }
  }, [customerProfile, user, ticketName, ticketContact]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, ticketOpen]);

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? input).trim();
      if (!text || isLoading) return;

      setErrorBanner(null);
      setTicketOpen(false);
      const userMsg: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const historySnapshot = [...messages, userMsg];
      const assistantMsgId = `msg-ai-${Date.now()}`;
      const placeholderAssistant: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([...historySnapshot, placeholderAssistant]);
      if (!textToSend) setInput('');
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const customerContext = {
        isSignedIn: Boolean(user || customerProfile),
        displayName: customerProfile?.displayName || user?.displayName || undefined,
        country: selectedCountry.name,
        balance: userStats.balance,
        formattedBalance: formatCurrencyFromUsd(userStats.balance, selectedCountry),
        pass: 'Open Access (No Worker Pass)',
        tasksCompleted: userStats.completedTasksCount,
      };

      const requestPayload = {
        messages: historySnapshot
          .filter((m) => !m.isError)
          .map((m) => ({ role: m.role, content: m.content })),
        useSearch,
        modelMode,
        customerContext,
      };

      const callJsonFallback = async (): Promise<{ text: string; sources?: { title: string; uri: string }[] }> => {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(requestPayload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.text) {
          throw new Error(data?.error || 'Unable to reach Live AI right now.');
        }
        return { text: data.text, sources: Array.isArray(data.sources) ? data.sources : [] };
      };

      let accumulatedText = '';
      let accumulatedSources: { title: string; uri: string }[] = [];

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(requestPayload),
        });

        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('text/event-stream') || !response.body) {
          const fallbackData = await callJsonFallback();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: fallbackData.text,
                    sources: fallbackData.sources || [],
                  }
                : m
            )
          );
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const payload = JSON.parse(jsonStr);
              if (payload.error) {
                throw new Error(payload.error);
              }
              if (typeof payload.chunk === 'string') {
                accumulatedText += payload.chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulatedText } : m
                  )
                );
              }
              if (Array.isArray(payload.sources)) {
                accumulatedSources = payload.sources;
              }
              if (payload.done) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content:
                            accumulatedText ||
                            'I have reviewed your question. Please let me know if you need more details!',
                          sources: accumulatedSources,
                        }
                      : m
                  )
                );
              }
            } catch (parseErr: any) {
              if (parseErr?.message && !jsonStr.startsWith('{')) {
                continue;
              }
              if (parseErr?.message && parseErr.message !== 'Unexpected end of JSON input') {
                throw parseErr;
              }
            }
          }
        }

        // If stream closed cleanly without emitting text, fall back to JSON endpoint
        if (!accumulatedText.trim()) {
          const fallbackData = await callJsonFallback();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: fallbackData.text,
                    sources: fallbackData.sources || [],
                  }
                : m
            )
          );
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const msg =
          err?.message ||
          'Connection error reaching Live AI. Leave a Support Ticket below or Call +254712727558 / WhatsApp 0785909543.';
        setErrorBanner(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  isError: true,
                  retryPrompt: text,
                  content: `Could not complete AI reply (${msg}). Tap Retry below or leave a Support Ticket for Gideon.`,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      input,
      isLoading,
      messages,
      useSearch,
      modelMode,
      selectedCountry,
      userStats.balance,
      userStats.completedTasksCount,
      user,
      customerProfile,
    ]
  );

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // Allow any button across the app (Navbar, Contact, etc.) to open live AI chat cleanly
  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ prompt?: string }>;
      setIsOpen(true);
      const initialPrompt = customEvent?.detail?.prompt;
      if (initialPrompt && initialPrompt.trim()) {
        setTimeout(() => {
          void handleSendRef.current(initialPrompt.trim());
        }, 120);
      }
    };

    window.addEventListener('gideon:open-ai-chat', handleOpenEvent);
    return () => {
      window.removeEventListener('gideon:open-ai-chat', handleOpenEvent);
    };
  }, []);

  const handleClearChat = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setErrorBanner(null);
    setMessages([
      {
        ...buildWelcomeMessage(),
        id: `welcome-msg-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);
    setTicketSubmittedId(null);

    if (ticketName.trim().length < 2) {
      setTicketError('Please enter your name.');
      return;
    }
    if (ticketContact.trim().length < 5) {
      setTicketError('Please enter your phone number or email.');
      return;
    }
    if (ticketMessage.trim().length < 8) {
      setTicketError('Please describe your issue clearly (at least 8 characters).');
      return;
    }

    setTicketSubmitting(true);
    try {
      const token = (await getFreshToken()) || activeToken;
      const recentChat = messages
        .filter((m) => m.id !== 'welcome-msg' && !m.isError)
        .slice(-4)
        .map((m) => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.content.slice(0, 220)}`)
        .join('\n');

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customerName: ticketName.trim(),
          contactInfo: ticketContact.trim(),
          countryCode: selectedCountry.code,
          category: ticketCategory,
          subject: `${ticketCategory} Issue`,
          message: ticketMessage.trim(),
          aiConversationSummary: recentChat || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setTicketError(data?.error || 'Could not submit support ticket.');
        return;
      }

      const id = data.ticket?.id || 'SAVED';
      setTicketSubmittedId(id);
      setTicketMessage('');
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ticket-${Date.now()}`,
          role: 'assistant',
          content: `Support Ticket ${id} has been logged for Gideon (${ticketCategory}). Gideon will review it in his Owner Console as soon as he is back. For urgent assistance, you can also Call +254712727558 or WhatsApp 0785909543.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setTimeout(() => {
        setTicketOpen(false);
        setTicketSubmittedId(null);
      }, 1500);
    } catch {
      setTicketError('Network error while saving your ticket. Please retry.');
    } finally {
      setTicketSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Live AI Chat launcher */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Live AI Support Chat"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-2xl border border-blue-400/40 transition-transform hover:scale-105 whitespace-nowrap cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold tracking-wide">24/7 Support AI</span>
        </button>
      )}

      {/* Live AI Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Live AI Support Chat"
          className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 w-[calc(100vw-1.5rem)] sm:w-[410px] h-[590px] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-blue-950 text-white flex items-center justify-between border-b border-blue-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold leading-tight truncate">
                  Gideon 24/7 AI Helpdesk
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-blue-200 mt-0.5 truncate">
                  <span>{modelMode === 'fast' ? 'Fast Mode' : 'Standard Support'}</span>
                  <span>·</span>
                  <span>{useSearch ? 'Web Search On' : 'Platform Knowledge'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setModelMode((m) => (m === 'hydrogen' ? 'fast' : 'hydrogen'))}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  modelMode === 'fast'
                    ? 'bg-emerald-600/80 text-white'
                    : 'bg-blue-900 text-blue-200 hover:text-white'
                }`}
                title="Switch between Gemini 4 Hydrogen (Standard) and Gemini 3.1 Flash Lite (Fast)"
              >
                <Zap className="w-3 h-3" />
                <span>{modelMode === 'fast' ? 'Fast' : 'Auto'}</span>
              </button>
              <button
                type="button"
                onClick={() => setUseSearch(!useSearch)}
                className={`p-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                  useSearch
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-300 hover:text-white hover:bg-blue-900'
                }`}
                title={useSearch ? 'Web Search Enabled' : 'Enable Web Search Grounding'}
                aria-label="Toggle Google Search Grounding"
              >
                <Globe className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-900 rounded-lg transition-colors cursor-pointer"
                title="Clear Conversation"
                aria-label="Clear Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-900 rounded-lg transition-colors cursor-pointer"
                title="Minimize Chat"
                aria-label="Close Live AI Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Optional Error Banner */}
          {errorBanner && (
            <div className="px-3.5 py-2 bg-rose-50 border-b border-rose-200 flex items-start justify-between gap-2 text-[11px] text-rose-800">
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug truncate">{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setTicketOpen(true)}
                className="text-[10px] font-bold text-rose-900 underline shrink-0 cursor-pointer"
              >
                Leave Ticket
              </button>
            </div>
          )}

          {/* Offline Ticket Escalation Panel OR Messages Stream */}
          {ticketOpen ? (
            <form
              onSubmit={handleSubmitTicket}
              className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    Leave an Issue Ticket for Gideon
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Saved directly in Gideon&apos;s Owner Inbox with your chat context.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTicketOpen(false)}
                  className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  Back to Chat
                </button>
              </div>

              {ticketSubmittedId && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ticket {ticketSubmittedId} submitted!</span>
                </div>
              )}

              {ticketError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
                  {ticketError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Your Name</label>
                <input
                  type="text"
                  value={ticketName}
                  onChange={(e) => setTicketName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Phone Number or Email
                </label>
                <input
                  type="text"
                  value={ticketContact}
                  onChange={(e) => setTicketContact(e.target.value)}
                  placeholder="+2547... or email@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Issue Type</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="PayPal Payout / KYC">PayPal Payout / National ID KYC</option>
                  <option value="Auction 50% Escrow Dispute">Auction 50% Escrow Dispute</option>
                  <option value="Daily 8 AM EAT Task Drop">Daily 8:00 AM EAT Task Drop</option>
                  <option value="Pay-Per-View 24h Status">Pay-Per-View 24h Status</option>
                  <option value="Account / Other">Account / Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Describe Your Issue (Include PayPal TXN ID if applicable)
                </label>
                <textarea
                  rows={4}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Explain what happened so Gideon can fix it right away..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={ticketSubmitting}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {ticketSubmitting ? 'Sending to Gideon...' : 'Submit Ticket to Gideon'}
              </button>
            </form>
          ) : (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50">
              {messages.map((msg) => {
                const showStreamingDots = isLoading && msg.role === 'assistant' && !msg.content;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[86%] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-700 text-white rounded-br-xs shadow-xs'
                          : msg.isError
                          ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-bl-xs'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-xs'
                      }`}
                    >
                      {showStreamingDots ? (
                        <div className="flex items-center gap-2 text-slate-500">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Preparing support reply...</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}

                      {msg.isError && msg.retryPrompt && (
                        <div className="mt-2 pt-2 border-t border-rose-200 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => void handleSend(msg.retryPrompt)}
                            className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Retry Question</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTicketOpen(true)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-900 text-[10px] font-bold cursor-pointer"
                          >
                            Leave Ticket
                          </button>
                        </div>
                      )}

                      {/* Grounding sources citation */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                          <div className="text-[10px] font-bold text-slate-400 tracking-wide">
                            Verified Sources
                          </div>
                          <div className="space-y-0.5">
                            {msg.sources.slice(0, 3).map((src, idx) => (
                              <a
                                key={idx}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] text-blue-700 hover:underline truncate"
                              >
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Quick Customer Questions */}
          {!ticketOpen && (
            <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleSend(prompt)}
                  className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          {!ticketOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about OTP, VIP +100 bonus, PPV, payouts, or tasks..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className="p-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Direct Human Escalation Bar */}
          <div className="px-3 py-2 bg-slate-900 text-slate-200 flex items-center justify-between gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => setTicketOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 whitespace-nowrap cursor-pointer"
            >
              <LifeBuoy className="w-3 h-3" />
              <span>{ticketOpen ? 'Back to AI Chat' : 'Leave Ticket for Gideon'}</span>
            </button>
            <div className="flex items-center gap-2 shrink-0 font-mono font-semibold">
              <a
                href="tel:+254712727558"
                className="inline-flex items-center gap-1 text-sky-300 hover:text-white hover:underline"
              >
                <Phone className="w-2.5 h-2.5" />
                <span>+254712727558</span>
              </a>
              <span className="text-slate-600">·</span>
              <a
                href="https://wa.me/254785909543"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:text-white hover:underline"
              >
                <MessageSquare className="w-2.5 h-2.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
