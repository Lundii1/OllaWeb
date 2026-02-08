"use client";

interface PDFPreviewProps {
  pdfUrl: string | null;
  isCompiling: boolean;
  error: string | null;
}

export function PDFPreview({ pdfUrl, isCompiling, error }: PDFPreviewProps) {
  return (
    <div className="retro-sunken bg-retro-bg h-full flex flex-col">
      <div className="px-3 py-1.5 bg-retro-surface retro-raised text-retro-amber text-sm flex items-center justify-between">
        <span>[PREVIEW]</span>
        {isCompiling && (
          <span className="text-retro-cyan retro-blink">COMPILING...</span>
        )}
      </div>

      <div className="flex-1 relative">
        {error ? (
          <div className="p-4">
            <p className="text-retro-red text-sm whitespace-pre-wrap">{error}</p>
            {error.includes('not installed') && (
              <div className="mt-3 text-retro-border-light text-xs">
                <p className="text-retro-amber mb-1">To install pdflatex:</p>
                <p>• Windows: Install <span className="text-retro-cyan">MiKTeX</span> from miktex.org</p>
                <p>• macOS: <span className="text-retro-cyan">brew install --cask mactex</span></p>
                <p>• Linux: <span className="text-retro-cyan">sudo apt install texlive-full</span></p>
              </div>
            )}
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Resume PDF Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-retro-border-light">
            <div className="text-center">
              <p className="text-2xl mb-2">{'<NO PREVIEW>'}</p>
              <p className="text-sm">Click [COMPILE] to preview your resume</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
