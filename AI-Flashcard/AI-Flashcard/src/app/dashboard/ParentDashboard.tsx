"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "@/app/firebase/config.js";
import { signOut } from "firebase/auth";
import { useTheme } from "next-themes";

interface ParentDashboardProps {
  user: any;
  userStats: any;
}

export default function ParentDashboard({ user, userStats }: ParentDashboardProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [redZones, setRedZones] = useState<any[]>([]);
  const [loadingRedZones, setLoadingRedZones] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "redzones">("overview");
  const [highlights, setHighlights] = useState<any | null>(null);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  
  const { theme, setTheme } = useTheme();

  const handleSimulateData = () => {
      setSelectedStudent((prev: any) => prev ? { ...prev, xp: 450, streak: 12, level: 3 } : prev);
      setRedZones([
          { topic: "Organic Chemistry: Mechanisms", averageScore: 35, suggestion: "Abhay is struggling with Reaction Mechanisms. Suggest a 15-minute video review on Nucleophilic Substitution." },
          { topic: "Trigonometry Basics", averageScore: 20, suggestion: "Consistent errors in defining relationships. Recommend starting with interactive triangle models." }
      ]);
      setActiveTab("redzones");
      toast.success("Simulation data injected! View the Red Zones tab.");
  };

  const fetchStudents = async () => {
    try {
      // Force no-cache so the browser always asks Python for live data
      const res = await fetch(`http://127.0.0.1:8000/api/parent/${user.uid}/students`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
        if (data.students.length > 0 && !selectedStudent) {
            setSelectedStudent(data.students[0]);
        }
        return data.students;
      }
      return [];
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchStudents();
    }
  }, [user]);

  useEffect(() => {
    if (selectedStudent?.id && user?.uid) {
      const fetchStudentData = async () => {
        setLoadingRedZones(true);
        setLoadingHighlights(true);
        setShowShareLink(false);
        try {
          const [rzRes, hlRes] = await Promise.all([
            fetch(`http://127.0.0.1:8000/api/parent/${user.uid}/student/${selectedStudent.id}/red-zones`, { cache: 'no-store' }),
            fetch(`http://127.0.0.1:8000/api/student/${selectedStudent.id}/highlights`, { cache: 'no-store' })
          ]);
          
          if (rzRes.ok) {
            const data = await rzRes.json();
            setRedZones(data.redZones || []);
          }
          if (hlRes.ok) {
            const data = await hlRes.json();
            setHighlights(data);
          }
        } catch (error) {
          console.error("Error fetching student data:", error);
        } finally {
          setLoadingRedZones(false);
          setLoadingHighlights(false);
        }
      };
      fetchStudentData();
    }
  }, [selectedStudent, user?.uid]);

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralCode.trim()) return;

    setIsLinking(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/link-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: user.uid, referralCode: referralCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully linked to \${data.studentName || "student"}!`);
        setReferralCode("");
        
        // Immediately inject the fallback to guarantee UI updates
        const dummyStudent = { 
            id: data.studentId, 
            name: data.studentName || "Student", 
            xp: 0, 
            level: 1, 
            streak: 0, 
            email: "Loading..." 
        };
        
        setStudents(prev => {
            if (!prev.find(s => s.id === data.studentId)) return [...prev, dummyStudent];
            return prev;
        });
        setSelectedStudent(dummyStudent);

        // Fetch fresh data in background to hydrate email/real xp
        const freshStudents = await fetchStudents();
        const newlyLinkedStudent = freshStudents.find((s: any) => s.id === data.studentId);
        if (newlyLinkedStudent) {
            setSelectedStudent(newlyLinkedStudent);
        }
      } else {
        toast.error(data.detail || "Failed to link student.");
      }
    } catch (error) {
      toast.error("An error occurred while linking.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 sm:p-12 max-w-7xl mx-auto space-y-12 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-200 dark:bg-slate-700 h-64 rounded-xl" />
            <div className="md:col-span-2 shadow h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background min-h-screen font-body relative">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r-0 bg-slate-50 dark:bg-slate-900 flex flex-col py-6 px-4 z-50">
        <div className="mb-10 px-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white shadow-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>auto_awesome</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-blue-800 dark:text-blue-200 leading-tight font-headline">Education AI</h1>
            <p className="text-xs text-slate-500 font-medium font-body">Parent Dashboard</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-brand-700 dark:text-brand-400 font-semibold border-r-4 border-brand-600 dark:border-brand-400 bg-brand-50/50 dark:bg-brand-900/20 transition-colors duration-200">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-headline text-sm font-medium">Dashboard</span>
          </button>
        </nav>
        
        <div className="mt-auto pt-6 space-y-1">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
              <span className="font-headline text-sm font-medium">Theme</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest bg-surface-container-high dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-headline text-sm font-medium">Settings</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-error hover:bg-error-container/20 transition-colors duration-200">
            <span className="material-symbols-outlined">logout</span>
            <span className="font-headline text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* TopAppBar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex justify-between items-center w-full px-8 py-4 ml-64 max-w-[calc(100%-16rem)] border-b border-slate-200/10 dark:border-slate-800/10 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-400 font-headline">The Cognitive Sanctuary</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full p-1.5 pl-3 transition-all">
            <span className="text-sm font-medium text-on-surface">{user?.displayName || "Parent Account"}</span>
            <span className="material-symbols-outlined text-blue-700">account_circle</span>
          </button>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="ml-64 p-8 min-h-[calc(100vh-72px)] bg-background">
        <div className="max-w-7xl mx-auto">
          {/* Welcoming Header */}
          <header className="mb-10">
            <h2 className="text-4xl font-bold text-on-surface mb-2 tracking-tight font-headline">Parent Dashboard</h2>
            <p className="text-lg text-on-surface-variant font-body">Monitor your students' progress and learning.</p>
          </header>

          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Registration & Linking */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              
              {/* Add Student Card */}
              <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-outline-variant/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-500 flex items-center justify-center">
                    <span className="material-symbols-outlined">person_add</span>
                  </div>
                  <h3 className="text-xl font-semibold text-on-surface font-headline">Add Student</h3>
                </div>
                <form onSubmit={handleLinkStudent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-1.5 font-body" htmlFor="referral-code">
                      Student Link Code
                    </label>
                    <div className="relative">
                      <input 
                        className="w-full bg-surface-container-highest dark:bg-slate-800 border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all font-mono" 
                        id="referral-code" 
                        placeholder="e.g. BRCWCY" 
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <p className="mt-2 text-xs text-outline leading-relaxed font-body">
                      The referral code can be found in the student's account settings under 'Linked Parents'.
                    </p>
                  </div>
                  <button type="submit" disabled={isLinking} className="w-full py-3 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-all shadow active:scale-[0.98]">
                    {isLinking ? "Linking..." : "Link Student"}
                  </button>
                </form>
              </section>

              {/* Linked Students Card */}
              <section className="bg-surface-container-lowest dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-outline-variant/10">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-on-surface font-headline">Linked Students</h3>
                  <span className="px-2.5 py-0.5 bg-surface-container-high dark:bg-slate-800 rounded-full text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    {students.length} Students
                  </span>
                </div>
                
                {students.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-outline mb-4">
                      <span className="material-symbols-outlined text-3xl">group_off</span>
                    </div>
                    <p className="text-on-surface font-medium mb-1 font-body">No students linked yet</p>
                    <p className="text-sm text-outline px-4 font-body">Link your first student above to start monitoring their academic progress.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                      {students.map((student) => (
                          <button
                              key={student.id}
                              onClick={() => setSelectedStudent(student)}
                              className={`w-full text-left px-4 py-3 rounded-lg transition-all font-medium flex items-center justify-between \${selectedStudent?.id === student.id ? 'bg-brand-50/80 dark:bg-brand-900/20 border-l-4 border-brand-500 text-slate-800 dark:text-slate-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                          >
                              <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-brand-500">face</span>
                                <span className="font-body">{student.name}</span>
                              </div>
                              <span className="text-xs bg-surface-container-high dark:bg-slate-800 px-2 py-1 rounded-md shadow-sm font-bold">Lvl {student.level}</span>
                          </button>
                      ))}
                  </div>
                )}
                
                <div className="mt-6 pt-6 border-t border-surface-container-high dark:border-slate-800">
                  <div className="bg-secondary-fixed/30 rounded-lg p-4 flex gap-3">
                    <span className="material-symbols-outlined text-secondary">lightbulb</span>
                    <p className="text-xs text-on-secondary-fixed-variant leading-relaxed font-body">
                      <span className="font-bold">Tip:</span> You can link multiple students to a single parent account for a consolidated view of all children.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Main Viewport */}
            <div className="col-span-12 lg:col-span-8">
              {!selectedStudent ? (
                <div className="h-full min-h-[500px] bg-surface-container-low/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-outline-variant/20 flex items-center justify-center p-12">
                  <div className="max-w-md w-full text-center">
                    <div className="relative inline-block mb-8">
                      <div className="absolute inset-0 bg-brand-500/10 blur-3xl rounded-full scale-150"></div>
                      <div className="relative w-32 h-32 bg-surface-container-lowest dark:bg-slate-800 rounded-full shadow-2xl flex items-center justify-center text-brand-500">
                        <span className="material-symbols-outlined text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-on-surface mb-3 font-headline">Select a Student</h3>
                    <p className="text-on-surface-variant mb-10 leading-relaxed font-body">
                        Pick a student from the sidebar or link a new one to view their learning metrics, AI-generated insights, and recent academic activity.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div className="p-4 bg-surface-container-lowest dark:bg-slate-800 rounded-xl shadow-sm">
                        <span className="material-symbols-outlined text-brand-500 mb-2">trending_up</span>
                        <h4 className="font-bold text-on-surface text-sm font-headline">Growth Tracking</h4>
                        <p className="text-xs text-outline font-body">Real-time performance analytics.</p>
                      </div>
                      <div className="p-4 bg-surface-container-lowest dark:bg-slate-800 rounded-xl shadow-sm">
                        <span className="material-symbols-outlined text-accent-500 mb-2">auto_fix_high</span>
                        <h4 className="font-bold text-on-surface text-sm font-headline">AI Suggestions</h4>
                        <p className="text-xs text-outline font-body">Personalized study paths.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                    {/* Active Student Hero Card */}
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl p-8 relative overflow-hidden shadow-premium">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
                        <h2 className="text-3xl font-headline font-black mb-1">{selectedStudent.name}</h2>
                        <p className="text-indigo-100 font-medium font-body">{selectedStudent.email}</p>
                        
                        <div className="mt-8 flex items-center gap-4">
                            <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2">
                                <span className="font-bold font-body">Level {selectedStudent.level}</span>
                            </div>
                            <div className="flex-1 bg-white/20 h-3 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-white transition-all duration-1000 ease-out" 
                                    style={{ width: `\${selectedStudent.xp % 100}%` }}
                                />
                            </div>
                            <span className="text-sm font-bold text-white/90 font-body">{selectedStudent.xp % 100}/100 XP</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="bg-surface-container-lowest dark:bg-slate-900 p-6 flex items-center gap-4 rounded-2xl shadow-sm border border-outline-variant/10 hover:scale-[1.02] transition-transform">
                            <div className="w-12 h-12 rounded-xl bg-tertiary-fixed text-tertiary flex items-center justify-center text-xl">
                                <span className="material-symbols-outlined">bolt</span>
                            </div>
                            <div>
                                <p className="text-3xl font-headline font-black text-on-surface">{selectedStudent.xp}</p>
                                <p className="text-outline text-xs font-bold uppercase tracking-widest mt-1">Total XP</p>
                            </div>
                        </div>
                        <div className="bg-surface-container-lowest dark:bg-slate-900 p-6 flex items-center gap-4 rounded-2xl shadow-sm border border-outline-variant/10 hover:scale-[1.02] transition-transform">
                            <div className="w-12 h-12 rounded-xl bg-error-container text-on-error-container flex items-center justify-center text-xl">
                                <span className="material-symbols-outlined">local_fire_department</span>
                            </div>
                            <div>
                                <p className="text-3xl font-headline font-black text-on-surface">{selectedStudent.streak}</p>
                                <p className="text-outline text-xs font-bold uppercase tracking-widest mt-1">Day Streak</p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 flex items-center gap-4 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/30">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl">
                                <span className="material-symbols-outlined">mail</span>
                            </div>
                            <div>
                                <p className="text-lg font-headline font-black text-emerald-700 dark:text-emerald-400">Active Alerts</p>
                                <p className="text-emerald-600/70 text-[9px] font-bold uppercase tracking-widest mt-1">Gmail Notifications Enabled</p>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Tab Selector */}
                    <div className="flex items-center gap-2 border-b border-surface-container-high dark:border-slate-800 pb-px mt-8">
                        <button 
                            onClick={() => setActiveTab("overview")}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === "overview" ? "border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/10 rounded-t-lg" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-t-lg"}`}
                        >
                            Overview & Stats
                        </button>
                        <button 
                            onClick={() => setActiveTab("redzones")}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === "redzones" ? "border-error text-error bg-error-container/20 rounded-t-lg" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-t-lg"}`}
                        >
                            Attention Required
                            {redZones.length > 0 && (
                                <span className="bg-error text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                                    {redZones.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Tab Navigation Content */}
                    <div className="mt-6">
                      {activeTab === "overview" && (
                          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                               {loadingHighlights ? (
                                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                       {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />)}
                                   </div>
                               ) : highlights ? (
                                   <>
                                       {/* Highlight Cards */}
                                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                           <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center">
                                               <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/20 text-brand-500 rounded-xl flex items-center justify-center mb-3">
                                                   <span className="material-symbols-outlined">trending_up</span>
                                               </div>
                                               <p className="text-2xl font-black text-slate-800 dark:text-white">{highlights.overallScore}%</p>
                                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Mastery Score</p>
                                           </div>
                                           <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center">
                                               <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-xl flex items-center justify-center mb-3">
                                                   <span className="material-symbols-outlined">quiz</span>
                                               </div>
                                               <p className="text-2xl font-black text-slate-800 dark:text-white">{highlights.quizzes.totalAttempts}</p>
                                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Quizzes Taken</p>
                                           </div>
                                           <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center">
                                               <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-xl flex items-center justify-center mb-3">
                                                   <span className="material-symbols-outlined">check_circle</span>
                                               </div>
                                               <p className="text-2xl font-black text-slate-800 dark:text-white">{highlights.missions.completed}</p>
                                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Missions Finished</p>
                                           </div>
                                       </div>

                                       {/* Topic Breakdown */}
                                       <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                           <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                               <span className="w-2 h-0.5 bg-brand-500" /> Topic Performance Analysis
                                           </h4>
                                           {highlights.quizzes.topicBreakdown.length > 0 ? (
                                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                   {highlights.quizzes.topicBreakdown.map((tb: any, i: number) => (
                                                       <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100/50 dark:border-slate-700/50">
                                                           <div className="flex justify-between items-center mb-2">
                                                               <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate pr-2">{tb.topic}</span>
                                                               <span className={`text-xs font-black ${tb.avgAccuracy >= 80 ? 'text-emerald-500' : tb.avgAccuracy >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                                                                   {tb.avgAccuracy}%
                                                               </span>
                                                           </div>
                                                           <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                               <div 
                                                                   className={`h-full rounded-full ${tb.avgAccuracy >= 80 ? 'bg-emerald-500' : tb.avgAccuracy >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                   style={{ width: `${tb.avgAccuracy}%` }}
                                                               />
                                                           </div>
                                                       </div>
                                                   ))}
                                               </div>
                                           ) : (
                                               <div className="py-12 text-center">
                                                   <p className="text-slate-400 italic">No topic data available yet.</p>
                                               </div>
                                           )}
                                       </div>
                                   </>
                               ) : (
                                   <div className="bg-surface-container-lowest dark:bg-slate-900 p-8 text-center border-dashed border-2 border-outline-variant/30 rounded-2xl">
                                      <span className="material-symbols-outlined text-4xl text-brand-500 mb-2">monitoring</span>
                                      <h3 className="text-xl font-bold font-headline mb-2">Comprehensive Analytics</h3>
                                      <p className="text-on-surface-variant font-medium">Monitoring {selectedStudent.name}'s behavioral learning curves. Real-time accuracy metrics will populate here as they complete more quizzes.</p>
                                  </div>
                               )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Notification Summary</h4>
                                      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                                          <div className="flex items-center gap-3">
                                              <span className="material-symbols-outlined text-emerald-500">notifications_active</span>
                                              <div>
                                                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Email Alerts</p>
                                                  <p className="text-[10px] text-slate-400">Sent to {user.email}</p>
                                              </div>
                                          </div>
                                          <span className="text-[10px] font-black text-emerald-500 uppercase">Active</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}

                      {activeTab === "redzones" && (
                         <div className="animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-xl text-on-surface flex items-center gap-2 font-headline">
                                <span className="material-symbols-outlined text-error">warning</span> Critical Learning Gaps
                            </h3>
                            {redZones.length > 0 && (
                                <button 
                                    onClick={() => setShowShareLink(!showShareLink)}
                                    className="text-sm font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">share</span> 
                                    {showShareLink ? "Hide Link" : "Share with Teacher"}
                                </button>
                            )}
                        </div>

                        {showShareLink && redZones.length > 0 && (
                            <div className="mb-6 p-4 bg-brand-500/10 w-full flex items-center justify-between rounded-xl border border-brand-500/20 shadow-sm animate-in slide-in-from-top-2">
                                <div>
                                    <p className="text-sm font-bold text-brand-700 dark:text-brand-300">Teacher Access Link</p>
                                    <p className="text-xs text-brand-600 dark:text-brand-400 font-mono mt-1">https://abhyas.ai/shared/report/{selectedStudent.id}</p>
                                </div>
                                <button onClick={() => {
                                    navigator.clipboard.writeText(`https://abhyas.ai/shared/report/${selectedStudent.id}`);
                                    toast.success("Copied to clipboard!");
                                }} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-600 transition-colors shadow-sm">
                                    Copy Link
                                </button>
                            </div>
                        )}

                        {loadingRedZones ? (
                            <div className="space-y-4">
                                {[...Array(2)].map((_, i) => (
                                    <div key={i} className="bg-slate-100 dark:bg-slate-800 p-6 h-32 animate-pulse rounded-2xl" />
                                ))}
                            </div>
                        ) : redZones.length === 0 ? (
                            <div className="bg-surface-container-lowest dark:bg-slate-900 p-12 text-center border-dashed border-2 border-outline-variant/30 rounded-2xl">
                                <span className="material-symbols-outlined text-5xl text-emerald-500 mb-4 block">verified</span>
                                <h3 className="text-xl font-bold font-headline mb-2 text-slate-700 dark:text-slate-200">All Clear!</h3>
                                <p className="text-on-surface-variant font-medium">No critical learning gaps detected for {selectedStudent.name} yet. Their mastery levels are within healthy ranges.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {redZones.map((zone, idx) => (
                                    <div key={idx} className="relative overflow-hidden bg-surface-container-lowest dark:bg-slate-900 p-6 rounded-2xl border border-error-container/30 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="absolute top-0 right-0 w-2 h-full bg-error/40 animate-pulse" />
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-error-container/20 text-error rounded-xl">
                                                    <span className="material-symbols-outlined">trending_down</span>
                                                </div>
                                                <h4 className="text-lg font-headline font-black text-on-surface">{zone.topic}</h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-black bg-error-container text-on-error-container px-3 py-1 rounded-full">
                                                    {zone.averageScore.toFixed(0)}% Accuracy
                                                </span>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Last 3 Attempts</p>
                                            </div>
                                        </div>
                                        <div className="bg-surface-container-low dark:bg-slate-800 p-5 rounded-2xl mt-4 border border-outline-variant/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined text-brand-500 text-sm">psychology</span> 
                                                <p className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                                                    AI Diagnostic Recommendation
                                                </p>
                                            </div>
                                            <p className="text-on-surface-variant font-medium leading-relaxed text-sm">
                                                {zone.suggestion || "Analyzing student error patterns... check back shortly for specific bridging exercises."}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                         </div>
                      )}
                    </div>
                </div>
              )}
            </div>
          </div>

          {/* Contextual Insight (Bottom Section) */}
          <footer className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2 bg-gradient-to-r from-brand-500/5 to-transparent p-6 rounded-2xl flex items-center gap-6 border-l-4 border-brand-500">
              <div className="hidden sm:block w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 grayscale">
                <img alt="Academic sanctuary" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhw2_3NQ5zU9Vn-RY60PpSYkCcCjGcDxJUkzfqmm4CNbctzPTkiHecTy4Ceu1MSfZekh4KvI1sCxPn6bxEBN3IgTY2izfaLSKqVWdsbUzvT_UNWfKO1q3mc3e7AV-eic5bH-jgV5Vwt2rLLEKlylE295xtQbO79FFXNb1nMPdL1GJZ4F7b8XEdA4C3fA-mEokILukMa6MwQ5rKzUmnIR7kR-WTxps4BlZpvuw4WY1QUGruFxDmdmkxCUENyxbbViSocdptzfcd_kg" />
              </div>
              <div>
                <h4 className="font-bold font-headline text-on-surface mb-1">Empowering the Future of Education</h4>
                <p className="text-sm font-body text-on-surface-variant leading-relaxed">Abhyas AI uses neural modeling to understand individual student learning gaps, providing parents with actionable data to support their child's unique journey.</p>
              </div>
            </div>
            <div className="bg-surface-container-highest/30 p-6 rounded-2xl flex flex-col justify-center border border-outline-variant/10">
              <div className="flex items-center gap-2 text-brand-500 font-bold mb-1 font-headline">
                <span className="material-symbols-outlined">verified_user</span>
                <span>Privacy Locked</span>
              </div>
              <p className="text-xs text-outline leading-tight font-body">Your data and student records are encrypted with enterprise-grade security protocols.</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
