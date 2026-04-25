"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FaReact, FaSun, FaMoon, FaDesktop } from "react-icons/fa"; // Importing basic icons, we'll replace FaReact with something if needed

export default function ThemeToggle({ className = "", variant = "icon" }: { className?: string, variant?: "icon" | "sidebar" }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === "sidebar") {
        return <div className={`w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse mb-2 ${className}`} />;
    }
    return <div className={`w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse ${className}`} />;
  }

  if (variant === "sidebar") {
    return (
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group mb-1 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-5 h-5">
             <FaSun className="absolute w-[18px] h-[18px] transition-all scale-100 rotate-0 dark:scale-0 dark:-rotate-90 text-slate-400 group-hover:text-indigo-500" />
             <FaMoon className="absolute w-[18px] h-[18px] transition-all scale-0 rotate-90 dark:scale-100 dark:rotate-0 text-slate-400 dark:group-hover:text-indigo-400" />
          </div>
          <span>Theme</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900">
          {theme === 'dark' ? 'Dark' : 'Light'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors shadow-sm outline-none ${className}`}
      aria-label="Toggle Dark Mode"
    >
      <FaSun className="absolute w-5 h-5 transition-all scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
      <FaMoon className="absolute w-5 h-5 transition-all scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
    </button>
  );
}
