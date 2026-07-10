"use client";

import type { IndividualResponse, ConfidenceLevel } from '../../lib/types';
import { useState } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Eye, EyeOff } from "lucide-react";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "../../components/ai/reasoning";

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { label: string; colorClass: string; icon: React.ReactNode }> = {
  strong:       { label: 'Strong Consensus',  colorClass: 'text-green-500 bg-green-500/10 border-green-500/20', icon: <CheckCircle2 size={14} className="text-green-500" /> },
  moderate:     { label: 'Moderate Consensus',colorClass: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: <CheckCircle2 size={14} className="text-blue-400" /> },
  mixed:        { label: 'Mixed Views',       colorClass: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', icon: <AlertTriangle size={14} className="text-yellow-500" /> },
  disagreement: { label: 'Advisors Disagree', colorClass: 'text-red-400 bg-red-400/10 border-red-400/20', icon: <XCircle size={14} className="text-red-400" /> },
  unknown:      { label: 'Analysis Complete', colorClass: 'text-muted-foreground bg-[#2f2f2f] border-[#444]', icon: <HelpCircle size={14} /> },
};

interface CouncilResponseProps {
  consensusText: string;
  individualResponses: IndividualResponse[];
  confidence?: ConfidenceLevel;
  renderMessageContent: (content: string) => React.ReactNode;
}

export function CouncilResponse({
  consensusText,
  individualResponses,
  confidence,
  renderMessageContent,
}: CouncilResponseProps) {
  const confidenceStyle = confidence ? CONFIDENCE_STYLES[confidence] : CONFIDENCE_STYLES.unknown;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hiddenNodes, setHiddenNodes] = useState<Set<number>>(new Set());

  const toggleNode = (index: number) => {
    setHiddenNodes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const completedCount = individualResponses.filter(r => r.status === 'complete').length;
  const visibleResponses = individualResponses.filter(r => !hiddenNodes.has(r.index));

  return (
    <div className="flex flex-col w-full gap-3">
      {/* Header toggle */}
      {individualResponses.length > 0 && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setDetailsOpen(open => !open)}
            aria-expanded={detailsOpen}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#252525] hover:bg-[#2f2f2f] border border-[#333] text-xs text-muted-foreground transition-colors whitespace-nowrap"
          >
            <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-xs font-medium leading-none ${confidenceStyle.colorClass}`}>
              {confidenceStyle.icon}
              {confidenceStyle.label}
            </span>
            <span className="text-[#666]">·</span>
            <span>{completedCount} of {individualResponses.length} Responses</span>
            <ChevronDown size={14} className={`${detailsOpen ? "rotate-180" : ""} transition-transform duration-200`} />
          </button>
        </div>
      )}

      {/* Consensus answer */}
      <div className="prose prose-invert max-w-none prose-p:leading-relaxed">
        {renderMessageContent(consensusText)}
      </div>

      {/* Individual response details */}
      {detailsOpen && (
        <div className="border border-[#333] rounded-xl bg-[#1a1a1a]/50 overflow-hidden text-sm">
          {/* Node visibility toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#333] bg-[#212121]/80">
            <span className="text-muted-foreground text-xs">Show nodes:</span>
            {individualResponses.map((response) => {
              const hidden = hiddenNodes.has(response.index);
              return (
                <button
                  key={response.index}
                  type="button"
                  onClick={() => toggleNode(response.index)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors whitespace-nowrap ${
                    hidden
                      ? 'text-muted-foreground bg-[#1a1a1a] border-[#333] hover:bg-[#252525]'
                      : 'text-foreground bg-[#2a2a2a] border-[#444] hover:bg-[#333]'
                  }`}
                  title={hidden ? 'Show this node' : 'Hide this node'}
                >
                  {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span>Node {response.index + 1}</span>
                </button>
              );
            })}
          </div>

          <div className="p-3 flex flex-col gap-3">
            {visibleResponses.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-2">All nodes hidden. Use the toggles above to show responses.</p>
            ) : (
              visibleResponses.map((response) => (
                <div key={response.index} className="flex flex-col border border-[#333] rounded-lg overflow-hidden bg-[#212121]">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] border-b border-[#333] font-medium text-xs">
                    <span className="text-muted-foreground">Node {response.index + 1}</span>
                    <span className="text-foreground">{response.model}</span>
                    {response.status === 'error' && (
                      <span className="ml-auto text-red-400 flex items-center gap-1">
                        <XCircle size={12} /> Failed
                      </span>
                    )}
                  </div>
                  <div className="p-3 bg-[#1e1e1e]">
                    {response.status === 'error' ? (
                      <div className="flex flex-col gap-1">
                        <p className="text-red-400 text-sm">{response.error || 'Failed to respond'}</p>
                        {response.errorAction && (
                          <p className="text-muted-foreground text-xs mt-1 bg-red-400/10 p-2 rounded border border-red-400/20">
                            {response.errorAction}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {response.reasoning && (
                          <Reasoning defaultOpen={false}>
                            <ReasoningTrigger>
                              <span className="text-xs">View Thinking Process</span>
                            </ReasoningTrigger>
                            <ReasoningContent>
                              {response.reasoning}
                            </ReasoningContent>
                          </Reasoning>
                        )}
                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
                          {renderMessageContent(response.text)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
