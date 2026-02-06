"use client";

import { AVAILABLE_MODELS, DEFAULT_COUNCIL_MODELS } from '../../lib/types';
import type { ChatMode } from '../../lib/types';

interface CouncilSelectorProps {
  chatMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  singleModel: string;
  onSingleModelChange: (model: string) => void;
  councilModels: [string, string, string];
  onCouncilModelsChange: (models: [string, string, string]) => void;
  moderatorIndex: number;
  onModeratorIndexChange: (index: number) => void;
}

export function CouncilSelector({
  chatMode,
  onModeChange,
  singleModel,
  onSingleModelChange,
  councilModels,
  onCouncilModelsChange,
  moderatorIndex,
  onModeratorIndexChange,
}: CouncilSelectorProps) {
  const isPreset =
    councilModels[0] === DEFAULT_COUNCIL_MODELS[0] &&
    councilModels[1] === DEFAULT_COUNCIL_MODELS[1] &&
    councilModels[2] === DEFAULT_COUNCIL_MODELS[2];

  const hasDuplicates =
    new Set(councilModels).size !== councilModels.length;

  const handlePresetChange = (value: string) => {
    if (value === 'default') {
      onCouncilModelsChange([...DEFAULT_COUNCIL_MODELS]);
      onModeratorIndexChange(0);
    }
  };

  const handleModelChange = (index: number, value: string) => {
    const updated: [string, string, string] = [...councilModels];
    updated[index] = value;
    onCouncilModelsChange(updated);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Mode toggle */}
        <div className="flex overflow-hidden">
          <button
            onClick={() => onModeChange('single')}
            className={`px-3 py-1 transition-colors ${
              chatMode === 'single'
                ? 'retro-sunken bg-retro-panel text-retro-green'
                : 'retro-raised bg-retro-surface text-retro-text hover:text-retro-text-bright'
            }`}
          >
            Single AI
          </button>
          <button
            onClick={() => onModeChange('council')}
            className={`px-3 py-1 transition-colors ${
              chatMode === 'council'
                ? 'retro-sunken bg-retro-panel text-retro-green'
                : 'retro-raised bg-retro-surface text-retro-text hover:text-retro-text-bright'
            }`}
          >
            Council
          </button>
        </div>

        {/* Single model selector */}
        {chatMode === 'single' && (
          <select
            value={singleModel}
            onChange={(e) => onSingleModelChange(e.target.value)}
            className="px-2 py-1"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}

        {/* Council preset selector */}
        {chatMode === 'council' && (
          <select
            value={isPreset ? 'default' : 'custom'}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="px-2 py-1"
          >
            <option value="default">Default Preset</option>
            <option value="custom">Custom</option>
          </select>
        )}
      </div>

      {/* Council model pickers */}
      {chatMode === 'council' && (
        <div className="flex flex-col gap-1.5 bg-retro-bg retro-sunken p-2">
          {councilModels.map((selectedModel, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-retro-amber w-20 shrink-0">
                Node {index + 1}:
              </span>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(index, e.target.value)}
                className="flex-1 px-2 py-1"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-retro-text cursor-pointer shrink-0">
                <input
                  type="radio"
                  name="moderator"
                  checked={moderatorIndex === index}
                  onChange={() => onModeratorIndexChange(index)}
                />
                <span className="text-sm">MOD</span>
              </label>
            </div>
          ))}
          {hasDuplicates && (
            <p className="text-retro-amber mt-1">
              ! WARNING: Duplicate models selected
            </p>
          )}
        </div>
      )}
    </div>
  );
}
