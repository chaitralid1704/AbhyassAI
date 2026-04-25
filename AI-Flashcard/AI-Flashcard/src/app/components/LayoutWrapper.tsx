"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/app/firebase/config.js";
import { useEffect, useState } from "react";
import { FaRobot, FaTimes } from "react-icons/fa";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, loading] = useAuthState(auth);
  const [isMounted, setIsMounted] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  const [role, setRole] = useState("student");
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (user?.uid) {
      fetch(`http://127.0.0.1:8000/api/user/${user.uid}/stats`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
           setRole(data.role || "student");
           setRoleLoaded(true);
        })
        .catch(() => setRoleLoaded(true));
    } else {
      setRoleLoaded(true);
    }
  }, [user, pathname]);

  if (!isMounted) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />;

  const isAuthOrLanding = pathname === "/" || pathname === "/auth";
  const showSidebar = !isAuthOrLanding && user && role !== "parent";
  
  if (user && !roleLoaded && !isAuthOrLanding) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />;
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden relative">
      {showSidebar && <Sidebar />}
      <main className={`flex-1 transition-all duration-300 ${showSidebar ? "pl-64" : ""}`}>
        {children}
      </main>

      {/* Chat FAB */}
      {showSidebar && (
        <button 
          onClick={() => setShowChatModal(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-brand-500 to-accent-600 text-white rounded-full shadow-2xl shadow-brand-500/30 flex items-center justify-center text-2xl hover:scale-110 hover:shadow-brand-500/50 transition-all z-40 group"
        >
          <FaRobot className="group-hover:animate-bounce" />
        </button>
      )}

      {/* Chat Modal Overlay */}
      {showChatModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in duration-200">
                <button 
                    onClick={() => setShowChatModal(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 rounded-full"
                >
                    <FaTimes />
                </button>
                <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-500/20 text-brand-500 rounded-2xl flex items-center justify-center text-3xl mb-6">
                    <FaRobot />
                </div>
                <h3 className="text-2xl font-display font-extrabold text-center text-slate-800 dark:text-white mb-2">Abhyas AI Tutor</h3>
                <p className="text-center font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    Abhyas AI Tutor is currently under development. Stay tuned for personalized 1-on-1 coaching!
                </p>
                <button 
                    onClick={() => setShowChatModal(false)} 
                    className="w-full bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold py-3 rounded-xl transition-all"
                >
                    Got it!
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
