import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function PassportModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const position = { x: window.scrollX, y: window.scrollY, hash: window.location.hash };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      document.getElementById('header-profile-btn')?.focus({ preventScroll: true });
      // Restore after the background's scrollbar/layout settles; deliberate site navigation keeps its own position.
      requestAnimationFrame(() => { if (window.location.hash === position.hash) window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' }); });
    };
  }, []);
  return <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-2 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="passport-title" tabIndex={-1} className="passport-shell relative w-full max-w-[680px] max-h-[90dvh] flex flex-col border border-[#927440] bg-[#1e1b19] text-[#fffdf9] shadow-xl">
      <div className="shrink-0 flex justify-end px-3 pt-2"><button id="passport-close" aria-label="Close Heritage Passport" onClick={onClose} className="min-h-11 min-w-11 flex items-center justify-center text-[#e8cf9f] hover:bg-white/10"><X aria-hidden="true" size={22} /></button></div>
      <div className="overflow-y-auto overscroll-contain min-h-0">{children}</div>
    </div>
  </div>;
}
