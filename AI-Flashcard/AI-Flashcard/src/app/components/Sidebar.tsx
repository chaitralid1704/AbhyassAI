"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FaHome, 
  FaPlus, 
  FaFolder, 
  FaSignOutAlt, 
  FaBolt,
  FaCog,
  FaProjectDiagram,
  FaMap,
  FaChalkboardTeacher
} from "react-icons/fa";
import { auth } from "@/app/firebase/config.js";
import { signOut } from "firebase/auth";

import ThemeToggle from "./ThemeToggle";

import { useAuthState } from "react-firebase-hooks/auth";
import { useState, useEffect } from "react";

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: FaHome },
  { name: "Generate", href: "/flashcard", icon: FaPlus },
  { name: "Collections", href: "/collections", icon: FaFolder },
  { name: "Visualizer", href: "/visualizer", icon: FaBolt },
  { name: "My Learning", href: "/my-learning", icon: FaMap },
  { name: "AI Tutor", href: "/ai-tutor", icon: FaChalkboardTeacher },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user] = useAuthState(auth);
  const [role, setRole] = useState("student");

  useEffect(() => {
    if (user?.uid) {
      // Force cache bypassing
      fetch(`http://127.0.0.1:8000/api/user/${user.uid}/stats`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => setRole(data.role || "student"))
        .catch((err) => console.error("Error fetching stats:", err));
    }
  }, [user, pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const visibleMenuItems = menuItems.filter(item => {
    if (String(role).toLowerCase().trim() === "parent" && ["Generate", "Collections", "Visualizer", "My Learning", "AI Tutor"].includes(item.name)) {
      return false;
    }
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 flex flex-col border-r border-slate-200 dark:border-slate-800 z-50 transition-colors duration-300">
      {/* Logo Section */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <FaBolt className="text-white text-xl" />
        </div>
        <span className="font-display font-bold text-xl text-slate-900 dark:text-slate-100 tracking-tight leading-none">
          ABHYAS AI
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 mt-4 space-y-2">
        {visibleMenuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group \${
                isActive 
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium" 
                  : "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Icon className={`text-lg \${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <ThemeToggle variant="sidebar" />
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group"
        >
          <FaCog className="text-lg text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors group"
        >
          <FaSignOutAlt className="text-lg text-slate-400 group-hover:text-red-500 dark:group-hover:text-red-400" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
