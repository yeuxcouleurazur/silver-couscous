import type {
  Artifact,
  Citation,
  Conversation,
  Message,
  ModelId,
  Project,
} from '../types/claude';

export interface ConversationGroup {
  label: string;
  items: Conversation[];
}

export function generateConversationTitle(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Nouvelle conversation';
  const sentence = cleaned.split(/[.!?\n]/)[0].trim();
  if (sentence.length <= 46) return sentence;
  return `${sentence.slice(0, 44).trim()}…`;
}

export function createConversationRecord(params: {
  id: string;
  title: string;
  modelId: ModelId;
  projectId: string | null;
  nowIso: string;
  initialMessages?: Message[];
}): Conversation {
  return {
    id: params.id,
    title: params.title,
    createdAt: params.nowIso,
    updatedAt: params.nowIso,
    starred: false,
    projectId: params.projectId,
    modelId: params.modelId,
    messages: params.initialMessages ?? [],
  };
}

export function toggleConversationStar(
  conversations: Conversation[],
  conversationId: string
): Conversation[] {
  return conversations.map((conv) =>
    conv.id === conversationId ? { ...conv, starred: !conv.starred } : conv
  );
}

export function renameConversation(
  conversations: Conversation[],
  conversationId: string,
  nextTitle: string
): Conversation[] {
  const trimmed = nextTitle.trim();
  if (!trimmed) return conversations;
  return conversations.map((conv) =>
    conv.id === conversationId ? { ...conv, title: trimmed } : conv
  );
}

export function moveConversationToProject(
  conversations: Conversation[],
  conversationId: string,
  projectId: string | null
): Conversation[] {
  return conversations.map((conv) =>
    conv.id === conversationId ? { ...conv, projectId } : conv
  );
}

export function deleteConversation(
  conversations: Conversation[],
  conversationId: string
): Conversation[] {
  return conversations.filter((conv) => conv.id !== conversationId);
}

export function appendMessagesToConversation(
  conversations: Conversation[],
  conversationId: string,
  messagesToAdd: Message[],
  nowIso: string
): Conversation[] {
  return conversations.map((conv) =>
    conv.id === conversationId
      ? {
          ...conv,
          updatedAt: nowIso,
          messages: [...conv.messages, ...messagesToAdd],
        }
      : conv
  );
}

export function updateAssistantMessageStream(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  patch: {
    appendContent?: string;
    appendThinking?: string;
    thinkingDurationSec?: number;
    isThinkingStreaming?: boolean;
    isStreaming?: boolean;
    wasStopped?: boolean;
    citations?: Citation[];
    artifact?: Artifact;
  }
): Conversation[] {
  return conversations.map((conv) => {
    if (conv.id !== conversationId) return conv;
    return {
      ...conv,
      messages: conv.messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        return {
          ...msg,
          content: patch.appendContent ? msg.content + patch.appendContent : msg.content,
          thinking: patch.appendThinking
            ? (msg.thinking ?? '') + patch.appendThinking
            : msg.thinking,
          thinkingDurationSec:
            patch.thinkingDurationSec !== undefined
              ? patch.thinkingDurationSec
              : msg.thinkingDurationSec,
          isThinkingStreaming:
            patch.isThinkingStreaming !== undefined
              ? patch.isThinkingStreaming
              : msg.isThinkingStreaming,
          isStreaming:
            patch.isStreaming !== undefined ? patch.isStreaming : msg.isStreaming,
          wasStopped:
            patch.wasStopped !== undefined ? patch.wasStopped : msg.wasStopped,
          citations: patch.citations ?? msg.citations,
          artifact: patch.artifact ?? msg.artifact,
        };
      }),
    };
  });
}

export function setMessageFeedback(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  feedback: 'up' | 'down' | null
): Conversation[] {
  return conversations.map((conv) => {
    if (conv.id !== conversationId) return conv;
    return {
      ...conv,
      messages: conv.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, feedback: msg.feedback === feedback ? null : feedback }
          : msg
      ),
    };
  });
}

/**
 * Groups non-starred conversations into Claude Desktop chronological buckets.
 */
export function groupConversationsByDate(
  conversations: Conversation[],
  referenceDate: Date = new Date()
): ConversationGroup[] {
  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const buckets: Record<string, Conversation[]> = {
    "Aujourd'hui": [],
    Hier: [],
    '7 derniers jours': [],
    '30 derniers jours': [],
    'Plus ancien': [],
  };

  for (const conv of sorted) {
    const ts = new Date(conv.updatedAt).getTime();
    if (ts >= startOfToday) {
      buckets["Aujourd'hui"].push(conv);
    } else if (ts >= startOfToday - msPerDay) {
      buckets.Hier.push(conv);
    } else if (ts >= startOfToday - 7 * msPerDay) {
      buckets['7 derniers jours'].push(conv);
    } else if (ts >= startOfToday - 30 * msPerDay) {
      buckets['30 derniers jours'].push(conv);
    } else {
      buckets['Plus ancien'].push(conv);
    }
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export interface SearchResults {
  conversations: Conversation[];
  projects: Project[];
}

export function filterConversationsAndProjects(
  conversations: Conversation[],
  projects: Project[],
  query: string
): SearchResults {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return {
      conversations: [...conversations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
      projects,
    };
  }

  const matchedConversations = conversations.filter((conv) => {
    if (conv.title.toLowerCase().includes(normalized)) return true;
    return conv.messages.some((m) => m.content.toLowerCase().includes(normalized));
  });

  const matchedProjects = projects.filter(
    (proj) =>
      proj.name.toLowerCase().includes(normalized) ||
      proj.description.toLowerCase().includes(normalized) ||
      proj.instructions.toLowerCase().includes(normalized)
  );

  return {
    conversations: matchedConversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
    projects: matchedProjects,
  };
}

export function exportConversationAsMarkdown(conversation: Conversation): string {
  const lines: string[] = [`# ${conversation.title}`, ''];
  for (const msg of conversation.messages) {
    const speaker = msg.role === 'user' ? 'Utilisateur' : 'Claude';
    lines.push(`## ${speaker}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

export function getGreetingForHour(hour: number, userName: string): string {
  const firstName = userName.trim().split(' ')[0] || '';
  const suffix = firstName ? `, ${firstName}` : '';
  if (hour >= 5 && hour < 12) return `Bonjour${suffix}`;
  if (hour >= 12 && hour < 18) return `Bon après-midi${suffix}`;
  return `Bonsoir${suffix}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export interface IndexedArtifact {
  artifact: Artifact;
  conversationId: string;
  conversationTitle: string;
  projectId: string | null;
}

export function collectAllArtifacts(conversations: Conversation[]): IndexedArtifact[] {
  const results: IndexedArtifact[] = [];
  const seen = new Set<string>();

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.artifact && !seen.has(msg.artifact.id)) {
        seen.add(msg.artifact.id);
        results.push({
          artifact: msg.artifact,
          conversationId: conv.id,
          conversationTitle: conv.title,
          projectId: conv.projectId,
        });
      }
    }
  }

  return results.sort(
    (a, b) =>
      new Date(b.artifact.updatedAt).getTime() - new Date(a.artifact.updatedAt).getTime()
  );
}

export function createPastedAttachment(
  text: string,
  indexLabel = 1
): {
  id: string;
  name: string;
  size: number;
  type: 'text';
  mimeType: string;
  previewText: string;
  lineCount: number;
} {
  const normalized = text.replace(/\r\n/g, '\n');
  const lineCount = normalized.split('\n').length;
  return {
    id: `paste-${Date.now()}-${indexLabel}`,
    name: `Extrait collé ${indexLabel > 1 ? indexLabel : ''}`.trim(),
    size: new TextEncoder().encode(normalized).length,
    type: 'text',
    mimeType: 'text/plain',
    previewText: normalized,
    lineCount,
  };
}

/**
 * Preserves the current assistant response inside `variants` and prepares a fresh
 * streaming slot so the user can switch between response versions (< 1 / 2 >).
 */
export function prepareAssistantRegeneration(
  conversations: Conversation[],
  conversationId: string,
  assistantMessageId: string,
  nextModelId: ModelId,
  nowIso: string,
  extendedThinking: boolean
): Conversation[] {
  return conversations.map((conv) => {
    if (conv.id !== conversationId) return conv;
    return {
      ...conv,
      updatedAt: nowIso,
      messages: conv.messages.map((msg) => {
        if (msg.id !== assistantMessageId || msg.role !== 'assistant') return msg;
        const currentSnapshot = {
          content: msg.content,
          createdAt: msg.createdAt,
          modelId: msg.modelId,
          thinking: msg.thinking,
          thinkingDurationSec: msg.thinkingDurationSec,
          citations: msg.citations,
          artifact: msg.artifact,
          wasStopped: msg.wasStopped,
        };
        const existingVariants =
          msg.variants && msg.variants.length > 0
            ? msg.variants.map((v, i) =>
                i === (msg.activeVariantIndex ?? msg.variants!.length - 1)
                  ? currentSnapshot
                  : v
              )
            : [currentSnapshot];

        const nextVariants = [
          ...existingVariants,
          {
            content: '',
            createdAt: nowIso,
            modelId: nextModelId,
          },
        ];

        return {
          ...msg,
          content: '',
          createdAt: nowIso,
          modelId: nextModelId,
          thinking: undefined,
          thinkingDurationSec: undefined,
          citations: undefined,
          artifact: undefined,
          wasStopped: false,
          isStreaming: true,
          isThinkingStreaming: extendedThinking,
          variants: nextVariants,
          activeVariantIndex: nextVariants.length - 1,
        };
      }),
    };
  });
}

export function switchAssistantVariant(
  conversations: Conversation[],
  conversationId: string,
  assistantMessageId: string,
  nextIndex: number
): Conversation[] {
  return conversations.map((conv) => {
    if (conv.id !== conversationId) return conv;
    return {
      ...conv,
      messages: conv.messages.map((msg) => {
        if (msg.id !== assistantMessageId || !msg.variants || msg.variants.length === 0) {
          return msg;
        }
        const bounded = Math.max(0, Math.min(nextIndex, msg.variants.length - 1));
        const currentIdx = msg.activeVariantIndex ?? msg.variants.length - 1;
        const syncedVariants = msg.variants.map((v, i) =>
          i === currentIdx
            ? {
                content: msg.content,
                createdAt: msg.createdAt,
                modelId: msg.modelId,
                thinking: msg.thinking,
                thinkingDurationSec: msg.thinkingDurationSec,
                citations: msg.citations,
                artifact: msg.artifact,
                wasStopped: msg.wasStopped,
              }
            : v
        );
        const chosen = syncedVariants[bounded];
        return {
          ...msg,
          content: chosen.content,
          createdAt: chosen.createdAt,
          modelId: chosen.modelId,
          thinking: chosen.thinking,
          thinkingDurationSec: chosen.thinkingDurationSec,
          citations: chosen.citations,
          artifact: chosen.artifact,
          wasStopped: chosen.wasStopped,
          variants: syncedVariants,
          activeVariantIndex: bounded,
        };
      }),
    };
  });
}
