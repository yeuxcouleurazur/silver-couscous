/**
 * Services — Unified exports for all internal services.
 */

// FCC Adapter (model communication)
export {
  createClaudeAdapter,
  fetchFccModels,
  getKnownClaudeModels,
  type FccHttpAdapter,
  type GeminiApiAdapter,
  type ClaudeTransportAdapter,
  type SendMessagePayload,
  type ConversationHistoryTurn,
  type ClaudeStreamEvent,
  type UsageInfo,
} from './fccAdapter';

// Usage Tracker (real token/cost tracking)
export {
  usageTracker,
  type UsageRecord,
  type UsageStats,
  type ModelUsageStats,
  type ProviderUsageStats,
} from './usageTracker';

// Tool Executor (file operations, commands, search)
export {
  TOOL_DEFINITIONS,
  buildToolDefinitionsPrompt,
  parseToolCalls,
  stripToolCalls,
  executeToolCall,
  executeToolCalls,
} from './toolExecutor';

// Agent Orchestrator (backward-compatible facade)
export {
  agentOrchestrator,
} from './agentOrchestrator';

// Dot Brain (multi-agent system)
export * from './dot';

// Dot Brain Public API (for ALL AIs to access)
export {
  dotBrainPublicApi,
  type DotBrainPublicAPI,
} from './dot/publicApi';