import { useEffect, useRef } from 'react';

export type ErrorKind = 'network' | 'server' | 'load' | 'authentication' | 'permission' | 'not-found' | 'validation';
const messages: Record<ErrorKind, string> = {
  network: 'Unable to connect to CHIS. Check your internet connection and try again.',
  server: 'CHIS is temporarily unavailable. Please try again later.',
  load: "We couldn't load this part of CHIS.",
  authentication: 'Your session has expired. Please sign in again to continue.',
  permission: 'You do not have permission to perform this action.',
  'not-found': 'This page or record could not be found.',
  validation: 'Please check the information you entered and try again.',
};

export function ErrorState({ kind = 'load', message, title = 'Something went wrong', onRetry, onHome, retryLabel = 'Try Again' }: {
  kind?: ErrorKind; message?: string; title?: string; onRetry?: () => void; onHome?: () => void; retryLabel?: string;
}) {
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => { region.current?.focus(); }, [message, kind]);
  return <div ref={region} role="alert" tabIndex={-1} className="status-error p-6 space-y-3">
    <h2 className="section-title">{title}</h2><p>{message || messages[kind]}</p>
    <div className="flex flex-wrap gap-3">
      {onRetry && <button className="ui-button-secondary" onClick={onRetry}>{retryLabel}</button>}
      {onHome && <button className="ui-button-primary" onClick={onHome}>Return Home</button>}
    </div>
  </div>;
}
