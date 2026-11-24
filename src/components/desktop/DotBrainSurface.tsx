/**
 * DotBrainSurface - Connects OpenClaudeDesktop's real multi-agent orchestrator,
 * live Gemini/FCC model providers, workspace folder explorer, pre-launch
 * conversational dialogue, and 39 specialized agents to the Dot Brain workspace.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Square,
} from 'lucide-react';
import { DotBrainWorkspace } from '@/dot-brain/src/components/DotBrainWorkspace';
import type {
  Agent as DotBrainAgent,
  AgentAction,
  DotAttachedWorkspaceFile,
  DotEffortLevel,
  DotModelOption,
  DotPermissionMode,
  DotWorkspaceOption,
  MissionAttachment,
  MissionMode,
  MissionPayload,
  ThemeMode,
} from '@/dot-brain/src/types/dotBrain';
import type {
  CodeWorkspace,
  EffortLevel,
  ModelConfig,
  ModelId,
  PermissionMode,
} from '../../types/claude';
import type { Mission, ProviderState } from '../../types/agent';
import { ALL_AGENTS } from '../../data/agents';
import { CLAUDE_MODELS } from '../../data/demoData';
import { agentOrchestrator } from '../../services/agentOrchestrator';
import { subscribe } from '../../services/dot/dotMonitor';
import {
  buildDotBrainConnections,
  buildDotBrainGroups,
  mapAgentToDotBrainAgent,
  type RecentAgentComm,
} from '../../services/dot/dotBrainMapper';
import {
  buildMissionBriefFromConversation,
  buildOrchestratorSystemPrompt,
  isLaunchCommand,
  type DotChatMessage,
} from '../../services/dot/dotConversation';
import {
  DotBrainMissionDrawer,
  type DotBrainDrawerTab,
} from './DotBrainMissionDrawer';
import {
  DotBrainWorkspaceDrawer,
  type WorkspaceTreeNode,
} from './DotBrainWorkspaceDrawer';

export interface DotBrainSurfaceProps {
  onClose?: () => void;
  fccMode: string;
  fccEndpointUrl: string;
  sendWithCredentials?: boolean;
  theme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
  onOpenSettings?: () => void;
  // Shared model, effort, permission & folder controls (synced with Mode Code / Chat)
  modelId?: ModelId;
  onModelChange?: (id: ModelId) => void;
  fccModels?: ModelConfig[];
  effort?: EffortLevel;
  onEffortChange?: (effort: EffortLevel) => void;
  permissionMode?: PermissionMode;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  workspaces?: CodeWorkspace[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (workspaceId: string) => void;
  onOpenFolderPicker?: () => void;
}

const GEMINI_MODEL_LABELS: Record<string, { label: string; shortLabel: string }> = {
  'gemini-4-hydrogen': {
    label: 'Gemini 4 Hydrogen',
    shortLabel: 'Gemini 4 Hydrogen',
  },
  'gemini-3.1-flash-lite': {
    label: 'Gemini 3.1 Flash Lite',
    shortLabel: 'Gemini 3.1 Flash Lite',
  },
};

function formatGeminiModelLabel(id: string): { label: string; shortLabel: string } {
  return GEMINI_MODEL_LABELS[id] ?? { label: id, shortLabel: id };
}

async function readLocalAttachments(
  attachments: MissionAttachment[],
): Promise<Array<{ name: string; content: string }>> {
  const results: Array<{ name: string; content: string }> = [];
  for (const att of attachments.slice(0, 4)) {
    if (att.file && att.size <= 150_000) {
      try {
        const text = await att.file.text();
        results.push({ name: att.name, content: text.slice(0, 3500) });
      } catch {
        results.push({ name: att.name, content: '' });
      }
    } else {
      results.push({ name: att.name, content: '' });
    }
  }
  return results;
}

export const DotBrainSurface: React.FC<DotBrainSurfaceProps> = ({
  fccMode,
  fccEndpointUrl,
  sendWithCredentials = false,
  theme = 'light',
  onThemeChange,
  onOpenSettings,
  modelId: externalModelId,
  onModelChange,
  fccModels,
  onEffortChange,
  permissionMode = 'manual',
  onPermissionModeChange,
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenFolderPicker,
}) => {
  const [agentVersion, setAgentVersion] = useState(0);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [activeRightDrawer, setActiveRightDrawer] = useState<'none' | 'mission' | 'workspace'>(
    'none',
  );
  const [drawerTab, setDrawerTab] = useState<DotBrainDrawerTab>('dialogue');

  // Pre-launch conversational dialogue state (Dot Brain talks first, launches on user go-ahead)
  const [chatMessages, setChatMessages] = useState<DotChatMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [lastMissionMode, setLastMissionMode] = useState<MissionMode>('orchestration');
  const [pendingLocalAttachments, setPendingLocalAttachments] = useState<
    Array<{ name: string; content: string }>
  >([]);

  const [recentComms, setRecentComms] = useState<RecentAgentComm[]>([]);
  const [isCheckingProvider, setIsCheckingProvider] = useState(true);
  const [providerInfo, setProviderInfo] = useState<ProviderState>(() =>
    agentOrchestrator.getProviderState(),
  );
  const [selectedDotModel, setSelectedDotModel] = useState<string>('auto');
  const [dotEffort, setDotEffort] = useState<DotEffortLevel>('low');
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  // Real workspace folder state (/api/fs/workspace-root & /api/fs/tree)
  const [workspaceRootPath, setWorkspaceRootPath] = useState<string>('');
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceTreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [attachedWorkspaceFiles, setAttachedWorkspaceFiles] = useState<
    DotAttachedWorkspaceFile[]
  >([]);

  const noticeTimerRef = useRef<number | null>(null);
  const activeMissionIdRef = useRef<string | null>(null);
  const replyAbortRef = useRef<AbortController | null>(null);

  const showNotice = useCallback((msg: string) => {
    setInlineNotice(msg);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setInlineNotice(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      replyAbortRef.current?.abort();
    };
  }, []);

  const verifyConnection = useCallback(async () => {
    setIsCheckingProvider(true);
    try {
      const state = await agentOrchestrator.checkProviderConnection({
        mode: (fccMode === 'fcc' || fccMode === 'gemini' || fccMode === 'demo'
          ? fccMode
          : 'gemini') as 'demo' | 'gemini' | 'fcc',
        endpointUrl: fccEndpointUrl,
        workspaceLabel: 'dot-brain',
        sendWithCredentials,
      });
      setProviderInfo(state);
      setAgentVersion((v) => v + 1);
    } finally {
      setIsCheckingProvider(false);
    }
  }, [fccMode, fccEndpointUrl, sendWithCredentials]);

  // Actively probe real provider connectivity when entering Agents mode or changing FCC config
  useEffect(() => {
    void verifyConnection();
  }, [verifyConnection]);

  // Load real workspace root & directory tree from server
  const loadWorkspaceTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const [rootRes, treeRes] = await Promise.all([
        fetch('/api/fs/workspace-root'),
        fetch('/api/fs/tree?path=.&maxDepth=3'),
      ]);
      if (rootRes.ok) {
        const rootData = (await rootRes.json()) as { workspaceRoot?: string };
        if (rootData.workspaceRoot) setWorkspaceRootPath(rootData.workspaceRoot);
      }
      if (!treeRes.ok) {
        const errData = (await treeRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `HTTP ${treeRes.status}`);
      }
      const treeData = (await treeRes.json()) as { tree?: WorkspaceTreeNode[] };
      setWorkspaceTree(Array.isArray(treeData.tree) ? treeData.tree : []);
    } catch (err) {
      setTreeError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger l’arborescence du dossier.',
      );
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  // Refresh workspace root & tree on mount and whenever active workspace changes
  useEffect(() => {
    const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
    const syncAndLoad = async () => {
      if (activeWs?.pathLabel && activeWs.pathLabel.startsWith('/')) {
        try {
          await fetch('/api/fs/workspace-root', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: activeWs.pathLabel }),
          });
        } catch {
          // non-fatal if virtual workspace path doesn't exist on server disk
        }
      }
      await loadWorkspaceTree();
    };
    void syncAndLoad();
  }, [activeWorkspaceId, workspaces, loadWorkspaceTree]);

  // Subscribe to all live Dot Brain orchestrator events for real-time UI sync
  useEffect(() => {
    const syncMissionSnapshot = (missionId?: string) => {
      const targetId = missionId ?? activeMissionIdRef.current;
      if (!targetId) return;
      const latest = agentOrchestrator.getMissionById(targetId);
      if (latest) {
        setActiveMission({
          ...latest,
          steps: latest.steps.map((s) => ({ ...s })),
          messages: [...latest.messages],
        });
      }
    };

    const unsub = subscribe((event) => {
      setAgentVersion((v) => v + 1);

      if (event.type === 'provider_connected' || event.type === 'provider_disconnected') {
        setProviderInfo(agentOrchestrator.getProviderState());
      }

      if (
        event.type === 'agent_communicating' &&
        event.agentId &&
        typeof event.data.toAgentId === 'string'
      ) {
        const comm: RecentAgentComm = {
          id: event.id,
          fromId: event.agentId,
          toId: event.data.toAgentId,
          type: String(event.data.message ?? '').includes('Revue')
            ? 'verification'
            : 'orchestration',
          label: typeof event.data.message === 'string' ? event.data.message : undefined,
          timestamp: Date.now(),
        };
        setRecentComms((prev) => [comm, ...prev].slice(0, 32));
      }

      if (
        event.type === 'mission_created' ||
        event.type === 'mission_started' ||
        event.type === 'mission_paused' ||
        event.type === 'mission_completed' ||
        event.type === 'mission_failed' ||
        event.type === 'step_assigned' ||
        event.type === 'step_started' ||
        event.type === 'step_completed' ||
        event.type === 'step_failed' ||
        event.type === 'step_corrected' ||
        event.type === 'agent_status_changed'
      ) {
        if (event.missionId) {
          activeMissionIdRef.current = event.missionId;
        }
        syncMissionSnapshot(event.missionId);
      }

      if (event.type === 'mission_failed' && typeof event.data.reason === 'string') {
        showNotice(`Mission interrompue : ${event.data.reason}`);
      }
    });

    return () => unsub();
  }, [showNotice]);

  // Periodically expire stale live communication pulses cleanly
  useEffect(() => {
    if (recentComms.length === 0) return;
    const timer = window.setInterval(() => {
      const cutoff = Date.now() - 18000;
      setRecentComms((prev) => {
        const filtered = prev.filter((c) => c.timestamp >= cutoff);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [recentComms.length]);

  const providerModels = useMemo(
    () => agentOrchestrator.getAvailableProviderModels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providerInfo, agentVersion],
  );
  const activeProviderModel = agentOrchestrator.getActiveProviderModel() ?? null;

  // Build available model options based on the live connected provider
  const availableModels = useMemo<DotModelOption[]>(() => {
    const autoOption: DotModelOption = {
      id: 'auto',
      label: 'Auto (selon le Dot)',
      shortLabel: 'Auto (par Dot)',
      provider: providerInfo.id,
    };

    if (providerInfo.id === 'fcc') {
      const source = fccModels && fccModels.length > 0 ? fccModels : CLAUDE_MODELS;
      return [
        autoOption,
        ...source.map((m) => ({
          id: m.id,
          label: m.name,
          shortLabel: m.shortName,
          provider: 'fcc',
          description: m.description,
        })),
      ];
    }

    const geminiIds =
      providerModels.length > 0
        ? providerModels
        : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    return [
      autoOption,
      ...geminiIds.map((id) => {
        const meta = formatGeminiModelLabel(id);
        return {
          id,
          label: meta.label,
          shortLabel: meta.shortLabel,
          provider: 'gemini',
        };
      }),
    ];
  }, [providerInfo.id, providerModels, fccModels]);

  // Keep selectedDotModel valid whenever provider/models change
  useEffect(() => {
    const validIds = new Set(availableModels.map((m) => m.id));
    if (!validIds.has(selectedDotModel)) {
      if (externalModelId && validIds.has(externalModelId)) {
        setSelectedDotModel(externalModelId);
      } else {
        setSelectedDotModel('auto');
      }
    }
  }, [availableModels, selectedDotModel, externalModelId]);

  const handleGlobalModelChange = useCallback(
    (nextModelId: string) => {
      setSelectedDotModel(nextModelId);
      if (nextModelId !== 'auto' && onModelChange) {
        onModelChange(nextModelId);
      }
      const label =
        availableModels.find((m) => m.id === nextModelId)?.shortLabel ?? nextModelId;
      showNotice(`Modèle Dot Brain : ${label}`);
    },
    [availableModels, onModelChange, showNotice],
  );

  const handleAgentModelChange = useCallback(
    (agentId: string, nextModelId: string) => {
      const updated = agentOrchestrator.setAgentModel(ALL_AGENTS, agentId, nextModelId);
      if (updated) {
        if (selectedDotModel !== 'auto') {
          setSelectedDotModel('auto');
        }
        setAgentVersion((v) => v + 1);
        const label =
          availableModels.find((m) => m.id === nextModelId)?.shortLabel ?? nextModelId;
        showNotice(`Dot ${updated.name} → ${label} (mode par Dot)`);
      }
    },
    [availableModels, selectedDotModel, showNotice],
  );

  const dotBrainAgents = useMemo<DotBrainAgent[]>(
    () =>
      ALL_AGENTS.map((a) => {
        const effectiveModel = agentOrchestrator.resolveStepModel(
          a.config.model,
          selectedDotModel,
          providerInfo.id,
          providerModels,
          activeProviderModel,
        );
        return mapAgentToDotBrainAgent(a, effectiveModel);
      }),
    // agentVersion intentionally triggers fresh immutable snapshots when orchestrator mutates agent state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentVersion, selectedDotModel, providerInfo.id, providerModels, activeProviderModel],
  );

  const dotBrainGroups = useMemo(() => buildDotBrainGroups(ALL_AGENTS), []);

  const connections = useMemo(
    () => buildDotBrainConnections(ALL_AGENTS, activeMission, recentComms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentVersion, activeMission, recentComms],
  );

  const dotWorkspaces = useMemo<DotWorkspaceOption[]>(
    () =>
      workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        pathLabel: w.pathLabel,
        branch: w.branch,
      })),
    [workspaces],
  );

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  const handleToggleAttachWorkspaceFile = useCallback(
    (file: DotAttachedWorkspaceFile) => {
      setAttachedWorkspaceFiles((prev) => {
        const exists = prev.some((item) => item.path === file.path);
        if (exists) {
          return prev.filter((item) => item.path !== file.path);
        }
        return [...prev, file];
      });
    },
    [],
  );

  const handleRemoveWorkspaceFile = useCallback((filePath: string) => {
    setAttachedWorkspaceFiles((prev) => prev.filter((item) => item.path !== filePath));
  }, []);

  // Deterministic preview of Dots ready to execute the current discussed brief
  const plannedStepsPreview = useMemo(() => {
    const hasUserTurn = chatMessages.some(
      (m) => m.role === 'user' && m.content.trim().length > 0 && !isLaunchCommand(m.content, true),
    );
    if (!hasUserTurn) return [];
    const brief = buildMissionBriefFromConversation(chatMessages);
    const steps = agentOrchestrator.decomposeMission(
      brief.title,
      brief.description,
      ALL_AGENTS,
      lastMissionMode,
    );
    return steps.map((step) => {
      const agent = ALL_AGENTS.find((a) => a.id === step.assignedAgentId);
      return {
        title: step.title,
        agentName: agent?.name ?? 'Dot',
      };
    });
  }, [chatMessages, lastMissionMode]);

  const ensureLiveProvider = useCallback(async (): Promise<ProviderState> => {
    let currentProvider = agentOrchestrator.getProviderState();
    if (!currentProvider.available) {
      currentProvider = await agentOrchestrator.checkProviderConnection({
        mode: (fccMode === 'fcc' || fccMode === 'gemini' || fccMode === 'demo'
          ? fccMode
          : 'gemini') as 'demo' | 'gemini' | 'fcc',
        endpointUrl: fccEndpointUrl,
        workspaceLabel: activeWorkspace?.name || 'dot-brain',
        sendWithCredentials,
      });
      setProviderInfo(currentProvider);
    }
    return currentProvider;
  }, [activeWorkspace?.name, fccEndpointUrl, fccMode, sendWithCredentials]);

  const readWorkspaceContextBlocks = useCallback(
    async (
      extraLocalFiles: Array<{ name: string; content: string }>,
    ): Promise<string[]> => {
      const blocks: string[] = [];

      if (workspaceTree.length > 0) {
        const topLevelSummary = workspaceTree
          .slice(0, 24)
          .map((n) => (n.isDirectory ? `${n.name}/` : n.name))
          .join(', ');
        blocks.push(
          `[Dossier actif: ${workspaceRootPath || activeWorkspace?.pathLabel || '.'}]\nEntrées principales : ${topLevelSummary}`,
        );
      }

      if (attachedWorkspaceFiles.length > 0) {
        for (const wf of attachedWorkspaceFiles.slice(0, 6)) {
          try {
            const res = await fetch(`/api/fs/read?path=${encodeURIComponent(wf.path)}`);
            if (res.ok) {
              const data = (await res.json()) as { content?: string };
              blocks.push(
                `[Fichier du dossier: ${wf.path}]\n${(data.content ?? '').slice(0, 4500)}`,
              );
            } else {
              blocks.push(`[Fichier du dossier: ${wf.path}]`);
            }
          } catch {
            blocks.push(`[Fichier du dossier: ${wf.path}]`);
          }
        }
      }

      const combinedLocal = [...pendingLocalAttachments, ...extraLocalFiles];
      const seenNames = new Set<string>();
      for (const att of combinedLocal) {
        if (seenNames.has(att.name)) continue;
        seenNames.add(att.name);
        blocks.push(
          att.content
            ? `[Fichier joint: ${att.name}]\n${att.content}`
            : `[Fichier joint: ${att.name}]`,
        );
      }

      return blocks;
    },
    [
      activeWorkspace?.pathLabel,
      attachedWorkspaceFiles,
      pendingLocalAttachments,
      workspaceRootPath,
      workspaceTree,
    ],
  );

  // Launch the multi-agent swarm ONLY when explicitly commanded by the user
  const launchAgentsMission = useCallback(
    async (
      sourceMessages: DotChatMessage[],
      modeOverride?: MissionMode,
      extraAttachments: MissionAttachment[] = [],
      payloadOverride?: Partial<MissionPayload>,
    ) => {
      const currentProvider = await ensureLiveProvider();
      if (!currentProvider.available) {
        showNotice(
          currentProvider.error ||
            'Aucun modèle connecté. Vérifiez la connexion API dans les paramètres.',
        );
        return;
      }

      // Abort any ongoing pre-launch dialogue reply cleanly
      replyAbortRef.current?.abort();
      replyAbortRef.current = null;
      setIsReplying(false);

      // Stop any previous running mission cleanly so agents are free
      if (
        activeMission &&
        (activeMission.status === 'running' || activeMission.status === 'paused')
      ) {
        agentOrchestrator.stopMission(activeMission.id);
      }

      const newlyReadLocal =
        extraAttachments.length > 0 ? await readLocalAttachments(extraAttachments) : [];
      const contextBlocks = await readWorkspaceContextBlocks(newlyReadLocal);

      const brief = buildMissionBriefFromConversation(
        sourceMessages,
        attachedWorkspaceFiles.length > 0
          ? `Analyse de ${attachedWorkspaceFiles.length} fichier(s)`
          : 'Mission Dot Brain',
      );
      const enrichedDescription =
        contextBlocks.length > 0
          ? `${brief.description}\n\n${contextBlocks.join('\n\n')}`
          : brief.description;

      // Reset previously completed/failed agents to idle so all 39 Dots are eligible
      ALL_AGENTS.forEach((a) => {
        if (a.status === 'completed' || a.status === 'failed' || a.status === 'error') {
          a.status = 'idle';
          a.currentTask = null;
        }
      });

      const eligible = ALL_AGENTS.filter(
        (a) => a.isOnline && a.status !== 'working' && a.status !== 'reviewing',
      );
      if (eligible.length === 0) {
        showNotice(
          'Tous les agents sont occupés — attendez la fin ou arrêtez la mission en cours.',
        );
        return;
      }

      const effectiveMode = modeOverride ?? lastMissionMode;
      const verifyResults = effectiveMode === 'audit';
      const mission = agentOrchestrator.createMission(
        brief.title,
        enrichedDescription,
        eligible,
        {
          concurrency: effectiveMode === 'exploration' ? 3 : 2,
          verifyResults,
          autoCorrect: true,
          missionMode: effectiveMode,
          modelId: payloadOverride?.modelId ?? selectedDotModel,
          effort: (payloadOverride?.effort ?? dotEffort) as DotEffortLevel,
          permissionMode: (payloadOverride?.permissionMode ??
            permissionMode) as DotPermissionMode,
          workspaceName: payloadOverride?.workspaceName ?? activeWorkspace?.name,
          workspacePath:
            payloadOverride?.workspacePath ??
            workspaceRootPath ??
            activeWorkspace?.pathLabel,
        },
      );

      activeMissionIdRef.current = mission.id;
      const started = agentOrchestrator.startMissionExecution(mission, eligible);
      setActiveMission({
        ...started,
        steps: started.steps.map((s) => ({ ...s })),
        messages: [...started.messages],
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `sys-launch-${Date.now()}`,
          role: 'system',
          content: `Agents lancés (${started.steps.length} étapes) — suivi en direct dans l’onglet Exécution`,
          createdAt: new Date().toISOString(),
          status: 'done',
        },
      ]);
      setPendingLocalAttachments([]);
      setActiveRightDrawer('mission');
      setDrawerTab('execution');
      setAgentVersion((v) => v + 1);
    },
    [
      activeMission,
      activeWorkspace?.name,
      activeWorkspace?.pathLabel,
      attachedWorkspaceFiles.length,
      dotEffort,
      ensureLiveProvider,
      lastMissionMode,
      permissionMode,
      readWorkspaceContextBlocks,
      selectedDotModel,
      showNotice,
      workspaceRootPath,
    ],
  );

  // Composer submit handler: ALWAYS talks first, launches ONLY on explicit launch command
  const handleMissionSubmit = useCallback(
    async (missionPayload: MissionPayload) => {
      const trimmed = missionPayload.prompt.trim();
      if (
        !trimmed &&
        missionPayload.attachments.length === 0 &&
        attachedWorkspaceFiles.length === 0
      ) {
        return;
      }

      const currentProvider = await ensureLiveProvider();
      if (!currentProvider.available) {
        showNotice(
          currentProvider.error ||
            'Aucun modèle connecté. Vérifiez la connexion API dans les paramètres.',
        );
        return;
      }

      setLastMissionMode(missionPayload.mode);

      const hasPriorDiscussion = chatMessages.some((m) => m.role === 'user');

      // Explicit text command after prior discussion -> launch the agents!
      if (isLaunchCommand(trimmed, hasPriorDiscussion)) {
        const launchMsg: DotChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: trimmed,
          createdAt: new Date().toISOString(),
          status: 'done',
        };
        const updatedMessages = [...chatMessages, launchMsg];
        setChatMessages(updatedMessages);
        await launchAgentsMission(
          updatedMessages,
          missionPayload.mode,
          missionPayload.attachments,
          missionPayload,
        );
        return;
      }

      // Conversational pre-launch turn: Dot Brain replies directly before launching anything
      replyAbortRef.current?.abort();
      const abortController = new AbortController();
      replyAbortRef.current = abortController;

      const newlyReadLocal =
        missionPayload.attachments.length > 0
          ? await readLocalAttachments(missionPayload.attachments)
          : [];
      if (newlyReadLocal.length > 0) {
        setPendingLocalAttachments((prev) => [...prev, ...newlyReadLocal]);
      }

      const displayPrompt =
        trimmed ||
        `Analyse des fichiers joints (${missionPayload.attachments.length + attachedWorkspaceFiles.length})`;

      const userMsg: DotChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: displayPrompt,
        createdAt: new Date().toISOString(),
        status: 'done',
      };
      const assistantMsgId = `assistant-${Date.now() + 1}`;
      const assistantPlaceholder: DotChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'streaming',
      };

      const historyForModel = chatMessages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.status !== 'error')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const nextMessages = [...chatMessages, userMsg, assistantPlaceholder];
      setChatMessages(nextMessages);
      setActiveRightDrawer('mission');
      setDrawerTab('dialogue');
      setIsReplying(true);

      // Compute brief + planned steps preview to enrich Dot Brain's orchestrator prompt
      const draftBrief = buildMissionBriefFromConversation([...chatMessages, userMsg], displayPrompt);
      const previewSteps = agentOrchestrator.decomposeMission(
        draftBrief.title,
        draftBrief.description,
        ALL_AGENTS,
        missionPayload.mode,
      );
      const plannedStepsSummary = previewSteps.map((s) => {
        const dot = ALL_AGENTS.find((a) => a.id === s.assignedAgentId);
        return dot ? `${dot.name} (${s.title})` : s.title;
      });

      const systemPrompt = buildOrchestratorSystemPrompt({
        mode: missionPayload.mode,
        workspaceName: missionPayload.workspaceName ?? activeWorkspace?.name,
        workspacePath:
          missionPayload.workspacePath ?? workspaceRootPath ?? activeWorkspace?.pathLabel,
        topLevelEntries: workspaceTree
          .slice(0, 20)
          .map((n) => (n.isDirectory ? `${n.name}/` : n.name)),
        attachedFileNames: [
          ...attachedWorkspaceFiles.map((f) => f.path),
          ...pendingLocalAttachments.map((f) => f.name),
          ...newlyReadLocal.map((f) => f.name),
        ],
        plannedStepsSummary,
      });

      // Include snippet of any freshly attached files directly in the user turn prompt
      const attachmentSnippets: string[] = [];
      for (const wf of attachedWorkspaceFiles.slice(0, 3)) {
        try {
          const res = await fetch(`/api/fs/read?path=${encodeURIComponent(wf.path)}`);
          if (res.ok) {
            const data = (await res.json()) as { content?: string };
            attachmentSnippets.push(
              `[Fichier du dossier : ${wf.path}]\n${(data.content ?? '').slice(0, 2200)}`,
            );
          }
        } catch {
          // ignore read error during dialogue turn
        }
      }
      for (const loc of newlyReadLocal.slice(0, 2)) {
        if (loc.content) {
          attachmentSnippets.push(`[Fichier joint : ${loc.name}]\n${loc.content.slice(0, 2000)}`);
        }
      }

      const fullTurnPrompt =
        attachmentSnippets.length > 0
          ? `${displayPrompt}\n\n${attachmentSnippets.join('\n\n')}`
          : displayPrompt;

      try {
        const result = await agentOrchestrator.streamOrchestratorChat({
          prompt: fullTurnPrompt,
          history: historyForModel,
          systemPrompt,
          agents: ALL_AGENTS,
          modelId: missionPayload.modelId ?? selectedDotModel,
          effort: (missionPayload.effort ?? dotEffort) as DotEffortLevel,
          permissionMode: (missionPayload.permissionMode ??
            permissionMode) as DotPermissionMode,
          workspaceName: missionPayload.workspaceName ?? activeWorkspace?.name,
          signal: abortController.signal,
          onDelta: (delta) => {
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + delta } : m,
              ),
            );
          },
        });

        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: result.text || m.content || 'Prêt. Dites « lance » pour démarrer les agents.',
                  model: result.model,
                  status: 'done',
                }
              : m,
          ),
        );
      } catch (err) {
        const aborted =
          abortController.signal.aborted ||
          (err instanceof Error && err.name === 'AbortError');
        if (aborted) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: m.content || 'Réponse interrompue.',
                    status: 'done',
                  }
                : m,
            ),
          );
        } else {
          const message =
            err instanceof Error ? err.message : 'Erreur lors de la réponse de Dot Brain.';
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `Impossible de répondre : ${message}`, status: 'error' }
                : m,
            ),
          );
          showNotice(message);
        }
      } finally {
        if (replyAbortRef.current === abortController) {
          replyAbortRef.current = null;
        }
        setIsReplying(false);
        setAgentVersion((v) => v + 1);
      }
    },
    [
      activeWorkspace?.name,
      activeWorkspace?.pathLabel,
      attachedWorkspaceFiles,
      chatMessages,
      dotEffort,
      ensureLiveProvider,
      launchAgentsMission,
      pendingLocalAttachments,
      permissionMode,
      selectedDotModel,
      showNotice,
      workspaceRootPath,
      workspaceTree,
    ],
  );

  const handleStopReply = useCallback(() => {
    replyAbortRef.current?.abort();
    replyAbortRef.current = null;
    setIsReplying(false);
  }, []);

  const handleResetDialogue = useCallback(() => {
    replyAbortRef.current?.abort();
    replyAbortRef.current = null;
    setIsReplying(false);
    setChatMessages([]);
    setPendingLocalAttachments([]);
  }, []);

  const handleAgentAction = useCallback(
    (action: AgentAction) => {
      if (action.type === 'isolate') return;
      agentOrchestrator.controlAgent(
        ALL_AGENTS,
        action.agentId,
        action.type,
        activeMission?.id,
      );
      setAgentVersion((v) => v + 1);
    },
    [activeMission],
  );

  const isConnected = providerInfo.available;
  const completedStepsCount = activeMission
    ? activeMission.steps.filter((s) => s.status === 'completed').length
    : 0;
  const totalStepsCount = activeMission ? activeMission.steps.length : 0;
  const isMissionRunning = activeMission?.status === 'running';
  const isMissionPaused = activeMission?.status === 'paused';
  const dialogueMessageCount = chatMessages.filter((m) => m.role !== 'system').length;
  const canLaunchAgents = chatMessages.some(
    (m) => m.role === 'user' && m.content.trim().length > 0 && !isLaunchCommand(m.content, true),
  );

  const currentModelDisplay =
    availableModels.find((m) => m.id === selectedDotModel)?.shortLabel ?? selectedDotModel;
  const activeFolderShortName =
    activeWorkspace?.name ||
    workspaceRootPath.split(/[\\/]/).filter(Boolean).pop() ||
    'Dossier';

  const composerPlaceholder = canLaunchAgents
    ? 'Continuer la discussion ou écrire « lance » pour démarrer les agents…'
    : 'Parler à Dot Brain pour préparer votre demande avant de lancer…';

  return (
    <div
      data-testid="dot-brain-surface"
      data-provider-connected={isConnected ? 'true' : 'false'}
      data-mission-status={activeMission?.status ?? 'none'}
      data-selected-model={selectedDotModel}
      data-dialogue-turns={dialogueMessageCount}
      data-is-replying={isReplying ? 'true' : 'false'}
      className="flex h-full w-full flex-col overflow-hidden bg-[var(--claude-bg)] text-[var(--claude-text-primary)] font-[var(--font-sans-claude)]"
    >
      {/* Compact real-time connection, folder, model, dialogue & mission control strip */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-[var(--claude-border)] bg-[var(--claude-sidebar)] px-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          {isCheckingProvider ? (
            <>
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#D97757]" />
              <span className="truncate text-[var(--claude-text-secondary)]">
                Connexion au réseau Dot Brain…
              </span>
            </>
          ) : isConnected ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate font-medium text-[var(--claude-text-primary)]">
                Connecté · {providerInfo.name}
              </span>
              {typeof providerInfo.latencyMs === 'number' && (
                <span className="hidden font-mono text-[11px] tabular-nums text-[var(--claude-text-muted)] lg:inline">
                  {providerInfo.latencyMs} ms
                </span>
              )}
              <span
                className="hidden h-3 w-px bg-[var(--claude-border)] md:inline-block"
                aria-hidden="true"
              />
              <span className="hidden truncate text-[11.5px] text-[var(--claude-text-secondary)] md:inline">
                Modèle :{' '}
                <strong className="font-medium text-[var(--claude-text-primary)]">
                  {currentModelDisplay}
                </strong>
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="truncate font-medium text-amber-800 dark:text-amber-300">
                Non connecté — {providerInfo.error || 'Provider indisponible'}
              </span>
              <button
                type="button"
                onClick={() => void verifyConnection()}
                className="flex items-center gap-1 rounded-md border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Réessayer</span>
              </button>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex items-center gap-1 rounded-md border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
                >
                  <Settings className="h-3 w-3" />
                  <span>Paramètres</span>
                </button>
              )}
            </>
          )}

          {inlineNotice && (
            <span
              role="status"
              className="ml-2 truncate rounded-md bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200"
            >
              {inlineNotice}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Folder / Workspace explorer toggle */}
          <button
            type="button"
            data-testid="toggle-workspace-drawer-btn"
            onClick={() =>
              setActiveRightDrawer((prev) => (prev === 'workspace' ? 'none' : 'workspace'))
            }
            aria-expanded={activeRightDrawer === 'workspace'}
            title={workspaceRootPath || activeWorkspace?.pathLabel || 'Explorer le dossier actif'}
            className={`flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors cursor-pointer ${
              activeRightDrawer === 'workspace'
                ? 'border-[#D97757]/40 bg-[#D97757]/12 text-[#B85838] dark:text-[#F09A7D]'
                : 'border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)]'
            }`}
          >
            <FolderOpen className="h-3 w-3 text-[#D97757]" />
            <span className="max-w-[120px] truncate">{activeFolderShortName}</span>
            {attachedWorkspaceFiles.length > 0 && (
              <span className="font-mono text-[10.5px] text-[#D97757]">
                ({attachedWorkspaceFiles.length})
              </span>
            )}
          </button>

          {/* Pre-launch Dialogue drawer toggle */}
          <button
            type="button"
            data-testid="toggle-dialogue-drawer-btn"
            onClick={() => {
              if (activeRightDrawer === 'mission' && drawerTab === 'dialogue') {
                setActiveRightDrawer('none');
              } else {
                setDrawerTab('dialogue');
                setActiveRightDrawer('mission');
              }
            }}
            aria-expanded={activeRightDrawer === 'mission' && drawerTab === 'dialogue'}
            className={`flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors cursor-pointer ${
              activeRightDrawer === 'mission' && drawerTab === 'dialogue'
                ? 'border-[#D97757]/40 bg-[#D97757]/12 text-[#B85838] dark:text-[#F09A7D]'
                : 'border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)]'
            }`}
          >
            {isReplying ? (
              <Loader2 className="h-3 w-3 animate-spin text-[#D97757]" />
            ) : (
              <MessageSquare className="h-3 w-3 text-[#D97757]" />
            )}
            <span>
              Dialogue{dialogueMessageCount > 0 ? ` (${dialogueMessageCount})` : ''}
            </span>
          </button>

          {activeMission && (
            <>
              {(isMissionRunning || isMissionPaused) && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      isMissionPaused
                        ? agentOrchestrator.resumeMission(activeMission.id)
                        : agentOrchestrator.pauseMission(activeMission.id)
                    }
                    aria-label={
                      isMissionPaused ? 'Reprendre la mission' : 'Mettre la mission en pause'
                    }
                    className="flex h-6 items-center gap-1 rounded-md border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2 text-[11px] font-medium text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)] cursor-pointer"
                  >
                    {isMissionPaused ? (
                      <>
                        <Play className="h-3 w-3" />
                        <span>Reprendre</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-3 w-3" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => agentOrchestrator.stopMission(activeMission.id)}
                    aria-label="Arrêter la mission"
                    className="flex h-6 items-center gap-1 rounded-md border border-red-500/25 bg-red-500/10 px-2 text-[11px] font-medium text-red-700 hover:bg-red-500/15 dark:text-red-300 cursor-pointer"
                  >
                    <Square className="h-2.5 w-2.5" />
                    <span>Arrêter</span>
                  </button>
                </>
              )}

              <button
                type="button"
                data-testid="toggle-mission-drawer-btn"
                onClick={() => {
                  if (activeRightDrawer === 'mission' && drawerTab === 'execution') {
                    setActiveRightDrawer('none');
                  } else {
                    setDrawerTab('execution');
                    setActiveRightDrawer('mission');
                  }
                }}
                aria-expanded={activeRightDrawer === 'mission' && drawerTab === 'execution'}
                className={`flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors cursor-pointer ${
                  activeRightDrawer === 'mission' && drawerTab === 'execution'
                    ? 'border-[#D97757]/40 bg-[#D97757]/12 text-[#B85838] dark:text-[#F09A7D]'
                    : 'border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-hover)]'
                }`}
              >
                {isMissionRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin text-[#D97757]" />
                ) : (
                  <ClipboardList className="h-3 w-3" />
                )}
                <span>
                  Exécution ({completedStepsCount}/{totalStepsCount})
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Dot Brain visualization + collapsible right drawer (Workspace Folder OR Dialogue/Execution) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <DotBrainWorkspace
            agents={dotBrainAgents}
            connections={connections}
            groups={dotBrainGroups}
            isDemoMode={false}
            enableDemoSimulation={false}
            initialLayoutMode="brain"
            initialTheme={theme}
            onThemeChange={onThemeChange}
            availableModels={availableModels}
            selectedModelId={selectedDotModel}
            onModelChange={handleGlobalModelChange}
            onAgentModelChange={handleAgentModelChange}
            effort={dotEffort}
            onEffortChange={(nextEffort) => {
              setDotEffort(nextEffort);
              onEffortChange?.(nextEffort);
            }}
            permissionMode={permissionMode}
            onPermissionModeChange={onPermissionModeChange}
            workspaces={dotWorkspaces}
            activeWorkspaceId={activeWorkspace?.id}
            workspaceRootPath={workspaceRootPath}
            onSelectWorkspace={onSelectWorkspace}
            onOpenFolderPicker={onOpenFolderPicker}
            attachedWorkspaceFiles={attachedWorkspaceFiles}
            onRemoveWorkspaceFile={handleRemoveWorkspaceFile}
            onToggleWorkspaceBrowser={() =>
              setActiveRightDrawer((prev) => (prev === 'workspace' ? 'none' : 'workspace'))
            }
            activeMissionPrompt={
              activeMission && (isMissionRunning || isMissionPaused)
                ? activeMission.title
                : null
            }
            composerPlaceholder={composerPlaceholder}
            onMissionSubmit={handleMissionSubmit}
            onAgentAction={handleAgentAction}
          />
        </div>

        {activeRightDrawer === 'workspace' && (
          <DotBrainWorkspaceDrawer
            workspaces={dotWorkspaces}
            activeWorkspaceId={activeWorkspace?.id}
            workspaceRootPath={workspaceRootPath}
            tree={workspaceTree}
            isLoadingTree={isLoadingTree}
            treeError={treeError}
            attachedFiles={attachedWorkspaceFiles}
            onSelectWorkspace={(wsId) => onSelectWorkspace?.(wsId)}
            onOpenFolderPicker={() => onOpenFolderPicker?.()}
            onRefreshTree={() => void loadWorkspaceTree()}
            onToggleAttachFile={handleToggleAttachWorkspaceFile}
            onClearAttachedFiles={() => setAttachedWorkspaceFiles([])}
            onClose={() => setActiveRightDrawer('none')}
          />
        )}

        {activeRightDrawer === 'mission' && (
          <DotBrainMissionDrawer
            activeTab={drawerTab}
            onTabChange={setDrawerTab}
            messages={chatMessages}
            isReplying={isReplying}
            onStopReply={handleStopReply}
            plannedStepsPreview={plannedStepsPreview}
            canLaunch={canLaunchAgents}
            isConnected={isConnected}
            onLaunchAgents={() => void launchAgentsMission(chatMessages)}
            onResetDialogue={handleResetDialogue}
            mission={activeMission}
            agents={ALL_AGENTS}
            isPaused={isMissionPaused}
            onPause={() => activeMission && agentOrchestrator.pauseMission(activeMission.id)}
            onResume={() => activeMission && agentOrchestrator.resumeMission(activeMission.id)}
            onStop={() => activeMission && agentOrchestrator.stopMission(activeMission.id)}
            onClose={() => setActiveRightDrawer('none')}
          />
        )}
      </div>
    </div>
  );
};

export default DotBrainSurface;
