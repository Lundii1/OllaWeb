"use client";

import type { Conversation } from "../../lib/types";
import { MessageSquare, Trash2 } from "lucide-react";

interface ChatHistoryProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  isOpen: boolean; // Managed by parent now, but keeping prop signature
  onToggle: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
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

export function ChatHistory({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
}: ChatHistoryProps) {
  
  // Group conversations by time for neat display
  const today = conversations.filter(c => Date.now() - c.updatedAt < 86400000);
  const older = conversations.filter(c => Date.now() - c.updatedAt >= 86400000);

  return (
    <div className="flex flex-col gap-4 text-sm mt-2">
      {conversations.length === 0 ? (
        <div className="text-muted-foreground text-center py-4 px-2">
          No saved chats yet.
        </div>
      ) : (
        <>
           {today.length > 0 && (
             <div>
               <div className="text-xs font-semibold text-muted-foreground px-3 mb-2">Today</div>
               <div className="flex flex-col gap-1">
                 {today.map(convo => (
                    <HistoryItem 
                      key={convo.id} 
                      convo={convo} 
                      isActive={convo.id === currentConversationId}
                      onSelect={() => onSelect(convo.id)}
                      onDelete={(e) => { e.stopPropagation(); onDelete(convo.id); }}
                    />
                 ))}
               </div>
             </div>
           )}

           {older.length > 0 && (
             <div>
               <div className="text-xs font-semibold text-muted-foreground px-3 mb-2 mt-4">Previous 7 Days</div>
               <div className="flex flex-col gap-1">
                 {older.map(convo => (
                    <HistoryItem 
                      key={convo.id} 
                      convo={convo} 
                      isActive={convo.id === currentConversationId}
                      onSelect={() => onSelect(convo.id)}
                      onDelete={(e) => { e.stopPropagation(); onDelete(convo.id); }}
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

function HistoryItem({ convo, isActive, onSelect, onDelete }: { convo: Conversation, isActive: boolean, onSelect: () => void, onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
        isActive
          ? "bg-[#2f2f2f] text-foreground"
          : "text-muted-foreground hover:bg-[#2f2f2f]/60 hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden flex-1">
        <MessageSquare size={16} className="shrink-0" />
        <div className="truncate flex-1">
           {convo.title}
        </div>
      </div>
      
      <button
        onClick={onDelete}
        className={`shrink-0 p-1.5 rounded-md hover:bg-neutral-600/50 hover:text-red-400 text-muted-foreground transition-all ${
           isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        title="Delete chat"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

