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
  return <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button id="passport-close" aria-label="Close Heritage Passport" onClick={onClose} className="absolute top-4 right-4 z-[110] min-h-12 min-w-12 flex items-center justify-center text-white/70 hover:text-white bg-black/20 hover:bg-black/50 rounded-full transition-colors backdrop-blur-sm"><X aria-hidden="true" size={28} /></button>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="passport-title" tabIndex={-1} className="relative w-full h-full sm:h-auto sm:max-h-[95dvh] max-w-5xl flex flex-col items-center justify-center">
      <div className="w-full h-full flex flex-col items-center justify-center">{children}</div>
    </div>
  </div>;
}
