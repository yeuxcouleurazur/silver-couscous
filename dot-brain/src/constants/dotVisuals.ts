import type {
  AgentStatus,
  ConnectionType,
  GroupId,
  LayoutMode,
  MissionMode,
} from '../types/dotBrain';

export interface StatusVisualConfig {
  status: AgentStatus;
  label: string;
  shortLabel: string;
  description: string;
  fill: string;
  stroke: string;
  ringColor: string;
  glyph: string;
}

export const AGENT_STATUS_ORDER: AgentStatus[] = [
  'Idle',
  'Thinking',
  'Working',
  'Communicating',
  'Reviewing',
  'Completed',
  'Error',
];

export const STATUS_VISUALS: Record<AgentStatus, StatusVisualConfig> = {
  Idle: {
    status: 'Idle',
    label: 'Idle',
    shortLabel: 'Veille',
    description: 'En attente d’une sollicitation ou d’un signal entrant.',
    fill: '#BEB9AE',
    stroke: '#9B968B',
    ringColor: '#C9C5BB',
    glyph: '○',
  },
  Thinking: {
    status: 'Thinking',
    label: 'Thinking',
    shortLabel: 'Réflexion',
    description: 'Analyse contextuelle et planification cognitive en cours.',
    fill: '#50647D',
    stroke: '#384A61',
    ringColor: '#6E849F',
    glyph: '◎',
  },
  Working: {
    status: 'Working',
    label: 'Working',
    shortLabel: 'Exécution',
    description: 'Production active d’artefacts, de code ou de synthèses.',
    fill: '#2B2A27',
    stroke: '#1C1B19',
    ringColor: '#4A4843',
    glyph: '●',
  },
  Communicating: {
    status: 'Communicating',
    label: 'Communicating',
    shortLabel: 'Transmission',
    description: 'Échange actif de messages ou de contexte avec d’autres Dots.',
    fill: '#A36B36',
    stroke: '#815124',
    ringColor: '#C28A52',
    glyph: '◈',
  },
  Reviewing: {
    status: 'Reviewing',
    label: 'Reviewing',
    shortLabel: 'Revue',
    description: 'Vérification critique, conformité ou arbitrage qualité.',
    fill: '#466D62',
    stroke: '#315249',
    ringColor: '#668F83',
    glyph: '◉',
  },
  Completed: {
    status: 'Completed',
    label: 'Completed',
    shortLabel: 'Terminé',
    description: 'Tâche achevée et résultat consolidé dans le réseau.',
    fill: '#3F6A4F',
    stroke: '#2C4E38',
    ringColor: '#639274',
    glyph: '✓',
  },
  Error: {
    status: 'Error',
    label: 'Error',
    shortLabel: 'Incident',
    description: 'Blocage ou anomalie nécessitant une reprise ou un arbitrage.',
    fill: '#A4463F',
    stroke: '#7E312B',
    ringColor: '#C6665E',
    glyph: '✕',
  },
};

export const STATUS_VISUALS_DARK: Record<AgentStatus, StatusVisualConfig> = {
  Idle: {
    status: 'Idle',
    label: 'Idle',
    shortLabel: 'Veille',
    description: 'En attente d’une sollicitation ou d’un signal entrant.',
    fill: '#6E6C65',
    stroke: '#8D8A81',
    ringColor: '#7A7870',
    glyph: '○',
  },
  Thinking: {
    status: 'Thinking',
    label: 'Thinking',
    shortLabel: 'Réflexion',
    description: 'Analyse contextuelle et planification cognitive en cours.',
    fill: '#7D9DC7',
    stroke: '#A4C0E6',
    ringColor: '#8CABD4',
    glyph: '◎',
  },
  Working: {
    status: 'Working',
    label: 'Working',
    shortLabel: 'Exécution',
    description: 'Production active d’artefacts, de code ou de synthèses.',
    fill: '#ECEAE4',
    stroke: '#FFFFFF',
    ringColor: '#C2BFB5',
    glyph: '●',
  },
  Communicating: {
    status: 'Communicating',
    label: 'Communicating',
    shortLabel: 'Transmission',
    description: 'Échange actif de messages ou de contexte avec d’autres Dots.',
    fill: '#DE8857',
    stroke: '#F0A87D',
    ringColor: '#D97757',
    glyph: '◈',
  },
  Reviewing: {
    status: 'Reviewing',
    label: 'Reviewing',
    shortLabel: 'Revue',
    description: 'Vérification critique, conformité ou arbitrage qualité.',
    fill: '#6CB3A0',
    stroke: '#94D4C3',
    ringColor: '#7DC2B0',
    glyph: '◉',
  },
  Completed: {
    status: 'Completed',
    label: 'Completed',
    shortLabel: 'Terminé',
    description: 'Tâche achevée et résultat consolidé dans le réseau.',
    fill: '#67B585',
    stroke: '#8DD6A9',
    ringColor: '#7AC496',
    glyph: '✓',
  },
  Error: {
    status: 'Error',
    label: 'Error',
    shortLabel: 'Incident',
    description: 'Blocage ou anomalie nécessitant une reprise ou un arbitrage.',
    fill: '#DF6C64',
    stroke: '#F2948D',
    ringColor: '#E87E76',
    glyph: '✕',
  },
};

export function getStatusVisual(status: AgentStatus, isDark: boolean): StatusVisualConfig {
  return isDark ? STATUS_VISUALS_DARK[status] : STATUS_VISUALS[status];
}

export const GROUP_ORDER: GroupId[] = [
  'core-intelligence',
  'research',
  'architecture',
  'development',
  'testing',
  'review',
  'memory',
  'design',
];

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  orchestration: 'Orchestration',
  delegation: 'Délégation',
  synthesis: 'Synthèse',
  critique: 'Revue critique',
  'memory-sync': 'Synchronisation mémoire',
  verification: 'Vérification',
};

export const CONNECTION_TYPE_COLORS: Record<ConnectionType, string> = {
  orchestration: '#6B5CE7',
  delegation: '#7C65EB',
  synthesis: '#4A82D6',
  critique: '#D46E52',
  'memory-sync': '#3E9A6E',
  verification: '#DF489E',
};

export const CONNECTION_TYPE_COLORS_DARK: Record<ConnectionType, string> = {
  orchestration: '#A494FF',
  delegation: '#B2A3FF',
  synthesis: '#7EB3FA',
  critique: '#EB9278',
  'memory-sync': '#6CD19E',
  verification: '#F476BE',
};

export function getConnectionColor(type: ConnectionType, isDark: boolean): string {
  return isDark ? CONNECTION_TYPE_COLORS_DARK[type] : CONNECTION_TYPE_COLORS[type];
}

export const LAYOUT_MODES: Array<{
  id: LayoutMode;
  label: string;
  description: string;
}> = [
  {
    id: 'brain',
    label: 'Cerveau',
    description: 'Topologie anatomique en nuage de points par régions cognitives',
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    description: 'Rapproche dynamiquement les Dots qui communiquent activement',
  },
  {
    id: 'structured',
    label: 'Structurée',
    description: 'Organisation spatiale analytique par domaines de spécialité',
  },
];

export const MISSION_MODES: Array<{
  id: MissionMode;
  label: string;
  hint: string;
  targetGroups: GroupId[];
}> = [
  {
    id: 'orchestration',
    label: 'Orchestration',
    hint: 'Mobilise le noyau et coordonne plusieurs groupes spécialisés',
    targetGroups: ['core-intelligence', 'research', 'architecture', 'development', 'review', 'memory'],
  },
  {
    id: 'exploration',
    label: 'Exploration',
    hint: 'Concentre la recherche, la synthèse documentaire et la mémoire',
    targetGroups: ['core-intelligence', 'research', 'design', 'memory'],
  },
  {
    id: 'implementation',
    label: 'Implémentation',
    hint: 'Engage architecture, développement, design et tests',
    targetGroups: ['core-intelligence', 'architecture', 'development', 'design', 'testing'],
  },
  {
    id: 'audit',
    label: 'Audit & Revue',
    hint: 'Active la vérification, les tests et la revue critique',
    targetGroups: ['core-intelligence', 'testing', 'review', 'architecture', 'memory'],
  },
];
