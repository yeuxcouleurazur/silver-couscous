import type { ModelConfig } from '../types/claude';

/** Real usage record from an actual model call. */
export interface UsageRecord {
  id: string;
  timestamp: string; // ISO 8601
  modelId: string;
  modelName: string;
  provider: 'fcc' | 'gemini';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs: number;
  success: boolean;
  error?: string;
  conversationId?: string;
  missionId?: string;
  agentId?: string;
}

/** Aggregated usage statistics. */
export interface UsageStats {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalEstimatedCost: number;
  averageLatencyMs: number;
  successRate: number;
  byModel: Record<string, ModelUsageStats>;
  byProvider: Record<string, ProviderUsageStats>;
  recentCalls: UsageRecord[];
}

/** Per-model usage statistics. */
export interface ModelUsageStats {
  modelId: string;
  modelName: string;
  provider: 'fcc' | 'gemini';
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  averageLatencyMs: number;
  successRate: number;
}

/** Per-provider usage statistics. */
export interface ProviderUsageStats {
  provider: 'fcc' | 'gemini';
  requests: number;
  totalTokens: number;
  estimatedCost: number;
  successRate: number;
}

/** Cost estimation per model (approximate, based on public pricing). */
export interface ModelPricing {
  inputPerMillion: number; // USD per 1M input tokens
  outputPerMillion: number; // USD per 1M output tokens
}

/** Known model pricing (approximate, update as needed). */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude models via OpenRouter (approximate)
  'claude-opus-5-5': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-sonnet-5-5': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-fable-5-2': { inputPerMillion: 0.50, outputPerMillion: 2.50 },
  'claude-haiku-5-5': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  // Legacy
  'claude-opus-4-1': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-opus-4-0': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-sonnet-4-0': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-5-haiku': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'claude-3-haiku': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  // NVIDIA NIM models (often free on OpenRouter)
  'nvidia/nemotron-3-ultra-550b-a55b': { inputPerMillion: 0.00, outputPerMillion: 0.00 },
  'nvidia/nemotron-3.5-super-vl-120b-a12b': { inputPerMillion: 0.00, outputPerMillion: 0.00 },
  'nvidia/nemotron-3.5-lightning-30b-a3b': { inputPerMillion: 0.00, outputPerMillion: 0.00 },
  'google/gemma-4-31b-it': { inputPerMillion: 0.00, outputPerMillion: 0.00 },
  'mistralai/mistral-large-4-1t-a52b': { inputPerMillion: 0.00, outputPerMillion: 0.00 },
  'moonshotai/kimi-k3.1-pro': { inputPerMillion: 0.00, outputPerMillion: 0.00 },
  // OpenRouter free models
  'open_router/stepfun/step-3.5-flash:free': { inputPerMillion: 0.00, outputPerMillion: 0.00 },
  // OpenAI models
  'openai/gpt-5.6-luna': { inputPerMillion: 10.00, outputPerMillion: 30.00 },
  'openai/gpt-5.6-terra': { inputPerMillion: 10.00, outputPerMillion: 30.00 },
  'openai/gpt-6-luna': { inputPerMillion: 15.00, outputPerMillion: 60.00 },
};

/** Default pricing for unknown models. */
const DEFAULT_PRICING: ModelPricing = { inputPerMillion: 1.00, outputPerMillion: 5.00 };

const STORAGE_KEY = 'claude_desktop_usage_history';
const MAX_HISTORY = 1000;

/** Rough token estimation: ~4 chars per token for English, ~3 for French/code. */
function estimateTokens(text: string): number {
  if (!text) return 0;
  const charCount = text.length;
  // Mixed content average
  return Math.ceil(charCount / 3.5);
}

/** Get pricing for a model ID. */
function getPricing(modelId: string): ModelPricing {
  // Try exact match
  if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];
  // Try partial match for variants
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelId.includes(key) || key.includes(modelId)) return pricing;
  }
  return DEFAULT_PRICING;
}

/** Calculate estimated cost for a call. */
function calculateCost(promptTokens: number, completionTokens: number, modelId: string): number {
  const pricing = getPricing(modelId);
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

/** Load usage history from localStorage. */
function loadHistory(): UsageRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UsageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save usage history to localStorage. */
function saveHistory(history: UsageRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // Ignore quota errors
  }
}

/**
 * UsageTracker — tracks real model usage from actual API calls.
 * All data comes from real requests, never simulated.
 */
export class UsageTracker {
  private static instance: UsageTracker;
  private history: UsageRecord[] = [];
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.history = loadHistory();
  }

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /** Subscribe to usage updates. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  /** Record a real model call. */
  recordCall(params: {
    modelId: string;
    modelName: string;
    provider: 'fcc' | 'gemini';
    promptText: string;
    completionText: string;
    durationMs: number;
    success: boolean;
    error?: string;
    conversationId?: string;
    missionId?: string;
    agentId?: string;
    // Optional: exact tokens if provided by the API
    promptTokens?: number;
    completionTokens?: number;
  }): UsageRecord {
    const promptTokens = params.promptTokens ?? estimateTokens(params.promptText);
    const completionTokens = params.completionTokens ?? estimateTokens(params.completionText);
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = calculateCost(promptTokens, completionTokens, params.modelId);

    const record: UsageRecord = {
      id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      modelId: params.modelId,
      modelName: params.modelName,
      provider: params.provider,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      durationMs: params.durationMs,
      success: params.success,
      error: params.error,
      conversationId: params.conversationId,
      missionId: params.missionId,
      agentId: params.agentId,
    };

    this.history.push(record);
    saveHistory(this.history);
    this.notify();

    return record;
  }

  /** Get all usage records (most recent first). */
  getHistory(limit?: number): UsageRecord[] {
    const sorted = [...this.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /** Get aggregated statistics. */
  getStats(): UsageStats {
    const totalRequests = this.history.length;
    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        averageLatencyMs: 0,
        successRate: 100,
        byModel: {},
        byProvider: {},
        recentCalls: [],
      };
    }

    const successful = this.history.filter((r) => r.success);
    const totalPromptTokens = this.history.reduce((sum, r) => sum + r.promptTokens, 0);
    const totalCompletionTokens = this.history.reduce((sum, r) => sum + r.completionTokens, 0);
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const totalEstimatedCost = this.history.reduce((sum, r) => sum + r.estimatedCost, 0);
    const averageLatencyMs = this.history.reduce((sum, r) => sum + r.durationMs, 0) / totalRequests;
    const successRate = (successful.length / totalRequests) * 100;

    // By model
    const byModel: Record<string, ModelUsageStats> = {};
    for (const record of this.history) {
      if (!byModel[record.modelId]) {
        byModel[record.modelId] = {
          modelId: record.modelId,
          modelName: record.modelName,
          provider: record.provider,
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          averageLatencyMs: 0,
          successRate: 0,
        };
      }
      const m = byModel[record.modelId];
      m.requests += 1;
      m.promptTokens += record.promptTokens;
      m.completionTokens += record.completionTokens;
      m.totalTokens += record.totalTokens;
      m.estimatedCost += record.estimatedCost;
    }
    // Calculate averages for models
    for (const m of Object.values(byModel)) {
      m.averageLatencyMs = this.history
        .filter((r) => r.modelId === m.modelId)
        .reduce((sum, r) => sum + r.durationMs, 0) / m.requests;
      const modelSuccess = this.history.filter((r) => r.modelId === m.modelId && r.success).length;
      m.successRate = (modelSuccess / m.requests) * 100;
    }

    // By provider
    const byProvider: Record<string, ProviderUsageStats> = {};
    for (const record of this.history) {
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = {
          provider: record.provider,
          requests: 0,
          totalTokens: 0,
          estimatedCost: 0,
          successRate: 0,
        };
      }
      const p = byProvider[record.provider];
      p.requests += 1;
      p.totalTokens += record.totalTokens;
      p.estimatedCost += record.estimatedCost;
    }
    for (const p of Object.values(byProvider)) {
      const providerSuccess = this.history.filter((r) => r.provider === p.provider && r.success).length;
      p.successRate = (providerSuccess / p.requests) * 100;
    }

    return {
      totalRequests,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalEstimatedCost,
      averageLatencyMs,
      successRate,
      byModel,
      byProvider,
      recentCalls: this.getHistory(10),
    };
  }

  /** Clear all usage history. */
  clearHistory(): void {
    this.history = [];
    saveHistory([]);
    this.notify();
  }

  /** Export usage data as JSON. */
  exportData(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      records: this.history,
      stats: this.getStats(),
    }, null, 2);
  }
}

/** Export singleton instance. */
export const usageTracker = UsageTracker.getInstance();