import type {
  ModelConfig,
  ResponseStyle,
  UserPreferences,
} from '../types/claude';

export const CLAUDE_MODELS: ModelConfig[] = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Flash',
    shortName: 'Gemini 4 Flash',
    description: 'API Gemini en direct — équilibré et rapide',
    supportsThinking: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    shortName: 'Gemini Lite',
    description: 'API Gemini en direct — latence minimale',
    supportsThinking: true,
  },
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
    mode: 'gemini',
    endpointUrl: '',
    workspaceLabel: '',
    sendWithCredentials: false,
  },
};
