import type {
  CodeSession,
  ContextCategory,
  FileDiff,
  SlashCommandItem,
} from '../types/claude';

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'compact',
    name: 'compact',
    description: 'Résumer le contexte précédent de cette session',
  },
  {
    id: 'clear',
    name: 'clear',
    description: 'Démarrer une nouvelle session vierge',
  },
  {
    id: 'recap',
    name: 'recap',
    description: 'Générer un récapitulatif structuré des changements en cours',
  },
  {
    id: 'btw',
    name: 'btw',
    description: 'Ouvrir un side chat parallèle sans polluer la session',
    hint: '<question>',
  },
  {
    id: 'review',
    name: 'review',
    description: 'Revoir le diff de la session et signaler les risques',
  },
  {
    id: 'fork',
    name: 'fork',
    description: 'Dupliquer cette session pour explorer une autre piste',
  },
  {
    id: 'subtask',
    name: 'subtask',
    description: 'Découper la demande en liste de tâches suivies',
    hint: '<tâche>',
  },
  {
    id: 'rename',
    name: 'rename',
    description: 'Renommer la session active',
    hint: '<nouveau titre>',
  },
  {
    id: 'model',
    name: 'model',
    description: "Choisir le modèle Claude ou l'adaptateur actif",
  },
  {
    id: 'effort',
    name: 'effort',
    description: "Régler le niveau d'effort de raisonnement (Faible à Max)",
  },
  {
    id: 'plan',
    name: 'plan',
    description: 'Passer en mode Plan avant toute modification',
  },
  {
    id: 'permissions',
    name: 'permissions',
    description: "Configurer le mode d'approbation (Manuel, Auto-édition, Plan)",
  },
];

export interface ParsedSlashInput {
  isSlashMode: boolean;
  query: string;
  commandName: string | null;
  args: string;
}

export function parseSlashInput(raw: string): ParsedSlashInput {
  if (!raw.startsWith('/')) {
    return { isSlashMode: false, query: '', commandName: null, args: '' };
  }
  const rest = raw.slice(1);
  const spaceIdx = rest.indexOf(' ');
  if (spaceIdx === -1) {
    return {
      isSlashMode: true,
      query: rest.toLowerCase(),
      commandName: rest.toLowerCase() || null,
      args: '',
    };
  }
  return {
    isSlashMode: false,
    query: '',
    commandName: rest.slice(0, spaceIdx).toLowerCase(),
    args: rest.slice(spaceIdx + 1).trim(),
  };
}

export function filterSlashCommands(
  query: string,
  commands: SlashCommandItem[] = SLASH_COMMANDS
): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const startsWith = commands.filter((c) => c.name.toLowerCase().startsWith(q));
  const includes = commands.filter(
    (c) =>
      !c.name.toLowerCase().startsWith(q) &&
      (c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
  );
  return [...startsWith, ...includes];
}

export function computeDiffStats(diffs: FileDiff[]): {
  fileCount: number;
  additions: number;
  deletions: number;
} {
  return diffs.reduce(
    (acc, diff) => ({
      fileCount: acc.fileCount + 1,
      additions: acc.additions + diff.additions,
      deletions: acc.deletions + diff.deletions,
    }),
    { fileCount: 0, additions: 0, deletions: 0 }
  );
}

export function computeContextSummary(
  categories: ContextCategory[],
  limitTokens: number
): {
  usedTokens: number;
  freeTokens: number;
  usedPercent: number;
} {
  const usedTokens = categories.reduce((sum, c) => sum + c.tokens, 0);
  const clampedUsed = Math.min(usedTokens, limitTokens);
  const freeTokens = Math.max(0, limitTokens - clampedUsed);
  const usedPercent =
    limitTokens > 0 ? Math.min(100, Math.round((clampedUsed / limitTokens) * 100)) : 0;
  return { usedTokens: clampedUsed, freeTokens, usedPercent };
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'k';
  }
  return String(tokens);
}

export function resolveApprovalInSession(
  sessions: CodeSession[],
  sessionId: string,
  approvalId: string,
  decision: 'approved-once' | 'approved-session' | 'denied'
): CodeSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const nextTurns = session.turns.map((turn) => {
      if (!turn.approval || turn.approval.id !== approvalId) return turn;
      return {
        ...turn,
        approval: {
          ...turn.approval,
          status: decision,
        },
      };
    });
    const stillNeedsInput = nextTurns.some((t) => t.approval?.status === 'pending');
    return {
      ...session,
      needsInput: stillNeedsInput,
      turns: nextTurns,
    };
  });
}

export function resolveNextStepInSession(
  sessions: CodeSession[],
  sessionId: string,
  nextStepId: string,
  resolution: { dismissed?: boolean; resolvedLabel?: string; markCommitted?: boolean }
): CodeSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    return {
      ...session,
      committed: resolution.markCommitted ? true : session.committed,
      turns: session.turns.map((turn) => {
        if (!turn.nextStep || turn.nextStep.id !== nextStepId) return turn;
        return {
          ...turn,
          nextStep: {
            ...turn.nextStep,
            dismissed: resolution.dismissed ?? turn.nextStep.dismissed,
            resolvedLabel: resolution.resolvedLabel ?? turn.nextStep.resolvedLabel,
          },
        };
      }),
    };
  });
}

export function compactSessionContext(
  sessions: CodeSession[],
  sessionId: string
): CodeSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    return {
      ...session,
      contextCategories: session.contextCategories.map((cat) =>
        cat.id === 'messages'
          ? { ...cat, tokens: Math.max(2400, Math.round(cat.tokens * 0.42)) }
          : cat
      ),
    };
  });
}

export function appendSideChatExchange(
  sessions: CodeSession[],
  sessionId: string,
  sideChatId: string | null,
  question: string,
  reply: string
): { sessions: CodeSession[]; activeSideChatId: string } {
  const newId = sideChatId ?? `btw-${Date.now()}`;
  const shortTitle =
    question.trim().length > 34
      ? question.trim().slice(0, 34) + '\u2026'
      : question.trim();

  const updated = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const existing = session.sideChats.find((sc) => sc.id === newId);
    const userMsg = {
      id: `scm-u-${Date.now()}`,
      role: 'user' as const,
      content: question.trim(),
    };
    const assistantMsg = {
      id: `scm-a-${Date.now()}`,
      role: 'assistant' as const,
      content: reply,
    };

    if (existing) {
      return {
        ...session,
        sideChats: session.sideChats.map((sc) =>
          sc.id === newId
            ? { ...sc, messages: [...sc.messages, userMsg, assistantMsg] }
            : sc
        ),
      };
    }

    return {
      ...session,
      sideChats: [
        {
          id: newId,
          title: shortTitle || 'Question rapide',
          messages: [userMsg, assistantMsg],
        },
        ...session.sideChats,
      ],
    };
  });

  return { sessions: updated, activeSideChatId: newId };
}
