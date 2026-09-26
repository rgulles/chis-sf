import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Award, Volume2, Clock, Sparkles, Image, Check, ChevronRight, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { HeritageSite } from '../types';
import { ThenNowSlider } from '../components/ThenNowSlider';
import { AudioStoryPlayer } from '../components/AudioStoryPlayer';

interface QRScanExperienceViewProps {
  site: HeritageSite;
  onBack: () => void;
  onStampCollected: (siteId: string) => void;
  isStampUnlocked: boolean;
}

export const QRScanExperienceView: React.FC<QRScanExperienceViewProps> = ({
  site,
  onBack,
  onStampCollected,
  isStampUnlocked
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stampEarnedJustNow, setStampEarnedJustNow] = useState<boolean>(false);

  const totalSteps = 5;

  const handleClaimStamp = () => {
    if (!isStampUnlocked) {
      onStampCollected(site.id);
      setStampEarnedJustNow(true);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  };

  const stepsList = [
    { id: 1, name: 'Listen to Story', icon: Volume2 },
    { id: 2, name: 'Explore Timeline', icon: Clock },
    { id: 3, name: 'Then & Now', icon: Sparkles },
    { id: 4, name: 'Historical Facts', icon: CheckCircle2 },
    { id: 5, name: 'Photo Gallery', icon: Image },
  ];

  return (
    <div id="qr-experience-page" className="max-w-2xl mx-auto px-4 py-4 space-y-6 pb-28">
      {/* Top Mobile Bar with Back and GPS Verified Tag */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-[#E8DFD5] bg-white px-3 py-1.5 text-xs font-bold text-[#23201F]"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#7A1C30]" />
          <span>Exit On-Site Mode</span>
        </button>

        <div className="flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[11px] font-bold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>On-Site GPS Verified</span>
        </div>
      </div>

      {/* HEADER SECTION: "You’re here. Let’s discover its story." */}
      <div className="rounded-3xl border-2 border-[#7A1C30] bg-[#FAF8F5] p-5 shadow-sm space-y-3 text-center sm:text-left">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A1C30] flex items-center justify-center sm:justify-start gap-1">
          <MapPin className="w-3.5 h-3.5 text-[#C28E38]" />
          Physical Plaque Scanned: {site.qrCodeId}
        </span>
        <h1 id="qr-welcome-title" className="text-2xl sm:text-3xl font-bold font-serif text-[#23201F] leading-tight">
          You’re here. Let’s discover its story.
        </h1>
        <p className="text-xs text-[#6B645F] leading-relaxed">
          Welcome to <strong>{site.name}</strong>. You are standing right where history was forged. Explore each experiential station below to complete your visit.
        </p>

        {/* Current Site Quick Card */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-[#E8DFD5] text-left">
          <img
            src={site.heroImage}
            alt={site.name}
            className="h-14 w-14 rounded-xl object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/sites/cathedral-hero.jpg';
            }}
          />
          <div>
            <h4 className="text-sm font-bold text-[#23201F]">{site.name}</h4>
            <p className="text-xs text-[#6B645F]">{site.barangay} • Circa {site.yearBuilt}</p>
          </div>
        </div>
      </div>

      {/* PROGRESS TRACKER: "You are exploring: 1 of 5 experiences" */}
      <div className="rounded-2xl border border-[#E8DFD5] bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#23201F]">
            You are exploring: <span className="text-[#7A1C30] font-bold">{currentStep} of {totalSteps} experiences</span>
          </span>
          <span className="text-[11px] font-mono text-[#6B645F]">
            {Math.round((currentStep / totalSteps) * 100)}% Complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 w-full rounded-full bg-[#FAF8F5] border border-[#E8DFD5] overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#7A1C30] to-[#DDA84E] transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Experience Step Buttons */}
        <div className="grid grid-cols-5 gap-1 pt-1">
          {stepsList.map((step) => {
            const isDone = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl text-center transition-all ${
                  isCurrent
                    ? 'bg-[#7A1C30] text-white shadow-sm'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-[#FAF8F5] text-[#6B645F] border border-[#E8DFD5]'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[9px] font-semibold truncate w-full">
                  {step.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE STEP CONTENT */}

      {/* STEP 1: LISTEN TO THE STORY */}
      {currentStep === 1 && (
        <div className="space-y-4 rounded-3xl border border-[#E8DFD5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-3">
            <h3 className="text-base font-bold font-serif text-[#23201F] flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-[#7A1C30]" />
              Experience 1: Listen to the On-Site Story
            </h3>
            <span className="text-[10px] font-bold text-[#7A1C30] bg-[#7A1C30]/10 px-2 py-0.5 rounded-full">
              Audio Guide
            </span>
          </div>

          <p className="text-xs text-[#6B645F] leading-relaxed">
            Put in your earphones and look up at the architecture. Our historian explains the hidden details right before your eyes.
          </p>

          <AudioStoryPlayer
            title={site.audioStory.title}
            narrator={site.audioStory.narrator}
            duration={site.audioStory.duration}
            durationSeconds={site.audioStory.durationSeconds}
            transcript={site.audioStory.transcript}
          />

          <button
            onClick={() => setCurrentStep(2)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#7A1C30] py-3 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#581020]"
          >
            <span>Next: Explore Timeline</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 2: EXPLORE TIMELINE */}
      {currentStep === 2 && (
        <div className="space-y-4 rounded-3xl border border-[#E8DFD5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-3">
            <h3 className="text-base font-bold font-serif text-[#23201F] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#7A1C30]" />
              Experience 2: Explore Timeline
            </h3>
            <span className="text-[10px] font-bold text-[#C28E38] bg-[#C28E38]/10 px-2 py-0.5 rounded-full">
              Epochs
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {site.timeline.map((item, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFD5] space-y-1">
                <span className="text-xs font-bold font-mono text-[#7A1C30]">{item.year}</span>
                <h5 className="text-xs font-bold text-[#23201F]">{item.title}</h5>
                <p className="text-[11px] text-[#6B645F] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentStep(1)}
              className="rounded-xl border border-[#E8DFD5] px-4 py-2 text-xs font-semibold text-[#6B645F]"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#7A1C30] py-3 text-xs font-bold uppercase tracking-wider text-white shadow"
            >
              <span>Next: Then & Now Comparison</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: THEN & NOW */}
      {currentStep === 3 && (
        <div className="space-y-4 rounded-3xl border border-[#E8DFD5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-3">
            <h3 className="text-base font-bold font-serif text-[#23201F] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#7A1C30]" />
              Experience 3: Then & Now
            </h3>
            <span className="text-[10px] font-bold text-[#7A1C30] bg-[#7A1C30]/10 px-2 py-0.5 rounded-full">
              Interactive
            </span>
          </div>

          <p className="text-xs text-[#6B645F]">
            Look at the building in front of you, then drag the slider to see how it looked a century ago.
          </p>

          <ThenNowSlider
            archivalImage={site.archivalImage}
            modernImage={site.modernImage}
            caption={site.thenNowCaption}
            thenYear="Then (Archival)"
            nowYear="Now (Present)"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentStep(2)}
              className="rounded-xl border border-[#E8DFD5] px-4 py-2 text-xs font-semibold text-[#6B645F]"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#7A1C30] py-3 text-xs font-bold uppercase tracking-wider text-white shadow"
            >
              <span>Next: Historical Facts</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: HISTORICAL FACTS */}
      {currentStep === 4 && (
        <div className="space-y-4 rounded-3xl border border-[#E8DFD5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-3">
            <h3 className="text-base font-bold font-serif text-[#23201F] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#7A1C30]" />
              Experience 4: Historical Facts
            </h3>
            <span className="text-[10px] font-bold text-[#C28E38] bg-[#C28E38]/10 px-2 py-0.5 rounded-full">
              Local Trivia
            </span>
          </div>

          <div className="space-y-2.5">
            {site.didYouKnow.map((fact, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFD5]">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7A1C30] text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-[#23201F] leading-relaxed">{fact}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentStep(3)}
              className="rounded-xl border border-[#E8DFD5] px-4 py-2 text-xs font-semibold text-[#6B645F]"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#7A1C30] py-3 text-xs font-bold uppercase tracking-wider text-white shadow"
            >
              <span>Next: Photo Gallery</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: PHOTO GALLERY & STAMP COLLECTION */}
      {currentStep === 5 && (
        <div className="space-y-4 rounded-3xl border border-[#E8DFD5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-3">
            <h3 className="text-base font-bold font-serif text-[#23201F] flex items-center gap-1.5">
              <Image className="w-4 h-4 text-[#7A1C30]" />
              Experience 5: Photo Gallery & Visit Verification
            </h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Final Step
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <img
              src={site.heroImage}
              alt="Site photo"
              className="h-28 w-full rounded-xl object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/sites/cathedral-hero.jpg';
              }}
            />
            <img
              src={site.archivalImage}
              alt="Archival photo"
              className="h-28 w-full rounded-xl object-cover filter sepia-[0.3]"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/sites/cathedral-archival.jpg';
              }}
            />
          </div>

          {/* VISIT VERIFICATION CLAIM BOX */}
          <div className="rounded-2xl border-2 border-dashed border-[#DDA84E] bg-[#DDA84E]/10 p-5 text-center space-y-3">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#7A1C30] text-[#DDA84E] shadow-lg">
              <Award className="w-7 h-7" />
            </div>

            <div>
              <h4 className="text-base font-bold font-serif text-[#23201F]">
                {site.badgeName}
              </h4>
              <p className="text-xs text-[#6B645F] mt-0.5">
                Official San Fernando Landmark Verification #{site.qrCodeId}
              </p>
            </div>

            {isStampUnlocked || stampEarnedJustNow ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2 text-xs font-bold shadow">
                <Check className="w-4 h-4" />
                <span>Visit Successfully Verified!</span>
              </div>
            ) : (
              <button
                id="verify-visit-btn"
                onClick={handleClaimStamp}
                className="w-full rounded-xl bg-[#7A1C30] py-3 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#581020] active:scale-95 transition-all"
              >
                Verify Landmark Visit
              </button>
            )}
          </div>

          <div className="pt-2 flex justify-center">
            <button
              onClick={onBack}
              className="w-full rounded-xl bg-[#7A1C30] py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#581020] transition-colors"
            >
              Done & Return to Site
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
