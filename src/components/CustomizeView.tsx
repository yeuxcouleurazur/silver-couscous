import React, { useState } from 'react';
import { BookOpen, Plug, Sparkles, TerminalSquare } from 'lucide-react';

interface CustomizeViewProps {
  onOpenFccSettings: () => void;
}

const DEMO_CUSTOM_SECTIONS = [
  {
    id: 'instructions',
    title: 'Instructions personnalisées',
    description:
      'Définissez le style de code, la langue des réponses et les conventions appliquées à vos sessions.',
    items: [
      {
        name: 'CLAUDE.md (exemple démo)',
        detail: 'Toujours répondre en français, privilégier TypeScript strict et des fonctions pures.',
      },
    ],
  },
  {
    id: 'skills',
    title: 'Skills & Commandes (aperçu frontend)',
    description:
      'Cette interface web n’accède pas à vos Skills locaux. Connectez votre bridge FCC pour charger votre catalogue réel.',
    items: [
      { name: '/compact', detail: 'Résume l’historique pour libérer de la fenêtre de contexte.' },
      { name: '/btw', detail: 'Ouvre un side chat parallèle sans polluer la session.' },
      { name: '/review', detail: 'Relit les changements en attente et signale les régressions.' },
    ],
  },
  {
    id: 'mcp',
    title: 'Connecteurs & Bridge FCC',
    description:
      'Aucun serveur MCP local n’est interrogé depuis le navigateur. Configurez votre endpoint FCC dans les paramètres.',
    items: [
      {
        name: 'ClaudeTransportAdapter (SSE)',
        detail: 'Contrat frontend découplé prêt à relayer vos requêtes vers votre FCC Claude.',
      },
    ],
  },
];

export const CustomizeView: React.FC<CustomizeViewProps> = ({ onOpenFccSettings }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'instructions' | 'skills' | 'mcp'>('all');

  const visible =
    activeTab === 'all'
      ? DEMO_CUSTOM_SECTIONS
      : DEMO_CUSTOM_SECTIONS.filter((s) => s.id === activeTab);

  return (
    <div className="claude-scroll flex-1 overflow-y-auto bg-[var(--claude-bg)] px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[780px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-[20px] font-semibold tracking-[-0.015em] text-[var(--claude-text-primary)] sm:text-[22px]">
              Personnaliser
            </h1>
            <p className="mt-1 text-[13px] text-[var(--claude-text-secondary)]">
              Instructions, commandes slash et point d’extension FCC (environnement de démonstration frontend).
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFccSettings}
            className="rounded-lg border border-[var(--claude-border-strong)] bg-[var(--claude-bg-elevated)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-surface-subtle)]"
          >
            Configurer le bridge FCC
          </button>
        </div>

        <div className="claude-scroll mt-5 flex items-center gap-1.5 overflow-x-auto border-b border-[var(--claude-border)] pb-3 text-[12.5px]">
          {(
            [
              { id: 'all', label: 'Tout', icon: Sparkles },
              { id: 'instructions', label: 'Instructions', icon: BookOpen },
              { id: 'skills', label: 'Commandes', icon: TerminalSquare },
              { id: 'mcp', label: 'Connecteurs FCC', icon: Plug },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--claude-sidebar-active)] text-[var(--claude-text-primary)]'
                    : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-5">
          {visible.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-4"
            >
              <h2 className="m-0 text-[14px] font-semibold text-[var(--claude-text-primary)]">
                {section.title}
              </h2>
              <p className="mt-1 text-[12.5px] text-[var(--claude-text-secondary)]">
                {section.description}
              </p>
              <div className="mt-3 divide-y divide-[var(--claude-border)] rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)]">
                {section.items.map((item) => (
                  <div key={item.name} className="px-3 py-2.5">
                    <div className="font-claude-mono text-[12.5px] font-medium text-[var(--claude-text-primary)]">
                      {item.name}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--claude-text-muted)]">
                      {item.detail}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
