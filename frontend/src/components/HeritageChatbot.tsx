import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star,
  Sparkles,
  Bot,
  Send,
  ChevronDown,
  RotateCcw,
  Compass,
  ArrowRight,
  MapPin
} from 'lucide-react';
import type { HeritageSite } from '../types';
import { type ChatMessage, INITIAL_CHATBOT_MESSAGES, getLocalHeritageResponse } from '../data/heritageChatEngine';

interface HeritageChatbotProps {
  sites: HeritageSite[];
  onSelectSite: (site: HeritageSite) => void;
  onPlanRoute?: () => void;
}

export const HeritageChatbot: React.FC<HeritageChatbotProps> = ({
  sites,
  onSelectSite,
  onPlanRoute
}) => {
  // Starts in collapse mode as requested
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('sf_heritage_chat_live_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* Browser storage may be unavailable. */ }
    return INITIAL_CHATBOT_MESSAGES;
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('sf_heritage_chat_live_v1', JSON.stringify(messages));
    } catch { /* Browser storage may be unavailable. */ }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const local = getLocalHeritageResponse(messageText, sites);
      const replyText = local.text;
      const matchedSiteId = local.matchedSiteId;

      const botMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        matchedSiteId
      };

      setMessages(prev => [...prev, botMessage]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Heritage information is unavailable. Please browse the current catalogue or try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages(INITIAL_CHATBOT_MESSAGES);
    try {
      sessionStorage.removeItem('sf_heritage_chat_live_v1');
    } catch { /* Browser storage may be unavailable. */ }
  };

  // Helper to render simple markdown formatting (bolding, lists, paragraphs)
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // Process bold (**text**)
          const parts = line.split(/(\*\*.*?\*\*)/g);
          const formattedLine = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-bold text-[#1e1b19]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx} className="italic text-[#7e1925]">{part.slice(1, -1)}</em>;
            }
            return part;
          });

          if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-[#7e1925] font-bold mt-0.5">•</span>
                <span>{formattedLine}</span>
              </div>
            );
          }

          if (/^\d+\.\s/.test(line.trim())) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-[#7e1925] font-bold text-xs mt-0.5">{line.trim().split('.')[0]}.</span>
                <span>{formattedLine}</span>
              </div>
            );
          }

          return <p key={idx}>{formattedLine}</p>;
        })}
      </div>
    );
  };

  return (
    <>
      {/* ===================================================================== */}
      {/* 1. COLLAPSED TRIGGER BUTTON (Located at Lower Right Part - Logo Only)  */}
      {/* ===================================================================== */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 select-none">
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
            >
              <button
                id="heritage-chatbot-trigger-btn"
                onClick={() => setIsOpen(true)}
                className="group relative flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7e1925] via-[#6d131e] to-[#4e0910] text-white shadow-[0_10px_28px_-4px_rgba(126,25,37,0.5)] border-2 border-[#ffd580]/70 hover:border-[#ffd580] transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                title="Ask Katulung (Heritage Guide)"
                aria-label="Ask Katulung (Heritage Guide)"
              >
                {/* Subtle Pulse ring */}
                <span className="absolute -inset-1 rounded-full bg-[#ffd580] opacity-25 animate-ping pointer-events-none" />

                {/* Lantern Star + Chatbot Emblem */}
                <div className="relative flex items-center justify-center w-8 h-8">
                  {/* San Fernando Giant Lantern Star Silhouette */}
                  <Star
                    className="w-8 h-8 text-[#ffd580] fill-[#ffd580]/40 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-12 drop-shadow-[0_0_8px_rgba(255,213,128,0.5)]"
                    strokeWidth={1.8}
                  />

                  {/* Chatbot face embedded within the heart of the lantern */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Bot
                      className="w-4 h-4 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                      strokeWidth={2.4}
                    />
                  </div>

                  {/* Lantern Light Ray Sparkle */}
                  <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-white animate-pulse" />
                </div>

                {/* Unread indicator dot */}
                {hasUnread && (
                  <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-[#f5b82a] border-2 border-[#7e1925] shadow-xs" />
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===================================================================== */}
      {/* 2. EXPANDED CHATBOT WINDOW (Anchored at Lower Right)                 */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="heritage-chatbot-window"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[390px] md:w-[410px] h-[520px] max-h-[82vh] flex flex-col rounded-2xl border border-[#e8dfd5] bg-white shadow-2xl overflow-hidden font-outfit"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#7e1925] to-[#580b14] p-3.5 text-white shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-[#ffd580] shadow-xs">
                  <Star className="w-5 h-5 text-[#ffd580] fill-[#ffd580]/30" strokeWidth={1.8} />
                  <Bot className="absolute w-3 h-3 text-white" strokeWidth={2.4} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold tracking-tight text-white">Katulung Heritage Guide</h3>
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-[11px] text-white/75 font-medium">City of San Fernando, Pampanga</p>
                </div>
              </div>

              {/* Action Buttons: Reset & Collapse */}
              <div className="flex items-center gap-1">
                <button
                  id="reset-chat-btn"
                  onClick={handleResetChat}
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
                  title="Reset conversation"
                  aria-label="Reset conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  id="collapse-chatbot-btn"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                  title="Collapse chat"
                  aria-label="Collapse chat"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Context Banner */}
            <div className="bg-[#faf2ee] px-3.5 py-1.5 border-b border-[#e8dfd5] flex items-center justify-between text-[11px] font-medium text-[#574141]">
              <span className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-[#7e1925]" />
                San Fernando Heritage & Culture
              </span>
              <span className="text-[#8a7171]">English • Tagalog • Kapampangan</span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fcfaf7]">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const matchedSite = msg.matchedSiteId ? sites.find(s => s.id === msg.matchedSiteId) : null;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                        isUser
                          ? 'bg-[#7e1925] text-white rounded-br-xs'
                          : 'bg-white border border-[#e8dfd5] text-[#3d2e2e] rounded-bl-xs'
                      }`}
                    >
                      {isUser ? (
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        renderFormattedText(msg.content)
                      )}

                      {/* Interactive Matched Landmark Button */}
                      {!isUser && matchedSite && (
                        <div className="mt-3 pt-2.5 border-t border-[#e8dfd5] flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7e1925]">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{matchedSite.name}</span>
                          </div>
                          <button
                            id={`chat-explore-site-${matchedSite.id}`}
                            onClick={() => {
                              onSelectSite(matchedSite);
                              setIsOpen(false);
                            }}
                            className="inline-flex items-center justify-between w-full rounded-xl bg-[#faf2ee] hover:bg-[#7e1925] text-[#7e1925] hover:text-white border border-[#e8dfd5] px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs group"
                          >
                            <span>Explore Landmark Details</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-[#8a7171] px-1">
                      {msg.timestamp}
                    </span>

                    {/* Suggested Prompt Chips */}
                    {!isUser && msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 max-w-[95%]">
                        {msg.suggestedPrompts.map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(prompt)}
                            className="rounded-full bg-white hover:bg-[#faf2ee] border border-[#e8dfd5] hover:border-[#7e1925] text-[#7e1925] px-2.5 py-1 text-[11px] font-semibold transition-all shadow-xs text-left cursor-pointer"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Typing / Loading Indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-2xl bg-white border border-[#e8dfd5] p-3 text-xs text-[#574141] max-w-[70%] shadow-xs"
                >
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7e1925] animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7e1925] animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7e1925] animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[11px] font-medium text-[#8a7171]">Reading saved heritage information...</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 bg-white border-t border-[#e8dfd5]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  id="heritage-chat-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about a heritage site..."
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-[#e8dfd5] bg-[#fcfaf7] px-3.5 py-2 text-xs text-[#1e1b19] placeholder-[#8a7171] focus:border-[#7e1925] focus:bg-white focus:outline-none transition-colors"
                />

                <button
                  id="heritage-chat-send-btn"
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7e1925] text-white hover:bg-[#580b14] disabled:opacity-40 transition-all cursor-pointer flex-shrink-0 shadow-xs"
                  title="Send question"
                  aria-label="Send question"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#8a7171] px-1">
                <span>Current heritage catalogue</span>
                {onPlanRoute && (
                  <button
                    onClick={() => {
                      onPlanRoute();
                      setIsOpen(false);
                    }}
                    className="text-[#7e1925] hover:underline font-semibold cursor-pointer"
                  >
                    View Saved Plan ➔
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
