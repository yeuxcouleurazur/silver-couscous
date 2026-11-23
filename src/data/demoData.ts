import type {
  ModelConfig,
  ResponseStyle,
  UserPreferences,
} from '../types/claude';

/**
 * Complete list of known working Claude models (FCC / Claude Code compatible).
 * These models are exposed by the FCC bridge at /v1/models when connected.
 * Includes all Opus, Sonnet, and Haiku variants from the Claude 5 family.
 */
export const CLAUDE_MODELS: ModelConfig[] = [
  // Opus 5.5 — Maximum capability, complex reasoning
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    shortName: 'Opus 5.5',
    description: 'Modèle le plus capable pour raisonnement complexe, planification et résolution de problèmes difficiles.',
    supportsThinking: true,
  },
  {
    id: 'claude-opus-5-5-20251022',
    name: 'Claude Opus 5.5 (2025-10-22)',
    shortName: 'Opus 5.5 Oct',
    description: 'Version datée d\'Opus 5.5 pour reproductibilité.',
    supportsThinking: true,
  },

  // Sonnet 5.5 — Balanced performance, best for most tasks
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    shortName: 'Sonnet 5.5',
    description: 'Modèle équilibré haute performance pour code, analyse et tâches générales.',
    supportsThinking: true,
  },
  {
    id: 'claude-sonnet-5-5-20251022',
    name: 'Claude Sonnet 5.5 (2025-10-22)',
    shortName: 'Sonnet 5.5 Oct',
    description: 'Version datée de Sonnet 5.5 pour reproductibilité.',
    supportsThinking: true,
  },

  // Fable 5.2 — Creative writing and specialized tasks
  {
    id: 'claude-fable-5-2',
    name: 'Claude Fable 5.2',
    shortName: 'Fable 5.2',
    description: 'Modèle spécialisé pour écriture créative, narration et tâches stylistiques.',
    supportsThinking: false,
  },

  // Haiku 5.5 — Fast, efficient, cost-effective
  {
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    shortName: 'Haiku 5.5',
    description: 'Modèle rapide et économique pour tâches simples, classification et extraction.',
    supportsThinking: false,
  },
  {
    id: 'claude-haiku-5-5-20251022',
    name: 'Claude Haiku 5.5 (2025-10-22)',
    shortName: 'Haiku 5.5 Oct',
    description: 'Version datée de Haiku 5.5 pour reproductibilité.',
    supportsThinking: false,
  },

  // Legacy Opus 4.x — Still available for compatibility
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    shortName: 'Opus 4.1',
    description: 'Génération précédente, capacités avancées de raisonnement.',
    supportsThinking: true,
  },
  {
    id: 'claude-opus-4-0',
    name: 'Claude Opus 4.0',
    shortName: 'Opus 4.0',
    description: 'Modèle Opus de base de la génération 4.',
    supportsThinking: true,
  },

  // Legacy Sonnet 4.x
  {
    id: 'claude-sonnet-4-0',
    name: 'Claude Sonnet 4.0',
    shortName: 'Sonnet 4.0',
    description: 'Génération précédente, bon équilibre performance/coût.',
    supportsThinking: true,
  },

  // Legacy Haiku 3.x
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    shortName: '3.5 Haiku',
    description: 'Modèle Haiku de génération 3.5, très rapide.',
    supportsThinking: false,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    shortName: '3 Haiku',
    description: 'Modèle Haiku de génération 3, le plus rapide.',
    supportsThinking: false,
  },
];

/**
 * Default fallback models when FCC bridge is not configured.
 * Used in demo mode or when FCC endpoint is unavailable.
 */
export const DEFAULT_FCC_MODELS: ModelConfig[] = [
  CLAUDE_MODELS[1], // Sonnet 5.5 as default
  CLAUDE_MODELS[3], // Fable 5.2
  CLAUDE_MODELS[5], // Haiku 5.5
  CLAUDE_MODELS[0], // Opus 5.5
];

export const RESPONSE_STYLES: Array<{
  id: ResponseStyle;
  label: string;
  description: string;
}> = [
  { id: 'normal', label: 'Normal', description: 'Réponses équilibrées et naturelles' },
  { id: 'concis', label: 'Concis', description: 'Synthétique, droit au but' },
  { id: 'explicatif', label: 'Explicatif', description: 'Pédagogique avec exemples détaillés' },
  { id: 'formel', label: 'Formel', description: 'Ton professionnel et structuré' },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  chatFont: 'serif',
  userName: '',
  userEmail: '',
  userInitials: '',
  planLabel: '',
  sendWithEnter: true,
  fcc: {
    mode: 'fcc',
    endpointUrl: 'http://localhost:8787/v1/claude/stream',
    workspaceLabel: '',
    sendWithCredentials: false,
  },
};
