"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/app/firebase/config.js";
import { useRouter } from "next/navigation";
import { FaPlus, FaFolder, FaRegLightbulb, FaBolt, FaFire, FaCopy } from "react-icons/fa";
import { ModernButton } from "../components/ModernUI";
import ParentDashboard from "./ParentDashboard";
import toast from "react-hot-toast";

// ---- Types ----
interface Achievement { id: string; title: string; description: string; icon: string; color: string; unlocked: boolean; }
interface TestResult { id: string; topic: string; score: number; total: number; accuracy: number; timestamp: string | null; source: string; }
interface Highlights {
  missions: { completed: number; total: number; averageScore: number; recent: { task: string; score: number; date: string }[] };
  quizzes: { totalAttempts: number; avgAccuracy: number; topicBreakdown: { topic: string; attempts: number; avgAccuracy: number }[] };
  user: { xp: number; level: number; streak: number };
  overallScore: number;
}

const COLOR_MAP: Record<string, string> = {
  emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  blue: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  purple: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
  amber: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  indigo: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
  orange: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  yellow: "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
  teal: "text-teal-500 bg-teal-50 dark:bg-teal-900/20",
  violet: "text-violet-500 bg-violet-50 dark:bg-violet-900/20",
  green: "text-green-500 bg-green-50 dark:bg-green-900/20",
  cyan: "text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20",
  rose: "text-rose-500 bg-rose-50 dark:bg-rose-900/20",
};

function getAccuracyColor(acc: number) {
  if (acc >= 80) return "text-emerald-600 bg-emerald-50";
  if (acc >= 60) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

export default function Dashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [collections, setCollections] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalCollections: 0, totalCards: 0 });
  const [userStats, setUserStats] = useState({ xp: 0, level: 1, streak: 0, lastActive: null, role: "", referralCode: "" });

  // New performance state
  const [highlights, setHighlights] = useState<Highlights | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementStats, setAchievementStats] = useState({ totalUnlocked: 0, totalAchievements: 0 });
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showAllTests, setShowAllTests] = useState(false);
  const [activeTab, setActiveTab] = useState<"quiz" | "mission">("quiz");
  const [perfLoading, setPerfLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      try {
        const [colRes, statsRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/collections?uid=${user.uid}`),
          fetch(`http://127.0.0.1:8000/api/user/${user.uid}/stats`),
        ]);
        if (colRes.ok) {
          const data = await colRes.json();
          setCollections(data.collections);
          setStats({ totalCollections: data.collections.length, totalCards: data.collections.reduce((a: number, c: any) => a + (c.cardCount || 0), 0) });
        }
        if (statsRes.ok) setUserStats(await statsRes.json());
      } catch (e) { console.error(e); }

      // Performance data
      setPerfLoading(true);
      try {
        const [hlRes, achRes, trRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/student/${user.uid}/highlights`),
          fetch(`http://127.0.0.1:8000/api/student/${user.uid}/achievements`),
          fetch(`http://127.0.0.1:8000/api/student/${user.uid}/test-results`),
        ]);
        if (hlRes.ok) setHighlights(await hlRes.json());
        if (achRes.ok) {
          const achData = await achRes.json();
          setAchievements(achData.achievements);
          setAchievementStats({ totalUnlocked: achData.totalUnlocked, totalAchievements: achData.totalAchievements });
        }
        if (trRes.ok) {
          const trData = await trRes.json();
          const combined = [
            ...trData.results,
            ...trData.missionResults,
          ].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
          setTestResults(combined);
        }
      } catch (e) { console.error("Performance fetch error:", e); }
      setPerfLoading(false);
    };
    fetchAll();
  }, [user]);

  if (loading) return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto space-y-12 animate-pulse">
      <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      <div className="grid grid-cols-3 gap-6"><div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl" /><div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl" /><div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl" /></div>
    </div>
  );

  if (userStats.role === "parent") return <ParentDashboard user={user} userStats={userStats} />;

  const copyReferralCode = () => { if (userStats.referralCode) { navigator.clipboard.writeText(userStats.referralCode); toast.success("Referral code copied!"); } };
  const displayedResults = showAllTests ? testResults : testResults.slice(0, 6);

  return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto space-y-12">

      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, <span className="text-gradient">{user?.displayName || "Scholar"}</span>! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">Here's your full academic picture today.</p>
          {userStats.referralCode && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm font-bold text-slate-500">Parent Link Code:</span>
              <div onClick={copyReferralCode} className="cursor-pointer flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 font-mono font-bold rounded-lg hover:bg-brand-100 transition-colors" title="Click to copy">
                {userStats.referralCode}<FaCopy className="text-xs" />
              </div>
            </div>
          )}
        </div>
        <div className="glass-card p-6 min-w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white text-xs font-black">Lvl {userStats.level}</div>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Scholar Progression</span>
            </div>
            <span className="text-xs font-bold text-brand-500">{userStats.xp % 100}/100 XP</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all duration-1000 ease-out" style={{ width: `${userStats.xp % 100}%` }} />
          </div>
        </div>
      </header>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard icon={<FaFolder className="text-brand-500" />} label="Collections" value={stats.totalCollections} />
          <StatCard icon={<FaBolt className="text-yellow-500" />} label="Total XP" value={userStats.xp} />
          <StatCard icon={<FaFire className="text-orange-500" />} label="Study Streak" value={`${userStats.streak} Days`} />
        </div>
        <div className="glass-card p-8 flex flex-col justify-between bg-gradient-to-br from-brand-500 to-accent-600 text-white overflow-hidden relative border-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="z-10">
            <h3 className="text-xl font-bold mb-2">Ready for a challenge?</h3>
            <p className="text-white/80 text-sm font-medium mb-6">Generate new flashcards from your documents instantly.</p>
          </div>
          <ModernButton variant="glass" className="w-full bg-white text-brand-600 hover:bg-brand-50" onClick={() => router.push("/flashcard")} icon={<FaPlus />}>
            Create New Set
          </ModernButton>
        </div>
      </div>

      {/* ── Student Highlights ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-brand-500">insights</span>
            Student Highlights
          </h2>
          {highlights && (
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${getAccuracyColor(highlights.overallScore)}`}>
              Overall Score: {highlights.overallScore}%
            </span>
          )}
        </div>

        {perfLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl" />)}
          </div>
        ) : highlights ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Overall Score */}
            <div className="glass-card p-6 flex flex-col items-center text-center dark:bg-slate-900 dark:border-slate-800">
              <div className="relative w-20 h-20 mb-3">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray={`${highlights.overallScore} ${100 - highlights.overallScore}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-slate-800 dark:text-white">{highlights.overallScore}%</span>
              </div>
              <p className="text-sm font-black text-slate-800 dark:text-white">Overall Performance</p>
              <p className="text-xs text-slate-400 mt-1">Missions + Quizzes</p>
            </div>

            {/* Missions */}
            <div className="glass-card p-6 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-emerald-500">task_alt</span>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Daily Missions</span>
              </div>
              <p className="text-3xl font-black text-slate-800 dark:text-white mb-1">{highlights.missions.completed}<span className="text-base font-bold text-slate-400">/{highlights.missions.total}</span></p>
              <p className="text-xs text-slate-400 font-bold">Avg Score: <span className="text-emerald-500">{highlights.missions.averageScore}%</span></p>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${highlights.missions.total > 0 ? (highlights.missions.completed / highlights.missions.total) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Quizzes */}
            <div className="glass-card p-6 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-indigo-500">quiz</span>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Quiz Performance</span>
              </div>
              <p className="text-3xl font-black text-slate-800 dark:text-white mb-1">{highlights.quizzes.avgAccuracy}%</p>
              <p className="text-xs text-slate-400 font-bold">{highlights.quizzes.totalAttempts} quiz{highlights.quizzes.totalAttempts !== 1 ? "zes" : ""} completed</p>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${highlights.quizzes.avgAccuracy}%` }} />
              </div>
            </div>

            {/* Recent activity */}
            <div className="glass-card p-6 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-amber-500">history</span>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Recent Activity</span>
              </div>
              <div className="space-y-2">
                {highlights.missions.recent.length > 0 ? highlights.missions.recent.slice(0, 3).map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-bold truncate max-w-[120px]">{m.task}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${getAccuracyColor(m.score)}`}>{m.score}%</span>
                  </div>
                )) : <p className="text-xs text-slate-400 italic">No missions completed yet</p>}
              </div>
            </div>
          </div>
        ) : null}

        {/* Topic breakdown */}
        {highlights && highlights.quizzes.topicBreakdown.length > 0 && (
          <div className="mt-6 glass-card p-6 dark:bg-slate-900 dark:border-slate-800">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <span className="w-2 h-0.5 bg-indigo-500" /> Quiz Topic Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {highlights.quizzes.topicBreakdown.map((tb, i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-[10px] font-black text-slate-500 uppercase truncate mb-2">{tb.topic}</p>
                  <p className={`text-lg font-black ${tb.avgAccuracy >= 80 ? 'text-emerald-600' : tb.avgAccuracy >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{tb.avgAccuracy}%</p>
                  <p className="text-[9px] text-slate-400 font-bold">{tb.attempts} attempt{tb.attempts !== 1 ? "s" : ""}</p>
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-2">
                    <div className={`h-full rounded-full ${tb.avgAccuracy >= 80 ? 'bg-emerald-500' : tb.avgAccuracy >= 60 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${tb.avgAccuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Achievements ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500">emoji_events</span>
            Achievements
          </h2>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            {achievementStats.totalUnlocked} / {achievementStats.totalAchievements} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`relative p-4 rounded-2xl border transition-all flex flex-col items-center text-center group ${
                ach.unlocked
                  ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  : "bg-slate-50 dark:bg-slate-900/50 border-dashed border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
              }`}
            >
              {ach.unlocked && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[10px]">check</span>
                </span>
              )}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${ach.unlocked ? (COLOR_MAP[ach.color] || "text-slate-500 bg-slate-100") : "text-slate-400 bg-slate-100 dark:bg-slate-800"}`}>
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{ach.icon}</span>
              </div>
              <p className={`text-xs font-black leading-tight mb-1 ${ach.unlocked ? "text-slate-800 dark:text-white" : "text-slate-500"}`}>{ach.title}</p>
              <p className="text-[9px] text-slate-400 leading-snug">{ach.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Test Results ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-500">checklist</span>
            Test Results
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("quiz")} className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "quiz" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"}`}>Quizzes</button>
            <button onClick={() => setActiveTab("mission")} className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "mission" ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"}`}>Missions</button>
          </div>
        </div>

        {perfLoading ? (
          <div className="space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}</div>
        ) : (() => {
          const filtered = displayedResults.filter(r => activeTab === "quiz" ? r.source === "quiz" : r.source === "mission");
          return filtered.length > 0 ? (
            <div className="glass-card dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Topic</th>
                      <th className="text-center p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Score</th>
                      <th className="text-center p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Accuracy</th>
                      <th className="text-center p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Performance</th>
                      <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id} className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/10'}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${r.source === "quiz" ? "bg-indigo-400" : "bg-emerald-400"}`} />
                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{r.topic}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-black text-slate-800 dark:text-white">{r.score}</span>
                          <span className="text-slate-400">/{r.total}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${getAccuracyColor(r.accuracy)}`}>{r.accuracy}%</span>
                        </td>
                        <td className="p-4">
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[100px] mx-auto">
                            <div className={`h-full rounded-full transition-all duration-700 ${r.accuracy >= 80 ? "bg-emerald-500" : r.accuracy >= 60 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${r.accuracy}%` }} />
                          </div>
                        </td>
                        <td className="p-4 text-right text-xs text-slate-400 font-bold">
                          {r.timestamp ? new Date(r.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {testResults.filter(r => activeTab === "quiz" ? r.source === "quiz" : r.source === "mission").length > 6 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button onClick={() => setShowAllTests(p => !p)} className="text-xs font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest">
                    {showAllTests ? "Show Less" : `View All ${testResults.length} Results`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-12 text-center dark:bg-slate-900 dark:border-slate-800">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">assignment</span>
              <p className="font-bold text-slate-500">No {activeTab === "quiz" ? "quiz" : "mission"} results yet.</p>
              <p className="text-sm text-slate-400 mt-1">Complete a {activeTab === "quiz" ? "quiz" : "daily mission"} to see your results here.</p>
            </div>
          );
        })()}
      </section>

      {/* ── Recent Collections ── */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Recent Collections</h2>
          <button onClick={() => router.push("/collections")} className="text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline">View All</button>
        </div>
        {collections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.slice(0, 3).map((col) => (
              <div key={col.id} className="interactive-glass p-6 group dark:bg-slate-900 dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-4 transition-colors group-hover:bg-indigo-500 group-hover:text-white">
                  <FaRegLightbulb className="text-xl" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{col.name || "Untitled Collection"}</h3>
                <p className="text-slate-400 dark:text-slate-400 text-sm font-medium">{col.cardCount || 0} Cards</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center dark:bg-slate-900 dark:border-slate-800">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-950 rounded-3xl rotate-3 flex items-center justify-center mx-auto mb-6 shadow-sm">
              <FaFolder className="text-3xl text-indigo-400 -rotate-3" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-100 mb-2">No collections yet</h3>
            <p className="text-slate-400 font-medium mb-8">Your saved flashcards will appear here.</p>
            <ModernButton onClick={() => router.push("/flashcard")}>Generate Your First Set</ModernButton>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="glass-card p-6 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-3">{icon}</div>
      <p className="text-2xl font-display font-black text-slate-800 dark:text-white">{value}</p>
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}
