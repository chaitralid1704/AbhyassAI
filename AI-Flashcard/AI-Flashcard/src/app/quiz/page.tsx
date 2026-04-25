"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/app/firebase/config.js";
import { FaArrowLeft, FaCheck, FaTimes, FaTrophy, FaBolt } from "react-icons/fa";
import Confetti from "react-confetti";
import { ModernButton } from "../components/ModernUI";

function QuizContent() {
  const [user] = useAuthState(auth);
  const searchParams = useSearchParams();
  const router = useRouter();
  const collectionId = searchParams.get("collectionId");

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xpEarned, setXpEarned] = useState(0);

  useEffect(() => {
    if (!user || !collectionId) return;

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        // 1. Fetch current flashcards for context
        const cardsResponse = await fetch(`http://127.0.0.1:8000/api/collections/${collectionId}/flashcards?uid=${user.uid}`);
        if (!cardsResponse.ok) throw new Error("Failed to load cards");
        const cardsData = await cardsResponse.json();
        
        // Convert cards to a single text block for the AI
        const contextText = cardsData.flashcards.map((c: any) => `${c.question}: ${c.answer}`).join("\n");

        // 2. Generate Quiz
        const quizResponse = await fetch("http://127.0.0.1:8000/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: contextText, count: 5 }),
        });

        if (!quizResponse.ok) throw new Error("Failed to generate quiz");
        const quizData = await quizResponse.json();
        setQuestions(quizData.questions);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [user, collectionId]);

  const handleOptionSelect = (option: string) => {
    if (selectedOption) return; // Prevent double select
    setSelectedOption(option);
    if (option === questions[currentIndex].answer) {
      setScore(score + 1);
    }
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
    } else {
      // Quiz Finished!
      const finalXp = score * 20; // 20 XP per correct answer
      setXpEarned(finalXp);
      setShowResult(true);

      // Submit XP to backend
      if (user) {
        await fetch(`http://127.0.0.1:8000/api/user/${user.uid}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid, xp_gained: finalXp, collection_id: collectionId }),
        });
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-400 font-medium animate-pulse">AI is crafting your quiz questions...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
      <div className="p-8 glass-card border-red-500/20 text-center">
        <p className="text-red-400 mb-6">Error: {error}</p>
        <ModernButton onClick={() => router.back()}>Go Back</ModernButton>
      </div>
    </div>
  );

  if (showResult) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
      <Confetti recycle={false} />
      <div className="w-full max-w-md glass-card p-10 text-center animate-in zoom-in duration-500">
        <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <FaTrophy className="text-4xl text-yellow-500" />
        </div>
        <h1 className="text-4xl font-display font-black mb-2">Quiz Complete!</h1>
        <p className="text-slate-400 mb-8 font-medium">You dominated {score}/{questions.length} questions</p>
        
        <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl p-6 mb-8 flex items-center justify-center gap-4">
          <FaBolt className="text-3xl text-brand-400" />
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest text-brand-400">Total Reward</p>
            <p className="text-2xl font-black text-white">+{xpEarned} XP</p>
          </div>
        </div>

        <div className="flex gap-4">
          <ModernButton onClick={() => router.push("/dashboard")} className="flex-1">Dashboard</ModernButton>
          <button onClick={() => window.location.reload()} className="flex-1 py-4 px-6 rounded-2xl bg-slate-900 border border-slate-800 text-white font-bold hover:bg-slate-800 transition-all">Retry</button>
        </div>
      </div>
    </div>
  );

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 sm:p-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <button onClick={() => router.back()} className="p-3 rounded-xl bg-slate-900 text-slate-400 hover:text-white transition-colors">
          <FaArrowLeft />
        </button>
        <div className="flex-1 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-brand-400 mb-1">Question {currentIndex + 1} of {questions.length}</p>
            <div className="w-48 h-1.5 bg-slate-900 rounded-full mx-auto overflow-hidden">
                <div 
                    className="h-full bg-brand-500 transition-all duration-500" 
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
            </div>
        </div>
        <div className="w-10" />
      </header>

      <main className="max-w-2xl mx-auto space-y-12 animate-in slide-in-from-bottom-10 duration-500">
        <div className="glass-card p-10 text-center">
            <h2 className="text-3xl font-display font-bold leading-tight">{currentQ.question}</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {currentQ.options.map((option: string) => {
                const isSelected = selectedOption === option;
                const isCorrect = option === currentQ.answer;
                const showFeedback = selectedOption !== null;

                let styles = "p-6 rounded-2xl border-2 text-left font-bold transition-all duration-200 ";
                if (!showFeedback) {
                    styles += "bg-slate-900 border-slate-800 hover:border-brand-500/50 hover:bg-slate-800 cursor-pointer";
                } else {
                    if (isSelected && isCorrect) styles += "bg-green-500/20 border-green-500 text-green-400";
                    else if (isSelected && !isCorrect) styles += "bg-red-500/20 border-red-500 text-red-400";
                    else if (isCorrect) styles += "bg-green-500/20 border-transparent text-green-400 opacity-50";
                    else styles += "bg-slate-900 border-slate-800 opacity-30";
                }

                return (
                    <button 
                        key={option} 
                        onClick={() => handleOptionSelect(option)}
                        disabled={showFeedback}
                        className={styles}
                    >
                        <div className="flex items-center justify-between">
                            <span>{option}</span>
                            {showFeedback && isCorrect && <FaCheck className="text-green-400" />}
                            {showFeedback && isSelected && !isCorrect && <FaTimes className="text-red-400" />}
                        </div>
                    </button>
                );
            })}
        </div>

        {selectedOption && (
            <div className="animate-in fade-in duration-500 space-y-8">
                {currentQ.explanation && (
                    <div className="p-6 bg-brand-500/5 border border-brand-500/10 rounded-2xl text-slate-400 text-sm italic">
                        <strong>Why?</strong> {currentQ.explanation}
                    </div>
                )}
                <ModernButton onClick={handleNext} className="w-full py-6 text-xl">
                    {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
                </ModernButton>
            </div>
        )}
      </main>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div>Loading Quiz...</div>}>
      <QuizContent />
    </Suspense>
  );
}
