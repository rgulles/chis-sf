import { useEffect, useRef, useState } from 'react';
import { Star, Send, X, RotateCcw } from 'lucide-react';
import type { HeritageSite } from '../types';
import { type ChatMessage, INITIAL_CHATBOT_MESSAGES, getLocalHeritageResponse } from '../data/heritageChatEngine';
import { apiFetchSiteById } from '../api/client';
interface HeritageChatbotProps {
  sites: HeritageSite[]; onSelectSite: (site: HeritageSite) => void;
  onPlanRoute?: () => void; onOpenDirections?: (site: HeritageSite) => void;
  currentSite?: HeritageSite | null;
}
export function HeritageChatbot({ sites, onSelectSite, onPlanRoute, onOpenDirections, currentSite }: HeritageChatbotProps) {
  const [isOpen, setIsOpen] = useState(false), [input, setInput] = useState(''), [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHATBOT_MESSAGES);
  const inputRef = useRef<HTMLInputElement>(null), panel = useRef<HTMLDivElement>(null), messagesEndRef = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    const viewport = window.visualViewport;
    const resize = () => {
      if (!panel.current?.style) return;
      if (window.innerWidth < 640 && viewport) {
        panel.current.style.height = `${Math.floor(viewport.height * 0.96)}px`;
        panel.current.style.maxHeight = `${Math.floor(viewport.height * 0.96)}px`;
        panel.current.style.bottom = `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`;
      } else { panel.current.style.height = ''; panel.current.style.maxHeight = ''; panel.current.style.bottom = ''; }
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize); window.addEventListener?.('resize', resize);
    return () => { clearTimeout(timer); viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener?.('resize', resize); };
  }, [isOpen]);
  useEffect(() => { if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }); }, [messages, isLoading, isOpen]);
  const send = async (text?: string) => {
    const question = (text || input).trim(); if (!question || isLoading) return;
    const generation = ++request.current;
    setMessages(previous => [...previous, { id: `user-${generation}`, role: 'user', content: question, timestamp: '' }]); setInput(''); setIsLoading(true);
    try {
      const catalogue = currentSite ? sites.map(site => site.id === currentSite.id ? currentSite : site) : sites;
      let response = getLocalHeritageResponse(question, catalogue, currentSite?.id);
      if (response.matchedSiteId && catalogue.find(site => site.id === response.matchedSiteId)?.isSummary) {
        const detail = await apiFetchSiteById(response.matchedSiteId);
        if (!detail) throw new Error('Site unavailable');
        response = getLocalHeritageResponse(question, catalogue.map(site => site.id === detail.id ? detail : site), currentSite?.id);
      }
      if (request.current === generation) setMessages(previous => [...previous, { id: `assistant-${generation}`, role: 'assistant', timestamp: '', content: response.text, matchedSiteId: response.matchedSiteId, choiceSiteIds: response.choiceSiteIds }]);
    } catch {
      if (request.current === generation) setMessages(previous => [...previous, { id: `assistant-${generation}`, role: 'assistant', timestamp: '', content: 'Heritage information is unavailable. Please try again.' }]);
    } finally { if (request.current === generation) setIsLoading(false); }
  };
  return <>
    {!isOpen && <button id="heritage-chatbot-trigger-btn" onClick={() => setIsOpen(true)} aria-label="Ask Katulung (Heritage Guide)" title="Ask Katulung (Heritage Guide)" className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#7e1925] border-2 border-[#ffd580] text-[#ffd580] shadow-xl"><Star className="h-8 w-8" /></button>}
    {isOpen && <div ref={panel} id="heritage-chatbot-window" role="dialog" aria-label="Katulung San Fernando Heritage Guide" className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[410px] h-[560px] max-h-[82dvh] flex flex-col rounded-2xl border border-[#e8dfd5] bg-white shadow-2xl overflow-hidden" onKeyDown={event => { if (event.key === 'Escape') setIsOpen(false); }}>
      <header className="flex shrink-0 items-center justify-between gap-2 bg-[#7e1925] p-3 text-white">
        <div className="flex items-center gap-2 min-w-0"><Star className="shrink-0 text-[#ffd580]" /><div><h3 className="text-sm font-bold">KATULUNG</h3><p className="text-xs">San Fernando Heritage Guide</p></div></div>
        <div className="flex shrink-0"><button id="reset-chat-btn" aria-label="Reset conversation" className="h-11 w-11 flex items-center justify-center" onClick={() => { request.current++; setMessages(INITIAL_CHATBOT_MESSAGES); setIsLoading(false); }}><RotateCcw size={17} /></button><button id="collapse-chatbot-btn" aria-label="Close guide" className="h-11 w-11 flex items-center justify-center" onClick={() => setIsOpen(false)}><X size={20} /></button></div>
      </header>
      <p className="shrink-0 bg-[#faf2ee] px-4 py-2 text-xs text-[#574141]">Answers from the current heritage catalogue</p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 bg-[#fcfaf7]" aria-live="polite">
        {messages.map(message => {
          const matched = sites.find(site => site.id === message.matchedSiteId && site.status !== 'archived');
          return <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[95%] min-w-0 rounded-xl p-3 text-sm ${message.role === 'user' ? 'bg-[#7e1925] text-white' : 'bg-white text-[#3d2e2e] border border-[#e8dfd5]'}`}>
            <p className="whitespace-pre-line">{message.content}</p>
            {matched && <div className="mt-3 flex flex-wrap gap-2"><button id={`chat-explore-site-${matched.id}`} className="ui-button-secondary" onClick={() => { onSelectSite(matched); setIsOpen(false); }}>View Heritage Site</button>{onOpenDirections && <button className="ui-button-secondary" onClick={() => { onOpenDirections(matched); setIsOpen(false); }}>Directions</button>}</div>}
            {message.choiceSiteIds?.map(id => { const choice = sites.find(site => site.id === id && site.status !== 'archived'); return choice ? <button key={id} className="block text-left underline text-[#7e1925] mt-2" onClick={() => { onSelectSite(choice); setIsOpen(false); }}>{choice.name}</button> : null; })}
            {message.suggestedPrompts?.map(prompt => <button key={prompt} className="block text-left text-[#7e1925] underline mt-2" onClick={() => send(prompt)}>{prompt}</button>)}
          </div></div>;
        })}
        {isLoading && <p role="status" className="text-sm">Checking the heritage record…</p>}
        <div ref={messagesEndRef} />
      </div>
      <div className="shrink-0 border-t border-[#e8dfd5] p-3 bg-white">
        {onPlanRoute && <button className="text-xs text-[#7e1925] mb-2 underline" onClick={() => { onPlanRoute(); setIsOpen(false); }}>Plan Your Visit</button>}
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void send(); }}><input id="heritage-chat-input" ref={inputRef} aria-label="Ask about a heritage site" value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about a heritage site…" className="min-w-0 flex-1 rounded-lg border border-[#e8dfd5] p-3 text-base" /><button aria-label="Send question" disabled={isLoading || !input.trim()} className="shrink-0 rounded-lg bg-[#7e1925] text-white px-3 disabled:opacity-50"><Send size={18} /></button></form>
      </div>
    </div>}
  </>;
}
