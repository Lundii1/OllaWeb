"use client";

import type { ResumeVersion } from "../../lib/resume-types";
import { History, Trash2, FileText, Clock } from "lucide-react";

interface ResumeHistoryProps {
  versions: ResumeVersion[];
  currentVersionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ResumeHistory({
  versions,
  currentVersionId,
  onSelect,
  onDelete,
}: ResumeHistoryProps) {
  
  // Group by date
  const today = versions.filter(v => Date.now() - v.createdAt < 86400000);
  const older = versions.filter(v => Date.now() - v.createdAt >= 86400000);

  return (
    <div className="flex flex-col gap-4 text-sm">
      {versions.length === 0 ? (
        <div className="text-muted-foreground text-center py-8 px-4 border border-dashed border-[#333] rounded-xl flex flex-col items-center gap-3">
          <History size={32} className="opacity-20" />
          <p>No saved versions yet.</p>
        </div>
      ) : (
        <>
          {today.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em] px-3 mb-2 flex items-center gap-2">
                <Clock size={10} />
                Today
              </div>
              <div className="flex flex-col gap-1">
                {today.map(version => (
                   <HistoryItem 
                     key={version.id} 
                     version={version} 
                     isActive={version.id === currentVersionId}
                     onSelect={() => onSelect(version.id)}
                     onDelete={(e) => { e.stopPropagation(); onDelete(version.id); }}
                   />
                ))}
              </div>
            </div>
          )}

          {older.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em] px-3 mb-2 mt-4 flex items-center gap-2">
                <Clock size={10} />
                Older
              </div>
              <div className="flex flex-col gap-1">
                {older.map(version => (
                   <HistoryItem 
                     key={version.id} 
                     version={version} 
                     isActive={version.id === currentVersionId}
                     onSelect={() => onSelect(version.id)}
                     onDelete={(e) => { e.stopPropagation(); onDelete(version.id); }}
                   />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HistoryItem({ version, isActive, onSelect, onDelete }: { version: ResumeVersion, isActive: boolean, onSelect: () => void, onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 border ${
        isActive
          ? "bg-[#2f2f2f] border-[#444] text-foreground shadow-sm"
          : "border-transparent text-muted-foreground hover:bg-[#2f2f2f]/40 hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden flex-1">
        <FileText size={16} className={isActive ? "text-blue-400" : "text-muted-foreground/50"} />
        <div className="flex flex-col min-w-0">
           <span className="truncate font-medium text-xs">{version.title}</span>
           <span className="text-[10px] opacity-50">{formatTime(version.createdAt)}</span>
        </div>
      </div>
      
      <button
        onClick={onDelete}
        className={`shrink-0 p-1.5 rounded-md hover:bg-neutral-600/50 hover:text-red-400 text-muted-foreground transition-all duration-200 ${
           isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        title="Delete version"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

