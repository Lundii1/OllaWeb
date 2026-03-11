"use client";

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
    <div className="flex flex-col gap-2 h-full">
      <span className="text-retro-amber text-sm">[JOB POSTING]</span>

      <textarea
        value={jobPosting}
        onChange={(e) => onJobPostingChange(e.target.value)}
        placeholder="Paste job posting here..."
        className="flex-1 retro-sunken bg-retro-bg text-retro-green p-2 resize-none font-retro text-sm min-h-[8rem]"
        style={{
          fontFamily: 'var(--font-retro), "Courier New", monospace',
          outline: 'none',
        }}
      />

      {tailorError && (
        <div className="text-retro-red text-xs mt-1 mb-1">
          [ERROR] {tailorError}
        </div>
      )}

      <button
        type="button"
        onClick={onTailor}
        disabled={disabled || isTailoring || !jobPosting.trim()}
        className="retro-raised bg-retro-panel text-retro-green px-3 py-1.5 hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40 disabled:cursor-not-allowed text-sm"
      >
        {isTailoring ? '[TAILORING...]' : '[TAILOR RESUME]'}
      </button>
    </div>
  );
}
