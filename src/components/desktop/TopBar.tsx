/**
 * TopBar - Professional top bar with brain status and controls
 * Height: 48px
 */

import React from 'react';
import {
  Brain,
  Zap,
  RotateCcw,
  Maximize2,
  Minimize2,
  HelpCircle,
  ExternalLink,
  Settings,
  Bell,
  User,
  ChevronDown,
} from 'lucide-react';
import type { ProviderStatus } from '../../types/dotbrain';

interface TopBarProps {
  brainStatus: 'active' | 'idle' | 'processing' | 'error';
  activeAgentCount: number;
  totalAgentCount: number;
  providerStatus: ProviderStatus;
  onAutoLayout: () => void;
  onCenterView: () => void;
  onToggleFullscreen: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  isFullscreen: boolean;
  currentView: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  brainStatus,
  activeAgentCount,
  totalAgentCount,
  providerStatus,
  onAutoLayout,
  onCenterView,
  onToggleFullscreen,
  onOpenHelp,
  onOpenSettings,
  isFullscreen,
  currentView,
}) => {
  const getBrainStatusConfig = () => {
    switch (brainStatus) {
      case 'active':
        return { color: 'var(--dot-success)', label: 'Actif', pulse: true };
      case 'processing':
        return { color: 'var(--dot-accent)', label: 'Traitement', pulse: true };
      case 'error':
        return { color: 'var(--dot-error)', label: 'Erreur', pulse: false };
      default:
        return { color: 'var(--dot-text-dim)', label: 'Inactif', pulse: false };
    }
  };

  const statusConfig = getBrainStatusConfig();

  const viewLabels: Record<string, string> = {
    overview: 'Vue d\'ensemble',
    network: 'Réseau d\'agents',
    missions: 'Missions',
    library: 'Bibliothèque d\'agents',
    training: 'Laboratoire',
    models: 'Modèles',
    memory: 'Mémoire partagée',
    tools: 'Outils & MCP',
    activity: 'Journaux d\'activité',
    settings: 'Paramètres',
  };

  return (
    <header className="top-bar fixed top-0 left-0 right-0 z-40 h-[48px] flex items-center justify-between px-4 border-b border-[var(--dot-border)] bg-[var(--dot-bg-elevated)]/80 backdrop-blur-sm">
      {/* Left: Title & Brain Status */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--dot-accent)] to-#c05a2e flex items-center justify-center shadow-[0_0_16px_rgba(232,121,73,0.4)]">
              <Brain className="w-5 h-5 text-white" />
            </div>
            {/* Brain status indicator */}
            <div
              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--dot-bg)]"
              style={{ backgroundColor: statusConfig.color }}
            >
              {statusConfig.pulse && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ backgroundColor: statusConfig.color }} />
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-[var(--dot-text-primary)] text-sm truncate">Dot Brain</h1>
            <p className="text-[10px] text-[var(--dot-text-muted)] truncate">
              {viewLabels[currentView] || currentView} · {activeAgentCount}/{totalAgentCount} agents
            </p>
          </div>
        </div>

        {/* Brain Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--dot-bg)] border border-[var(--dot-border)]"
          style={{ borderColor: statusConfig.color }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusConfig.color }}
          />
          <span className="text-[11px] font-medium" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Center: View Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAutoLayout}
          className="dot-btn-ghost rounded-lg p-2 transition-colors"
          title="Disposition automatique (A)"
          aria-label="Disposition automatique"
        >
          <Zap className="w-4.5 h-4.5" />
        </button>
        <button
          type="button"
          onClick={onCenterView}
          className="dot-btn-ghost rounded-lg p-2 transition-colors"
          title="Centrer la vue (C)"
          aria-label="Centrer la vue"
        >
          <RotateCcw className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Right: Provider Status & User Actions */}
      <div className="flex items-center gap-2">
        {/* Provider Status */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--dot-bg)] border border-[var(--dot-border)]"
          style={{ borderColor: providerStatus.available ? 'var(--dot-success)' : 'var(--dot-text-dim)' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: providerStatus.available ? 'var(--dot-success)' : 'var(--dot-text-dim)' }}
          />
          <span className="text-[11px] text-[var(--dot-text-secondary)]">
            {providerStatus.available ? providerStatus.name : 'Non connecté'}
          </span>
          {providerStatus.latencyMs && providerStatus.available && (
            <span className="text-[10px] text-[var(--dot-text-dim)] font-mono">{providerStatus.latencyMs}ms</span>
          )}
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="dot-btn-ghost rounded-lg p-2 relative"
          aria-label="Notifications"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--dot-error)] text-[9px] font-bold flex items-center justify-center">3</span>
        </button>

        {/* Help */}
        <button
          type="button"
          onClick={onOpenHelp}
          className="dot-btn-ghost rounded-lg p-2"
          aria-label="Aide et raccourcis"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="dot-btn-ghost rounded-lg p-2"
          aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        >
          {isFullscreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--dot-sidebar-hover)] transition-colors"
            aria-label="Menu utilisateur"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--dot-accent)] to-#c05a2e flex items-center justify-center text-white font-medium text-sm">
              NO
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--dot-text-muted)]" />
          </button>
          {/* Dropdown would go here */}
        </div>
      </div>
    </header>
  );
};

export default TopBar;