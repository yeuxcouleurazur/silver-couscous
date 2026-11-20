/** Shared types for the FCC Bridge. These mirror the frontend contract
 * (src/types/claude.ts and src/services/fccAdapter.ts) so the bridge stays
 * wire-compatible with the web frontend, plus bridge-specific discovery types.
 */

export type ModelId = string;

export type EffortLevel = 'low' | 'medium' | 'high' | 'max';

export type PermissionMode = 'plan' | 'manual' | 'auto-edit';

export type ChatMode = 'main' | 'btw';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: 'code' | 'document' | 'image' | 'text';
  mimeType: string;
  previewText?: string;
  lineCount?: number;
}

export interface ToolSettings {
  webSearch: boolean;
  extendedThinking: boolean;
  artifacts: boolean;
  responseStyle: 'normal' | 'concis' | 'explicatif' | 'formel';
}

export interface ConversationHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Payload the frontend POSTs to /v1/claude/stream. */
export interface SendMessagePayload {
  conversationId: string;
  prompt: string;
  modelId: ModelId;
  tools: ToolSettings;
  attachments: Attachment[];
  history?: ConversationHistoryTurn[];
  effort?: EffortLevel;
  mode?: ChatMode;
  projectName?: string;
  projectInstructions?: string;
  permissionMode?: PermissionMode;
}

/** SSE event contract the bridge emits, mirroring ClaudeStreamEvent. */
export type BridgeStreamEvent =
  | { type: 'thinking_delta'; delta: string }
  | { type: 'thinking_done'; durationSec: number }
  | { type: 'text_delta'; delta: string }
  | { type: 'citation'; citations: Citation[] }
  | { type: 'artifact'; artifact: Artifact }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface Citation {
  id: number;
  title: string;
  domain: string;
  url: string;
  excerpt: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: 'code' | 'markdown' | 'svg' | 'html';
  language?: string;
  content: string;
  version: number;
  updatedAt: string;
}

/** ------------------------------------------------------------------ */
/** Discovery types                                                    */
/** ------------------------------------------------------------------ */

export interface DiscoveredModel {
  id: string;
  displayName: string;
  providerModelRef?: string;
  supportsReasoning?: boolean | null;
  contextWindowTokens?: number | null;
  maxOutputTokens?: number | null;
  inputModalities?: string[];
  apiBackend?: string | null;
  reasoningEfforts?: string[];
}

export interface DiscoveredMCPServer {
  id: string; // e.g. "stdio:<hash>"
  name: string;
  transport: 'stdio' | 'http' | 'websocket';
  command?: string;
  args?: string[];
  url?: string;
  protocolVersion?: string;
  observedAt?: number;
  capabilities?: string[];
  enabled: boolean;
}

export interface DiscoveredSkill {
  id: string; // directory name, e.g. "clean-code"
  name: string;
  description: string;
  risk?: string;
  source?: string;
  dateAdded?: string;
  path: string; // absolute path to the skill directory
  enabled: boolean;
}

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
  type: 'skill' | 'mcp' | 'builtin';
  source: string; // where it was discovered from
  enabled: boolean;
}

/** ------------------------------------------------------------------ */
/** Permission / tool-call types                                       */
/** ------------------------------------------------------------------ */

export type ToolKind = 'read' | 'write' | 'edit' | 'run' | 'search' | 'mcp' | 'skill';

export interface ToolCallRequest {
  id: string;
  kind: ToolKind;
  label: string;
  target: string; // file path, command, mcp server/tool, skill id
  permissionMode: PermissionMode;
  workspacePath: string | null;
  meta?: Record<string, unknown>;
}

export interface ToolCallDecision {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  approvalId?: string;
}

export interface ApprovalCard {
  id: string;
  title: string;
  description: string;
  workingDirectory: string;
  command: string;
  status: 'pending' | 'approved-once' | 'approved-session' | 'denied';
}

/** ------------------------------------------------------------------ */
/** Session / stream state                                             */
/** ------------------------------------------------------------------ */

export interface StreamSession {
  conversationId: string;
  abortController: AbortController;
  startedAt: number;
  modelId: ModelId;
  permissionMode: PermissionMode;
  active: boolean;
}
