import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeft, PanelRight, Paperclip, Plus } from 'lucide-react';
import type {
  AppSurfaceMode,
  Attachment,
  CodeSession,
  CodeTurn,
  EffortLevel,
  ModelConfig,
  ModelId,
  PermissionMode,
  RightPaneMode,
  SettingsSectionId,
  ThemeMode,
  ToolSettings,
  UserPreferences,
} from './types/claude';
import { DEFAULT_PREFERENCES } from './data/demoData';
import {
  INITIAL_CODE_SESSIONS,
  INITIAL_CODE_WORKSPACES,
} from './data/codeDemoData';
import { generateConversationTitle } from './utils/chatStore';
import {
  appendSideChatExchange,
  compactSessionContext,
  resolveApprovalInSession,
  resolveNextStepInSession,
} from './utils/codeSessionStore';
import {
  createClaudeAdapter,
  fetchFccModels,
  type ConversationHistoryTurn,
} from './services/fccAdapter';
import { CodeSidebar } from './components/CodeSidebar';
import { CodeHomeView } from './components/CodeHomeView';
import { CodeSessionView } from './components/CodeSessionView';
import { CodeRightPane } from './components/CodeRightPane';
import { CustomizeView } from './components/CustomizeView';
import { ImportChatsModal } from './components/ImportChatsModal';
import { SearchModal } from './components/SearchModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';

const STORAGE_KEYS = {
  preferences: 'claude_desktop_clone_preferences_v3',
  codeSessions: 'claude_desktop_clone_code_sessions_v2',
};

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadStored(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES)
  );
  const [codeSessions, setCodeSessions] = useState<CodeSession[]>(() =>
    loadStored(STORAGE_KEYS.codeSessions, INITIAL_CODE_SESSIONS)
  );

  // Unified OpenClaudeDesktop 4.x interface:
  // 'code' = full workspace with right rail/diffs, 'chat' = focused view in the same shell
  const [surfaceMode, setSurfaceMode] = useState<AppSurfaceMode>('code');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Workspace & session state
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    INITIAL_CODE_WORKSPACES[0].id
  );
  const [activeCodeSessionId, setActiveCodeSessionId] = useState<string | null>(
    INITIAL_CODE_SESSIONS[0].id
  );
  const [codeSubPage, setCodeSubPage] = useState<'session' | 'customize'>('session');
  const [rightPane, setRightPane] = useState<RightPaneMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'none' : 'rail'
  );
  const [contextExpanded, setContextExpanded] = useState(false);
  const [activeSideChatId, setActiveSideChatId] = useState<string | null>(
    INITIAL_CODE_SESSIONS[0].sideChats[0]?.id ?? null
  );
  const [navHistory, setNavHistory] = useState<Array<string | null>>([
    INITIAL_CODE_SESSIONS[0].id,
  ]);
  const [navHistoryIndex, setNavHistoryIndex] = useState(0);

  // Composer / model controls
  const [modelId, setModelId] = useState<ModelId>('gemini-4-hydrogen');
  const [effort, setEffort] = useState<EffortLevel>('high');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('manual');
  const [tools] = useState<ToolSettings>({
    webSearch: true,
    extendedThinking: false,
    artifacts: true,
    responseStyle: 'normal',
  });
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);

  // Modèles découverts en direct depuis le bridge FCC (mode 'fcc' uniquement)
  const [fccModels, setFccModels] = useState<ModelConfig[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (preferences.fcc.mode === 'fcc' && preferences.fcc.endpointUrl.trim().length > 0) {
      fetchFccModels(preferences.fcc.endpointUrl).then((models) => {
        if (!cancelled) setFccModels(models);
      });
    } else {
      setFccModels([]);
    }
    return () => {
      cancelled = true;
    };
  }, [preferences.fcc.mode, preferences.fcc.endpointUrl]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modals
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsSectionId | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2800);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.codeSessions, JSON.stringify(codeSessions));
    } catch {
      // ignore
    }
  }, [codeSessions]);

  // Sync light / dark / system theme onto <html class="dark">
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (mode: ThemeMode) => {
      if (mode === 'dark') {
        root.classList.add('dark');
      } else if (mode === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      }
    };

    applyTheme(preferences.theme);

    if (preferences.theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => applyTheme('system');
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
  }, [preferences.theme]);

  // Collapse right rail automatically if viewport shrinks below desktop lg (1024px)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setRightPane((prev) => (prev === 'rail' ? 'none' : prev));
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const pushCodeHistory = useCallback((sessionId: string | null) => {
    setActiveCodeSessionId(sessionId);
    setCodeSubPage('session');
    setNavHistory((prev) => {
      const sliced = prev.slice(0, navHistoryIndex + 1);
      if (sliced[sliced.length - 1] === sessionId) return sliced;
      const next = [...sliced, sessionId];
      setNavHistoryIndex(next.length - 1);
      return next;
    });
  }, [navHistoryIndex]);

  const handleGoBack = useCallback(() => {
    if (navHistoryIndex <= 0) return;
    const nextIdx = navHistoryIndex - 1;
    setNavHistoryIndex(nextIdx);
    setActiveCodeSessionId(navHistory[nextIdx]);
    setCodeSubPage('session');
  }, [navHistory, navHistoryIndex]);

  const handleGoForward = useCallback(() => {
    if (navHistoryIndex >= navHistory.length - 1) return;
    const nextIdx = navHistoryIndex + 1;
    setNavHistoryIndex(nextIdx);
    setActiveCodeSessionId(navHistory[nextIdx]);
    setCodeSubPage('session');
  }, [navHistory, navHistoryIndex]);

  const handleNewChat = useCallback(() => {
    handleStopGeneration();
    pushCodeHistory(null);
    setRightPane('none');
    setDraft('');
    setAttachments([]);
  }, [handleStopGeneration, pushCodeHistory]);

  // Global Claude Desktop keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (isMod && e.key === ',') {
        e.preventDefault();
        setSettingsTab((prev) => (prev ? null : 'models'));
      } else if (isMod && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (isMod && e.key === '.') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      } else if (isMod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleNewChat();
      } else if (
        e.key === 'Escape' &&
        isGenerating &&
        !searchOpen &&
        !settingsTab &&
        !shortcutsOpen &&
        !importModalOpen
      ) {
        e.preventDefault();
        handleStopGeneration();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleNewChat,
    handleStopGeneration,
    importModalOpen,
    isGenerating,
    searchOpen,
    settingsTab,
    shortcutsOpen,
  ]);

  const activeWorkspace = useMemo(
    () =>
      INITIAL_CODE_WORKSPACES.find((w) => w.id === activeWorkspaceId) ??
      INITIAL_CODE_WORKSPACES[0],
    [activeWorkspaceId]
  );

  const activeCodeSession = useMemo(
    () => codeSessions.find((s) => s.id === activeCodeSessionId) ?? null,
    [codeSessions, activeCodeSessionId]
  );

  // Stream into Code Session
  const runCodeTurnStream = useCallback(
    async (params: {
      sessionId: string;
      turnId: string;
      prompt: string;
      history: ConversationHistoryTurn[];
      usedAttachments: Attachment[];
    }) => {
      handleStopGeneration();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsGenerating(true);

      const adapter = createClaudeAdapter(preferences.fcc);

      try {
        const stream = adapter.sendMessageStream(
          {
            conversationId: params.sessionId,
            prompt: params.prompt,
            history: params.history,
            modelId,
            effort,
            permissionMode,
            tools: {
              ...tools,
              extendedThinking: effort === 'high' || effort === 'max',
            },
            attachments: params.usedAttachments,
            projectName: activeWorkspace.name,
          },
          controller.signal
        );

        for await (const event of stream) {
          if (event.type === 'text_delta') {
            setCodeSessions((prev) =>
              prev.map((sess) =>
                sess.id !== params.sessionId
                  ? sess
                  : {
                      ...sess,
                      turns: sess.turns.map((t) =>
                        t.id === params.turnId
                          ? { ...t, content: t.content + event.delta }
                          : t
                      ),
                    }
              )
            );
          } else if (event.type === 'done') {
            setCodeSessions((prev) =>
              prev.map((sess) =>
                sess.id !== params.sessionId
                  ? sess
                  : {
                      ...sess,
                      turns: sess.turns.map((t) =>
                        t.id === params.turnId ? { ...t, isStreaming: false } : t
                      ),
                    }
              )
            );
          }
        }
      } catch (err) {
        const wasAbort = err instanceof DOMException && err.name === 'AbortError';
        const errorDetail =
          err instanceof Error && err.message
            ? err.message
            : 'Erreur de communication avec le serveur.';
        setCodeSessions((prev) =>
          prev.map((sess) =>
            sess.id !== params.sessionId
              ? sess
              : {
                  ...sess,
                  turns: sess.turns.map((t) =>
                    t.id === params.turnId
                      ? {
                          ...t,
                          isStreaming: false,
                          wasStopped: wasAbort,
                          content: wasAbort
                            ? t.content
                            : `${t.content}${t.content ? '\n\n' : ''}> **Erreur de réponse** : ${errorDetail}`,
                        }
                      : t
                  ),
                }
          )
        );
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsGenerating(false);
      }
    },
    [
      activeWorkspace.name,
      effort,
      handleStopGeneration,
      modelId,
      permissionMode,
      preferences.fcc,
      tools,
    ]
  );

  const handleSendCodeMessage = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isGenerating) return;

    const nowIso = new Date().toISOString();
    const promptText =
      trimmed || `Analyse ces fichiers : ${attachments.map((a) => a.name).join(', ')}`;
    const usedAttachments = [...attachments];
    const isDemoMode = preferences.fcc.mode === 'demo';

    const userTurn: CodeTurn = {
      id: `cu-${Date.now()}`,
      role: 'user',
      content: promptText,
      createdAt: nowIso,
    };

    const assistantTurn: CodeTurn = {
      id: `ca-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      createdAt: nowIso,
      modelId,
      effort,
      isStreaming: true,
      ...(isDemoMode
        ? {
            toolGroupSummary: '1 fichier lu (espace de démo)',
            toolGroupDefaultExpanded: false,
            toolCalls: [
              {
                id: `tc-auto-${Date.now()}`,
                kind: 'read' as const,
                label: 'Lu',
                target: activeWorkspace.files[0]?.path ?? 'index.html',
                outputPreview: 'Contexte de démonstration chargé dans le navigateur.',
              },
            ],
          }
        : {}),
    };

    setDraft('');
    setAttachments([]);

    if (!activeCodeSession) {
      const newSessionId = `code-sess-${Date.now()}`;
      const created: CodeSession = {
        id: newSessionId,
        workspaceId: activeWorkspace.id,
        title: generateConversationTitle(promptText),
        updatedAt: nowIso,
        originLabel:
          preferences.fcc.mode === 'gemini'
            ? `API Gemini (${modelId.startsWith('gemini-') ? modelId : 'gemini-4-hydrogen'}) · ${activeWorkspace.name}`
            : `Démarré dans l’espace de démo · ${activeWorkspace.name}`,
        contextLimitTokens: 128000,
        contextCategories: [
          { id: 'messages', label: 'Messages', color: '#3B82F6', tokens: 4200 },
          { id: 'system-tools', label: 'Outils système', color: '#F97316', tokens: 12700 },
          { id: 'system-prompt', label: 'Prompt système', color: '#34A853', tokens: 3200 },
        ],
        mcpToolsCount: 0,
        memoryFilesCount: 1,
        outputs: [],
        diffs: [],
        terminalLines: ['$ # Session active'],
        turns: [userTurn, assistantTurn],
        sideChats: [],
      };
      setCodeSessions((prev) => [created, ...prev]);
      pushCodeHistory(newSessionId);
      if (typeof window === 'undefined' || window.innerWidth >= 1024) {
        setRightPane('rail');
      }
      void runCodeTurnStream({
        sessionId: newSessionId,
        turnId: assistantTurn.id,
        prompt: promptText,
        history: [],
        usedAttachments,
      });
    } else {
      const targetId = activeCodeSession.id;
      const priorHistory: ConversationHistoryTurn[] = activeCodeSession.turns
        .filter((t) => Boolean(t.content.trim()))
        .map((t) => ({ role: t.role, content: t.content }));

      setCodeSessions((prev) =>
        prev.map((s) =>
          s.id === targetId
            ? { ...s, updatedAt: nowIso, turns: [...s.turns, userTurn, assistantTurn] }
            : s
        )
      );
      void runCodeTurnStream({
        sessionId: targetId,
        turnId: assistantTurn.id,
        prompt: promptText,
        history: priorHistory,
        usedAttachments,
      });
    }
  }, [
    activeCodeSession,
    activeWorkspace,
    attachments,
    draft,
    effort,
    isGenerating,
    modelId,
    preferences.fcc.mode,
    pushCodeHistory,
    runCodeTurnStream,
  ]);

  const handleExecuteSlashCommand = useCallback(
    (commandName: string, args: string) => {
      switch (commandName) {
        case 'clear':
          handleNewChat();
          showToast('Nouvelle session démarrée (/clear)');
          break;
        case 'compact':
          if (activeCodeSession) {
            setCodeSessions((prev) => compactSessionContext(prev, activeCodeSession.id));
            setRightPane('rail');
            showToast('Contexte compacté (/compact)');
          }
          break;
        case 'btw': {
          const targetSession = activeCodeSession ?? codeSessions[0];
          if (!targetSession) return;
          if (!activeCodeSession) pushCodeHistory(targetSession.id);
          if (args.trim()) {
            const reply = `Réponse rapide \`/btw\` (démo) : concernant **${args.trim()}**, la session principale reste intacte et votre contexte n’est pas modifié.`;
            const res = appendSideChatExchange(
              codeSessions,
              targetSession.id,
              null,
              args.trim(),
              reply
            );
            setCodeSessions(res.sessions);
            setActiveSideChatId(res.activeSideChatId);
          } else {
            setActiveSideChatId(targetSession.sideChats[0]?.id ?? null);
          }
          setRightPane('side-chat');
          break;
        }
        case 'review':
          setRightPane('changes');
          showToast('Panneau des changements ouvert (/review)');
          break;
        case 'plan':
          setPermissionMode('plan');
          showToast('Mode Plan activé (/plan)');
          break;
        case 'permissions':
          setPermissionMode((prev) =>
            prev === 'manual' ? 'auto-edit' : prev === 'auto-edit' ? 'plan' : 'manual'
          );
          showToast('Mode de permission basculé (/permissions)');
          break;
        case 'effort': {
          const order: EffortLevel[] = ['low', 'medium', 'high', 'max'];
          const next = order[(order.indexOf(effort) + 1) % order.length];
          setEffort(next);
          showToast(`Effort réglé sur ${next.toUpperCase()} (/effort)`);
          break;
        }
        case 'model':
          setSettingsTab('models');
          break;
        case 'rename':
          if (activeCodeSession && args.trim()) {
            setCodeSessions((prev) =>
              prev.map((s) =>
                s.id === activeCodeSession.id ? { ...s, title: args.trim() } : s
              )
            );
            showToast(`Session renommée en « ${args.trim()} »`);
          }
          break;
        case 'fork':
          if (activeCodeSession) {
            const copyId = `code-fork-${Date.now()}`;
            const forked: CodeSession = {
              ...activeCodeSession,
              id: copyId,
              title: `${activeCodeSession.title} (copie)`,
              updatedAt: new Date().toISOString(),
            };
            setCodeSessions((prev) => [forked, ...prev]);
            pushCodeHistory(copyId);
            showToast('Session dupliquée (/fork)');
          }
          break;
        case 'cd': {
          const nextWs =
            INITIAL_CODE_WORKSPACES.find((w) => w.id !== activeWorkspaceId) ??
            INITIAL_CODE_WORKSPACES[0];
          setActiveWorkspaceId(nextWs.id);
          showToast(`Espace de démonstration : ${nextWs.name}`);
          break;
        }
        default:
          showToast(`Commande /${commandName} exécutée (mode démo)`);
      }
    },
    [
      activeCodeSession,
      activeWorkspaceId,
      codeSessions,
      effort,
      handleNewChat,
      pushCodeHistory,
      showToast,
    ]
  );

  const handleResetDemoData = useCallback(() => {
    handleStopGeneration();
    setCodeSessions(INITIAL_CODE_SESSIONS);
    setPreferences(DEFAULT_PREFERENCES);
    setActiveCodeSessionId(INITIAL_CODE_SESSIONS[0].id);
    setRightPane(typeof window !== 'undefined' && window.innerWidth < 1024 ? 'none' : 'rail');
    setContextExpanded(false);
    setSettingsTab(null);
    showToast('Données de démonstration restaurées');
  }, [handleStopGeneration, showToast]);

  // Drag-and-drop file attachments
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingFiles(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingFiles(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFiles(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;

      const parsed: Attachment[] = droppedFiles.map((file, idx) => ({
        id: `drop-${Date.now()}-${idx}`,
        name: file.name,
        size: file.size,
        type: file.type.startsWith('image/')
          ? 'image'
          : /\.(ts|tsx|js|jsx|py|rs|go|css|html|json|yaml|yml|sh|sql)$/i.test(file.name)
            ? 'code'
            : 'document',
        mimeType: file.type || 'application/octet-stream',
      }));

      setAttachments((prev) => [...prev, ...parsed]);
      showToast(
        parsed.length === 1
          ? `Pièce jointe « ${parsed[0].name} » ajoutée`
          : `${parsed.length} pièces jointes ajoutées`
      );
    },
    [showToast]
  );

  return (
    <div
      data-surface="code"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-[100dvh] w-screen overflow-hidden bg-[var(--claude-bg)] text-[var(--claude-text-primary)]"
    >
      {/* Left Collapsible Sidebar — Always OpenClaudeDesktop 4.x */}
      <CodeSidebar
        isOpen={sidebarOpen}
        isMobileOpen={mobileSidebarOpen}
        onToggleOpen={() => setSidebarOpen((prev) => !prev)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        surfaceMode={surfaceMode}
        onChangeSurfaceMode={(nextMode) => {
          setSurfaceMode(nextMode);
          if (nextMode === 'chat') {
            setRightPane('none');
          } else if (
            activeCodeSessionId &&
            rightPane === 'none' &&
            (typeof window === 'undefined' || window.innerWidth >= 1024)
          ) {
            setRightPane('rail');
          }
        }}
        canGoBack={navHistoryIndex > 0}
        canGoForward={navHistoryIndex < navHistory.length - 1}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        workspaces={INITIAL_CODE_WORKSPACES}
        activeWorkspaceId={activeWorkspace.id}
        onSelectWorkspace={(wsId) => {
          setMobileSidebarOpen(false);
          setActiveWorkspaceId(wsId);
          const first = codeSessions.find((s) => s.workspaceId === wsId);
          pushCodeHistory(first?.id ?? null);
        }}
        sessions={codeSessions}
        activeSessionId={activeCodeSessionId}
        activeSubPage={codeSubPage}
        onNewSession={() => {
          setMobileSidebarOpen(false);
          pushCodeHistory(null);
          setRightPane('none');
        }}
        onSelectSession={(sessId) => {
          setMobileSidebarOpen(false);
          pushCodeHistory(sessId);
          const chosen = codeSessions.find((s) => s.id === sessId);
          setActiveSideChatId(chosen?.sideChats[0]?.id ?? null);
          if (
            surfaceMode === 'code' &&
            rightPane === 'none' &&
            (typeof window === 'undefined' || window.innerWidth >= 1024)
          ) {
            setRightPane('rail');
          }
        }}
        onOpenSideChatFromSidebar={(sessId, scId) => {
          setMobileSidebarOpen(false);
          pushCodeHistory(sessId);
          setActiveSideChatId(scId);
          setRightPane('side-chat');
        }}
        onDeleteSession={(sessId) => {
          setCodeSessions((prev) => prev.filter((s) => s.id !== sessId));
          if (activeCodeSessionId === sessId) {
            pushCodeHistory(null);
          }
          showToast('Session supprimée');
        }}
        onOpenSearch={() => {
          setMobileSidebarOpen(false);
          setSearchOpen(true);
        }}
        onOpenCustomize={() => {
          setMobileSidebarOpen(false);
          setCodeSubPage('customize');
        }}
        onOpenImportChats={() => {
          setMobileSidebarOpen(false);
          setImportModalOpen(true);
        }}
        onOpenSettings={(tab = 'models') => {
          setMobileSidebarOpen(false);
          setSettingsTab(tab);
        }}
        onOpenShortcuts={() => {
          setMobileSidebarOpen(false);
          setShortcutsOpen(true);
        }}
        preferences={preferences}
        onThemeChange={(theme) => setPreferences((prev) => ({ ...prev, theme }))}
      />

      {/* Main Content Workspace */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Reopen sidebar pill on desktop when collapsed */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir la barre latérale"
            title="Ouvrir la barre latérale (⌘.)"
            className="hidden md:flex fixed left-2.5 top-2 z-30 h-7 w-7 items-center justify-center rounded-md border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[var(--claude-text-secondary)] shadow-xs hover:text-[var(--claude-text-primary)]"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {/* Mobile Unified Top Bar (Single clean 48px bar, 40px touch targets) */}
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--claude-border)] bg-[var(--claude-bg)] px-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Ouvrir le menu latéral"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--claude-text-secondary)] active:bg-[var(--claude-surface-subtle)]"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <span className="block truncate text-[14px] font-medium text-[var(--claude-text-primary)]">
              {codeSubPage === 'customize'
                ? 'Personnaliser'
                : activeCodeSession
                  ? activeCodeSession.title
                  : 'Nouvelle session'}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {codeSubPage === 'session' && (
              <button
                type="button"
                onClick={() =>
                  setRightPane((prev) => (prev === 'none' ? 'rail' : 'none'))
                }
                aria-label="Panneau outils et contexte"
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  rightPane !== 'none'
                    ? 'bg-[var(--claude-sidebar-active)] text-[var(--claude-text-primary)]'
                    : 'text-[var(--claude-text-secondary)] active:bg-[var(--claude-surface-subtle)]'
                }`}
              >
                <PanelRight className="h-4.5 w-4.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleNewChat}
              aria-label="Nouvelle session"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--claude-text-primary)] active:bg-[var(--claude-surface-subtle)]"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Workspace Split */}
        <main className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {codeSubPage === 'customize' ? (
                  <CustomizeView onOpenFccSettings={() => setSettingsTab('fcc')} />
                ) : activeCodeSession ? (
                  <CodeSessionView
                    session={activeCodeSession}
                    workspace={activeWorkspace}
                    rightPane={rightPane}
                    onToggleRightPane={(pane) =>
                      setRightPane((prev) => (prev === pane ? 'none' : pane))
                    }
                    draft={draft}
                    onDraftChange={setDraft}
                    onSend={handleSendCodeMessage}
                    onStop={handleStopGeneration}
                    onExecuteSlashCommand={handleExecuteSlashCommand}
                    isGenerating={isGenerating}
                    modelId={modelId}
                    onModelChange={setModelId}
                    fccModels={fccModels}
                    effort={effort}
                    onEffortChange={setEffort}
                    permissionMode={permissionMode}
                    onPermissionModeChange={setPermissionMode}
                    attachments={attachments}
                    onAddAttachments={(files) =>
                      setAttachments((prev) => [...prev, ...files])
                    }
                    onRemoveAttachment={(id) =>
                      setAttachments((prev) => prev.filter((a) => a.id !== id))
                    }
                    onRenameSession={(nextTitle) =>
                      setCodeSessions((prev) =>
                        prev.map((s) =>
                          s.id === activeCodeSession.id ? { ...s, title: nextTitle } : s
                        )
                      )
                    }
                    onDeleteSession={() => {
                      const delId = activeCodeSession.id;
                      setCodeSessions((prev) => prev.filter((s) => s.id !== delId));
                      pushCodeHistory(null);
                      showToast('Session supprimée');
                    }}
                    onSaveEnvironment={() => {
                      setCodeSessions((prev) =>
                        prev.map((s) =>
                          s.id === activeCodeSession.id
                            ? { ...s, savedEnvironment: true }
                            : s
                        )
                      );
                      showToast('Environnement de démonstration enregistré');
                    }}
                    onResolveApproval={(approvalId, decision) => {
                      setCodeSessions((prev) =>
                        resolveApprovalInSession(prev, activeCodeSession.id, approvalId, decision)
                      );
                      showToast(
                        decision === 'denied'
                          ? 'Commande refusée'
                          : 'Commande autorisée (simulation démo)'
                      );
                    }}
                    onResolveNextStep={(nextStepId, resolution) => {
                      setCodeSessions((prev) =>
                        resolveNextStepInSession(prev, activeCodeSession.id, nextStepId, resolution)
                      );
                      if (resolution.markCommitted) {
                        showToast('Changements validés dans l’espace de démo');
                      }
                    }}
                    onOpenSideChat={() => {
                      setActiveSideChatId(activeCodeSession.sideChats[0]?.id ?? null);
                      setRightPane('side-chat');
                    }}
                    onOpenContextRail={() => {
                      setRightPane('rail');
                      setContextExpanded(true);
                    }}
                    onUndoEdits={() => showToast('Modifications annulées (démo)')}
                    sendWithEnter={preferences.sendWithEnter}
                    chatFont={preferences.chatFont}
                  />
                ) : (
                  <CodeHomeView
                    workspaces={INITIAL_CODE_WORKSPACES}
                    activeWorkspace={activeWorkspace}
                    onSelectWorkspace={(wsId) => setActiveWorkspaceId(wsId)}
                    draft={draft}
                    onDraftChange={setDraft}
                    onSend={handleSendCodeMessage}
                    onStop={handleStopGeneration}
                    onExecuteSlashCommand={handleExecuteSlashCommand}
                    isGenerating={isGenerating}
                    modelId={modelId}
                    onModelChange={setModelId}
                    fccModels={fccModels}
                    effort={effort}
                    onEffortChange={setEffort}
                    permissionMode={permissionMode}
                    onPermissionModeChange={setPermissionMode}
                    attachments={attachments}
                    onAddAttachments={(files) =>
                      setAttachments((prev) => [...prev, ...files])
                    }
                    onRemoveAttachment={(id) =>
                      setAttachments((prev) => prev.filter((a) => a.id !== id))
                    }
                    onOpenRightPane={(pane) =>
                      setRightPane((prev) => (prev === pane ? 'none' : pane))
                    }
                    sendWithEnter={preferences.sendWithEnter}
                  />
                )}
              </div>

              {/* Right Split Pane: Rail / Changes Diff / Side Chat (/btw) / Terminal / Files / Preview */}
              {codeSubPage === 'session' && rightPane !== 'none' && (
                <CodeRightPane
                  mode={rightPane}
                  session={activeCodeSession}
                  workspace={activeWorkspace}
                  chatFont={preferences.chatFont}
                  activeSideChatId={activeSideChatId}
                  onSelectSideChat={(id) => setActiveSideChatId(id)}
                  onCreateNewSideChat={() => setActiveSideChatId(null)}
                  onSendSideChat={(question) => {
                    const target = activeCodeSession ?? codeSessions[0];
                    if (!target) return;

                    if (preferences.fcc.mode !== 'gemini') {
                      const reply = `Dans le contexte de **${target.title}**, \`${question}\` est traité localement dans ce side chat sans altérer le fil principal.`;
                      const res = appendSideChatExchange(
                        codeSessions,
                        target.id,
                        activeSideChatId,
                        question,
                        reply
                      );
                      setCodeSessions(res.sessions);
                      setActiveSideChatId(res.activeSideChatId);
                      return;
                    }

                    const res = appendSideChatExchange(
                      codeSessions,
                      target.id,
                      activeSideChatId,
                      question,
                      '…'
                    );
                    setCodeSessions(res.sessions);
                    setActiveSideChatId(res.activeSideChatId);
                    const sideChatId = res.activeSideChatId;

                    void (async () => {
                      const adapter = createClaudeAdapter(preferences.fcc);
                      const ctrl = new AbortController();
                      let acc = '';
                      try {
                        for await (const ev of adapter.sendMessageStream(
                          {
                            conversationId: `${target.id}-btw`,
                            prompt: question,
                            modelId,
                            effort: 'low',
                            mode: 'btw',
                            tools,
                            attachments: [],
                            projectName: activeWorkspace.name,
                          },
                          ctrl.signal
                        )) {
                          if (ev.type === 'text_delta') {
                            acc += ev.delta;
                            setCodeSessions((prev) =>
                              prev.map((sess) =>
                                sess.id !== target.id
                                  ? sess
                                  : {
                                      ...sess,
                                      sideChats: sess.sideChats.map((sc) =>
                                        sc.id !== sideChatId
                                          ? sc
                                          : {
                                              ...sc,
                                              messages: sc.messages.map((m, idx) =>
                                                idx === sc.messages.length - 1
                                                  ? { ...m, content: acc }
                                                  : m
                                              ),
                                            }
                                      ),
                                    }
                              )
                            );
                          }
                        }
                      } catch (err) {
                        const msg =
                          err instanceof Error ? err.message : 'Erreur API Gemini';
                        setCodeSessions((prev) =>
                          prev.map((sess) =>
                            sess.id !== target.id
                              ? sess
                              : {
                                  ...sess,
                                  sideChats: sess.sideChats.map((sc) =>
                                    sc.id !== sideChatId
                                      ? sc
                                      : {
                                          ...sc,
                                          messages: sc.messages.map((m, idx) =>
                                            idx === sc.messages.length - 1
                                              ? { ...m, content: `> ${msg}` }
                                              : m
                                          ),
                                        }
                                  ),
                                }
                          )
                        );
                      }
                    })();
                  }}
                  onClosePane={() => setRightPane('none')}
                  onSwitchPane={(nextMode) => setRightPane(nextMode)}
                  onSaveEnvironment={() => {
                    if (!activeCodeSession) return;
                    setCodeSessions((prev) =>
                      prev.map((s) =>
                        s.id === activeCodeSession.id ? { ...s, savedEnvironment: true } : s
                      )
                    );
                    showToast('Environnement enregistré');
                  }}
                  onCommitChanges={() => {
                    if (!activeCodeSession) return;
                    setCodeSessions((prev) =>
                      prev.map((s) =>
                        s.id === activeCodeSession.id ? { ...s, committed: true } : s
                      )
                    );
                    showToast('Changements validés (simulation démo)');
                  }}
                  contextExpanded={contextExpanded}
                  onToggleContextExpanded={() => setContextExpanded((v) => !v)}
                />
          )}
        </main>
      </div>

      {/* Modals */}
      {searchOpen && (
        <SearchModal
          sessions={codeSessions}
          workspaces={INITIAL_CODE_WORKSPACES}
          onClose={() => setSearchOpen(false)}
          onSelectSession={(id) => {
            const target = codeSessions.find((s) => s.id === id);
            if (target) setActiveWorkspaceId(target.workspaceId);
            pushCodeHistory(id);
            setActiveSideChatId(target?.sideChats[0]?.id ?? null);
          }}
          onSelectWorkspace={(wsId) => {
            setActiveWorkspaceId(wsId);
            const first = codeSessions.find((s) => s.workspaceId === wsId);
            pushCodeHistory(first?.id ?? null);
          }}
        />
      )}

      {settingsTab && (
        <SettingsModal
          initialTab={settingsTab}
          preferences={preferences}
          fccModels={fccModels}
          onUpdatePreferences={setPreferences}
          onClose={() => setSettingsTab(null)}
          onResetDemoData={handleResetDemoData}
        />
      )}

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}

      {importModalOpen && (
        <ImportChatsModal
          onClose={() => setImportModalOpen(false)}
          onImportConversation={(title, content) => {
            const nowIso = new Date().toISOString();
            const newId = `code-import-${Date.now()}`;
            const importedSession: CodeSession = {
              id: newId,
              workspaceId: activeWorkspace.id,
              title: title.trim() || 'Session importée',
              updatedAt: nowIso,
              originLabel: `Importé dans le navigateur · ${activeWorkspace.name}`,
              contextLimitTokens: 128000,
              contextCategories: [
                { id: 'messages', label: 'Messages', color: '#3B82F6', tokens: Math.max(800, content.length * 2) },
                { id: 'system-tools', label: 'Outils système', color: '#F97316', tokens: 6400 },
                { id: 'system-prompt', label: 'Prompt système', color: '#34A853', tokens: 3200 },
              ],
              mcpToolsCount: 0,
              memoryFilesCount: 0,
              outputs: [],
              diffs: [],
              terminalLines: ['$ # Session importée côté navigateur (mode démo)'],
              sideChats: [],
              turns: [
                {
                  id: `imp-u-${Date.now()}`,
                  role: 'user',
                  content: `Transcription importée : ${title}`,
                  createdAt: nowIso,
                },
                {
                  id: `imp-a-${Date.now() + 1}`,
                  role: 'assistant',
                  content,
                  createdAt: nowIso,
                  modelId,
                  effort,
                },
              ],
            };
            setCodeSessions((prev) => [importedSession, ...prev]);
            pushCodeHistory(newId);
            showToast(`Session « ${importedSession.title} » importée`);
          }}
        />
      )}

      {/* Drag-and-drop overlay */}
      {isDraggingFiles && (
        <div className="claude-animate-backdrop pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[var(--claude-bg)]/80 backdrop-blur-[3px]">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-[var(--claude-accent)] bg-[var(--claude-bg-elevated)] px-10 py-8 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--claude-accent-soft)] text-[var(--claude-accent)]">
              <Paperclip className="h-6 w-6" />
            </div>
            <div className="font-claude-serif text-xl text-[var(--claude-text-primary)]">
              Déposez vos fichiers pour les joindre
            </div>
            <p className="text-xs text-[var(--claude-text-muted)]">
              Traités uniquement côté navigateur — aucun accès au système de fichiers local
            </p>
          </div>
        </div>
      )}

      {/* Subtle Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="claude-animate-fade-up fixed bottom-5 right-5 z-50 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-text-primary)] px-4 py-2.5 text-xs font-medium text-[var(--claude-bg)] shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
