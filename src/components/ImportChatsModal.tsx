import React, { useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';

interface ImportChatsModalProps {
  onClose: () => void;
  onImportConversation: (title: string, content: string) => void;
}

export const ImportChatsModal: React.FC<ImportChatsModalProps> = ({
  onClose,
  onImportConversation,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');
  const [title, setTitle] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setTitle(file.name.replace(/\.(json|md|txt)$/i, ''));
      setPastedText(text.slice(0, 8000));
    } catch {
      // ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) return;
    onImportConversation(title.trim() || 'Conversation importée', pastedText.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="claude-animate-backdrop fixed inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-chats-title"
        className="claude-animate-modal relative z-10 w-full max-w-lg rounded-2xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-5"
        style={{ boxShadow: 'var(--claude-popover-shadow)' }}
      >
        <div className="flex items-center justify-between">
          <h2
            id="import-chats-title"
            className="m-0 text-[16px] font-semibold text-[var(--claude-text-primary)]"
          >
            Importer des chats
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’importation"
            className="rounded-lg p-1 text-[var(--claude-text-muted)] hover:bg-[var(--claude-surface-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1.5 text-[12.5px] text-[var(--claude-text-secondary)]">
          Importez un fichier Markdown/JSON ou collez une transcription pour la consulter localement dans le navigateur.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt,.json"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--claude-border-strong)] bg-[var(--claude-surface-subtle)]/50 px-4 py-3 text-[13px] text-[var(--claude-text-secondary)] transition-colors hover:text-[var(--claude-text-primary)]"
          >
            <FileUp className="h-4 w-4" />
            <span>Choisir un fichier (.md, .txt, .json)</span>
          </button>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la conversation"
            className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] px-3 py-2 text-[13px]"
          />

          <textarea
            rows={5}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Ou collez ici le texte de votre discussion…"
            className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] px-3 py-2 text-[13px]"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[var(--claude-surface-subtle)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--claude-text-primary)]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!pastedText.trim()}
              className="rounded-lg bg-[var(--claude-text-primary)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--claude-bg)] disabled:opacity-40"
            >
              Importer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
