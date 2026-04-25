"use client";

import { useState } from "react";
import { FaVolumeUp, FaBolt } from "react-icons/fa";

interface FlashcardProps {
  question: string;
  answer: string;
  onSpeak?: (text: string) => void;
  onReviewCard?: (quality: number) => void;
}

export default function Flashcard({ question, answer, onSpeak, onReviewCard }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="group perspective-1000 w-full max-w-md h-[400px] cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div 
        className={`relative w-full h-full text-center transition-all duration-700 preserve-3d rounded-[2rem] ${
          isFlipped ? "rotate-y-180 shadow-2xl scale-[1.02]" : "shadow-premium"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
      >
        {/* Front Face */}
        <div className="absolute inset-0 w-full h-full backface-hidden glass-card p-10 flex flex-col items-center justify-center border-brand-100/50">
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1 bg-brand-50 rounded-full border border-brand-100">
            <FaBolt className="text-brand-500 text-xs" />
            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest leading-none">Question</span>
          </div>
          
          <h3 className="text-2xl font-display font-semibold text-slate-800 leading-tight">
            {question}
          </h3>

          <div className="mt-8 flex gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak?.(question);
                }}
                className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-brand-50 hover:text-brand-500 transition-all border border-slate-100 relative z-10"
                title="Speak Question"
              >
                <FaVolumeUp />
              </button>
          </div>
          
          <p className="absolute bottom-6 text-slate-400 text-sm font-medium animate-pulse">
            Click to reveal answer
          </p>
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 w-full h-full backface-hidden glass-card p-10 flex flex-col items-center justify-center border-accent-100/50 rotate-y-180 bg-gradient-to-br from-white via-white to-accent-50/30">
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1 bg-accent-50 rounded-full border border-accent-100">
            <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
            <span className="text-[10px] font-bold text-accent-600 uppercase tracking-widest leading-none">Answer</span>
          </div>

          <p className="text-lg text-slate-600 leading-relaxed font-medium">
            {answer}
          </p>

          <div className="mt-8 flex gap-3">
             <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak?.(answer);
                }}
                className="p-3 bg-accent-50 text-accent-400 rounded-2xl hover:bg-accent-100 hover:text-accent-500 transition-all border border-accent-100 relative z-10"
                title="Speak Answer"
              >
                <FaVolumeUp />
              </button>
          </div>
          
          {onReviewCard && (
             <div className="mt-6 flex gap-2 z-20">
                <button onClick={(e) => { e.stopPropagation(); onReviewCard(0); setIsFlipped(false); }} className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">Again</button>
                <button onClick={(e) => { e.stopPropagation(); onReviewCard(1); setIsFlipped(false); }} className="px-4 py-2 bg-orange-100 text-orange-600 rounded-xl text-sm font-bold shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">Hard</button>
                <button onClick={(e) => { e.stopPropagation(); onReviewCard(2); setIsFlipped(false); }} className="px-4 py-2 bg-green-100 text-green-600 rounded-xl text-sm font-bold shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">Good</button>
                <button onClick={(e) => { e.stopPropagation(); onReviewCard(3); setIsFlipped(false); }} className="px-4 py-2 bg-blue-100 text-blue-600 rounded-xl text-sm font-bold shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">Easy</button>
             </div>
          )}

          <p className="absolute bottom-6 text-slate-400 text-sm font-medium">
            Click to return to question
          </p>
        </div>
      </div>
    </div>
  );
}
