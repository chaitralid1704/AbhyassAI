'use client';
import { useEffect, useRef, useState } from 'react';

const MOUTHS: Record<string, string> = {
  idle: '/mouths/idle_closed.svg',
  a: '/mouths/open_a.svg',
  e: '/mouths/wide_e.svg',
  o: '/mouths/round_o.svg',
  mbp: '/mouths/mbp_closed.svg',
};

function pickMouth(smoothed: number): string {
  if (smoothed < 0.015) return 'idle';
  if (smoothed < 0.03) return Math.random() < 0.5 ? 'e' : 'o';
  if (smoothed < 0.06) return Math.random() < 0.6 ? 'a' : 'e';
  return 'a';
}

interface TutorAvatarPlayerProps {
  ttsAudioData: string | null;
  isSpeaking: boolean;
  onSpeechEnd: () => void;
  onSpeechStart: () => void;
}

export default function TutorAvatarPlayer({
  ttsAudioData,
  isSpeaking,
  onSpeechEnd,
  onSpeechStart,
}: TutorAvatarPlayerProps) {
  const rafRef = useRef<number | null>(null);
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [mouth, setMouth] = useState<string>('idle');

  // Stop any ongoing playback and animation cleanly
  const stopAll = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      bufferSourceRef.current?.stop();
    } catch {
      // already stopped
    }
    bufferSourceRef.current = null;
    setMouth('idle');
  };

  useEffect(() => {
    if (!ttsAudioData) return;

    stopAll();

    let cancelled = false;

    const play = async () => {
      try {
        // Create (or reuse) a single AudioContext per component lifetime
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
          const AudioCtx =
            (window.AudioContext ||
              (window as any).webkitAudioContext) as typeof AudioContext;
          ctxRef.current = new AudioCtx();

          const analyser = ctxRef.current.createAnalyser();
          analyser.fftSize = 1024;
          analyser.connect(ctxRef.current.destination);
          analyserRef.current = analyser;
        }

        const ctx = ctxRef.current;
        const analyser = analyserRef.current!;

        // Resume if suspended (required after user gesture)
        if (ctx.state === 'suspended') await ctx.resume();

        // Fetch the base64 data URI as an ArrayBuffer
        const response = await fetch(ttsAudioData);
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        // Decode PCM audio — no HTMLMediaElement needed
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        // Create a fresh BufferSourceNode for this playback
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        bufferSourceRef.current = source;

        // Lip-sync animation loop
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let ema = 0;
        const alpha = 0.2;
        let lastMouth = 'idle';
        let lastSwitch = performance.now();

        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          ema = alpha * rms + (1 - alpha) * ema;

          const now = performance.now();
          if (now - lastSwitch > 60) {
            const base = pickMouth(ema);
            const next =
              ema > 0.02 && ema < 0.05 && Math.random() < 0.05 ? 'mbp' : base;
            if (next !== lastMouth) {
              lastMouth = next;
              setMouth(next);
            }
            lastSwitch = now;
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        source.onended = () => {
          if (cancelled) return;
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setMouth('idle');
          onSpeechEnd();
        };

        onSpeechStart();
        source.start(0);
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('TutorAvatarPlayer playback error:', err);
        setMouth('idle');
      }
    };

    play();

    return () => {
      // Cleanup when ttsAudioData changes or component unmounts
      cancelled = true;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsAudioData]);

  // Close AudioContext on full unmount
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return (
    <div className="relative w-full max-w-xs mx-auto aspect-square">
      {/* Glowing ring */}
      <div
        className={`absolute inset-0 rounded-3xl transition-all duration-300 ${
          isSpeaking
            ? 'shadow-[0_0_50px_15px_rgba(20,184,166,0.4)]'
            : 'shadow-[0_0_20px_5px_rgba(20,184,166,0.1)]'
        }`}
      />

      {/* Avatar container */}
      <div className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-teal-400/30">
        {/* Base face */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/avatar/base_face.svg"
          alt="AI Tutor"
          className="absolute inset-0 w-full h-full object-contain z-10"
        />

        {/* Mouth overlay */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={MOUTHS[mouth]}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain z-20 pointer-events-none"
        />

        {/* Speaking dots */}
        {isSpeaking && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
            {[0, 75, 150].map((delay) => (
              <span
                key={delay}
                className="block w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
