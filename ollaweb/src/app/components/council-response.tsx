"use client";

import type { IndividualResponse } from '../../lib/types';

interface CouncilResponseProps {
  consensusText: string;
  individualResponses: IndividualResponse[];
  renderMessageContent: (content: string) => React.ReactNode;
}

export function CouncilResponse({
  consensusText,
  individualResponses,
  renderMessageContent,
}: CouncilResponseProps) {
  return (
    <div className="bg-retro-assistant-bg retro-raised max-w-[85%] border-l-4 border-retro-green">
      {/* Consensus header */}
      <div className="px-4 pt-3 pb-1">
        <span className="inline-block text-retro-green bg-retro-panel retro-raised px-2 py-0.5 text-sm">
          [COUNCIL CONSENSUS]
        </span>
      </div>

      {/* Consensus content */}
      <div className="px-4 pb-3">
        <div className="prose text-retro-text">
          {renderMessageContent(consensusText)}
        </div>
      </div>

      {/* Individual responses (collapsible) */}
      {individualResponses.length > 0 && (
        <details className="border-t border-retro-border">
          <summary className="px-4 py-2 text-retro-border-light cursor-pointer select-none">
            + Advisor Responses ({individualResponses.filter(r => r.status === 'complete').length}/{individualResponses.length})
          </summary>
          <div className="px-4 pb-3 space-y-2">
            {individualResponses.map((response) => (
              <details key={response.index} className="retro-sunken bg-retro-bg">
                <summary className="px-3 py-1.5 cursor-pointer select-none flex items-center gap-2">
                  <span className="text-retro-cyan">
                    Node {response.index + 1}
                  </span>
                  <span className="text-retro-border-light">({response.model})</span>
                  {response.status === 'error' && (
                    <span className="text-retro-red">[FAIL]</span>
                  )}
                </summary>
                <div className="px-3 pb-2">
                  {response.status === 'error' ? (
                    <p className="text-retro-red">{response.error || 'Failed to respond'}</p>
                  ) : (
                    <div className="prose prose-sm text-retro-text">
                      {renderMessageContent(response.text)}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
