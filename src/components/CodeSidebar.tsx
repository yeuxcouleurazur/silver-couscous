import React, { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Keyboard,
  MessageCircle,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Plug,
  Plus,
  Search,
  Settings,
  Sun,
  Monitor,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type {
  AppSurfaceMode,
  CodeSession,
  CodeWorkspace,
  SettingsSectionId,
  ThemeMode,
  UserPreferences,
} from '../types/claude';
import { ClaudeSpark } from './ClaudeLogo';

interface CodeSidebarProps {
  isOpen: boolean;
  isMobileOpen: boolean;
  onToggleOpen: () => void;
  onCloseMobile: () => void;
  surfaceMode: AppSurfaceMode;
  onChangeSurfaceMode: (mode: AppSurfaceMode) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  workspaces: CodeWorkspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  sessions: CodeSession[];
  activeSessionId: string | null;
  activeSubPage: 'session' | 'customize';
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onOpenSideChatFromSidebar: (sessionId: string, sideChatId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSearch: () => void;
  onOpenCustomize: () => void;
  onOpenImportChats: () => void;
  onOpenSettings: (section?: SettingsSectionId) => void;
  onOpenShortcuts: () => void;
  preferences: UserPreferences;
  onThemeChange: (theme: ThemeMode) => void;
}

export const CodeSidebar: React.FC<CodeSidebarProps> = ({
  isOpen,
  isMobileOpen,
  onToggleOpen,
  onCloseMobile,
  surfaceMode,
  onChangeSurfaceMode,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  sessions,
  activeSessionId,
  activeSubPage,
  onNewSession,
  onSelectSession,
  onOpenSideChatFromSidebar,
  onDeleteSession,
  onOpenSearch,
  onOpenCustomize,
  onOpenImportChats,
  onOpenSettings,
  onOpenShortcuts,
  preferences,
  onThemeChange,
}) => {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [sessionMenuId, setSessionMenuId] = useState<string | null>(null);

  const wsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wsRef.current && !wsRef.current.contains(target)) setWorkspaceMenuOpen(false);
      if (moreRef.current && !moreRef.current.contains(target)) setMoreMenuOpen(false);
      if (accountRef.current && !accountRef.current.contains(target)) setAccountMenuOpen(false);
      if (sessionMenuId) setSessionMenuId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [sessionMenuId]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const workspaceSessions = sessions.filter((s) => s.workspaceId === activeWorkspace.id);
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const firstName = preferences.userName.trim().split(' ')[0] || 'Utilisateur';
  const transportTag = preferences.fcc.mode === 'fcc' ? 'FCC' : 'API';

  const sidebarInner = (
    <div className="flex h-full flex-col bg-[var(--claude-sidebar)] text-[13px] text-[var(--claude-text-primary)] select-none">
      {/* Top 44px Control Bar: Sidebar toggle, Back/Forward, Chat/Code segmented toggle */}
      <div className="flex h-11 shrink-0 items-center justify-between px-2.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={isMobileOpen ? onCloseMobile : onToggleOpen}
            aria-label="Réduire la barre latérale"
            title="Réduire la barre latérale (⌘.)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)]"
          >
            {isMobileOpen ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onGoBack}
            disabled={!canGoBack}
            aria-label="Session précédente"
            className="flex h-7 w-6 items-center justify-center rounded-md text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onGoForward}
            disabled={!canGoForward}
            aria-label="Session suivante"
            className="flex h-7 w-6 items-center justify-center rounded-md text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Exact OpenClaudeDesktop Chat / Code Segmented Toggle */}
        <div
          role="tablist"
          aria-label="Mode d’interface"
          className="inline-flex items-center rounded-lg bg-black/[0.045] p-0.5 dark:bg-white/[0.06]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={surfaceMode === 'chat'}
            aria-label="Mode Chat"
            title="Mode Chat Claude Desktop"
            onClick={() => {
              onChangeSurfaceMode('chat');
              onCloseMobile();
            }}
            className={`flex h-6 w-7 items-center justify-center rounded-[6px] transition-all ${
              surfaceMode === 'chat'
                ? 'bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] shadow-xs ring-1 ring-[var(--claude-border)]'
                : 'text-[var(--claude-text-secondary)] hover:text-[var(--claude-text-primary)]'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={surfaceMode === 'code'}
            aria-label="Mode Code"
            title="Mode Code Claude Desktop"
            onClick={() => {
              onChangeSurfaceMode('code');
              onCloseMobile();
            }}
            className={`flex h-6 w-7 items-center justify-center rounded-[6px] transition-all ${
              surfaceMode === 'code'
                ? 'bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] shadow-xs ring-1 ring-[var(--claude-border)]'
                : 'text-[var(--claude-text-secondary)] hover:text-[var(--claude-text-primary)]'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Top Primary Action List (+ New, Search, Customize, Import Chats, More) */}
      <div className="space-y-0.5 px-2 pt-1">
        <button
          type="button"
          onClick={() => {
            onNewSession();
            onCloseMobile();
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
            activeSubPage === 'session' && activeSessionId === null
              ? 'bg-[var(--claude-sidebar-active)] font-medium text-[var(--claude-text-primary)]'
              : 'text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)]'
          }`}
        >
          <Plus className="h-4 w-4 shrink-0 text-[var(--claude-text-secondary)]" />
          <span>Nouveau</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenSearch();
            onCloseMobile();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)]"
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--claude-text-secondary)]" />
          <span className="flex-1 text-left">Rechercher</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenCustomize();
            onCloseMobile();
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
            activeSubPage === 'customize'
              ? 'bg-[var(--claude-sidebar-active)] font-medium text-[var(--claude-text-primary)]'
              : 'text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)]'
          }`}
        >
          <Briefcase className="h-4 w-4 shrink-0 text-[var(--claude-text-secondary)]" />
          <span>Personnaliser</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenImportChats();
            onCloseMobile();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)]"
        >
          <Download className="h-4 w-4 shrink-0 text-[var(--claude-text-secondary)]" />
          <span>Importer des chats</span>
        </button>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--claude-text-primary)] transition-colors hover:bg-[var(--claude-sidebar-hover)]"
          >
            <MoreHorizontal className="h-4 w-4 shrink-0 text-[var(--claude-text-secondary)]" />
            <span>Plus</span>
          </button>

          {moreMenuOpen && (
            <div
              className="claude-animate-popover absolute left-1 top-full z-40 mt-1 w-48 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[12.5px]"
              style={{ boxShadow: 'var(--claude-popover-shadow)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenSettings('models');
                  onCloseMobile();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
              >
                <Zap className="h-3.5 w-3.5 text-[var(--claude-text-secondary)]" />
                Modèles & Effort
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenSettings('fcc');
                  onCloseMobile();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
              >
                <Plug className="h-3.5 w-3.5 text-[var(--claude-text-secondary)]" />
                Bridge FCC
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenShortcuts();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
              >
                <Keyboard className="h-3.5 w-3.5 text-[var(--claude-text-secondary)]" />
                Raccourcis clavier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Group Header & Sessions List */}
      <div className="claude-scroll mt-4 flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-1 flex items-center justify-between px-2 py-1" ref={wsRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md px-0.5 py-0.5 text-[12.5px] font-semibold text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)]"
            >
              <span>{activeWorkspace.name}</span>
              <ChevronDown className="h-3 w-3 text-[var(--claude-text-muted)]" />
            </button>

            {workspaceMenuOpen && (
              <div
                className="claude-animate-popover absolute left-0 top-full z-40 mt-1 w-52 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[12.5px]"
                style={{ boxShadow: 'var(--claude-popover-shadow)' }}
              >
                <div className="px-2 py-1 text-[11px] font-medium text-[var(--claude-text-muted)]">
                  Espaces de démonstration
                </div>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      setWorkspaceMenuOpen(false);
                    }}
                    className={`flex w-full flex-col rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--claude-sidebar-hover)] ${
                      ws.id === activeWorkspace.id
                        ? 'bg-[var(--claude-sidebar-active)] font-medium'
                        : ''
                    }`}
                  >
                    <span>{ws.name}</span>
                    <span className="text-[11px] text-[var(--claude-text-muted)]">
                      {ws.branch} · {ws.pathLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onNewSession();
              onCloseMobile();
            }}
            aria-label="Nouvelle session dans cet espace"
            title="Nouvelle session dans cet espace"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Side chat (/btw) quick entry if active session has one */}
        {activeSession &&
          activeSession.sideChats.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                onOpenSideChatFromSidebar(activeSession.id, sc.id);
                onCloseMobile();
              }}
              className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)]"
            >
              <span className="truncate">btw: {sc.title}</span>
            </button>
          ))}

        {/* Workspace Sessions */}
        <nav aria-label="Sessions Code" className="space-y-0.5">
          {workspaceSessions.map((sess) => {
            const isActive = activeSubPage === 'session' && activeSessionId === sess.id;
            return (
              <div
                key={sess.id}
                className={`group relative flex items-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[var(--claude-sidebar-active)] text-[var(--claude-text-primary)]'
                    : 'text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(sess.id);
                    onCloseMobile();
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[13px]"
                >
                  <span className="truncate">{sess.title}</span>
                  {sess.needsInput && (
                    <span
                      title="Validation requise"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cds-warning-dot)]"
                    />
                  )}
                </button>

                <button
                  type="button"
                  aria-label={`Options pour ${sess.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionMenuId((prev) => (prev === sess.id ? null : sess.id));
                  }}
                  className={`mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--claude-text-muted)] transition-opacity hover:bg-black/5 dark:hover:bg-white/10 ${
                    isActive || sessionMenuId === sess.id
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>

                {sessionMenuId === sess.id && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="claude-animate-popover absolute right-1 top-full z-40 mt-0.5 w-40 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1 text-[12.5px]"
                    style={{ boxShadow: 'var(--claude-popover-shadow)' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSessionMenuId(null);
                        onDeleteSession(sess.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer: ClaudeSpark + Name · API ▾ + Gear icon */}
      <div
        ref={accountRef}
        className="relative flex h-11 shrink-0 items-center justify-between border-t border-[var(--claude-border)] px-2.5"
      >
        <button
          type="button"
          onClick={() => setAccountMenuOpen((v) => !v)}
          aria-label="Menu du compte utilisateur"
          className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] transition-colors hover:bg-[var(--claude-sidebar-hover)]"
        >
          <ClaudeSpark size={16} />
          <span className="truncate font-medium text-[var(--claude-text-primary)]">
            {firstName}
          </span>
          <span className="text-[var(--claude-text-muted)]">· {transportTag}</span>
          <ChevronDown className="h-3 w-3 text-[var(--claude-text-muted)]" />
        </button>

        <button
          type="button"
          onClick={() => onOpenSettings('models')}
          aria-label="Ouvrir les paramètres"
          title="Paramètres (⌘,)"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--claude-text-secondary)] transition-colors hover:bg-[var(--claude-sidebar-hover)] hover:text-[var(--claude-text-primary)]"
        >
          <Settings className="h-4 w-4" />
        </button>

        {accountMenuOpen && (
          <div
            className="claude-animate-popover absolute bottom-12 left-2 right-2 z-50 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-1.5 text-[12.5px]"
            style={{ boxShadow: 'var(--claude-popover-shadow)' }}
          >
            <div className="px-2.5 py-1.5">
              <div className="truncate font-medium text-[var(--claude-text-primary)]">
                {preferences.userName}
              </div>
              <div className="truncate text-[11px] text-[var(--claude-text-muted)]">
                {preferences.userEmail}
              </div>
            </div>
            <div className="my-1 border-t border-[var(--claude-border)]" />
            <div className="px-2.5 py-1">
              <div className="mb-1 text-[11px] font-medium text-[var(--claude-text-muted)]">
                Apparence
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--claude-surface-subtle)] p-0.5">
                {(
                  [
                    { id: 'light', label: 'Clair', icon: Sun },
                    { id: 'dark', label: 'Sombre', icon: Moon },
                    { id: 'system', label: 'Auto', icon: Monitor },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onThemeChange(t.id)}
                      className={`flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors ${
                        preferences.theme === t.id
                          ? 'bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] shadow-xs'
                          : 'text-[var(--claude-text-secondary)] hover:text-[var(--claude-text-primary)]'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="my-1 border-t border-[var(--claude-border)]" />
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                onOpenSettings('models');
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
            >
              <span>Paramètres & Modèles</span>
              <span className="font-claude-mono text-[11px] text-[var(--claude-text-muted)]">⌘,</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                onOpenSettings('fcc');
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
            >
              <span>Bridge FCC Claude</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                onOpenShortcuts();
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--claude-sidebar-hover)]"
            >
              <span>Raccourcis clavier</span>
              <span className="font-claude-mono text-[11px] text-[var(--claude-text-muted)]">⌘/</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden h-full shrink-0 border-r border-[var(--claude-border)] transition-[width] duration-200 ease-out md:block ${
          isOpen ? 'w-[244px]' : 'w-0 overflow-hidden border-r-0'
        }`}
      >
        <div className="h-full w-[244px]">{sidebarInner}</div>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            onClick={onCloseMobile}
            className="claude-animate-backdrop fixed inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <div className="claude-animate-slide-left relative z-10 h-[100dvh] w-[min(296px,86vw)] border-r border-[var(--claude-border)] shadow-2xl">
            {sidebarInner}
          </div>
        </div>
      )}
    </>
  );
};
