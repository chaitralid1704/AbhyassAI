"use client";

import React from "react";
import { FaSpinner } from "react-icons/fa";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "glass";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const ModernButton = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 hover:shadow-brand-500/40",
    secondary: "bg-accent-500 text-white shadow-lg shadow-accent-500/30 hover:bg-accent-600 hover:shadow-accent-500/40",
    outline: "bg-transparent border-2 border-slate-200 text-slate-600 hover:border-brand-500 hover:text-brand-500",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
    danger: "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600",
    glass: "glass-card hover:bg-white/60 text-slate-700",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? <FaSpinner className="animate-spin text-lg" /> : icon}
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const ModernInput = ({
  label,
  error,
  icon,
  className = "",
  ...props
}: InputProps) => {
  return (
    <div className="w-full space-y-2">
      {label && <label className="block text-sm font-bold text-slate-700 ml-1">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
            icon ? "pl-11" : ""
          } ${error ? "border-red-500 focus:ring-red-500/10" : ""} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs font-bold text-red-500 ml-1 mt-1">{error}</p>}
    </div>
  );
};
