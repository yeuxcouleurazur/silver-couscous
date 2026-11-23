import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PanelLeftClose, Pause, Play, Search, X } from 'lucide-react';
import type { Agent, AgentActionType, Group } from '../types/dotBrain';
import { getStatusVisual } from '../constants/dotVisuals';
import { getExecutingAgents, isAgentRunning } from '../engine/layoutEngine';

interface RunningAgentsPanelProps {
  isOpen: boolean;
  agents: Agent[];
  groups: Group[];
  selectedAgentId: string | null;
  isDemoMode: boolean;
  isSimulationRunning: boolean;
  isDark?: boolean;
  onClose: () => void;
  onSelectAgent: (agent: Agent) => void;
  onAgentAction: (agentId: string, actionType: AgentActionType) => void;
}

export function RunningAgentsPanel({
  isOpen,
  agents,
  groups,
  selectedAgentId,
  isDemoMode,
  isSimulationRunning,
  isDark = false,
  onClose,
  onSelectAgent,
  onAgentAction,
}: RunningAgentsPanelProps) {
  const [scope, setScope] = useState<'running' | 'all'>('running');
  const [query, setQuery] = useState('');

  const groupMap = useMemo(
    () => new Map(groups.map((g) => [g.id, g.name])),
    [groups]
  );

  const runningCount = useMemo(
    () => agents.filter(isAgentRunning).length,
    [agents]
  );

  const visibleAgents = useMemo(
    () =>
      getExecutingAgents(agents, groups, {
        onlyRunning: scope === 'running',
        query,
      }),
    [agents, groups, scope, query]
  );

  const microDotColor = isDark ? '#1F1F1D' : '#FAF9F5';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="running-agents-panel"
          data-testid="running-agents-panel"
          aria-label="Agents en exécution"
          initial={{ x: -32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -32, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 top-0 bottom-0 z-30 flex w-full max-w-[312px] flex-col border-r border-[#E5E3DC] bg-[#FAF9F5]/98 shadow-[12px_0_32px_-20px_rgba(28,27,25,0.14)] backdrop-blur-md dark:border-[#3B3B37] dark:bg-[#1F1F1D]/98 dark:shadow-[16px_0_40px_-20px_rgba(0,0,0,0.55)]"
        >
          {/* En-tête éditorial sobre */}
          <div className="flex items-start justify-between gap-3 border-b border-[#EAE8E1] px-5 py-4 dark:border-[#33332F]">
            <div className="min-w-0">
              <h2
                className="text-[16px] font-medium tracking-tight text-[#1C1B19] dark:text-[#ECEAE4]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Agents en exécution
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#6A6760] dark:text-[#A4A198]">
                <span className="font-mono tabular-nums font-medium text-[#1C1B19] dark:text-[#ECEAE4]">
                  {runningCount}
                </span>
                <span>actifs</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {agents.length} Dots
                </span>
              </p>
            </div>

            <button
              type="button"
              data-testid="close-running-panel-btn"
              onClick={onClose}
              aria-label="Refermer le panneau des agents en exécution"
              title="Refermer le panneau"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6A6760] transition-colors hover:bg-[#EAE8E1] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#A4A198] dark:hover:bg-[#343430] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] cursor-pointer"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Barre de portée (En exécution / Tous) et recherche discrète */}
          <div className="space-y-2.5 border-b border-[#EAE8E1] px-5 py-3 dark:border-[#33332F]">
            <div
              role="tablist"
              aria-label="Filtrer la liste des agents"
              className="grid grid-cols-2 gap-1 rounded-lg bg-[#EFECE5]/80 p-0.5 dark:bg-[#2A2A27]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'running'}
                onClick={() => setScope('running')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  scope === 'running'
                    ? 'bg-[#FFFFFF] text-[#1C1B19] shadow-2xs dark:bg-[#383834] dark:text-[#ECEAE4]'
                    : 'text-[#6A6760] hover:text-[#1C1B19] dark:text-[#9C9990] dark:hover:text-[#ECEAE4]'
                }`}
              >
                En exécution{' '}
                <span className="font-mono tabular-nums opacity-75">
                  ({runningCount})
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'all'}
                onClick={() => setScope('all')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  scope === 'all'
                    ? 'bg-[#FFFFFF] text-[#1C1B19] shadow-2xs dark:bg-[#383834] dark:text-[#ECEAE4]'
                    : 'text-[#6A6760] hover:text-[#1C1B19] dark:text-[#9C9990] dark:hover:text-[#ECEAE4]'
                }`}
              >
                Tous{' '}
                <span className="font-mono tabular-nums opacity-75">
                  ({agents.length})
                </span>
              </button>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8E8B82] dark:text-[#848178]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un Dot, spécialité…"
                aria-label="Rechercher parmi les agents en exécution"
                className="w-full rounded-lg border border-[#DFDDD5] bg-[#FFFFFF] py-1.5 pl-8 pr-7 text-xs text-[#1C1B19] placeholder:text-[#8E8B82] focus:border-[#ABA79B] focus:outline-none dark:border-[#3E3E39] dark:bg-[#262624] dark:text-[#ECEAE4] dark:placeholder:text-[#7E7B73] dark:focus:border-[#5D5D56]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#827F77] hover:text-[#1C1B19] dark:text-[#96938A] dark:hover:text-[#ECEAE4] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Liste épurée des agents actifs (sans grosses cartes) */}
          <div className="flex-1 overflow-y-auto">
            {visibleAgents.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs font-medium text-[#4E4C46] dark:text-[#C2BFB6]">
                  Aucun Dot trouvé.
                </p>
                <p className="mt-1 text-[11.5px] text-[#827F77] dark:text-[#8E8B82]">
                  {query
                    ? 'Essayez un autre mot-clé ou effacez le filtre.'
                    : 'Tous les agents sont actuellement en veille ou terminés.'}
                </p>
              </div>
            ) : (
              <ul
                className="divide-y divide-[#EAE8E1]/90 dark:divide-[#2E2E2A]"
                role="list"
              >
                {visibleAgents.map((agent) => {
                  const visual = getStatusVisual(agent.status, isDark);
                  const isSelected = selectedAgentId === agent.id;
                  const isPaused = agent.status === 'Idle';
                  const groupName = groupMap.get(agent.groupId) ?? agent.groupId;

                  return (
                    <li key={agent.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelectAgent(agent)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`flex w-full items-start gap-3 px-5 py-3 pr-11 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#EFECE5]/90 dark:bg-[#2E2E2B]'
                            : 'hover:bg-[#F3F1EB]/80 dark:hover:bg-[#282825]'
                        }`}
                      >
                        {/* Marqueur Dot fidèle au graphe (12px) */}
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className="mt-0.5 shrink-0"
                        >
                          {agent.status === 'Thinking' && (
                            <circle
                              cx="10"
                              cy="10"
                              r="8"
                              fill="none"
                              stroke={visual.ringColor}
                              strokeWidth="1"
                              opacity="0.65"
                            />
                          )}
                          {agent.status === 'Working' && (
                            <circle
                              cx="10"
                              cy="10"
                              r="8"
                              fill="none"
                              stroke={visual.ringColor}
                              strokeWidth="1.1"
                              strokeDasharray="4 3"
                            />
                          )}
                          {agent.status === 'Communicating' && (
                            <circle
                              cx="10"
                              cy="10"
                              r="8"
                              fill="none"
                              stroke={visual.ringColor}
                              strokeWidth="1"
                              opacity="0.78"
                            />
                          )}
                          {agent.status === 'Reviewing' && (
                            <circle
                              cx="10"
                              cy="10"
                              r="8"
                              fill="none"
                              stroke={visual.ringColor}
                              strokeWidth="1"
                            />
                          )}
                          {agent.status === 'Error' && (
                            <circle
                              cx="10"
                              cy="10"
                              r="8"
                              fill="none"
                              stroke={visual.ringColor}
                              strokeWidth="1.15"
                              strokeDasharray="2 2"
                            />
                          )}
                          <circle
                            cx="10"
                            cy="10"
                            r="4.8"
                            fill={visual.fill}
                            stroke={visual.stroke}
                            strokeWidth="0.9"
                          />
                          {agent.status === 'Completed' && (
                            <circle cx="10" cy="10" r="1.5" fill={microDotColor} />
                          )}
                          {agent.status === 'Error' && (
                            <path
                              d="M 8.3 8.3 L 11.7 11.7 M 11.7 8.3 L 8.3 11.7"
                              stroke={microDotColor}
                              strokeWidth="1.1"
                              strokeLinecap="round"
                            />
                          )}
                        </svg>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-[#1C1B19] dark:text-[#ECEAE4]">
                              {agent.name}
                            </span>
                            <span
                              className="shrink-0 text-[11px] font-medium"
                              style={{
                                color: isDark ? visual.fill : visual.stroke,
                              }}
                            >
                              {visual.label}
                            </span>
                          </div>

                          <p className="mt-0.5 truncate text-[12px] leading-snug text-[#5A5852] dark:text-[#B4B1A8]">
                            {agent.currentTask}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-[#827F77] dark:text-[#8B8880]">
                            <span className="truncate">{groupName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate font-mono">
                              {agent.model}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Action rapide Pause / Reprendre discrète au survol ou focus */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAgentAction(agent.id, isPaused ? 'resume' : 'pause');
                        }}
                        aria-label={
                          isPaused
                            ? `Reprendre l'agent ${agent.name}`
                            : `Mettre en pause l'agent ${agent.name}`
                        }
                        title={isPaused ? 'Reprendre' : 'Mettre en pause'}
                        className="absolute right-2.5 top-3 flex h-7 w-7 items-center justify-center rounded-md text-[#827F77] opacity-0 transition-opacity hover:bg-[#E5E3DC] hover:text-[#1C1B19] focus-visible:opacity-100 group-hover:opacity-100 dark:text-[#96938A] dark:hover:bg-[#3A3A37] dark:hover:text-[#ECEAE4] cursor-pointer"
                      >
                        {isPaused ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Pied de panneau transparent */}
          {isDemoMode && (
            <div className="border-t border-[#EAE8E1] bg-[#F3F2EE]/80 px-5 py-2.5 text-[11px] text-[#6A6760] dark:border-[#33332F] dark:bg-[#262624]/90 dark:text-[#96938A]">
              {isSimulationRunning
                ? 'Flux d’exécution simulés en direct (démo)'
                : 'Simulation de démonstration en pause'}
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
