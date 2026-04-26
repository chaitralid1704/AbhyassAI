'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";

export default function FreshAITutor() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [contextSet, setContextSet] = useState(false);
  
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("https://embed.liveavatar.com/v1/fb26a591-a69a-4094-8ce8-88731a8c5daa?orientation=horizontal");
  const [transcript, setTranscript] = useState('');
  const [tutorMessage, setTutorMessage] = useState("Tutor is Offline");
  
  const recognitionRef = useRef<any>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize Web Speech API for native STT
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop();
      }
    };
  }, []);

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
        method: 'POST', body: formData,
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.detail || 'Failed to extract text');
      
      const saveRes = await fetch('http://localhost:8000/api/tutor/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: 'default_user', material_text: extractData.text }),
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

  const fetchToken = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/heygen-token", { method: "POST" });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching token:", error);
      return null;
    }
  };

  const startAvatarSession = async () => {
    setIsConnecting(true);
    setTutorMessage("Connecting to LiveAvatar...");
    
    const data = await fetchToken();
    if (!data) {
      toast.error("Failed to connect to backend.");
      setIsConnecting(false);
      setTutorMessage("Tutor is Offline");
      return;
    }

    // Sandbox v2 Mode
    if (data.url) {
      console.log("Using v2 Sandbox URL:", data.url);
      setEmbedUrl(data.url);
      setShowIframe(true);
      setIsSessionActive(true);
      setIsConnecting(false);
      setTutorMessage("Tutor is Ready (Sandbox Mode)");
      toast.success("Tutor is live!");
      return;
    }

    const token = data.token;
    if (!token) {
      toast.error("Failed to get session token. Check your LiveAvatar API key.");
      setIsConnecting(false);
      setTutorMessage("Tutor is Offline");
      return;
    }


    try {
      // New LiveAvatarSession SDK v3.0
      const session = new LiveAvatarSession(token, {
        voiceChat: true,
      });

      
      session.on("stream_ready", (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });

      session.on("disconnected", () => {
        setIsSessionActive(false);
        setTutorMessage("Tutor Disconnected");
      });


      console.log("Starting session with token:", token);
      await session.start().catch((err: any) => {
        console.error("SDK Start Error:", err);
        throw new Error(`Connection failed: ${err.message || 'Check microphone/internet'}`);
      });

      sessionRef.current = session;
      setIsSessionActive(true);
      setIsConnecting(false);
      
      const greeting = "Hello! I am your AI tutor. I am ready to help you learn.";
      setTutorMessage(greeting);
      toast.success('Tutor is live!');
      
      await session.repeat(greeting);
    } catch (err: any) {
      console.error("Avatar session failed:", err);
      // Fallback to Iframe if SDK fails
      console.log("Switching to Iframe Fallback...");
      setShowIframe(true);
      setIsSessionActive(true); // Mark as active so UI shows the container
      setIsConnecting(false);
      toast.success("Connected via Fallback Mode");

    }

  };

  const endAvatarSession = async () => {
    if (sessionRef.current) {
      await sessionRef.current.stop();
      sessionRef.current = null;
    }
    setIsSessionActive(false);
    setTutorMessage('Tutor is Offline');
  };

  const handleUserMessage = async (text: string) => {
    if (!isSessionActive || !sessionRef.current) {
      toast.error("Please connect the tutor first");
      return;
    }
    
    // Sandbox mode: direct return without SDK interaction
    if (showIframe) {
      return;
    }

    if (!sessionRef.current) return;
    
    setTutorMessage("Thinking...");
    const toastId = toast.loading('Thinking...');
    try {
      const res = await fetch('http://localhost:8000/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: 'default_user', message: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      toast.dismiss(toastId);
      setTutorMessage(data.reply);
      
      // Speak through LiveAvatar for real-time lip-sync
      setIsSpeaking(true);
      await sessionRef.current.repeat(data.reply);
      setIsSpeaking(false);
      
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Failed to get answer');
      const errorMsg = "Sorry, I couldn't understand that. Can you try again?";
      setTutorMessage(errorMsg);
      if (sessionRef.current) await sessionRef.current.repeat(errorMsg);
    }
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast.error("Speech recognition is not supported in this browser.");
        return;
      }
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-gray-900 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">LiveAvatar Engine v3.0</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              Personal AI Tutor
            </h1>
            <p className="text-gray-500 mt-3 text-lg max-w-xl">Real-time interactive tutor powered by LiveAvatar.</p>

          </div>
          
          <Link href="/dashboard" className="flex items-center gap-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold rounded-2xl transition-all border border-gray-200 shadow-sm hover:shadow">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Setup */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">1. Knowledge Base</h2>
              <p className="text-sm text-gray-500 mb-6">Upload study material to ground the AI's responses.</p>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-primary/40 bg-gray-50 transition-all cursor-pointer">
                  <input
                    type="file" accept=".pdf" onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary/5 file:text-primary hover:file:bg-primary/10 cursor-pointer"
                  />
                  {file && <p className="mt-3 text-sm font-semibold text-primary">{file.name}</p>}
                </div>
                
                <button
                  onClick={submitContext} disabled={isUploading || !file}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 disabled:opacity-50 transition-all"
                >
                  {isUploading ? 'Extracting...' : contextSet ? 'Knowledge Loaded ✅' : 'Inject Knowledge'}
                </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">2. Connection</h2>
              <p className="text-sm text-gray-500 mb-6">Initialize the live streaming avatar session.</p>
              
              {!isSessionActive ? (
                <button
                  onClick={startAvatarSession}
                  disabled={isConnecting}
                  className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-semibold shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting...
                    </>
                  ) : 'Connect Tutor'}

                </button>
              ) : (
                <button
                  onClick={endAvatarSession}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-semibold shadow-lg shadow-red-500/20 transition-all"
                >
                  Disconnect Tutor
                </button>
              )}
            </div>
          </div>

          {/* Right Panel: Avatar & Voice Interface */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 overflow-hidden relative flex-1 min-h-[550px] flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-8">
              
              {/* Real LiveAvatar Video Container */}
              <div className="relative w-full max-w-lg aspect-video mx-auto mb-8 rounded-[2.5rem] overflow-hidden shadow-2xl bg-gray-900 border-4 border-white ring-1 ring-gray-100">
                {!isSessionActive && !isConnecting ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Avatar Standby</span>
                  </div>
                ) : isConnecting ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                    <span className="text-primary font-black uppercase tracking-widest text-xs">Initializing Tutor...</span>

                  </div>
                ) : showIframe ? (
                  <div className="absolute inset-0 w-full h-full bg-white">
                    <iframe 
                      src={embedUrl}
                      allow="microphone; camera" 
                      title="LiveAvatar Embed" 
                      className="w-full h-full border-none"
                      style={{ minHeight: '300px' }}
                    />
                  </div>
                ) : (
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline
                    className="w-full h-full object-cover"
                  />
                )}

              </div>

              {/* Subtitles / AI Response Text */}
              <div className="max-w-2xl text-center px-4">
                <p className={`text-2xl font-bold transition-all duration-500 leading-relaxed ${isSessionActive ? 'text-slate-800' : 'text-slate-300'}`}>
                  {tutorMessage}
                </p>
              </div>

              {/* Status Overlay */}
              {isSessionActive && (
                <div className="absolute top-6 right-6 px-4 py-2 bg-emerald-500 text-white text-xs font-black uppercase tracking-tighter rounded-full flex items-center gap-2 shadow-xl shadow-emerald-500/20">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Live Session Active
                </div>
              )}
            </div>

            {/* Voice Control Bar */}
            <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col md:flex-row items-center gap-4">
              <button
                onClick={toggleListen}
                disabled={!isSessionActive}
                className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  !isSessionActive ? 'bg-gray-100 text-gray-400' :
                  isListening ? 'bg-red-500 text-white shadow-xl shadow-red-500/40 animate-pulse' : 'bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20'
                }`}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              
              <div className="flex-1 w-full bg-slate-50 rounded-2xl p-5 min-h-[64px] border border-slate-100 flex items-center">
                <p className={`text-lg font-medium ${transcript || isListening ? 'text-slate-800' : 'text-slate-400'}`}>
                  {isListening ? (transcript || 'Listening...') : (transcript || 'Tap the microphone to speak...')}
                </p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
