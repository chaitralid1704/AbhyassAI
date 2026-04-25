"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaDownload, FaExpand, FaSync } from "react-icons/fa";
import MermaidRenderer from "../components/MermaidRenderer";
import { ModernButton } from "../components/ModernUI";

export default function VisualizerPage() {
  const router = useRouter();
  const [diagramCode, setDiagramCode] = useState<string | null>(null);
  const [showDiagram, setShowDiagram] = useState(false);

  useEffect(() => {
    const savedCode = localStorage.getItem("pending_diagram");
    if (savedCode) {
      setDiagramCode(savedCode);
    } else {
      router.push("/flashcard");
    }
  }, [router]);

  const handleDownload = () => {
    const svgElement = document.querySelector("svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width * 2; // Higher resolution
      canvas.height = img.height * 2;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "abhyas-diagram.png";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (!diagramCode) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors p-8 sm:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors mb-4"
            >
              <FaArrowLeft size={14} /> Back to Generator
            </button>
            <h1 className="text-4xl font-display font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Generated <span className="text-gradient">Diagram</span> 🕸️
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
              Visualizing your study material for better mental mapping.
            </p>
          </div>

          <div className="flex items-center gap-3">
             <ModernButton 
                variant="glass" 
                icon={<FaSync />}
                onClick={() => router.push("/flashcard")}
             >
                Regenerate
             </ModernButton>
             <ModernButton 
                icon={<FaDownload />}
                onClick={handleDownload}
                disabled={!showDiagram}
             >
                Download PNG
             </ModernButton>
          </div>
        </div>

        {/* Main Content */}
        <div className="glass-card p-1 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
          {!showDiagram ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <div className="w-24 h-24 bg-brand-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <FaExpand className="text-3xl text-brand-500 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Your Diagram is Ready</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 font-medium">
                We&apos;ve converted your text into a visual flowchart. Click below to reveal the mental map.
              </p>
              <ModernButton 
                className="px-12 py-4 text-lg"
                onClick={() => setShowDiagram(true)}
              >
                View Diagram
              </ModernButton>
            </div>
          ) : (
            <div className="relative animate-in fade-in zoom-in duration-500">
               <div className="absolute top-4 right-4 flex gap-2 z-10">
                  <button 
                    className="p-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 transition-all"
                    title="Fullscreen"
                    onClick={() => document.querySelector(".mermaid-container")?.requestFullscreen()}
                  >
                    <FaExpand size={16} />
                  </button>
               </div>
               <div className="mermaid-container bg-white dark:bg-slate-800 rounded-2xl p-4">
                  <MermaidRenderer code={diagramCode} />
               </div>
            </div>
          )}
        </div>

        {/* Pro Tip */}
        <div className="mt-8 p-6 bg-brand-50/50 dark:bg-indigo-500/10 border border-brand-100 dark:border-indigo-500/20 rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500 dark:bg-indigo-500 text-white flex items-center justify-center flex-shrink-0 animate-bounce">
                <span className="font-bold">💡</span>
            </div>
            <div>
                <h4 className="font-bold text-brand-900 dark:text-indigo-300 text-lg">Pro Tip: Mental Mapping</h4>
                <p className="text-brand-700 dark:text-indigo-200/80 font-medium">
                   Visual diagrams help in encoding information spatially. Try following the flow from top to bottom while recalling the definitions from your flashcards!
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
