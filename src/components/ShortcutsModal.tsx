import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUT_GROUPS: Array<{
  title: string;
  items: Array<{ label: string; keys: string[] }>;
}> = [
  {
    title: 'Navigation',
    items: [
      { label: 'Nouvelle conversation', keys: ['⌘', '⇧', 'O'] },
      { label: 'Recherche rapide', keys: ['⌘', 'K'] },
      { label: 'Ouvrir / réduire la barre latérale', keys: ['⌘', '.'] },
      { label: 'Ouvrir les paramètres', keys: ['⌘', ','] },
      { label: 'Afficher les raccourcis clavier', keys: ['⌘', '/'] },
    ],
  },
  {
    title: 'Conversation & saisie',
    items: [
      { label: 'Envoyer le message', keys: ['Entrée'] },
      { label: 'Saut de ligne dans la saisie', keys: ['⇧', 'Entrée'] },
      { label: 'Arrêter la génération en cours', keys: ['Échap'] },
      { label: 'Fermer un menu ou une fenêtre', keys: ['Échap'] },
    ],
  },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="claude-animate-backdrop fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="claude-animate-modal relative z-10 w-full max-w-md rounded-2xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-6"
        style={{ boxShadow: 'var(--claude-popover-shadow)' }}
      >
        <div className="flex items-center justify-between">
          <h2
            id="shortcuts-modal-title"
            className="m-0 font-claude-serif text-[21px] font-normal text-[var(--claude-text-primary)]"
          >
            Raccourcis clavier
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les raccourcis clavier"
            className="rounded-lg p-1.5 text-[var(--claude-text-muted)] transition-colors hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-[11.5px] font-medium text-[var(--claude-text-muted)]">
                {group.title}
              </div>
              <div className="divide-y divide-[var(--claude-border)] rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)]">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[13px]"
                  >
                    <span className="text-[var(--claude-text-primary)]">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="min-w-[24px] rounded-md border border-[var(--claude-border-strong)] bg-[var(--claude-bg-elevated)] px-1.5 py-0.5 text-center font-claude-mono text-[11px] text-[var(--claude-text-secondary)]"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
