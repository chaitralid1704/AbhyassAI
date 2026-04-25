const fs = require('fs');
const file = 'e:/Project/AI-Flashcard/AI-Flashcard/AI-Flashcard/src/app/flashcard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
  'import { useRouter } from "next/navigation";\n\nconst inter = Inter({ subsets: ["latin"] });',
  'import { useRouter } from "next/navigation";\nimport { ModernButton } from "../components/ModernUI";\nimport Flashcard from "../components/Flashcard";\nimport toast from "react-hot-toast";\n\nconst inter = Inter({ subsets: ["latin"] });'
);

// 2. handleSaveFlashcards alerts
content = content.replace(
  'alert("Please login first");',
  'toast.error("Please login first");'
);
content = content.replace(
  'alert("Please select a collection");',
  'toast.error("Please select a collection");'
);
content = content.replace(
  'alert("No flashcards to save.");',
  'toast.error("No flashcards to save.");'
);
content = content.replace(
  'alert("Flashcard set saved as new document!");',
  'toast.success("Flashcard set saved!");'
);
content = content.replace(
  'alert("Error saving flashcards");',
  'toast.error("Error saving flashcards");'
);

// 3. The Return JSX block
const splitToken = '  return (\n    <div\n      className={`min-h-screen flex flex-col items-center justify-center text-white bg-big ${inter.className}`}\n    >';
const parts = content.split(splitToken);

if (parts.length === 2) {
  const newJsx = `  return (
    <div
      className={\`min-h-screen pt-24 pb-12 flex flex-col items-center justify-start \${inter.className}\`}
    >
      <div className="w-full max-w-3xl p-8 glass-card border-[rgba(255,255,255,0.2)] dark:bg-slate-900/60 mx-auto mt-8 relative z-10">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-display font-extrabold tracking-tight text-slate-900 leading-tight mb-2">
              ABHYAS AI Flashcard Generator ⚡
            </h1>
            <p className="text-slate-500 font-medium">Turn any text or image into interactive flashcards instantly.</p>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-500 rounded-2xl mb-6 font-medium text-sm border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="mb-8 space-y-6">
          {/* TEXT INPUT */}
          <div>
              <label className="block text-sm font-bold text-slate-700 ml-1 mb-2">Source Text</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your text here, or upload a document below..."
                className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium text-slate-700 placeholder:text-slate-400 min-h-[120px]"
              />
          </div>

          {/* FILE INPUT (PDF + IMAGE) */}
          <div className="p-4 glass-card border-dashed border-2 border-slate-200 hover:border-brand-300 transition-colors">
            <label className="block text-sm font-bold text-slate-700 ml-1 mb-2">Or Upload Context File (.pdf, image)</label>
            <input
              type="file"
              accept=".pdf, image/*"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-500
            file:mr-4 file:py-3 file:px-6
            file:rounded-xl file:border-0
            file:text-sm file:font-semibold
            file:bg-brand-50 file:text-brand-600
            hover:file:bg-brand-100 cursor-pointer transition-all"
            />
          </div>

          {/* BUTTONS */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <ModernButton
              type="submit"
              loading={loading}
              className="flex-1 py-4"
            >
               <span className="flex items-center justify-center gap-2">
                   {loading ? loadingMessage || "Generating..." : "Generate Flashcards"}
               </span>
            </ModernButton>

            <ModernButton
              type="button"
              variant="outline"
              onClick={handleGenerateDiagram}
              disabled={diagramLoading || !inputText}
            >
              <span className="flex items-center justify-center gap-2">
                {diagramLoading ? <FaSpinner className="animate-spin" /> : <FaProjectDiagram />} {diagramLoading ? "Mapping..." : "Diagram"}
              </span>
            </ModernButton>
            
            <ModernButton
              type="button"
              variant="secondary"
              onClick={handleSaveFlashcards}
              disabled={flashcards.length === 0}
            >
               <span className="flex items-center justify-center gap-2">
                <FaSave /> Save
              </span>
            </ModernButton>
          </div>

          {/* COLLECTION SELECTOR */}
          <div className="pt-2 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 ml-1 mb-2">
                  Save To Collection
                </label>
                <select
                  value={selectedCollection || ""}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium text-slate-700"
                >
                  <option value="">
                    -- Select Collection --
                  </option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
            </div>
            
            {/* Start Quiz */}
            <div className="flex items-end">
              {selectedCollection ? (
                <ModernButton
                  type="button"
                  variant="glass"
                  onClick={() => router.push(\`/quiz?collectionId=\${selectedCollection}\`)}
                >
                    <span className="flex items-center justify-center gap-2 text-brand-600 font-bold py-1">
                       <FaGamepad className="text-lg" /> Start AI Quiz
                    </span>
                </ModernButton>
              ) : null}
            </div>
          </div>
        </form>

        {/* FLASHCARDS SECTION */}
        <div className="mt-12 flex flex-col items-center relative min-h-[450px]">
          {flashcards.length > 0 && (
            <div className="w-full max-w-md bg-slate-100 rounded-full h-2 mb-8 overflow-hidden">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: \`\${((currentPage + 1) / flashcards.length) * 100}%\`,
                }}
              />
            </div>
          )}

          {flashcards.length > 0 && (
            <Flashcard 
                key={currentPage}
                question={flashcards[currentPage].question}
                answer={flashcards[currentPage].answer}
                onSpeak={handleSpeak}
            />
          )}

          {/* CONTROLS */}
          {flashcards.length > 0 && (
              <div className="flex items-center justify-between w-full max-w-md mt-8">
                <ModernButton
                  variant="outline"
                  size="sm"
                  onClick={handlePrevClick}
                  disabled={currentPage === 0}
                >
                   <FaChevronLeft /> Prev
                </ModernButton>

                <span className="text-slate-500 font-bold tracking-widest text-sm uppercase">
                  {currentPage + 1} / {flashcards.length}
                </span>

                <ModernButton
                  variant="outline"
                  size="sm"
                  onClick={handleNextClick}
                  disabled={currentPage === flashcards.length - 1}
                >
                  Next <FaChevronRight />
                </ModernButton>
              </div>
          )}

          {/* CONFETTI */}
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50">
                <Confetti
                  width={typeof window !== "undefined" ? window.innerWidth : 1000}
                  height={typeof window !== "undefined" ? window.innerHeight : 1000}
                  recycle={false}
                />
            </div>
          )}

          {/* EMPTY STATE */}
          {flashcards.length === 0 && (
            <div className="flex flex-col items-center justify-center absolute inset-0 text-slate-400 mt-10">
               <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                  <FaProjectDiagram className="text-3xl text-brand-400" />
               </div>
               <p className="font-bold text-slate-800 text-lg mb-2">Ready to convert knowledge to cards</p>
               <p className="text-slate-500 font-medium text-sm text-center">Paste your notes or extract text from a document<br/> to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;

  fs.writeFileSync(file, parts[0] + newJsx);
  console.log('Successfully updated file.');
} else {
  console.log('Split token not found or multiple found!');
}
