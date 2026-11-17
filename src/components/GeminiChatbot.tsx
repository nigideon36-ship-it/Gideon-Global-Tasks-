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
  Sparkles,
} from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromKes, formatCurrencyFromUsd, WITHDRAWAL_THRESHOLD_USD } from '../lib/eastAfrica';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; uri: string }[];
  timestamp: string;
  isError?: boolean;
}

export const GeminiChatbot: React.FC = () => {
  const { userStats, activePackage } = useTasks();
  const { selectedCountry } = useRegion();

  const buildWelcomeMessage = React.useCallback((): ChatMessage => {
    const passList = `${formatCurrencyFromKes(50, selectedCountry)} / ${formatCurrencyFromKes(100, selectedCountry)} / ${formatCurrencyFromKes(200, selectedCountry)}`;
    const minWithdraw = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
    return {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hello! I'm the Gideon Global Tasks Live AI Assistant. Ask me anything directly about SMS OTP registration, Worker Passes (${passList}), ${minWithdraw} withdrawals, referrals, or task instructions!`,
      timestamp: 'Just now',
    };
  }, [selectedCountry]);

  const quickPrompts = React.useMemo(
    () => [
      'How do I register & verify SMS OTP?',
      `When can I withdraw (${formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} minimum)?`,
      `How do Worker Passes (${formatCurrencyFromKes(50, selectedCountry)}, ${formatCurrencyFromKes(100, selectedCountry)}, ${formatCurrencyFromKes(200, selectedCountry)}) work?`,
      'How do I complete tasks & earn faster?',
    ],
    [selectedCountry]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [useSearch, setUseSearch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? input).trim();
      if (!text || isLoading) return;

      setErrorBanner(null);
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
        country: selectedCountry.name,
        balance: userStats.balance,
        pass: activePackage?.name || 'None',
        tasksCompleted: userStats.completedTasksCount,
      };

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: historySnapshot
              .filter((m) => !m.isError)
              .map((m) => ({ role: m.role, content: m.content })),
            useSearch,
            customerContext,
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('text/event-stream') || !response.body) {
          let errMessage = 'Unable to reach Live AI right now.';
          try {
            const errData = await response.json();
            if (errData?.error) errMessage = errData.error;
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(errMessage);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulatedText = '';
        let accumulatedSources: { title: string; uri: string }[] = [];

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
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const msg =
          err?.message ||
          'Connection error reaching Live AI. Call +254712727558 or WhatsApp 0785909543 for immediate help.';
        setErrorBanner(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  isError: true,
                  content:
                    'I could not complete that AI reply right now. You can retry your question below, or contact human support directly via Call (+254712727558) or WhatsApp (0785909543).',
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [input, isLoading, messages, useSearch, selectedCountry.name, userStats.balance, userStats.completedTasksCount, activePackage?.name]
  );

  // Allow any button across the app (Navbar, Contact, etc.) to open live AI chat
  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ prompt?: string }>;
      setIsOpen(true);
      const initialPrompt = customEvent?.detail?.prompt;
      if (initialPrompt && initialPrompt.trim()) {
        setTimeout(() => {
          handleSend(initialPrompt.trim());
        }, 120);
      }
    };

    window.addEventListener('gideon:open-ai-chat', handleOpenEvent);
    return () => {
      window.removeEventListener('gideon:open-ai-chat', handleOpenEvent);
    };
  }, [handleSend]);

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

  return (
    <>
      {/* Floating Live AI Chat launcher */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Live AI Support Chat"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-2xl border border-blue-400/40 transition-all hover:scale-105 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold tracking-wide">Live AI Chat · Ask AI</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Live AI Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Live AI Support Chat"
          className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 w-[calc(100vw-1.5rem)] sm:w-[400px] h-[560px] max-h-[86vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-blue-950 text-white flex items-center justify-between border-b border-blue-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold leading-tight flex items-center gap-1.5 truncate">
                  <span>Live AI Support Chat</span>
                  <Sparkles className="w-3 h-3 text-sky-300 shrink-0" />
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-blue-200 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>24/7 Instant Answers</span>
                  <span>·</span>
                  <span>{useSearch ? 'Web Search On' : 'Platform Mode'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setUseSearch(!useSearch)}
                className={`p-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                  useSearch
                    ? 'bg-blue-600/50 text-sky-200'
                    : 'text-blue-300 hover:text-white hover:bg-blue-900'
                }`}
                title={useSearch ? 'Google Search Grounding Enabled' : 'Enable Google Search Grounding'}
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
            <div className="px-3.5 py-2 bg-rose-50 border-b border-rose-200 flex items-start gap-2 text-[11px] text-rose-800">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorBanner}</span>
            </div>
          )}

          {/* Messages Stream */}
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
                        <span>AI is typing...</span>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}

                    {/* Grounding sources citation */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Verified Sources:
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

          {/* Quick Customer Questions */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLoading}
                onClick={() => handleSend(prompt)}
                className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about registration, OTP, payouts, passes, or tasks..."
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

          {/* Direct Human Escalation Bar */}
          <div className="px-3 py-2 bg-slate-900 text-slate-200 flex items-center justify-between gap-2 text-[10px]">
            <span className="text-slate-400 truncate">Need human support?</span>
            <div className="flex items-center gap-2.5 shrink-0 font-mono font-semibold">
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
                <span>WhatsApp 0785909543</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
