"use client";

import { AVAILABLE_MODELS, DEFAULT_COUNCIL_MODELS } from '../../lib/types';
import type { ChatMode } from '../../lib/types';

interface CouncilSelectorProps {
  chatMode: ChatMode;
  showModeToggle?: boolean;
  onModeChange: (mode: ChatMode) => void;
  singleModel: string;
  onSingleModelChange: (model: string) => void;
  councilModels: [string, string, string];
  onCouncilModelsChange: (models: [string, string, string]) => void;
  moderatorIndex: number;
  onModeratorIndexChange: (index: number) => void;
  debateEnabled: boolean;
  onDebateEnabledChange: (enabled: boolean) => void;
}

export function CouncilSelector({
  chatMode,
  showModeToggle = true,
  onModeChange,
  singleModel,
  onSingleModelChange,
  councilModels,
  onCouncilModelsChange,
  moderatorIndex,
  onModeratorIndexChange,
  debateEnabled,
  onDebateEnabledChange,
}: CouncilSelectorProps) {
  const hasDuplicates = new Set(councilModels).size !== councilModels.length;

  const isDefault =
    councilModels[0] === DEFAULT_COUNCIL_MODELS[0] &&
    councilModels[1] === DEFAULT_COUNCIL_MODELS[1] &&
    councilModels[2] === DEFAULT_COUNCIL_MODELS[2] &&
    moderatorIndex === 0;

  const handleModelChange = (index: number, value: string) => {
    const updated: [string, string, string] = [...councilModels];
    updated[index] = value;
    onCouncilModelsChange(updated);
  };

  const handleReset = () => {
    onCouncilModelsChange([...DEFAULT_COUNCIL_MODELS]);
    onModeratorIndexChange(0);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        {/* Mode toggle */}
        {showModeToggle && (
          <div className="flex bg-[#212121] rounded-lg p-0.5 border border-[#333] shadow-sm">
            <button
              onClick={() => onModeChange('single')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                chatMode === 'single'
                  ? 'bg-[#333] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#2f2f2f]'
              }`}
            >
              Single AI
            </button>
            <button
              onClick={() => onModeChange('council')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                chatMode === 'council'
                  ? 'bg-[#333] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#2f2f2f]'
              }`}
            >
              Council
            </button>
          </div>
        )}

        {/* Single model selector */}
        {chatMode === 'single' && (
          <select
            value={singleModel}
            onChange={(e) => onSingleModelChange(e.target.value)}
            className="px-2 py-1 text-xs bg-[#212121] border border-[#333] rounded-md text-foreground focus:ring-1 focus:ring-white/20 outline-none"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}

        {/* Council controls */}
        {chatMode === 'council' && (
          <>
            {!isDefault && (
              <button
                type="button"
                onClick={handleReset}
                title="Reset to default models"
                className="px-2 py-1 bg-[#212121] border border-[#333] rounded-md text-xs font-medium text-orange-400 hover:bg-[#2f2f2f] transition-colors"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => onDebateEnabledChange(!debateEnabled)}
              title={debateEnabled ? "Debate round enabled — models will challenge each other before synthesis" : "Enable debate round"}
              className={`px-2 py-1 border rounded-md text-xs font-medium transition-colors ${
                debateEnabled
                  ? 'bg-blue-600/20 border-blue-600/30 text-blue-400'
                  : 'bg-[#212121] border-[#333] text-muted-foreground hover:bg-[#2f2f2f] hover:text-foreground'
              }`}
            >
              Debate
            </button>
          </>
        )}
      </div>

      {/* Council model pickers */}
      {chatMode === 'council' && (
        <div className="flex flex-col gap-2 bg-[#212121]/50 border border-[#333] rounded-lg p-3 mt-1 shadow-sm">
          {councilModels.map((selectedModel, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium w-16 shrink-0">
                Node {index + 1}:
              </span>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(index, e.target.value)}
                className="flex-1 px-2 py-1 bg-[#2f2f2f] border border-[#444] rounded-md text-foreground focus:ring-1 focus:ring-white/20 outline-none"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer shrink-0 hover:text-foreground transition-colors group">
                <input
                  type="radio"
                  name="moderator"
                  className="accent-white cursor-pointer"
                  checked={moderatorIndex === index}
                  onChange={() => onModeratorIndexChange(index)}
                />
                <span className="font-medium">MOD</span>
              </label>
            </div>
          ))}
          {hasDuplicates && (
            <p className="text-orange-400 text-xs mt-1 font-medium bg-orange-400/10 px-2 py-1 rounded-md border border-orange-400/20">
              Warning: Duplicate models selected
            </p>
          )}
        </div>
      )}
    </div>
  );
}




