import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, MessageSquare, Search, X } from 'lucide-react';
import type { CodeSession, CodeWorkspace } from '../types/claude';

interface SearchModalProps {
  sessions: CodeSession[];
  workspaces: CodeWorkspace[];
  onClose: () => void;
  onSelectSession: (id: string) => void;
  onSelectWorkspace: (id: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  sessions,
  workspaces,
  onClose,
  onSelectSession,
  onSelectWorkspace,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { matchedSessions, matchedWorkspaces } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        matchedSessions: sessions,
        matchedWorkspaces: workspaces,
      };
    }

    const filteredSessions = sessions.filter((sess) => {
      if (sess.title.toLowerCase().includes(q)) return true;
      if (sess.turns.some((t) => t.content.toLowerCase().includes(q) || t.intro?.toLowerCase().includes(q))) {
        return true;
      }
      if (sess.sideChats.some((sc) => sc.title.toLowerCase().includes(q))) return true;
      return false;
    });

    const filteredWorkspaces = workspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(q) ||
        ws.pathLabel.toLowerCase().includes(q) ||
        ws.branch.toLowerCase().includes(q)
    );

    return {
      matchedSessions: filteredSessions,
      matchedWorkspaces: filteredWorkspaces,
    };
  }, [sessions, workspaces, query]);

  const hasResults = matchedSessions.length > 0 || matchedWorkspaces.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div
        onClick={onClose}
        className="claude-animate-backdrop fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher dans les sessions"
        className="claude-animate-modal relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)]"
        style={{ boxShadow: 'var(--claude-popover-shadow)' }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[var(--claude-border)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--claude-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une session ou un espace de travail…"
            aria-label="Rechercher une session ou un espace de travail"
            className="flex-1 bg-transparent text-[14px] text-[var(--claude-text-primary)] placeholder:text-[var(--claude-text-muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Effacer la recherche"
              className="rounded-md p-1 text-[var(--claude-text-muted)] hover:bg-[var(--claude-surface-subtle)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la recherche"
            className="rounded-md border border-[var(--claude-border)] px-1.5 py-0.5 font-claude-mono text-[11px] text-[var(--claude-text-muted)] hover:text-[var(--claude-text-primary)]"
          >
            Échap
          </button>
        </div>

        {/* Results */}
        <div className="claude-scroll max-h-[60vh] overflow-y-auto p-2">
          {!hasResults ? (
            <div className="py-10 text-center text-[13px] text-[var(--claude-text-muted)]">
              Aucun résultat pour « {query} ».
            </div>
          ) : (
            <div className="space-y-3">
              {matchedSessions.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--claude-text-muted)]">
                    Sessions
                  </div>
                  {matchedSessions.map((sess) => {
                    const firstUserTurn = sess.turns.find((t) => t.role === 'user');
                    const ws = workspaces.find((w) => w.id === sess.workspaceId);
                    return (
                      <button
                        key={sess.id}
                        type="button"
                        onClick={() => {
                          onSelectSession(sess.id);
                          onClose();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--claude-sidebar-hover)]"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-[var(--claude-text-muted)]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-[var(--claude-text-primary)]">
                              {sess.title}
                            </span>
                            {ws && (
                              <span className="shrink-0 text-[11px] text-[var(--claude-text-muted)]">
                                {ws.name}
                              </span>
                            )}
                          </div>
                          {firstUserTurn && (
                            <div className="truncate text-[12px] text-[var(--claude-text-muted)]">
                              {firstUserTurn.content}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {matchedWorkspaces.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--claude-text-muted)]">
                    Espaces de travail (démo)
                  </div>
                  {matchedWorkspaces.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        onSelectWorkspace(ws.id);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--claude-sidebar-hover)]"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-[var(--claude-text-secondary)]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-[var(--claude-text-primary)]">
                          {ws.name}
                        </div>
                        <div className="truncate text-[11.5px] text-[var(--claude-text-muted)]">
                          {ws.pathLabel} · {ws.branch}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
