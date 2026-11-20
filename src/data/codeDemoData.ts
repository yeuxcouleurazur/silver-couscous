import type { CodeSession, CodeWorkspace, EffortLevel, PermissionMode } from '../types/claude';

export const EFFORT_OPTIONS: Array<{
  id: EffortLevel;
  label: string;
  shortLabel: string;
  isDefault?: boolean;
}> = [
  { id: 'low', label: 'Faible', shortLabel: 'Faible' },
  { id: 'medium', label: 'Moyen', shortLabel: 'Moyen' },
  { id: 'high', label: 'Ã‰levÃ©', shortLabel: 'Ã‰levÃ©', isDefault: true },
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
    description: 'Demander confirmation avant chaque commande ou Ã©criture',
  },
  {
    id: 'auto-edit',
    label: 'Auto-Ã©dit',
    description: 'Appliquer les modifications de fichiers et demander pour le shell',
  },
  {
    id: 'plan',
    label: 'Plan',
    description: 'Proposer un plan dÃ©taillÃ© sans modifier lâ€™espace de travail',
  },
];
