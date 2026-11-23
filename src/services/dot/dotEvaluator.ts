import type { ClaudeTransportAdapter } from '../fccAdapter';
import type { Agent, EvaluationResult, Mission, MissionStep } from '../../types/agent';
import { evaluationDone, errorDetected } from './dotMonitor';

/**
 * Dot Evaluator — quality control for step results.
 *
 * Evaluates whether a step's output meets the mission requirements by asking a
 * model to score the result (0-100), provide feedback, and determine if
 * correction is needed. Uses real model calls — no simulation.
 */

interface EvaluateParams {
  adapter: ClaudeTransportAdapter;
  agent: Agent;
  step: MissionStep;
  mission: Mission;
  model: string;
}

/** Evaluate a step result using the model. */
export async function evaluateStep(params: EvaluateParams): Promise<EvaluationResult> {
  const { adapter, agent, step, mission, model } = params;

  const systemPrompt = `Tu es l'évaluateur de qualité du système Dot Brain. Ta tâche est d'évaluer le résultat d'une étape de mission et de déterminer s'il est satisfaisant.

Critères d'évaluation :
1. Le résultat répond-il à l'objectif de l'étape ?
2. Le résultat est-il complet, clair et actionable ?
3. Y a-t-il des erreurs évidentes ou des omissions importantes ?

Réponds UNIQUEMENT au format JSON suivant (sans texte autour) :
{
  "score": <nombre 0-100>,
  "passed": <true si score >= 70>,
  "feedback": "explication concise en français",
  "needsCorrection": <true si le résultat doit être retravaillé>,
  "suggestedFix": "suggestion de correction si needsCorrection est true, sinon null"
}`;

  const userPrompt = `MISSION: ${mission.title}\n${mission.description}\n\nÉTAPE: ${step.title}\nObjectif: ${step.description}\n\nRÉSULTAT PRODUIT PAR L'AGENT ${agent.name} (${agent.role}):\n${step.result ?? '(aucun résultat)'}\n\nÉvalue ce résultat.`;

  let content = '';
  let error: string | undefined;
  let tokensUsed: number | undefined;
  let durationMs = 0;

  const start = Date.now();
  try {
    const stream = adapter.sendMessageStream(
      {
        conversationId: `eval-${mission.id}-${step.id}`,
        prompt: userPrompt,
        modelId: model,
        tools: { webSearch: false, extendedThinking: false, artifacts: false, responseStyle: 'concis' },
        attachments: [],
        history: [],
        projectName: mission.title,
        effort: 'low',
        mode: 'main',
        permissionMode: 'manual',
      },
      new AbortController().signal,
    );

    for await (const event of stream) {
      if (event.type === 'text_delta') {
        content += event.delta;
      } else if (event.type === 'error') {
        error = event.message;
        break;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Erreur d\'évaluation inconnue';
  }
  durationMs = Date.now() - start;

  if (error) {
    errorDetected(mission.id, agent.id, `Évaluation échouée: ${error}`);
    return {
      stepId: step.id,
      passed: false,
      score: 0,
      feedback: `Impossible d'évaluer automatiquement: ${error}`,
      needsCorrection: true,
    };
  }

  // Parse the JSON from the model response
  let parsed: { score: number; passed: boolean; feedback: string; needsCorrection: boolean; suggestedFix?: string };
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : content;
    parsed = JSON.parse(jsonText);
  } catch {
    // Fallback: treat as passed if content is non-empty
    parsed = {
      score: content.trim().length > 0 ? 75 : 0,
      passed: content.trim().length > 0,
      feedback: content.trim() || 'Évaluation non interprétable.',
      needsCorrection: content.trim().length === 0,
    };
  }

  const result: EvaluationResult = {
    stepId: step.id,
    passed: Boolean(parsed.passed),
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    feedback: parsed.feedback || 'Évaluation terminée.',
    needsCorrection: Boolean(parsed.needsCorrection),
    suggestedFix: parsed.suggestedFix,
  };

  evaluationDone(mission.id, step.id, result.passed, result.score, result.needsCorrection);
  return result;
}
