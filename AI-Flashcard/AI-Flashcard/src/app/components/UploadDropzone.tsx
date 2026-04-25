"use client";

import React, { useRef, useState } from "react";
import { FaCloudUploadAlt, FaFilePdf, FaImage, FaTimes, FaCheckCircle } from "react-icons/fa";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  description?: string;
}

export default function UploadDropzone({
  onFileSelect,
  accept = ".pdf, image/*",
  label = "Upload Source Material",
  description = "Support for PDF documents and Images with OCR"
}: UploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      onFileSelect(droppedFile);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      onFileSelect(selectedFile);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">{label}</label>
      
      <div
        className={`relative group cursor-pointer h-48 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 ${
          dragActive 
            ? "border-brand-500 bg-brand-50/50" 
            : file 
              ? "border-green-500/50 bg-green-50/20" 
              : "border-slate-200 bg-slate-50/50 hover:border-brand-400 hover:bg-brand-50/30"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
        />

        {file ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-3">
              {file.type === "application/pdf" ? (
                <FaFilePdf className="text-3xl text-red-500" />
              ) : (
                <FaImage className="text-3xl text-blue-500" />
              )}
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-bold max-w-[200px] truncate">{file.name}</p>
              <p className="text-slate-400 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={clearFile}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white text-slate-400 hover:text-red-500 transition-colors shadow-sm"
            >
              <FaTimes />
            </button>
            <div className="absolute top-4 left-4 p-2 text-green-500 drop-shadow-sm">
                <FaCheckCircle className="text-xl" />
            </div>
          </div>
        ) : (
          <>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
              dragActive ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-500 group-hover:bg-brand-500 group-hover:text-white"
            }`}>
              <FaCloudUploadAlt className="text-3xl" />
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-bold">Click to upload or drag & drop</p>
              <p className="text-slate-400 text-xs mt-1">{description}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
