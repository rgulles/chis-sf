import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp, Languages, Radio } from 'lucide-react';

interface Chapter {
  title: string;
  timeSeconds: number;
}

interface AudioStoryPlayerProps {
  title: string;
  narrator: string;
  duration: string;
  durationSeconds: number;
  transcript: string;
  kapampanganTranscript?: string;
  chapters?: Chapter[];
}

export const AudioStoryPlayer: React.FC<AudioStoryPlayerProps> = ({
  title,
  narrator,
  duration,
  durationSeconds,
  transcript,
  kapampanganTranscript,
  chapters = [
    { title: 'Origins & Architecture', timeSeconds: 0 },
    { title: 'Revolutionary Climax', timeSeconds: Math.floor(durationSeconds * 0.4) },
    { title: 'Living Heritage & Heirlooms', timeSeconds: Math.floor(durationSeconds * 0.75) }
  ]
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'pam'>('en');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const activeTranscript = (selectedLanguage === 'pam' && kapampanganTranscript) 
    ? kapampanganTranscript 
    : transcript;

  // Sync simulated progress and browser speech synthesis
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= durationSeconds) {
            setIsPlaying(false);
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            return 0;
          }
          return prev + 1 * playbackSpeed;
        });
      }, 1000);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isPlaying, durationSeconds, playbackSpeed]);

  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(activeTranscript);
        utterance.rate = playbackSpeed;
        utterance.pitch = 1.0;
        utterance.onend = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      setIsPlaying(false);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleSpeedChange = () => {
    const speeds = [0.75, 1, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setPlaybackSpeed(newSpeed);

    if (isPlaying && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(activeTranscript);
      utterance.rate = newSpeed;
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleLanguageSwitch = (lang: 'en' | 'pam') => {
    setSelectedLanguage(lang);
    if (isPlaying && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const newText = (lang === 'pam' && kapampanganTranscript) ? kapampanganTranscript : transcript;
      const utterance = new SpeechSynthesisUtterance(newText);
      utterance.rate = playbackSpeed;
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = Math.floor(ratio * durationSeconds);
    setCurrentTime(newTime);
  };

  const jumpToChapter = (timeSec: number) => {
    setCurrentTime(timeSec);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = Math.min(100, (currentTime / durationSeconds) * 100);

  return (
    <div id="audio-story-card" className="rounded-lg bg-white border border-[#e7e0d6] p-5 sm:p-6 space-y-4">
      {/* Top Meta Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e7e0d6]">
        <div>
          <span className="label-prominent text-[#D49B24] flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-[#D49B24] animate-pulse" />
            Voices of Pampanga • Archival Audio Memoir
          </span>
          <h4 id="audio-story-title" className="font-serif text-lg font-bold text-[#1e1b19] mt-1">
            {title}
          </h4>
          <p className="body-sm text-[#574141] mt-0.5">
            Oral testimony narrated by <span className="font-medium text-[#1e1b19]">{narrator}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* Bilingual Language Selector */}
          <div className="flex items-center rounded border border-[#e7e0d6] bg-[#faf2ee] p-0.5 text-xs">
            <button
              onClick={() => handleLanguageSwitch('en')}
              className={`px-2 py-1 rounded transition-colors ${
                selectedLanguage === 'en'
                  ? 'bg-[#7e1925] text-white font-semibold shadow-xs'
                  : 'text-[#574141] hover:text-[#1e1b19]'
              }`}
            >
              English
            </button>
            <button
              onClick={() => handleLanguageSwitch('pam')}
              className={`px-2 py-1 rounded transition-colors ${
                selectedLanguage === 'pam'
                  ? 'bg-[#7e1925] text-white font-semibold shadow-xs'
                  : 'text-[#574141] hover:text-[#1e1b19]'
              }`}
              title="Kapampangan (Amanung Sisuan)"
            >
              Kapampangan
            </button>
          </div>

          {/* Speed Toggle */}
          <button
            id="audio-speed-toggle"
            onClick={handleSpeedChange}
            className="rounded border border-[#e7e0d6] bg-[#faf2ee] px-2.5 py-1 text-xs font-semibold text-[#7e1925] hover:border-[#7e1925] transition-colors"
            title="Change playback speed"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>

      {/* Chapters Scrubbing Pills */}
      {chapters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7171] mr-1">
            Chapters:
          </span>
          {chapters.map((chap, idx) => {
            const isActive = currentTime >= chap.timeSeconds && 
              (idx === chapters.length - 1 || currentTime < chapters[idx + 1].timeSeconds);
            return (
              <button
                key={idx}
                onClick={() => jumpToChapter(chap.timeSeconds)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                  isActive
                    ? 'bg-[#D49B24] text-[#231416] border-[#D49B24] font-semibold'
                    : 'bg-[#faf2ee] text-[#574141] border-[#e7e0d6] hover:border-[#D49B24]'
                }`}
              >
                {chap.title} ({formatTime(chap.timeSeconds)})
              </button>
            );
          })}
        </div>
      )}

      {/* Animated Waveform Visualizer */}
      <div 
        onClick={handleSeek}
        className="cursor-pointer py-1 px-2 rounded bg-[#faf2ee] border border-[#e7e0d6] flex items-center justify-between gap-1 h-12 hover:border-[#D49B24] transition-colors"
        title="Click anywhere to scrub audio"
      >
        {[35, 65, 25, 95, 55, 100, 40, 85, 50, 90, 30, 75, 80, 45, 60, 95, 30, 85, 45, 70, 40, 80, 60, 100, 50, 90, 35, 70, 85, 40, 60, 90, 40].map((h, i) => {
          const barRatio = i / 33;
          const isPast = (currentTime / durationSeconds) >= barRatio;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-200"
              style={{
                height: isPlaying ? `${Math.max(18, (h * (0.35 + 0.65 * Math.sin((currentTime * 4) + i))))}%` : `${Math.max(18, h * 0.5)}%`,
                backgroundColor: isPast 
                  ? (isPlaying ? '#D49B24' : '#7e1925') 
                  : '#ddbfbf'
              }}
            />
          );
        })}
      </div>

      {/* Progress Slider & Timestamps */}
      <div className="space-y-1.5">
        <div 
          onClick={handleSeek}
          className="relative h-1.5 w-full rounded cursor-pointer bg-[#e7e0d6] overflow-hidden"
        >
          <div
            className="absolute left-0 top-0 h-full bg-[#7e1925] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-0 h-full w-2 bg-[#D49B24] -ml-1 transition-all duration-200"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between label-compact text-[#574141]">
          <span>{formatTime(currentTime)}</span>
          <span>{duration}</span>
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="flex items-center justify-between pt-1">
        <button
          id="audio-reset-btn"
          onClick={handleReset}
          className="flex items-center gap-1.5 p-2 rounded text-[#574141] hover:text-[#7e1925] hover:bg-[#faf2ee] transition-colors"
          title="Restart audio"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="label-compact hidden sm:inline">Reset</span>
        </button>

        {/* 48px Circular Play/Pause in Heritage Red #7e1925 */}
        <button
          id="audio-play-pause-btn"
          onClick={togglePlay}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7e1925] text-white hover:bg-[#580b14] shadow-sm transition-all hover:scale-105"
          title={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-white" />
          ) : (
            <Play className="w-5 h-5 fill-white translate-x-0.5" />
          )}
        </button>

        <button
          id="toggle-transcript-btn"
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#e7e0d6] bg-[#faf2ee] label-compact text-[#7e1925] hover:border-[#7e1925] transition-colors"
        >
          <Languages className="w-3.5 h-3.5 text-[#D49B24]" />
          <span>{selectedLanguage === 'pam' ? 'Kapampangan Text' : 'Transcript'}</span>
          {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Bilingual Transcript */}
      {showTranscript && (
        <div id="audio-transcript-panel" className="mt-4 rounded-lg bg-[#faf2ee] p-4 border border-[#e7e0d6] space-y-2">
          <div className="flex items-center justify-between">
            <span className="label-compact text-[#7e1925] font-bold">
              {selectedLanguage === 'pam' ? 'Amanung Sisuan (Kapampangan) Transcript' : 'Archival English Transcript'}
            </span>
            <span className="text-[10px] text-[#8a7171] uppercase tracking-wider">
              Recorded Oral History
            </span>
          </div>
          <p className="body-md text-[#1e1b19] italic leading-relaxed">
            “{activeTranscript}”
          </p>
        </div>
      )}
    </div>
  );
};
