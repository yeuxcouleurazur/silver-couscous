/**
 * Pure conversational pre-launch logic for Dot Brain.
 *
 * Ensures Dot Brain always talks with the user first to clarify, structure, and
 * validate a plan — and only launches the multi-agent swarm when the user
 * explicitly commands it (via natural launch phrasing or the Launch button).
 */

export interface DotChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string;
  status?: 'streaming' | 'done' | 'error';
}

const NEGATION_OR_DEFERRAL_RE =
  /\b(ne\s+lance\s+pas|lance\s+pas|pas\s+encore|avant\s+de\s+lancer|sans\s+lancer|attends?|attendre|stop|arrête|arrete|annule|non|don'?t\s+launch|not\s+yet|wait)\b/i;

const EXPLICIT_LAUNCH_RE =
  /^(?:(?:ok(?:ay)?|oui|ouais|parfait|super|top|cool|très\s+bien|tres\s+bien|d'?accord|c'?est\s+bon|allez|bon|bien|merci|allons-y|allons\s+y|on\s+y\s+va)[\s,!.:;-]*)*(?:tu\s+peux\s+|vous\s+pouvez\s+|peux-tu\s+|stp\s+|s'?il\s+te\s+pla[îi]t\s+)?(?:lance(?:r|z|s|-le|-la|-les)?(?:\s+(?:le|la|les|tout|ça|ca|la\s+mission|les\s+agents|le\s+plan|dot\s*brain|l'?exécution|l'?execution|maintenant))?|d[ée]marre(?:r|z|s)?(?:\s+(?:la\s+mission|les\s+agents|le\s+plan|maintenant|tout))?|ex[ée]cute(?:r|z|s)?(?:\s+(?:la\s+mission|les\s+agents|le\s+plan|maintenant|tout))?|vas[- ]?y(?:\s+lance(?:r|z)?)?|go(?:\s+lance(?:r|z)?)?|envoie(?:\s+(?:les\s+agents|la\s+mission))?|start(?:\s+(?:now|agents|mission))?|launch(?:\s+(?:now|agents|mission|it))?|run\s+(?:it|agents|mission))[\s,!.:;-]*(?:maintenant|stp|s'?il\s+te\s+pla[îi]t|please|les\s+agents|la\s+mission|le\s+plan|tout)?[\s!.]*$/i;

/**
 * Determine whether the user's message is an explicit command to launch the
 * multi-agent execution swarm.
 *
 * Rules:
 * - Never triggers if there has been no prior discussion yet (`hasPriorDiscussion === false`),
 *   so the user ALWAYS gets a direct conversational response from Dot Brain first.
 * - Never triggers on questions (`?`), negations/deferrals ("avant de lancer", "pas encore",
 *   "ne lance pas"), or long descriptive messages (> 90 chars).
 */
export function isLaunchCommand(input: string, hasPriorDiscussion: boolean): boolean {
  if (!hasPriorDiscussion) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (trimmed.length > 90) return false;
  if (trimmed.includes('?')) return false;
  if (NEGATION_OR_DEFERRAL_RE.test(trimmed)) return false;

  return EXPLICIT_LAUNCH_RE.test(trimmed);
}

/**
 * Consolidate a pre-launch conversation between the user and Dot Brain into a
 * clean mission title + structured brief for the multi-agent swarm.
 */
export function buildMissionBriefFromConversation(
  messages: DotChatMessage[],
  fallbackPrompt = 'Mission Dot Brain',
): { title: string; description: string } {
  const userTurns = messages.filter(
    (m) => m.role === 'user' && m.content.trim().length > 0 && !isLaunchCommand(m.content, true),
  );
  const assistantTurns = messages.filter(
    (m) => m.role === 'assistant' && m.content.trim().length > 0 && m.status !== 'error',
  );

  const primaryGoal = userTurns[0]?.content.trim() || fallbackPrompt.trim() || 'Mission Dot Brain';
  const title = primaryGoal.length > 96 ? `${primaryGoal.slice(0, 93).trim()}…` : primaryGoal;

  const parts: string[] = [];

  if (userTurns.length > 0) {
    parts.push('DEMANDE UTILISATEUR :');
    userTurns.forEach((u, idx) => {
      parts.push(idx === 0 ? u.content.trim() : `- Précision ${idx} : ${u.content.trim()}`);
    });
  } else {
    parts.push(`DEMANDE UTILISATEUR :\n${primaryGoal}`);
  }

  const lastAssistantPlan = assistantTurns[assistantTurns.length - 1]?.content.trim();
  if (lastAssistantPlan) {
    parts.push(`\nPLAN ET CADRAGE CONVENUS AVEC DOT BRAIN :\n${lastAssistantPlan.slice(0, 2200)}`);
  }

  return {
    title,
    description: parts.join('\n'),
  };
}

export interface OrchestratorPromptContext {
  workspaceName?: string;
  workspacePath?: string;
  topLevelEntries?: string[];
  attachedFileNames?: string[];
  plannedStepsSummary?: string[];
  mode?: string;
}

/**
 * Build the system instruction for Dot Brain's pre-launch orchestrator dialogue.
 */
export function buildOrchestratorSystemPrompt(ctx: OrchestratorPromptContext): string {
  const lines: string[] = [
    'Tu es le Cerveau central de Dot Brain, l’orchestrateur d’un réseau de 39 agents IA spécialisés (Dots) répartis en 8 lobes cognitifs (Noyau & Orchestration, Recherche & Analyse, Architecture & Infra, Développement, Design & UX, Tests & Qualité, Revue & Supervision, Mémoire & Exploration).',
    'RÈGLE ESSENTIELLE : Tu es en phase de DISCUSSION PRÉALABLE avant exécution. Les agents n’ont PAS ENCORE été lancés.',
    '1. Réponds directement et naturellement à l’utilisateur en français, de façon claire et concise.',
    '2. Comprends son besoin, pose 1 ou 2 questions de clarification courtes uniquement si quelque chose est vraiment ambigu.',
    '3. Propose un mini-plan concret (2 à 4 étapes max) en citant les Dots pertinents qui interviendront.',
    '4. Termine en lui rappelant en une courte phrase qu’il peut ajuster le plan ou simplement dire « lance » (ou cliquer sur « Lancer les agents ») dès qu’il veut démarrer l’exécution.',
    'Ne prétends jamais avoir déjà lancé les agents ou terminé la mission durant cette phase de dialogue.',
  ];

  if (ctx.mode) {
    lines.push(`Mode de mission sélectionné : ${ctx.mode}.`);
  }
  if (ctx.workspaceName || ctx.workspacePath) {
    lines.push(
      `Dossier / espace actif : ${[ctx.workspaceName, ctx.workspacePath].filter(Boolean).join(' — ')}.`,
    );
  }
  if (ctx.topLevelEntries && ctx.topLevelEntries.length > 0) {
    lines.push(`Entrées principales du dossier : ${ctx.topLevelEntries.slice(0, 20).join(', ')}.`);
  }
  if (ctx.attachedFileNames && ctx.attachedFileNames.length > 0) {
    lines.push(`Fichiers joints fournis par l’utilisateur : ${ctx.attachedFileNames.join(', ')}.`);
  }
  if (ctx.plannedStepsSummary && ctx.plannedStepsSummary.length > 0) {
    lines.push(
      `Étapes pressenties par le routeur Dot Brain : ${ctx.plannedStepsSummary.join(' → ')}.`,
    );
  }

  return lines.join('\n');
}
