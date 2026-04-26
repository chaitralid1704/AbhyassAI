"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/app/firebase/config.js";
import { useRouter } from "next/navigation";
import { ModernButton, ModernInput } from "../components/ModernUI";
import { FaMap, FaBookOpen, FaTasks, FaSearch, FaYoutube, FaMicrosoft } from "react-icons/fa";
import toast from "react-hot-toast";

export default function MyLearning() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  
  // Roadmap State
  const [goal, setGoal] = useState("");
  const [roadmap, setRoadmap] = useState<any[]>([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);

  // Quick Notes State
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [notes, setNotes] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);

  // Archive System
  interface SavedNote {
      id: string;
      subject: string;
      level: string;
      content: string;
      timestamp: any;
  }
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [viewingArchive, setViewingArchive] = useState<SavedNote | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  // Daily Tasks State
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Library State
  const [searchQuery, setSearchQuery] = useState("");

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizScore, setQuizScore] = useState<{correct: number, total: number} | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [performance, setPerformance] = useState({ averageScore: 0, completedCount: 0 });
  const [activeTaskForQuiz, setActiveTaskForQuiz] = useState<any | null>(null);
  const [roadmapTaskIndex, setRoadmapTaskIndex] = useState(0); // Tracks current week in roadmap
  const [showRoadmapDetail, setShowRoadmapDetail] = useState(false); // Collapsed by default
  const [correctAnswers, setCorrectAnswers] = useState(0); // Track real quiz performance



  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  const fetchPerformance = async () => {
      if (!user) return;
      try {
          const res = await fetch(`http://127.0.0.1:8000/api/learning/performance/${user.uid}`);
          if (res.ok) {
              const data = await res.json();
              setPerformance(data);
          }
      } catch (e) { console.error("Performance fetch failed", e); }
  };

  /**
   * Loads daily missions derived directly from the active roadmap tracker.
   * - If a roadmap is active, tasks come from the milestones of the current week.
   * - Falls back to AI-generated tasks if no roadmap exists.
   */
  const loadDailyMissions = async (activeGoal?: string, activeRoadmap?: any[], weekIndex?: number) => {
      if (!user) return;
      setTasksLoading(true);
      const currentRoadmap = activeRoadmap || roadmap;
      const currentWeekIdx = weekIndex ?? roadmapTaskIndex;

      try {
          if (currentRoadmap && currentRoadmap.length > 0) {
              // --- ROADMAP TRACKER MODE ---
              // Drive tasks directly from the current week's milestones
              const currentWeek = currentRoadmap[Math.min(currentWeekIdx, currentRoadmap.length - 1)];
              const roadmapTasks = currentWeek.milestones.map((milestone: string, i: number) => ({
                  id: `roadmap-${currentWeekIdx}-${i}`,
                  task: milestone,
                  completed: false,
                  score: 0,
                  source: 'roadmap',
                  week: currentWeek.week,
                  focus: currentWeek.focus,
              }));

              // Try to merge completion state from saved missions
              try {
                  const savedRes = await fetch(`http://127.0.0.1:8000/api/learning/missions/${user.uid}`);
                  if (savedRes.ok) {
                      const savedData = await savedRes.json();
                      const savedMap = new Map((savedData.missions || []).map((m: any) => [m.task, m]));
                      const merged = roadmapTasks.map((t: any) => {
                          const saved = savedMap.get(t.task) as any;
                          return saved ? { ...t, completed: saved.completed, score: saved.score, id: saved.id } : t;
                      });
                      setTasks(merged);
                  } else {
                      setTasks(roadmapTasks);
                  }
              } catch {
                  setTasks(roadmapTasks);
              }
          } else {
              // --- FALLBACK: AI-GENERATED MISSIONS ---
              const existingRes = await fetch(`http://127.0.0.1:8000/api/learning/missions/${user.uid}`);
              const missionData = await existingRes.json();

              if (existingRes.ok && missionData.missions.length > 0) {
                  setTasks(missionData.missions);
              } else {
                  const genRes = await fetch("http://127.0.0.1:8000/api/learning/daily-mission", {
                      method: "POST", headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({ uid: user.uid, topic: activeGoal || goal || null, roadmap: null })
                  });
                  if (genRes.ok) {
                      const genData = await genRes.json();
                      await fetch("http://127.0.0.1:8000/api/learning/missions/sync", {
                          method: "POST", headers: {"Content-Type": "application/json"},
                          body: JSON.stringify({ uid: user.uid, tasks: genData.tasks })
                      });
                      const finalRes = await fetch(`http://127.0.0.1:8000/api/learning/missions/${user.uid}`);
                      const finalData = await finalRes.json();
                      setTasks(finalData.missions || []);
                  }
              }
          }
          fetchPerformance();
      } catch {
          toast.error("Failed to load daily tasks.");
      }
      setTasksLoading(false);
  };


  useEffect(() => {
    if (user) {
        // Fetch Daily Mission on mount without active roadmap context
        loadDailyMissions();
        
        const fetchArchivedNotes = async () => {
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/learning/notes/${user.uid}`);
                if (res.ok) {
                    const data = await res.json();
                    setSavedNotes(data.notes || []);
                }
            } catch (error) {
                console.error("Failed to fetch notes:", error);
            }
        };
        fetchArchivedNotes();

        const fetchActiveRoadmap = async () => {
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/learning/active-roadmap/${user.uid}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.roadmap && data.roadmap.length > 0) {
                        setRoadmap(data.roadmap);
                        setGoal(data.goal);
                        // Restore saved week index if available
                        const savedWeekIdx = data.week_index ?? 0;
                        setRoadmapTaskIndex(savedWeekIdx);
                        // Drive daily tasks from roadmap tracker
                        loadDailyMissions(data.goal, data.roadmap, savedWeekIdx);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch roadmap:", error);
            }
        };
        fetchActiveRoadmap();
    }
  }, [user]);

  const generateRoadmap = async () => {
      if (!goal.trim() || !user) return;
      setRoadmapLoading(true);
      try {
          const res = await fetch("http://127.0.0.1:8000/api/learning/roadmap", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ goal, uid: user.uid })
          });
          const data = await res.json();
          if (res.ok && data.roadmap) {
              setRoadmap(data.roadmap);
              setRoadmapTaskIndex(0); // Start from week 1 of new roadmap
              loadDailyMissions(goal, data.roadmap, 0); // Drive daily tasks from roadmap
          }
          else toast.error("Failed to generate roadmap.");
      } catch {
          toast.error("Roadmap generation failed.");
      }
      setRoadmapLoading(false);
  };

  const generateNotes = async () => {
      if (!subject.trim()) return;
      setViewingArchive(null);
      setNotesLoading(true);
      try {
          const res = await fetch("http://127.0.0.1:8000/api/learning/quick-notes", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ subject, level })
          });
          const data = await res.json();
          if (res.ok && data.notes) setNotes(data.notes);
          else toast.error("Failed to generate notes.");
      } catch {
          toast.error("Notes generation failed.");
      }
      setNotesLoading(false);
  };

  const saveGeneratedNote = async () => {
      if (!user || !notes.trim()) return;
      setSavingNote(true);
      try {
          const res = await fetch("http://127.0.0.1:8000/api/learning/notes", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ uid: user.uid, subject: subject || "Quick Note", level, content: notes })
          });
          const data = await res.json();
          if (res.ok) {
              const newArchive: SavedNote = {
                  id: data.id, subject: subject || "Quick Note", level, content: notes, timestamp: new Date()
              };
              setSavedNotes([newArchive, ...savedNotes]);
              toast.success("Note saved to Archive!");
              setNotes(""); // Clear draft
          } else {
              toast.error("Failed to save note.");
          }
      } catch (e) {
          toast.error("Failed to save note.");
      }
      setSavingNote(false);
  };

  const deleteArchiveNote = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation(); // prevent clicking the note row
      if (!user) return;
      try {
          const res = await fetch(`http://127.0.0.1:8000/api/learning/notes/${id}`, { method: "DELETE" });
          if (res.ok) {
              setSavedNotes(savedNotes.filter(n => n.id !== id));
              if (viewingArchive?.id === id) setViewingArchive(null);
              toast.success("Note removed from Archive");
          } else {
              toast.error("Failed to delete note.");
          }
      } catch {
          toast.error("Failed to delete note.");
      }
  };

  const handleSearch = (platform: 'youtube' | 'mslearn', customQuery?: string) => {
      const activeQuery = customQuery || searchQuery;
      if (!activeQuery.trim()) return;
      if (platform === 'youtube') {
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(activeQuery)}`, '_blank');
      } else {
          window.open(`https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(activeQuery)}`, '_blank');
      }
  };

  const startRoadmapQuiz = async (step: any, idx: number) => {
      if (!user) return;
      setQuizLoading(true);
      setQuizQuestions([]);
      setCurrentQuestionIdx(0);
      setQuizScore(null);
      setCorrectAnswers(0);
      setSelectedAnswer(null);
      setShowExplanation(false);

      
      try {
          const res = await fetch("http://127.0.0.1:8000/api/learning/roadmap/quiz", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ uid: user.uid, week_index: idx, focus: step.focus, milestones: step.milestones })
          });
          if (res.ok) {
              const data = await res.json();
              setQuizQuestions(data.questions);
          } else {
              toast.error("Failed to generate quiz.");
          }
      } catch {
          toast.error("Quiz generation failed.");
      }
      setQuizLoading(false);
  };

  const checkAnswer = (option: string) => {
      if (selectedAnswer || quizScore) return;
      setSelectedAnswer(option);
      setShowExplanation(true);
      
      const current = quizQuestions[currentQuestionIdx];
      if (option === current.answer) {
          setCorrectAnswers(prev => prev + 1);
          toast.success("Correct!", { icon: '🎯' });
      } else {
          toast.error("Incorrect", { icon: '❌' });
      }

  };

  const nextQuestion = async () => {
      const isLast = currentQuestionIdx === quizQuestions.length - 1;
      if (isLast) {
          // Calculate score based on actual correct answers
          const finalScore = Math.round((correctAnswers / quizQuestions.length) * 100);

          
          if (activeTaskForQuiz) {
              try {
                  await fetch("http://127.0.0.1:8000/api/learning/missions/complete", {
                      method: "POST",
                      headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({ 
                          uid: user?.uid, 
                          task_id: activeTaskForQuiz.id, 
                          task_text: activeTaskForQuiz.task,
                          score: finalScore 
                      })
                  });
                  toast.success("Task Synchronized!");
                  loadDailyMissions(); // Refresh status
              } catch (e) { console.error("Sync failed", e); }
          }

          setQuizScore({ correct: correctAnswers, total: quizQuestions.length });
          toast.success("Checkup Complete!");

          setActiveTaskForQuiz(null);
      } else {
          setCurrentQuestionIdx(prev => prev + 1);
          setSelectedAnswer(null);
          setShowExplanation(false);
      }
  };

  const startTaskTest = async (task: any) => {
      if (!user) return;
      setActiveTaskForQuiz(task);
      setQuizLoading(true);
      setQuizQuestions([]);
      setCurrentQuestionIdx(0);
      setQuizScore(null);
      setCorrectAnswers(0);
      setSelectedAnswer(null);
      setShowExplanation(false);

      
      try {
          const res = await fetch("http://127.0.0.1:8000/api/learning/roadmap/quiz", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ uid: user.uid, week_index: 0, focus: task.task, milestones: ["Immediate synthesis of daily task"] })
          });
          if (res.ok) {
              const data = await res.json();
              setQuizQuestions(data.questions);
          } else {
              toast.error("Failed to generate mission test.");
          }
      } catch {
          toast.error("Mission test failed.");
      }
      setQuizLoading(false);
  };


  // ── Derived: real-time cognitive mastery from task completion ──
  const completedTasks = tasks.filter((t: any) => t.completed);
  const pendingTasks   = tasks.filter((t: any) => !t.completed);
  const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
  const avgTaskScore   = completedTasks.length > 0 ? completedTasks.reduce((s: number, t: any) => s + (t.score || 0), 0) / completedTasks.length : 0;
  // Weighted: 60% completion, 40% avg score quality
  const cognitiveScore = tasks.length > 0
    ? Math.round(completionRate * 0.6 + avgTaskScore * 0.4)
    : performance.averageScore;

  if (loading) return <div className="p-20 text-center animate-pulse">Loading My Learning...</div>;

  return (

    <>
    <div className="p-6 sm:p-10 max-w-screen-2xl mx-auto w-full space-y-10 animate-in fade-in duration-700">
        
        {/* Header & Welcome (Stitch Style) */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <span className="text-primary dark:text-primary-dim font-bold tracking-widest text-[10px] uppercase mb-2 block animate-in slide-in-from-left-4">Academic Progression</span>
                <h1 className="text-4xl md:text-6xl font-headline font-black text-slate-800 dark:text-white tracking-tighter leading-tight">
                    Structured Learning
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-2xl text-lg font-medium">
                    Your cognitive journey is {roadmap.length > 0 ? "ongoing" : "waiting to begin"}. 
                    {roadmap.length > 0 && ` Focused on ${roadmap[0].focus} this week.`}
                </p>
            </div>
            <div className="flex gap-3">
                <button 
                  onClick={() => loadDailyMissions(goal, roadmap)} 
                  disabled={tasksLoading}
                  className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                >
                    <span className="material-symbols-outlined text-lg">sync_alt</span>
                    Sync Progress
                </button>
                <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold rounded-xl shadow-xl shadow-slate-900/10 hover:opacity-90 transition-all flex items-center gap-2 active:scale-95">
                    <span className="material-symbols-outlined text-lg">download</span>
                    Export Report
                </button>
            </div>
        </header>

        {/* Top Feature Grid */}
        <div className="grid grid-cols-12 gap-8">
            
            {/* Today's Mission — Driven by Roadmap Tracker */}
            <section className="col-span-12 bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col md:flex-row gap-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -mr-40 -mt-40 transition-transform group-hover:scale-110 duration-1000" />
                <div className="flex-1 z-10">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <span className="p-3 bg-primary/10 text-primary rounded-2xl">
                                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                            </span>
                            <div>
                                <span className="font-extrabold text-primary uppercase tracking-widest text-xs block">Today's Mission</span>
                                {roadmap.length > 0 && (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                        Week {roadmap[Math.min(roadmapTaskIndex, roadmap.length - 1)]?.week} · {roadmap[Math.min(roadmapTaskIndex, roadmap.length - 1)]?.focus}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Live tracker badges */}
                        {tasks.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black uppercase rounded-full">
                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                    {completedTasks.length} Done
                                </span>
                                {pendingTasks.length > 0 && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-[10px] font-black uppercase rounded-full">
                                        <span className="material-symbols-outlined text-xs">pending</span>
                                        {pendingTasks.length} Pending
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Tracker Progress Bar ── */}
                    {tasks.length > 0 && !tasksLoading && (
                        <div className="mt-3 mb-1">
                            <div className="flex items-center gap-1.5 mb-2">
                                {tasks.map((t: any, i: number) => (
                                    <div
                                        key={t.id || i}
                                        title={t.task}
                                        className={`h-2 flex-1 rounded-full transition-all duration-500 ${t.completed ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <span>{completedTasks.length} of {tasks.length} milestones complete</span>
                                <span className={`${completionRate === 100 ? 'text-emerald-500' : 'text-primary'}`}>{Math.round(completionRate)}%</span>
                            </div>
                        </div>
                    )}

                    {tasksLoading ? (
                        <div className="space-y-4 animate-pulse mt-6">
                            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl w-3/4"></div>
                            <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-xl w-1/2"></div>
                            <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-xl w-2/3"></div>
                        </div>
                    ) : (
                        <div className="space-y-4 mt-6">
                            {tasks.length > 0 ? (
                                tasks.map((t: any, i: number) => (
                                    <div key={t.id || i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-white/5 group/task">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${t.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                {t.completed && <span className="material-symbols-outlined text-white text-xs font-black">check</span>}
                                            </div>
                                            <span className={`font-bold ${t.completed ? 'text-slate-400 line-through text-base' : 'text-slate-800 dark:text-white text-lg'}`}>
                                                {t.task}
                                            </span>
                                        </div>
                                        {!t.completed && (
                                            <button
                                                onClick={() => startTaskTest(t)}
                                                className="px-4 py-2 bg-primary text-white text-[10px] font-black uppercase rounded-xl hover:opacity-90 active:scale-95 transition-all opacity-0 group-hover/task:opacity-100 shrink-0 ml-4"
                                            >
                                                Complete & Test
                                            </button>
                                        )}
                                        {t.completed && (
                                            <span className="text-xs font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full uppercase shrink-0 ml-4">
                                                Mastery: {t.score}%
                                            </span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <h2 className="text-2xl font-headline font-black text-slate-800 dark:text-white">
                                    Generate a roadmap below to populate your daily tasks.
                                </h2>
                            )}
                        </div>
                    )}

                    {/* Week navigation for roadmap tracker */}
                    {roadmap.length > 1 && (
                        <div className="flex items-center gap-3 mt-8">
                            <button
                                disabled={roadmapTaskIndex === 0}
                                onClick={() => {
                                    const newIdx = roadmapTaskIndex - 1;
                                    setRoadmapTaskIndex(newIdx);
                                    loadDailyMissions(goal, roadmap, newIdx);
                                }}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                ← Prev Week
                            </button>
                            <span className="text-xs font-bold text-slate-400 px-2">
                                Week {roadmapTaskIndex + 1} / {roadmap.length}
                            </span>
                            <button
                                disabled={roadmapTaskIndex >= roadmap.length - 1}
                                onClick={() => {
                                    const newIdx = roadmapTaskIndex + 1;
                                    setRoadmapTaskIndex(newIdx);
                                    loadDailyMissions(goal, roadmap, newIdx);
                                }}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Next Week →
                            </button>
                        </div>
                    )}
                </div>

                <div className="w-full md:w-80 z-10 flex flex-col gap-4">
                    {/* Cognitive Mastery Card */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Cognitive Mastery</span>
                            <span className={`text-sm font-black ${
                                cognitiveScore >= 80 ? 'text-emerald-500' :
                                cognitiveScore >= 50 ? 'text-primary' : 'text-amber-500'
                            }`}>{cognitiveScore}%</span>
                        </div>

                        {/* Ring + stats */}
                        <div className="flex items-center gap-5">
                            {/* SVG ring */}
                            <div className="relative w-20 h-20 shrink-0">
                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" className="dark:stroke-slate-700" />
                                    <circle
                                        cx="18" cy="18" r="15.9" fill="none"
                                        stroke={cognitiveScore >= 80 ? '#10b981' : cognitiveScore >= 50 ? '#6366f1' : '#f59e0b'}
                                        strokeWidth="3"
                                        strokeDasharray={`${cognitiveScore} ${100 - cognitiveScore}`}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000"
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800 dark:text-white">{cognitiveScore}%</span>
                            </div>

                            {/* Breakdown */}
                            <div className="flex-1 space-y-2.5">
                                <div>
                                    <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1">
                                        <span>Completion</span>
                                        <span>{Math.round(completionRate)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1">
                                        <span>Avg Score</span>
                                        <span>{Math.round(avgTaskScore)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${avgTaskScore}%` }} />
                                    </div>
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold pt-1">
                                    {completedTasks.length}/{tasks.length} milestones · {pendingTasks.length} remaining
                                </p>
                            </div>
                        </div>

                        {/* All-done banner */}
                        {tasks.length > 0 && completionRate === 100 && (
                            <div className="mt-4 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center">
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">🎉 All milestones completed!</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-slate-900/10"
                    >
                        Enter Training Hub
                        <span className="material-symbols-outlined text-lg">rocket_launch</span>
                    </button>
                </div>
            </section>

            {/* AI Roadmap Generator (Middle Section) */}
            <section className="col-span-12 lg:col-span-12 bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 shadow-sm">
                 <div className="flex-1 w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="material-symbols-outlined text-secondary text-2xl">account_tree</span>
                        <h3 className="text-2xl font-headline font-black text-slate-800 dark:text-white">Architect New Trajectory</h3>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">Input your learning goal and Sanctuary AI will map your path through academic milestones.</p>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input 
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-6 py-4 text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg" 
                                placeholder="e.g. Master Quantum Mechanics in 4 weeks" 
                                type="text"
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={generateRoadmap}
                            disabled={roadmapLoading}
                            className="bg-primary text-white px-10 py-4 rounded-2xl font-black text-lg hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {roadmapLoading ? "Mapping..." : "Generate Roadmap"}
                            <span className="material-symbols-outlined text-xl">bolt</span>
                        </button>
                    </div>
                 </div>
                 <div className="hidden xl:flex gap-10 border-l border-slate-100 dark:border-slate-800 pl-10 pr-4">
                    <div className="flex flex-col">
                        <span className="text-3xl font-black text-primary">12</span>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Paths Saved</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-3xl font-black text-primary">94%</span>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Efficiency</span>
                    </div>
                 </div>
            </section>

            {/* Roadmap Progress + Collapsible Detail */}
            <section className="col-span-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

                {/* Always-visible: Progress summary header */}
                <div className="p-8 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <span className="material-symbols-outlined text-lg">trending_up</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-headline font-black text-slate-800 dark:text-white">Path Progression</h3>
                            <p className="text-xs text-slate-400 font-bold">
                                {roadmap.length === 0 ? 'No roadmap active' : `${roadmap.length} week${roadmap.length > 1 ? 's' : ''} · ${roadmap[0]?.focus}`}
                            </p>
                        </div>
                    </div>

                    {/* Week-by-week tracker */}
                    {roadmap.length > 0 && (
                        <div className="flex-1 flex flex-col gap-2">
                            {/* Step indicator rail */}
                            <div className="flex items-center gap-0">
                                {roadmap.map((step, idx) => {
                                    const isPast    = idx < roadmapTaskIndex;
                                    const isCurrent = idx === roadmapTaskIndex;
                                    const isFuture  = idx > roadmapTaskIndex;
                                    // For current week use live completion; past = 100%; future = 0%
                                    const pct = isPast ? 100 : isCurrent ? Math.round(completionRate) : 0;
                                    return (
                                        <div key={idx} className="flex items-center flex-1 min-w-0">
                                            {/* Node */}
                                            <button
                                                onClick={() => { setRoadmapTaskIndex(idx); loadDailyMissions(goal, roadmap, idx); }}
                                                title={`Week ${step.week}: ${step.focus}`}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-all border-2 ${
                                                    isPast    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200' :
                                                    isCurrent ? 'bg-primary border-primary text-white shadow-sm shadow-primary/30 scale-110' :
                                                                'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                                }`}
                                            >
                                                {isPast ? <span className="material-symbols-outlined text-[12px]">check</span> : idx + 1}
                                            </button>
                                            {/* Connector bar (not after last) */}
                                            {idx < roadmap.length - 1 && (
                                                <div className="flex-1 h-1 mx-0.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ${
                                                            isPast ? 'bg-emerald-500 w-full' : isCurrent ? 'bg-primary' : 'w-0'
                                                        }`}
                                                        style={isCurrent ? { width: `${pct}%` } : undefined}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Labels row */}
                            <div className="flex">
                                {roadmap.map((step, idx) => (
                                    <div key={idx} className="flex-1 min-w-0 pr-1">
                                        <p className={`text-[8px] font-black uppercase truncate ${
                                            idx === roadmapTaskIndex ? 'text-primary' : idx < roadmapTaskIndex ? 'text-emerald-500' : 'text-slate-400'
                                        }`}>{step.focus.split(' ').slice(0,2).join(' ')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Toggle button */}
                    {roadmap.length > 0 && (
                        <button
                            onClick={() => setShowRoadmapDetail(prev => !prev)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary font-black text-xs uppercase tracking-widest rounded-xl transition-all shrink-0"
                        >
                            <span className="material-symbols-outlined text-base">{showRoadmapDetail ? 'expand_less' : 'expand_more'}</span>
                            {showRoadmapDetail ? 'Hide Roadmap' : 'View Full Roadmap'}
                        </button>
                    )}
                </div>

                {/* Collapsible: Full roadmap detail */}
                {showRoadmapDetail && roadmap.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 p-8 sm:p-10 animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-headline font-black text-slate-800 dark:text-white flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary bg-primary/10 p-2.5 rounded-2xl text-lg">route</span>
                                Milestones &amp; Resources
                            </h3>
                            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">AI Verified Path</span>
                        </div>
                        <div className="space-y-8">
                            {roadmap.map((step, idx) => (
                                <div key={idx} className="relative pl-10 animate-in slide-in-from-bottom-2 fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                                    {idx !== roadmap.length - 1 && <div className="absolute left-3.5 top-8 bottom-[-32px] w-0.5 bg-slate-100 dark:bg-slate-800" />}
                                    <div className="absolute left-0 top-0.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-black ring-4 ring-white dark:ring-slate-900 shadow-md shadow-primary/20 z-10">
                                        {idx + 1}
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 sm:p-6 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-primary/20 transition-all">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                            <div>
                                                <h5 className="font-extrabold text-primary text-[10px] uppercase tracking-widest mb-0.5">Week {step.week} Focus</h5>
                                                <h4 className="text-lg font-headline font-black text-slate-800 dark:text-white">{step.focus}</h4>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Week status badge */}
                                                {idx < roadmapTaskIndex && (
                                                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[9px] font-black uppercase rounded-full flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[10px]">check_circle</span> Completed
                                                    </span>
                                                )}
                                                {idx === roadmapTaskIndex && (
                                                    <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-full flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[10px]">radio_button_checked</span> Current Week
                                                    </span>
                                                )}
                                                {idx > roadmapTaskIndex && (
                                                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[9px] font-black uppercase rounded-full flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[10px]">lock</span> Upcoming
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => startRoadmapQuiz(step, idx)}
                                                    className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black shadow-sm border border-slate-200 dark:border-slate-700 hover:text-primary hover:border-primary/30 transition-all flex items-center gap-2 active:scale-95"
                                                >
                                                    <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                                                    Knowledge Check
                                                </button>
                                            </div>
                                        </div>

                                        {/* Per-week tracker bar */}
                                        {(() => {
                                            const weekTasks = idx === roadmapTaskIndex ? tasks : [];
                                            const weekDone  = idx < roadmapTaskIndex ? step.milestones.length : weekTasks.filter((t: any) => t.completed).length;
                                            const weekTotal = step.milestones.length;
                                            const weekPct   = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
                                            return (
                                                <div className="mb-4 p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                                        <span>Week Progress</span>
                                                        <span className={weekPct === 100 ? 'text-emerald-500' : 'text-primary'}>{weekPct}%</span>
                                                    </div>
                                                    <div className="flex gap-1 mb-1.5">
                                                        {step.milestones.map((_: string, mi: number) => {
                                                            const done = idx < roadmapTaskIndex
                                                                ? true
                                                                : idx === roadmapTaskIndex
                                                                    ? tasks[mi]?.completed
                                                                    : false;
                                                            return (
                                                                <div
                                                                    key={mi}
                                                                    className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                                                                        done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                                                                    }`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <p className="text-[8px] text-slate-400 font-bold">{weekDone} of {weekTotal} milestones done</p>
                                                </div>
                                            );
                                        })()}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Core Milestones
                                                </p>
                                                <ul className="space-y-2">
                                                    {step.milestones.map((m: string, mi: number) => (
                                                        <li key={mi} className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400 font-bold">
                                                            <span className="material-symbols-outlined text-xs text-green-500 bg-green-50 rounded-full p-0.5 mt-0.5">check</span>
                                                            {m}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            {step.resources && step.resources.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Suggested Resources
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {step.resources.map((res: any, ri: number) => (
                                                            <button
                                                                key={ri}
                                                                onClick={() => handleSearch(res.type === 'video' ? 'youtube' : 'mslearn', res.query)}
                                                                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-transparent hover:border-primary/40 transition-all text-left shadow-sm"
                                                            >
                                                                <div className={`p-1.5 rounded-lg ${res.type === 'video' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                                    <span className="material-symbols-outlined text-sm">{res.type === 'video' ? 'smart_display' : 'menu_book'}</span>
                                                                </div>
                                                                <div className="flex-1 truncate">
                                                                    <span className="block text-[10px] font-black text-slate-700 dark:text-slate-200 truncate">{res.title}</span>
                                                                    <span className="block text-[9px] text-slate-400 font-bold uppercase mt-0.5">{res.type === 'video' ? 'YouTube EDU' : 'Docs'}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    </div>

    {/* Global Quiz Overlay */}
    {(quizQuestions.length > 0 || quizLoading) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.25)] border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden animate-in zoom-in-95 duration-500 max-h-[85vh] overflow-y-auto">
                {/* Background Decor */}
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 blur-3xl rounded-full" />
                <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-secondary/5 blur-3xl rounded-full" />
                
                <button onClick={() => { setQuizQuestions([]); setQuizScore(null); }} className="absolute right-8 top-8 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                    <span className="material-symbols-outlined">close</span>
                </button>

                {quizLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
                        <h3 className="text-xl font-headline font-black text-slate-800 dark:text-white mb-2">Architecting Assessment</h3>
                        <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest">Sanctuary AI is mapping your cognitive load...</p>
                    </div>
                ) : quizScore ? (
                    <div className="py-12 text-center animate-in zoom-in">
                        <div className="w-28 h-28 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-8 ring-8 ring-emerald-500/10">
                            <span className="material-symbols-outlined text-6xl text-emerald-500">verified_user</span>
                        </div>
                        <h3 className="text-3xl font-headline font-black text-slate-800 dark:text-white mb-4">Knowledge Synchronized!</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-10 px-6 font-bold text-lg leading-relaxed">
                            Excellent work navigating this trajectory's focus. Your progression has been updated in the cognitive matrix.
                        </p>
                        <button 
                            onClick={() => { setQuizQuestions([]); setQuizScore(null); }}
                            className="px-12 py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl shadow-2xl shadow-slate-900/20 hover:scale-105 transition-all active:scale-95 text-lg"
                        >
                            Return to Learning Path
                        </button>
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center justify-between mb-10">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 px-5 py-2 rounded-full border border-primary/20">
                                Question {currentQuestionIdx + 1} // {quizQuestions.length}
                            </span>
                        </div>
                        
                        <h3 className="text-2xl md:text-3xl font-headline font-black text-slate-800 dark:text-white mb-10 leading-[1.1] tracking-tight">
                            {quizQuestions[currentQuestionIdx].question}
                        </h3>

                        <div className="grid grid-cols-1 gap-3 mb-10">
                            {quizQuestions[currentQuestionIdx].options.map((opt: string, i: number) => {
                                const isCorrect = opt === quizQuestions[currentQuestionIdx].answer;
                                const isSelected = opt === selectedAnswer;
                                
                                let btnStyle = "bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-transparent text-slate-700 dark:text-slate-300";
                                if (showExplanation) {
                                    if (isCorrect) btnStyle = "bg-emerald-50 dark:bg-emerald-900/40 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20";
                                    else if (isSelected) btnStyle = "bg-red-50 dark:bg-red-900/40 border-red-500/50 text-red-700 dark:text-red-400";
                                } else {
                                    btnStyle += " hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-primary/40 active:scale-[0.99] hover:shadow-lg hover:shadow-primary/5";
                                }

                                return (
                                    <button 
                                        key={i} 
                                        onClick={() => checkAnswer(opt)}
                                        disabled={showExplanation}
                                        className={`p-5 rounded-2xl border-2 text-left font-black text-sm transition-all flex items-center justify-between group/opt ${btnStyle}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="w-8 h-8 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center font-black text-xs shrink-0">{String.fromCharCode(65 + i)}</span>
                                            {opt}
                                        </div>
                                        {showExplanation && isCorrect && <span className="material-symbols-outlined text-lg">check_circle</span>}
                                        {showExplanation && isSelected && !isCorrect && <span className="material-symbols-outlined text-lg">cancel</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {showExplanation && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="p-6 bg-primary/5 dark:bg-primary/20 rounded-3xl border border-primary/10 mb-8">
                                    <div className="flex items-center gap-3 mb-3 text-primary">
                                        <span className="material-symbols-outlined text-lg">lightbulb</span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cognitive Insight</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                        {quizQuestions[currentQuestionIdx].explanation}
                                    </p>
                                </div>
                                <button 
                                    onClick={nextQuestion}
                                    className="w-full py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-[0.99] text-sm uppercase tracking-widest shadow-2xl shadow-slate-900/20"
                                >
                                    {currentQuestionIdx === quizQuestions.length - 1 ? "Complete Diagnostic Check" : "Advance to Next Node"}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )}
  </>
  );
}


