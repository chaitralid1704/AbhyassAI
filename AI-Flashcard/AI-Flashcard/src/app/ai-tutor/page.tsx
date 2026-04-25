'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import TutorAvatarPlayer from '../components/TutorAvatarPlayer';

export default function FreshAITutor() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [contextSet, setContextSet] = useState(false);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [tutorMessage, setTutorMessage] = useState('Tutor is Offline');

  // Audio data URI from backend TTS (gTTS)
  const [ttsAudioData, setTtsAudioData] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API for STT
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = async (event: any) => {
        const currentTranscript = event.results[0][0].transcript;
        setTranscript(currentTranscript);
        setIsListening(false);
        await handleUserMessage(currentTranscript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const submitContext = async () => {
    if (!file) {
      toast.error('Please select a PDF file first.');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const extractRes = await fetch('http://localhost:8000/api/file', {
        method: 'POST',
        body: formData,
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok)
        throw new Error(extractData.detail || 'Failed to extract text');

      const saveRes = await fetch('http://localhost:8000/api/tutor/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: 'default_user',
          material_text: extractData.text,
        }),
      });
      if (!saveRes.ok) throw new Error('Failed to save context');

      setContextSet(true);
      toast.success('Study material loaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setIsUploading(false);
    }
  };

  const startAvatarSession = () => {
    setIsSessionActive(true);
    const greeting =
      'Hello! I am your AI tutor. I am ready to help you learn.';
    setTutorMessage(greeting);
    toast.success('Tutor is connected!');
    // Fetch initial greeting audio from backend
    fetchTutorReply(greeting);
  };

  const endAvatarSession = () => {
    setIsSessionActive(false);
    setIsSpeaking(false);
    setTtsAudioData(null);
    setTutorMessage('Tutor is Offline');
  };

  // Fetches TTS audio from backend for a pre-built text (used for greeting)
  const fetchTutorReply = async (text: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/tutor/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.audio_data) setTtsAudioData(data.audio_data);
    } catch {
      // silence — avatar just won't speak the greeting
    }
  };

  const handleUserMessage = async (text: string) => {
    if (!isSessionActive) {
      toast.error('Please connect the tutor first');
      return;
    }

    setTutorMessage('Thinking...');
    const toastId = toast.loading('Thinking...');
    try {
      const res = await fetch('http://localhost:8000/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: 'default_user', message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      toast.dismiss(toastId);
      setTutorMessage(data.reply);

      // Feed the gTTS audio data URI into the avatar player
      if (data.audio_data) {
        setTtsAudioData(null); // reset first to force re-trigger
        // Small timeout lets React flush the null before setting new data
        setTimeout(() => setTtsAudioData(data.audio_data), 80);
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to get answer');
      setTutorMessage("Sorry, I couldn't understand that. Can you try again?");
    }
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast.error('Speech recognition is not supported in this browser.');
        return;
      }
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-gray-100 font-sans">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 py-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                WebAudio Engine v3.0
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-emerald-400">
              Personal AI Tutor
            </h1>
            <p className="text-slate-400 mt-2 text-lg">
              Real-time lip-sync avatar powered by WebAudio analysis.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold rounded-2xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ─── Left Panel ─────────────────────────────── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Knowledge Base */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7">
              <h2 className="text-xl font-bold text-white mb-1">1. Knowledge Base</h2>
              <p className="text-sm text-slate-400 mb-5">Upload a PDF to ground the tutor's responses.</p>

              <div className="border-2 border-dashed border-teal-500/30 hover:border-teal-400/60 rounded-2xl p-5 text-center bg-teal-500/5 transition-all cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-teal-500/20 file:text-teal-300 hover:file:bg-teal-500/30 cursor-pointer"
                />
                {file && (
                  <p className="mt-3 text-sm font-semibold text-teal-400">{file.name}</p>
                )}
              </div>

              <button
                onClick={submitContext}
                disabled={isUploading || !file}
                className="mt-4 w-full py-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-semibold shadow-lg shadow-teal-600/25 disabled:opacity-40 transition-all"
              >
                {isUploading
                  ? 'Extracting...'
                  : contextSet
                  ? '✅ Knowledge Loaded'
                  : 'Inject Knowledge'}
              </button>
            </div>

            {/* Connection */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7">
              <h2 className="text-xl font-bold text-white mb-1">2. Connection</h2>
              <p className="text-sm text-slate-400 mb-5">Start the AI tutor session.</p>

              {!isSessionActive ? (
                <button
                  onClick={startAvatarSession}
                  className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-2xl font-semibold shadow-lg transition-all"
                >
                  Connect Tutor
                </button>
              ) : (
                <button
                  onClick={endAvatarSession}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-semibold shadow-lg shadow-red-600/20 transition-all"
                >
                  Disconnect
                </button>
              )}
            </div>

            {/* Status Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7">
              <h2 className="text-xl font-bold text-white mb-4">Status</h2>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Session', value: isSessionActive ? 'Active' : 'Offline', ok: isSessionActive },
                  { label: 'Listening', value: isListening ? 'Yes' : 'No', ok: isListening },
                  { label: 'Speaking', value: isSpeaking ? 'Yes' : 'No', ok: isSpeaking },
                  { label: 'Knowledge', value: contextSet ? 'Loaded' : 'None', ok: contextSet },
                ].map(({ label, value, ok }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-slate-400">{label}</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-lg text-xs ${ok ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-700/50 text-slate-400'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right Panel ────────────────────────────── */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* Avatar Stage */}
            <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-8 min-h-[520px] relative overflow-hidden">

              {/* Ambient glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl transition-all duration-700 ${isSpeaking ? 'bg-teal-500/15' : 'bg-teal-900/10'}`} />
              </div>

              {/* Avatar */}
              {!isSessionActive ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                  <div className="w-32 h-32 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                    <svg className="w-14 h-14 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">Connect tutor to begin</p>
                </div>
              ) : (
                <TutorAvatarPlayer
                  ttsAudioData={ttsAudioData}
                  isSpeaking={isSpeaking}
                  onSpeechStart={() => setIsSpeaking(true)}
                  onSpeechEnd={() => setIsSpeaking(false)}
                />
              )}

              {/* Tutor Message / Subtitles */}
              <div className="w-full max-w-xl text-center relative z-10">
                <div className={`inline-block px-5 py-3 rounded-2xl text-base font-medium leading-relaxed transition-all duration-500 ${
                  isSessionActive
                    ? 'bg-white/10 border border-white/10 text-gray-200 backdrop-blur-sm'
                    : 'text-slate-500'
                }`}>
                  {tutorMessage}
                </div>
              </div>

              {/* Session badge */}
              {isSessionActive && (
                <div className="absolute top-5 right-5 flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-full">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  Live
                </div>
              )}
            </div>

            {/* Voice Control Bar */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4">
              <button
                id="mic-toggle-button"
                onClick={toggleListen}
                disabled={!isSessionActive}
                className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all shadow-lg ${
                  !isSessionActive
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : isListening
                    ? 'bg-red-500 text-white shadow-red-500/30 animate-pulse scale-110'
                    : 'bg-teal-500 hover:bg-teal-400 text-white shadow-teal-500/30 hover:scale-105'
                }`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              <div className="flex-1 bg-white/5 rounded-2xl px-5 py-4 border border-white/10 min-h-[56px] flex items-center">
                <p className={`text-base leading-snug ${transcript || isListening ? 'text-gray-200' : 'text-slate-500'}`}>
                  {isListening
                    ? transcript || 'Listening...'
                    : transcript || 'Tap the microphone to speak to your tutor...'}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
