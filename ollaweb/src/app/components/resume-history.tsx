"use client";

import { useRef, useEffect } from "react";
import type { ResumeVersion } from "../../lib/resume-types";

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
  if (mins < 1) return "just now";
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
  isOpen,
  onToggle,
  onSelect,
  onDelete,
}: ResumeHistoryProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="retro-raised bg-retro-surface px-2 py-0.5 text-retro-green text-sm cursor-pointer hover:bg-retro-panel"
      >
        HISTORY
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-retro-surface retro-raised z-30">
          <div className="retro-titlebar flex items-center justify-between px-2 py-0.5">
            <span className="text-sm tracking-wider">Resume History</span>
            <button
              onClick={onToggle}
              className="retro-raised bg-retro-surface px-1 text-sm cursor-pointer"
            >
              X
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto retro-sunken m-1">
            {versions.length === 0 ? (
              <div className="p-3 text-retro-border-light text-sm text-center">
                No saved versions yet
              </div>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className={`flex items-start justify-between p-2 cursor-pointer border-b border-retro-border hover:bg-retro-panel ${
                    version.id === currentVersionId
                      ? "bg-retro-panel text-retro-green"
                      : "bg-retro-bg text-retro-text"
                  }`}
                >
                  <div
                    className="flex-1 min-w-0 mr-2"
                    onClick={() => onSelect(version.id)}
                  >
                    <div className="text-sm truncate">{version.title}</div>
                    <div className="text-xs text-retro-border-light mt-0.5">
                      {formatTime(version.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(version.id);
                    }}
                    className="retro-raised bg-retro-surface px-1 text-retro-red text-xs cursor-pointer hover:bg-retro-red hover:text-retro-text-bright flex-shrink-0"
                  >
                    X
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
