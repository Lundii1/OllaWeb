"use client";

import type { IndividualResponse, ConfidenceLevel } from '../../lib/types';
import { useState } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { Persona } from "./persona";
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

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Collapsible individual responses — hidden by default */}
      {individualResponses.length > 0 && (
        <div className="group border border-[#333] rounded-xl bg-[#212121]/50 overflow-hidden text-sm max-w-2xl shadow-sm">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="flex items-center gap-2 px-3 h-9 w-full flex-none text-left cursor-pointer hover:bg-[#2f2f2f]/50 transition-colors leading-none overflow-hidden"
          >
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium leading-none ${confidenceStyle.colorClass}`}>
              {confidenceStyle.icon}
              {confidenceStyle.label}
            </div>
            <span className="text-muted-foreground text-xs ml-auto flex items-center gap-1 leading-none">
              {individualResponses.filter(r => r.status === 'complete').length} of {individualResponses.length} Responses
              <ChevronDown size={14} className={`${detailsOpen ? "rotate-180" : ""} transition-transform duration-200`} />
            </span>
          </button>

          {detailsOpen && (
            <div className="p-3 border-t border-[#333] flex flex-col gap-3 bg-[#1a1a1a]/50">
            {individualResponses.map((response) => (
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
            ))}
          </div>
          )}
        </div>
      )}

      {/* Consensus Content */}
      <div className="flex gap-4 items-start">
         <div className="flex-shrink-0">
           <Persona state="speaking" variant="halo" className="size-10" />
         </div>
         <div className="flex-1 overflow-hidden pt-1">
            <div className="prose prose-invert max-w-none prose-p:leading-relaxed">
              {renderMessageContent(consensusText)}
            </div>
         </div>
      </div>
    </div>
  );
}
