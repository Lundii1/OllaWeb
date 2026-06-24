"use client";

import { FileText, Loader2, AlertCircle, ExternalLink } from "lucide-react";

interface PDFPreviewProps {
  pdfUrl: string | null;
  isCompiling: boolean;
  error: string | null;
}

export function PDFPreview({ pdfUrl, isCompiling, error }: PDFPreviewProps) {
  return (
    <div className="bg-[#1a1a1a]/50 border border-[#333] rounded-xl h-full flex flex-col overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-[#212121] border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-2">
           <FileText size={16} className="text-blue-400" />
           <span className="text-sm font-semibold">Live Preview</span>
        </div>
        
        {isCompiling && (
          <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
             <Loader2 size={14} className="animate-spin" />
             <span>Compiling...</span>
          </div>
        )}
      </div>

      <div className="flex-1 relative bg-black/20">
        {error ? (
          <div className="p-6 flex flex-col gap-4">
             <div className="flex items-center gap-2 text-red-400 font-semibold">
                <AlertCircle size={20} />
                <span>Compilation Error</span>
             </div>
             <pre className="text-xs text-red-300/80 bg-red-400/10 p-4 rounded-lg border border-red-400/20 whitespace-pre-wrap font-mono uppercase tracking-tight">
                {error}
             </pre>
             
             {error.includes('not installed') && (
               <div className="mt-2 text-muted-foreground text-xs bg-[#212121] p-4 rounded-lg border border-[#333]">
                 <p className="text-blue-400 font-bold mb-2 uppercase tracking-wider">Installation Guide:</p>
                 <ul className="space-y-1.5 opacity-80">
                   <li><span className="font-bold">Windows:</span> Install MiKTeX from <span className="text-white underline">miktex.org</span></li>
                   <li><span className="font-bold">macOS:</span> <code className="bg-black/40 px-1 rounded">brew install --cask mactex</code></li>
                   <li><span className="font-bold">Linux:</span> <code className="bg-black/40 px-1 rounded">sudo apt install texlive-full</code></li>
                 </ul>
               </div>
             )}
          </div>
        ) : pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full border-0"
            title="Resume PDF Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
             <div className="w-16 h-16 rounded-full bg-[#212121] flex items-center justify-center border border-[#333]">
                <FileText size={32} className="opacity-20" />
             </div>
             <div className="text-center">
                <p className="font-semibold text-foreground">No Preview Available</p>
                <p className="text-xs max-w-[200px] mt-1">Compile your LaTeX code to see the live PDF preview here.</p>
             </div>
          </div>
        )}
      </div>
      
      {pdfUrl && !error && (
        <div className="px-4 py-2 bg-[#212121]/80 border-t border-[#333] flex justify-end">
           <a 
             href={pdfUrl} 
             target="_blank" 
             rel="noopener noreferrer" 
             className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
           >
              Open in new tab <ExternalLink size={10} />
           </a>
        </div>
      )}
    </div>
  );
}

