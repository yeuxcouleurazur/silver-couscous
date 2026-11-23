/**
 * MissionBar - Bottom command bar for mission input
 * Height: 72px (expanded: 120px)
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  Send,
  Zap,
  Brain,
  Search,
  Paperclip,
  X,
  ChevronUp,
  ChevronDown,
  Mic,
  Loader2,
  HelpCircle,
  ExternalLink,
  FileText,
  Image,
  Code,
} from 'lucide-react';
import type { MissionBarState, MissionMode, Attachment } from '../../types/dotbrain';
import { MISSION_MODE_CONFIGS } from '../../types/dotbrain';

// Map icon name strings to actual Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Brain,
  Zap,
  Search,
};

interface MissionBarProps {
  barState: MissionBarState;
  onInputChange: (input: string) => void;
  onModeChange: (mode: MissionMode) => void;
  onSubmit: () => void;
  onAddAttachment: () => void;
  onRemoveAttachment: (id: string) => void;
  onToggleExpand: () => void;
  isProcessing: boolean;
}

export const MissionBar: React.FC<MissionBarProps> = ({
  barState,
  onInputChange,
  onModeChange,
  onSubmit,
  onAddAttachment,
  onRemoveAttachment,
  onToggleExpand,
  isProcessing,
}) => {
  const { input, mode, attachments, isExpanded, predictedAgents, isSubmitting } = barState;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showModeDetails, setShowModeDetails] = useState(false);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [onInputChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        onSubmit();
      }
    }
  };

  const currentModeConfig = MISSION_MODE_CONFIGS.find(m => m.mode === mode) || MISSION_MODE_CONFIGS[0];

  return (
    <div className="mission-bar flex flex-col border-t border-[var(--dot-border)] bg-[var(--dot-bg-elevated)]/80 backdrop-blur-sm transition-all duration-300"
      style={{ height: isExpanded ? '120px' : '72px' }}
    >
      {/* Main Input Row */}
      <div className="flex items-end h-[72px] px-4 gap-3">
        {/* Mode Selector */}
        <div className="relative flex items-center">
          <div className="flex items-center gap-1 bg-[var(--dot-bg)] rounded-lg border border-[var(--dot-border)] p-1">
            {MISSION_MODE_CONFIGS.map((m) => {
              const Icon = iconMap[m.icon];
              return (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => onModeChange(m.mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    mode === m.mode
                      ? 'bg-[var(--dot-accent)] text-white shadow-[0_0_8px_rgba(232,121,73,0.3)]'
                      : 'text-[var(--dot-text-secondary)] hover:bg-[var(--dot-sidebar-hover)] hover:text-[var(--dot-text-primary)]'
                  }`}
                  title={`${m.label} — ${m.description}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mode info tooltip */}
          {showModeDetails && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--dot-bg-elevated)] border border-[var(--dot-border)] rounded-lg shadow-lg text-[11px] whitespace-nowrap z-10">
              <div className="text-[var(--dot-text-primary)] font-medium">{currentModeConfig.label}</div>
              <div className="text-[var(--dot-text-muted)] mt-0.5">{currentModeConfig.description}</div>
              <div className="text-[var(--dot-accent)] mt-1">~{predictedAgents} agents · {currentModeConfig.estimatedTime(3)}</div>
            </div>
          )}
        </div>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isProcessing ? 'Mission en cours...' : 'Décrivez votre mission... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)'}
            disabled={isProcessing}
            className="w-full bg-[var(--dot-bg)] border border-[var(--dot-border)] rounded-lg px-4 py-3 text-[var(--dot-text-primary)] placeholder-[var(--dot-text-dim)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--dot-accent)] focus:border-transparent font-sans text-sm"
            style={{
              minHeight: '44px',
              maxHeight: '100px',
              lineHeight: '1.5',
            }}
            rows={1}
            aria-label="Mission input"
          />

          {/* Predicted agents indicator */}
          {input.trim() && predictedAgents > 0 && !isProcessing && (
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5 text-[10px] text-[var(--dot-text-muted)]">
              <Brain className="w-3.5 h-3.5 text-[var(--dot-accent)]" />
              <span>{predictedAgents} agents prédits</span>
            </div>
          )}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-1.5 px-2">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--dot-bg)] border border-[var(--dot-border)] rounded-lg">
                {att.type === 'image' ? (
                  <Image className="w-3.5 h-3.5" />
                ) : att.type === 'code' ? (
                  <Code className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span className="text-[11px] text-[var(--dot-text-secondary)] truncate max-w-[120px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="text-[var(--dot-text-dim)] hover:text-[var(--dot-error)] p-0.5"
                  aria-label="Supprimer la pièce jointe"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Attach button */}
          <button
            type="button"
            onClick={onAddAttachment}
            disabled={isProcessing}
            className="dot-btn-ghost rounded-lg p-2 transition-colors"
            aria-label="Ajouter une pièce jointe"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>

          {/* Voice input */}
          <button
            type="button"
            disabled={isProcessing}
            className="dot-btn-ghost rounded-lg p-2 transition-colors"
            aria-label="Saisie vocale"
          >
            <Mic className="w-4.5 h-4.5" />
          </button>

          {/* Expand/Collapse */}
          <button
            type="button"
            onClick={onToggleExpand}
            className="dot-btn-ghost rounded-lg p-2 transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
            aria-label={isExpanded ? 'Réduire' : 'Étendre'}
          >
            {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
          </button>

          {/* Submit */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!input.trim() || isProcessing}
            className="dot-btn-primary rounded-lg px-5 py-2.5 flex items-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Envoyer la mission"
          >
            {isProcessing || isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-medium text-sm">En cours...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="font-medium text-sm">Envoyer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Row - Attachments & Help */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-[var(--dot-border)] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-[var(--dot-text-muted)]">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>Entrée pour envoyer · Maj+Entrée nouvelle ligne · Mode: {currentModeConfig.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-[var(--dot-text-muted)] hover:text-[var(--dot-text-primary)] text-[11px] flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Raccourcis
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionBar;