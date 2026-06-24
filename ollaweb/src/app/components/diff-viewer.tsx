"use client";

import { useMemo } from 'react';
import * as Diff from 'diff';
import { Check, X, FileDiff, ArrowRight } from "lucide-react";

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
    <div className="flex flex-col h-full bg-[#0f0f0f] border border-[#333] rounded-xl overflow-hidden shadow-xl">
      {/* Toolbar */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
           <FileDiff size={18} className="text-blue-400" />
           <span className="text-sm font-semibold">Review Changes</span>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-bold text-green-400">
              +{addedCount} lines
           </div>
           <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-bold text-red-400">
              -{removedCount} lines
           </div>
        </div>

        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 bg-red-500/5 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/10 transition-all"
          >
            <X size={14} /> Revert
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-xs font-semibold hover:bg-neutral-200 transition-all shadow-sm"
          >
            <Check size={14} /> Accept
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <pre className="text-[13px] leading-6 m-0 p-4" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          {changes.map((part, i) => {
            const lines = part.value.replace(/\n$/, '').split('\n');
            return lines.map((line, j) => {
              lineNum++;
              const bgClass = part.added
                ? 'bg-green-500/10'
                : part.removed
                  ? 'bg-red-500/10'
                  : '';
              const textClass = part.added
                ? 'text-green-400'
                : part.removed
                  ? 'text-red-400'
                  : 'text-neutral-400';
              const prefix = part.added ? '+' : part.removed ? '-' : ' ';

              return (
                <div key={`${i}-${j}`} className={`${bgClass} flex items-start group`}>
                  <span className="text-neutral-600 inline-block w-12 text-right mr-4 select-none pr-1 border-r border-[#333]">
                    {lineNum}
                  </span>
                  <span className={`${textClass} select-none mr-3 font-bold w-4 flex-shrink-0`}>{prefix}</span>
                  <span className={`${textClass} break-all`}>{line}</span>
                </div>
              );
            });
          })}
        </pre>
      </div>
    </div>
  );
}

