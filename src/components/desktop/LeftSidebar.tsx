/**
 * LeftSidebar - Professional navigation sidebar for Dot Brain
 * Width: 225px (collapsed: 56px)
 */

import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  GitBranch,
  FileText,
  Library,
  FlaskConical,
  Cpu,
  Database,
  Wrench,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  Brain,
  Zap,
  Search,
  Clock,
  HelpCircle,
} from 'lucide-react';
import type { SidebarState, SidebarItem } from '../../types/dotbrain';
import { TEAM_CONFIGS } from '../../types/dotbrain';
import { AGENT_TEAMS, getAgentCountByTeam } from '../../data/agents';
import { useTeamStats } from '../../hooks/useDotBrain';
import { LAYOUT } from '../../types/dotbrain';

interface LeftSidebarProps {
  sidebarState: SidebarState;
  onSetActiveView: (view: SidebarState['activeView']) => void;
  onToggleCollapse: () => void;
  onSetHoveredItem: (item: SidebarState['hoveredItem']) => void;
  providerStatus: { configured: boolean; available: boolean; name: string };
  activeAgentCount: number;
  totalAgentCount: number;
}

const NAV_ITEMS: SidebarItem[] = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: 'LayoutDashboard' },
  { id: 'network', label: 'Réseau d\'agents', icon: 'GitBranch' },
  { id: 'missions', label: 'Missions', icon: 'FileText' },
  { id: 'library', label: 'Bibliothèque d\'agents', icon: 'Library' },
  { id: 'training', label: 'Laboratoire', icon: 'FlaskConical' },
  { id: 'models', label: 'Modèles', icon: 'Cpu' },
  { id: 'memory', label: 'Mémoire partagée', icon: 'Database' },
  { id: 'tools', label: 'Outils & MCP', icon: 'Wrench' },
  { id: 'activity', label: 'Journaux d\'activité', icon: 'Activity' },
  { id: 'settings', label: 'Paramètres', icon: 'Settings' },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  GitBranch,
  FileText,
  Library,
  FlaskConical,
  Cpu,
  Database,
  Wrench,
  Activity,
  Settings,
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  sidebarState,
  onSetActiveView,
  onToggleCollapse,
  onSetHoveredItem,
  providerStatus,
  activeAgentCount,
  totalAgentCount,
}) => {
  const teamStats = useTeamStats();

  const totalActive = teamStats.reduce((sum, t) => sum + t.activeCount, 0);

  return (
    <aside
      className="dot-sidebar flex flex-col h-full transition-all duration-300 ease-out"
      style={{
        width: sidebarState.collapsed ? LAYOUT.sidebar.collapsedWidth : LAYOUT.sidebar.width,
        minWidth: sidebarState.collapsed ? LAYOUT.sidebar.collapsedWidth : LAYOUT.sidebar.width,
      }}
      onMouseEnter={() => onSetHoveredItem(null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-[var(--dot-border)]">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--dot-accent)] to-#c05a2e flex items-center justify-center shadow-[0_0_16px_rgba(232,121,73,0.4)]">
              <Brain className="w-5 h-5 text-white" />
            </div>
            {!sidebarState.collapsed && (
              <span className="absolute -right-6 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-bold text-[var(--dot-accent)] opacity-70">
                DOT BRAIN
              </span>
            )}
          </div>
          {!sidebarState.collapsed && (
            <span className="font-semibold text-[var(--dot-text-primary)] text-sm tracking-tight">
              Dot Brain
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="dot-btn-ghost rounded-lg p-1.5 transition-transform duration-200"
          style={{ transform: sidebarState.collapsed ? 'rotate(180deg)' : 'none' }}
          aria-label={sidebarState.collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
        >
          {sidebarState.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Provider Status Indicator */}
      {!sidebarState.collapsed && (
        <div className="px-3 py-2.5 border-b border-[var(--dot-border)]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${providerStatus.available ? 'bg-[var(--dot-success)]' : 'bg-[var(--dot-text-dim)]'}`} />
            <span className="text-xs text-[var(--dot-text-muted)] flex-1 truncate">
              {providerStatus.available ? `Connecté · ${providerStatus.name}` : 'Aucun modèle connecté'}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" role="navigation" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => {
          const isActive = sidebarState.activeView === item.id;
          const Icon = ICON_MAP[item.icon];

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSetActiveView(item.id)}
              onMouseEnter={() => !sidebarState.collapsed && onSetHoveredItem(item.id)}
              onMouseLeave={() => onSetHoveredItem(null)}
              className={`sidebar-item flex items-center gap-3 rounded-lg px-3 py-2.5 w-full transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--dot-sidebar-active)] text-[var(--dot-text-primary)]'
                  : 'text-[var(--dot-text-secondary)] hover:bg-[var(--dot-sidebar-hover)] hover:text-[var(--dot-text-primary)]'
              } relative`}
              style={{
                paddingLeft: sidebarState.collapsed ? '0' : undefined,
                justifyContent: sidebarState.collapsed ? 'center' : 'flex-start',
              }}
              aria-current={isActive ? 'page' : undefined}
              title={sidebarState.collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {!sidebarState.collapsed && (
                <span className="font-medium text-sm truncate">{item.label}</span>
              )}
              {isActive && !sidebarState.collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[var(--dot-accent)] rounded-r" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Team Quick Stats */}
      {!sidebarState.collapsed && (
        <div className="px-2 py-3 border-t border-[var(--dot-border)] space-y-2">
          <div className="px-3 text-xs font-semibold text-[var(--dot-text-dim)] uppercase tracking-wider">
            Équipes
          </div>
          {teamStats.map((team) => (
            <div key={team.id} className="px-3 py-2 rounded-lg hover:bg-[var(--dot-sidebar-hover)] transition-colors cursor-default">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="text-xs font-medium text-[var(--dot-text-secondary)]">{team.name}</span>
                </div>
                <span className="text-xs font-mono text-[var(--dot-text-muted)]">
                  {team.activeCount}/{team.agentCount}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-[var(--dot-border)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: team.agentCount > 0 ? `${(team.activeCount / team.agentCount) * 100}%` : '0%',
                    backgroundColor: team.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Stats */}
      <div className="p-3 border-t border-[var(--dot-border)] bg-[var(--dot-bg-elevated)]/50">
        {!sidebarState.collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--dot-text-muted)]">Agents disponibles</span>
              <span className="font-mono font-semibold text-[var(--dot-text-primary)]">{totalAgentCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--dot-text-muted)]">Actifs</span>
              <span className="font-mono font-semibold text-[var(--dot-success)]">{totalActive}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--dot-text-muted)]">État du Brain</span>
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--dot-accent)] animate-pulse" />
                <span className="font-medium text-[var(--dot-accent)]">Actif</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--dot-border)]">
              <span className="text-[var(--dot-text-dim)]">v1.0.0</span>
              <span className="text-[var(--dot-text-dim)]">NOVA</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-center">
              <div className="font-mono font-bold text-[var(--dot-text-primary)] text-lg">{totalAgentCount}</div>
              <div className="text-[10px] text-[var(--dot-text-dim)]">Agents</div>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--dot-accent)] animate-pulse" title="Brain Actif" />
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;