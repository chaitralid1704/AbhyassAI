"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface MermaidRendererProps {
  code: string;
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      fontFamily: "var(--font-inter), sans-serif",
    });
  }, []);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code || !containerRef.current) return;
      
      try {
        setError(null);
        // Generate a random ID for the diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        setSvg(svg);
      } catch (err) {
        console.error("Mermaid Render Error:", err);
        setError("Failed to render diagram. Please check the generated code.");
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
        {error}
        <pre className="mt-2 p-3 bg-red-100/50 rounded-lg overflow-auto text-xs font-mono">
          {code}
        </pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center overflow-auto bg-white/50 backdrop-blur-sm rounded-2xl p-4 min-h-[400px]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default MermaidRenderer;
