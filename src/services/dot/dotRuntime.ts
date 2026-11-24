import type { ClaudeTransportAdapter } from '../fccAdapter';
import type { Agent, AgentStatus, LLMCallRequest, LLMCallResponse, MissionStep } from '../../types/agent';
import { agentStatusChanged, stepCompleted, stepFailed } from './dotMonitor';
import { addMemory } from './dotMemory';

/**
 * Dot Runtime — real agent execution via model calls.
 *
 * Given an agent and a task, builds the prompt from the agent's system prompt
 * and task description, invokes the model through the ClaudeTransportAdapter,
 * and returns a real LLMCallResponse. No SLEEP, no random failure — every
 * execution is a genuine model invocation.
 */

interface ExecuteParams {
  adapter: ClaudeTransportAdapter;
  agent: Agent;
  step: MissionStep;
  missionId: string;
  missionTitle: string;
  missionDescription: string;
  context?: string; // additional context from previous steps / messages
  modelOverride?: string; // optional model override
  effort?: 'low' | 'medium' | 'high' | 'max';
  permissionMode?: 'manual' | 'auto-edit' | 'plan';
  signal?: AbortSignal; // mission abort signal
  onDelta?: (delta: string, accumulated: string) => void;
}

/** Execute a single step by its assigned agent using a real model call. */
export async function executeAgentStep(params: ExecuteParams): Promise<LLMCallResponse> {
  const {
    adapter,
    agent,
    step,
    missionId,
    missionTitle,
    missionDescription,
    context,
    modelOverride,
    effort = 'low',
    permissionMode = 'manual',
    signal,
    onDelta,
  } = params;
  const model = modelOverride ?? agent.config.model;

  agentStatusChanged(agent.id, 'working', missionId);

  const systemPrompt =
    agent.config.systemPrompt ||
    `Tu es l'agent ${agent.name} (${agent.role}). Tu exécutes des tâches de manière autonome et produis des résultats concrets, structurés et concis en français.`;

  const contextSection = context
    ? `\n\nCONTEXTE (étapes précédentes / messages):\n${context}\n`
    : '';

  const prompt = `# Mission: ${missionTitle}\n${missionDescription}\n\n# Étape: ${step.title}\nObjectif: ${step.description}${contextSection}\n\nProduis le résultat de cette étape en français. Sois précis, concret et bien structuré (format Markdown concis).`;

  const request: LLMCallRequest = {
    agentId: agent.id,
    prompt,
    systemPrompt,
    model,
    temperature: agent.config.temperature,
    maxTokens: agent.config.maxTokens,
    stream: true,
  };

  let content = '';
  let error: string | undefined;
  let tokensUsed: number | undefined;
  let durationMs = 0;

  const start = Date.now();
  const effectiveSignal = signal ?? new AbortController().signal;

  try {
    const stream = adapter.sendMessageStream(
      {
        conversationId: `mission-${missionId}-agent-${agent.id}-step-${step.id}`,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        modelId: request.model,
        tools: {
          webSearch: false,
          extendedThinking: effort === 'high' || effort === 'max',
          artifacts: false,
          responseStyle: 'normal',
        },
        attachments: [],
        history: [],
        projectName: missionTitle,
        effort,
        mode: 'main',
        permissionMode,
      },
      effectiveSignal,
    );

    for await (const event of stream) {
      if (effectiveSignal.aborted) {
        error = 'Exécution interrompue';
        break;
      }
      if (event.type === 'text_delta') {
        content += event.delta;
        onDelta?.(event.delta, content);
      } else if (event.type === 'usage') {
        tokensUsed = event.usage.totalTokens;
      } else if (event.type === 'error') {
        error = event.message;
        break;
      } else if (event.type === 'done') {
        // Continue briefly in case usage event follows done
        continue;
      }
    }
  } catch (err) {
    if (effectiveSignal.aborted) {
      error = 'Exécution interrompue';
    } else {
      error = err instanceof Error ? err.message : 'Erreur d\'exécution inconnue';
    }
  }
  durationMs = Date.now() - start;

  if (tokensUsed === undefined && content.length > 0) {
    tokensUsed = Math.max(1, Math.ceil((request.prompt.length + content.length) / 4));
  }

  const response: LLMCallResponse = {
    content: error ? '' : content,
    model,
    tokensUsed,
    durationMs,
    provider: adapter.kind,
    error,
  };

  // Persist result to agent memory if successful
  if (!error && content.trim()) {
    try {
      addMemory(agent.id, {
        type: 'result',
        title: `Résultat: ${step.title}`,
        content,
        tags: [agent.role, step.title, 'mission-step'],
        sourceAgentId: agent.id,
      });
    } catch {
      // memory write is non-fatal
    }
  }

  return response;
}
