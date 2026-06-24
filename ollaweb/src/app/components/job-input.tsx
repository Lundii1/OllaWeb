"use client";

import { Wand2, AlertCircle } from "lucide-react";

interface JobInputProps {
  jobPosting: string;
  onJobPostingChange: (value: string) => void;
  onTailor: () => void;
  isTailoring: boolean;
  disabled: boolean;
  tailorError?: string | null;
}

export function JobInput({
  jobPosting,
  onJobPostingChange,
  onTailor,
  isTailoring,
  disabled,
  tailorError,
}: JobInputProps) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 px-1 text-muted-foreground">
        <Wand2 size={16} />
        <span className="text-xs font-semibold uppercase tracking-wider">Job Posting</span>
      </div>

      <textarea
        value={jobPosting}
        onChange={(e) => onJobPostingChange(e.target.value)}
        placeholder="Paste the job description here to tailor your resume..."
        className="flex-1 bg-[#1a1a1a]/50 border border-[#333] rounded-lg p-3 text-sm focus:ring-1 focus:ring-white/20 outline-none resize-none placeholder:text-muted-foreground/50 transition-all focus:bg-[#212121]"
      />

      {tailorError && (
        <div className="flex items-start gap-2 text-red-400 text-xs bg-red-400/5 p-2 rounded-md border border-red-400/20">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{tailorError}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onTailor}
        disabled={disabled || isTailoring || !jobPosting.trim()}
        className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 rounded-lg text-sm font-semibold hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {isTailoring ? (
          <>
            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            Tailoring...
          </>
        ) : (
          <>
            <Wand2 size={16} />
            Tailor Resume
          </>
        )}
      </button>
    </div>
  );
}

