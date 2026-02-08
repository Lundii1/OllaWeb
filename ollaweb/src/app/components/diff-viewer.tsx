"use client";

import { useMemo } from 'react';
import * as Diff from 'diff';

interface DiffViewerProps {
  originalText: string;
  modifiedText: string;
  onAccept: () => void;
  onReject: () => void;
}

export function DiffViewer({ originalText, modifiedText, onAccept, onReject }: DiffViewerProps) {
  const { changes, addedCount, removedCount } = useMemo(() => {
    const changes = Diff.diffLines(originalText, modifiedText);
    let added = 0;
    let removed = 0;
    for (const part of changes) {
      // Count actual lines (strip trailing newline to avoid phantom empty line)
      const lines = part.value.replace(/\n$/, '').split('\n');
      if (part.added) added += lines.length;
      if (part.removed) removed += lines.length;
    }
    return { changes, addedCount: added, removedCount: removed };
  }, [originalText, modifiedText]);

  let lineNum = 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-retro-surface retro-raised px-3 py-1.5 flex items-center gap-2 shrink-0">
        <span className="text-retro-cyan text-sm font-bold">[DIFF REVIEW]</span>
        <span className="text-retro-green text-xs">+{addedCount}</span>
        <span className="text-retro-red text-xs">-{removedCount}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onAccept}
          className="retro-raised bg-retro-panel text-retro-green px-3 py-0.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright"
        >
          [ACCEPT]
        </button>
        <button
          type="button"
          onClick={onReject}
          className="retro-raised bg-retro-panel text-retro-red px-3 py-0.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright"
        >
          [REJECT]
        </button>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto retro-sunken bg-retro-bg">
        <pre className="text-sm leading-relaxed m-0" style={{ fontFamily: '"Courier New", monospace', fontSize: '14px' }}>
          {changes.map((part, i) => {
            const lines = part.value.replace(/\n$/, '').split('\n');
            return lines.map((line, j) => {
              lineNum++;
              const bgClass = part.added
                ? 'diff-added'
                : part.removed
                  ? 'diff-removed'
                  : '';
              const textClass = part.added
                ? 'text-retro-green'
                : part.removed
                  ? 'text-retro-red'
                  : 'text-retro-text';
              const prefix = part.added ? '+' : part.removed ? '-' : ' ';

              return (
                <div key={`${i}-${j}`} className={`${bgClass} px-2 min-h-[1.5em]`}>
                  <span className="text-retro-border-light inline-block w-12 text-right mr-3 select-none opacity-50">
                    {lineNum}
                  </span>
                  <span className={`${textClass} select-none mr-1 font-bold`}>{prefix}</span>
                  <span className={textClass}>{line}</span>
                </div>
              );
            });
          })}
        </pre>
      </div>
    </div>
  );
}
