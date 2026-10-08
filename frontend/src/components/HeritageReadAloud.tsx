import { useEffect, useId, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import type { HeritageSite } from '../types';
import { heritageSpeechText } from '../utils/heritageSpeechText';

type Playback = 'ready' | 'reading' | 'paused' | 'finished';

function ReadAloudControls({ text }: { text: string }) {
  const [playback, setPlayback] = useState<Playback>('ready');
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  const speedId = useId();
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
    && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
  const synthesis = supported ? window.speechSynthesis : null;

  useEffect(() => () => {
    // Invalidate callbacks before cancelling: browsers may emit interrupted/error on cancel.
    current.current = null;
    try { synthesis?.cancel(); } catch { /* Cleanup must not break navigation. */ }
  }, [synthesis]);

  const fail = () => {
    current.current = null;
    try { synthesis?.cancel(); } catch { /* The local message is sufficient. */ }
    setPlayback('ready'); setError('Unable to read aloud right now. Please try again.');
  };
  const start = (rate = speed) => {
    if (!synthesis) return;
    setError(''); setNotice('');
    try {
      current.current = null;
      synthesis.cancel();
      if (synthesis.paused) synthesis.resume();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.onend = () => {
        if (current.current !== utterance) return;
        current.current = null; setPlayback('finished');
      };
      utterance.onerror = event => {
        if (current.current !== utterance) return;
        if (event.error === 'canceled' || event.error === 'interrupted') {
          current.current = null; setPlayback('ready');
        } else fail();
      };
      current.current = utterance;
      setPlayback('reading');
      synthesis.speak(utterance);
    } catch { fail(); }
  };
  const toggle = () => {
    if (!synthesis) return;
    try {
      if (playback === 'reading') { synthesis.pause(); setPlayback('paused'); }
      else if (playback === 'paused') { synthesis.resume(); setPlayback('reading'); }
      else start();
    } catch { fail(); }
  };
  const stop = () => {
    current.current = null;
    try { synthesis?.cancel(); setPlayback('ready'); setError(''); setNotice('Stopped.'); }
    catch { fail(); }
  };
  const changeSpeed = (rate: number) => {
    setSpeed(rate);
    if (playback === 'reading' || playback === 'paused') {
      start(rate);
      setNotice('Restarted from the beginning at the new speed.');
    }
  };
  return <section id="heritage-read-aloud" className="ui-card p-4 space-y-3" aria-label="Heritage read aloud">
    <h2 className="text-base font-semibold flex items-center gap-2"><Volume2 size={18} aria-hidden="true" />Listen to this heritage story</h2>
    {!supported ? <p role="status" className="ui-muted">Read aloud is not supported in this browser.</p> : <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="ui-button-primary inline-flex items-center gap-2" onClick={toggle}
          aria-label={playback === 'reading' ? 'Pause reading' : playback === 'paused' ? 'Resume reading' : 'Listen to heritage story'} aria-pressed={playback === 'reading'}>
          {playback === 'reading' ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playback === 'reading' ? 'Pause' : playback === 'paused' ? 'Resume' : 'Listen'}
        </button>
        <button type="button" className="ui-button-secondary inline-flex items-center gap-2" onClick={() => start()} aria-label="Restart reading from the beginning"><RotateCcw size={16} aria-hidden="true" />Restart</button>
        <button type="button" className="ui-button-secondary inline-flex items-center gap-2" onClick={stop} disabled={playback !== 'reading' && playback !== 'paused'} aria-label="Stop reading"><Square size={16} aria-hidden="true" />Stop</button>
        <label htmlFor={speedId} className="ui-label flex items-center gap-2">Speed
          <select id={speedId} className="ui-control bg-white" value={speed} onChange={event => changeSpeed(Number(event.target.value))}>
            {[0.75, 1, 1.25, 1.5].map(rate => <option key={rate} value={rate}>{rate}x</option>)}
          </select>
        </label>
      </div>
      <p role="status" aria-live="polite" className="ui-muted">{playback === 'reading' ? 'Reading heritage story' : playback === 'paused' ? 'Paused' : playback === 'finished' ? 'Finished' : 'Ready to listen'}{notice && ` · ${notice}`}</p>
      {error && <p role="alert" className="text-sm text-[#881337]">{error}</p>}
    </>}
  </section>;
}

export function HeritageReadAloud({ site }: { site: HeritageSite }) {
  const text = heritageSpeechText(site);
  if (!text) return null;
  // Remounting cancels narration and resets controls on site or content changes.
  return <ReadAloudControls key={`${site.id}:${text}`} text={text} />;
}
