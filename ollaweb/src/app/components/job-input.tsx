"use client";

interface JobInputProps {
  jobPosting: string;
  onJobPostingChange: (value: string) => void;
  onTailor: () => void;
  isTailoring: boolean;
  disabled: boolean;
}

export function JobInput({
  jobPosting,
  onJobPostingChange,
  onTailor,
  isTailoring,
  disabled,
}: JobInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-retro-amber text-sm">[JOB POSTING]</span>

      <textarea
        value={jobPosting}
        onChange={(e) => onJobPostingChange(e.target.value)}
        placeholder="Paste job posting here..."
        className="retro-sunken bg-retro-bg text-retro-green p-2 resize-none h-32 font-retro text-sm"
        style={{
          fontFamily: 'var(--font-retro), "Courier New", monospace',
          outline: 'none',
        }}
      />

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
