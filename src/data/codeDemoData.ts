import type { EffortLevel, PermissionMode } from '../types/claude';

export const EFFORT_OPTIONS: Array<{
  id: EffortLevel;
  label: string;
  shortLabel: string;
  isDefault?: boolean;
}> = [
  { id: 'low', label: 'Faible', shortLabel: 'Faible' },
  { id: 'medium', label: 'Moyen', shortLabel: 'Moyen' },
  { id: 'high', label: 'Élevé', shortLabel: 'Élevé', isDefault: true },
  { id: 'max', label: 'Max', shortLabel: 'Max' },
];

export const PERMISSION_OPTIONS: Array<{
  id: PermissionMode;
  label: string;
  description: string;
}> = [
  {
    id: 'manual',
    label: 'Manuel',
    description: 'Demander confirmation avant chaque commande ou écriture',
  },
  {
    id: 'auto-edit',
    label: 'Auto-édition',
    description: 'Appliquer les modifications de fichiers et demander pour le shell',
  },
  {
    id: 'plan',
    label: 'Plan',
    description: "Proposer un plan détaillé sans modifier l'espace de travail",
  },
];

/** Empty by default — user opens a folder to create a workspace. */
export const INITIAL_CODE_WORKSPACES: Array<{
  id: string;
  name: string;
  pathLabel: string;
  branch: string;
  environmentLabel: string;
  files: Array<{ path: string; language: string; content: string }>;
}> = [];

/** Empty by default — sessions created when user opens a folder. */
export const INITIAL_CODE_SESSIONS: Array<{
  id: string;
  workspaceId: string;
  title: string;
  updatedAt: string;
  originLabel: string;
  contextLimitTokens: number;
  contextCategories: Array<{ id: string; label: string; color: string; tokens: number }>;
  mcpToolsCount: number;
  memoryFilesCount: number;
  outputs: string[];
  diffs: Array<{ id: string; path: string; icon: 'html' | 'code' | 'doc'; additions: number; deletions: number; lines: Array<{ lineNumber: number; kind: 'context' | 'added' | 'removed'; text: string }> }>;
  committed?: boolean;
  terminalLines: string[];
  turns: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string; modelId?: string; effort?: 'low' | 'medium' | 'high' | 'max'; isStreaming?: boolean }>;
  sideChats: Array<{ id: string; title: string; messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }> }>;
}> = [];
