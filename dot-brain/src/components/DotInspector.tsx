import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  ArrowRight,
  Focus,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  Agent,
  AgentActionType,
  Connection,
  DotModelOption,
  Group,
} from '../types/dotBrain';
import {
  CONNECTION_TYPE_LABELS,
  getStatusVisual,
} from '../constants/dotVisuals';

interface DotInspectorProps {
  agent: Agent | null;
  group: Group | null;
  agents: Agent[];
  connections: Connection[];
  isIsolated: boolean;
  isDemoMode: boolean;
  isDark?: boolean;
  availableModels?: DotModelOption[];
  onAgentModelChange?: (agentId: string, modelId: string) => void;
  onClose: () => void;
  onSelectAgent: (agent: Agent) => void;
  onAgentAction: (agentId: string, actionType: AgentActionType) => void;
}

export function DotInspector({
  agent,
  group,
  agents,
  connections,
  isIsolated,
  isDemoMode,
  isDark = false,
  availableModels = [],
  onAgentModelChange,
  onClose,
  onSelectAgent,
  onAgentAction,
}: DotInspectorProps) {
  const agentMap = React.useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents]
  );

  const relatedConnections = React.useMemo(() => {
    if (!agent) return [];
    return connections
      .filter((c) => c.sourceId === agent.id || c.targetId === agent.id)
      .sort((a, b) => {
        const order = { active: 0, completing: 1, idle: 2 };
        return order[a.status] - order[b.status];
      });
  }, [agent, connections]);

  const visual = agent ? getStatusVisual(agent.status, isDark) : null;
  const isPaused = agent?.status === 'Idle';

  return (
    <AnimatePresence>
      {agent && visual && (
        <motion.aside
          key="dot-inspector"
          aria-label={`Détails de l’agent ${agent.name}`}
          initial={{ x: 36, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 36, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-0 bottom-0 z-30 flex w-full max-w-[360px] flex-col border-l border-[#E5E3DC] bg-[#FAF9F5]/98 shadow-[-12px_0_32px_-20px_rgba(28,27,25,0.14)] backdrop-blur-md dark:border-[#3B3B37] dark:bg-[#1F1F1D]/98 dark:shadow-[-16px_0_40px_-20px_rgba(0,0,0,0.55)]"
        >
          {/* En-tête de l'agent */}
          <div className="flex items-start justify-between gap-4 border-b border-[#EAE8E1] px-6 py-5 dark:border-[#33332F]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#6A6760] dark:text-[#A4A198]">
                <span>{group?.name ?? agent.groupId}</span>
                <span aria-hidden="true">·</span>
                <span
                  className="font-medium"
                  style={{ color: isDark ? visual.fill : visual.stroke }}
                >
                  {visual.glyph} {visual.label}
                </span>
              </div>
              <h2
                className="mt-1 text-xl font-medium tracking-tight text-[#1C1B19] dark:text-[#ECEAE4]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {agent.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-[#5A5852] dark:text-[#B4B1A8]">
                {agent.role}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le panneau de détail"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6A6760] transition-colors hover:bg-[#EAE8E1] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#A4A198] dark:hover:bg-[#343430] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenu défilable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Identité cognitive */}
            <section>
              <h3 className="text-xs font-medium text-[#827F77] dark:text-[#8E8B82]">
                Activité courante
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#1C1B19] dark:text-[#ECEAE4]">
                {agent.currentTask}
              </p>
              <p className="mt-2 text-xs text-[#6A6760] dark:text-[#A4A198]">
                {visual.description}
              </p>
            </section>

            {/* Spécifications techniques */}
            <section className="border-t border-[#EAE8E1] pt-5 dark:border-[#33332F]">
              <h3 className="text-xs font-medium text-[#827F77] dark:text-[#8E8B82]">
                Spécifications
              </h3>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#6A6760] dark:text-[#A4A198]">Spécialité</dt>
                  <dd className="text-right font-medium text-[#1C1B19] dark:text-[#ECEAE4]">
                    {agent.specialty}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#6A6760] dark:text-[#A4A198]">Modèle</dt>
                  <dd className="text-right">
                    {onAgentModelChange &&
                    availableModels.filter((m) => m.id !== 'auto').length > 0 ? (
                      <select
                        aria-label={`Modèle de l’agent ${agent.name}`}
                        data-testid="dot-inspector-model-select"
                        value={agent.model}
                        onChange={(e) => onAgentModelChange(agent.id, e.target.value)}
                        className="max-w-[190px] rounded-md border border-[#DFDDD5] bg-[#FFFFFF] px-2 py-1 font-mono text-[11.5px] text-[#1C1B19] focus:outline-none focus:ring-1 focus:ring-[#D97757] dark:border-[#42423D] dark:bg-[#30302E] dark:text-[#ECEAE4] cursor-pointer"
                      >
                        {!availableModels.some((m) => m.id === agent.model) && (
                          <option value={agent.model}>{agent.model}</option>
                        )}
                        {availableModels
                          .filter((m) => m.id !== 'auto')
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.shortLabel ?? m.label}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="font-mono text-[12px] text-[#1C1B19] dark:text-[#ECEAE4]">
                        {agent.model}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#6A6760] dark:text-[#A4A198]">Identifiant</dt>
                  <dd className="text-right font-mono text-[12px] text-[#5A5852] dark:text-[#B4B1A8]">
                    {agent.id}
                  </dd>
                </div>
                {typeof agent.metadata.latencyMs === 'number' && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[#6A6760] dark:text-[#A4A198]">Latence moyenne</dt>
                    <dd className="text-right font-mono tabular-nums text-[12px] text-[#1C1B19] dark:text-[#ECEAE4]">
                      {agent.metadata.latencyMs} ms
                    </dd>
                  </div>
                )}
                {typeof agent.metadata.tokensProcessed === 'number' && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[#6A6760] dark:text-[#A4A198]">Contexte traité</dt>
                    <dd className="text-right font-mono tabular-nums text-[12px] text-[#1C1B19] dark:text-[#ECEAE4]">
                      {agent.metadata.tokensProcessed.toLocaleString('fr-FR')} tokens
                    </dd>
                  </div>
                )}
                {typeof agent.metadata.confidence === 'number' && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[#6A6760] dark:text-[#A4A198]">Confiance</dt>
                    <dd className="text-right font-mono tabular-nums text-[12px] text-[#1C1B19] dark:text-[#ECEAE4]">
                      {Math.round(agent.metadata.confidence * 100)} %
                    </dd>
                  </div>
                )}
                {agent.metadata.lastActiveAt && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[#6A6760] dark:text-[#A4A198]">Dernier signal</dt>
                    <dd className="text-right text-[12.5px] text-[#5A5852] dark:text-[#B4B1A8]">
                      {agent.metadata.lastActiveAt}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Actions rapides reliées au callback onAgentAction */}
            <section className="border-t border-[#EAE8E1] pt-5 dark:border-[#33332F]">
              <h3 className="text-xs font-medium text-[#827F77] dark:text-[#8E8B82]">
                Actions sur le Dot
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onAgentAction(agent.id, isPaused ? 'resume' : 'pause')
                  }
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#DFDDD5] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#1C1B19] transition-colors hover:bg-[#F3F2EE] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:border-[#42423D] dark:bg-[#30302E] dark:text-[#ECEAE4] dark:hover:bg-[#3A3A37] dark:focus-visible:outline-[#D97757] whitespace-nowrap cursor-pointer"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Reprendre
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Mettre en pause
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onAgentAction(agent.id, 'restart')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#DFDDD5] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#1C1B19] transition-colors hover:bg-[#F3F2EE] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:border-[#42423D] dark:bg-[#30302E] dark:text-[#ECEAE4] dark:hover:bg-[#3A3A37] dark:focus-visible:outline-[#D97757] whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Relancer
                </button>

                <button
                  type="button"
                  onClick={() => onAgentAction(agent.id, 'isolate')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:focus-visible:outline-[#D97757] whitespace-nowrap cursor-pointer ${
                    isIsolated
                      ? 'border-[#262522] bg-[#262522] text-[#FAF9F5] hover:bg-[#3A3833] dark:border-[#D97757] dark:bg-[#D97757] dark:text-[#FAF9F5] dark:hover:bg-[#E28566]'
                      : 'border-[#DFDDD5] bg-[#FFFFFF] text-[#1C1B19] hover:bg-[#F3F2EE] dark:border-[#42423D] dark:bg-[#30302E] dark:text-[#ECEAE4] dark:hover:bg-[#3A3A37]'
                  }`}
                >
                  <Focus className="h-3.5 w-3.5" />
                  {isIsolated ? 'Vue complète' : 'Isoler liens'}
                </button>

                <button
                  type="button"
                  onClick={() => onAgentAction(agent.id, 'prioritize')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#DFDDD5] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#1C1B19] transition-colors hover:bg-[#F3F2EE] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:border-[#42423D] dark:bg-[#30302E] dark:text-[#ECEAE4] dark:hover:bg-[#3A3A37] dark:focus-visible:outline-[#D97757] whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Prioriser
                </button>
              </div>
            </section>

            {/* Collaborations & connexions directes */}
            <section className="border-t border-[#EAE8E1] pt-5 dark:border-[#33332F]">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-medium text-[#827F77] dark:text-[#8E8B82]">
                  Connexions ({relatedConnections.length})
                </h3>
                <span className="font-mono tabular-nums text-[11px] text-[#827F77] dark:text-[#8E8B82]">
                  {relatedConnections.filter((c) => c.status === 'active').length} actives
                </span>
              </div>

              {relatedConnections.length === 0 ? (
                <p className="mt-2.5 text-xs text-[#827F77] dark:text-[#8E8B82]">
                  Aucune connexion déclarée pour cet agent.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-[#EAE8E1] dark:divide-[#33332F]">
                  {relatedConnections.map((conn) => {
                    const isOutgoing = conn.sourceId === agent.id;
                    const peerId = isOutgoing ? conn.targetId : conn.sourceId;
                    const peer = agentMap.get(peerId);
                    if (!peer) return null;

                    const statusLabel =
                      conn.status === 'active'
                        ? 'Actif'
                        : conn.status === 'completing'
                          ? 'Finalisation'
                          : 'Discret';

                    return (
                      <li key={conn.id} className="py-2.5 first:pt-0">
                        <button
                          type="button"
                          onClick={() => onSelectAgent(peer)}
                          className="group flex w-full items-start justify-between gap-3 text-left transition-colors hover:text-[#1C1B19] dark:hover:text-[#ECEAE4] cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#1C1B19] group-hover:underline dark:text-[#ECEAE4]">
                              {conn.direction === 'bidirectional' ? (
                                <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-[#827F77] dark:text-[#8E8B82]" />
                              ) : (
                                <ArrowRight
                                  className={`h-3.5 w-3.5 shrink-0 text-[#827F77] dark:text-[#8E8B82] ${
                                    isOutgoing ? '' : 'rotate-180'
                                  }`}
                                />
                              )}
                              <span className="truncate">{peer.name}</span>
                            </div>
                            <p className="mt-0.5 text-[11.5px] text-[#6A6760] truncate dark:text-[#A4A198]">
                              {conn.label ?? CONNECTION_TYPE_LABELS[conn.type]}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[11px] font-medium ${
                              conn.status === 'active'
                                ? 'text-[#815124] dark:text-[#DE8857]'
                                : 'text-[#827F77] dark:text-[#8E8B82]'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Note transparente de données de démonstration */}
          {(isDemoMode || agent.metadata.isDemoData) && (
            <div className="border-t border-[#EAE8E1] bg-[#F3F2EE]/80 px-6 py-3 text-[11.5px] text-[#6A6760] dark:border-[#33332F] dark:bg-[#262624]/90 dark:text-[#9C9990]">
              Données de démonstration locales — remplaçables par des événements réels via les props du composant.
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
