export type ThemeMode = 'light' | 'dark' | 'system';

export type ChatFontPreference = 'serif' | 'sans' | 'dyslexic';

export type ModelId = string;

export type ResponseStyle = 'normal' | 'concis' | 'explicatif' | 'formel';

export type ActiveView = 'chat' | 'projects' | 'project-detail' | 'chats-all' | 'artifacts';

export interface ModelConfig {
  id: ModelId;
  name: string;
  shortName: string;
  description: string;
  supportsThinking: boolean;
}

export interface ToolSettings {
  webSearch: boolean;
  extendedThinking: boolean;
  artifacts: boolean;
  responseStyle: ResponseStyle;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: 'code' | 'document' | 'image' | 'text';
  mimeType: string;
  previewText?: string;
  base64Data?: string;
  lineCount?: number;
}

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

export interface MessageVariant {
  content: string;
  createdAt: string;
  modelId?: ModelId;
  thinking?: string;
  thinkingDurationSec?: number;
  citations?: Citation[];
  artifact?: Artifact;
  wasStopped?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  modelId?: ModelId;
  attachments?: Attachment[];
  thinking?: string;
  thinkingDurationSec?: number;
  isThinkingStreaming?: boolean;
  isStreaming?: boolean;
  wasStopped?: boolean;
  citations?: Citation[];
  artifact?: Artifact;
  feedback?: 'up' | 'down' | null;
  variants?: MessageVariant[];
  activeVariantIndex?: number;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  starred: boolean;
  projectId: string | null;
  modelId: ModelId;
  messages: Message[];
}

export interface ProjectKnowledgeFile {
  id: string;
  name: string;
  sizeLabel: string;
  lines: number;
  contentPreview: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  updatedAt: string;
  starred: boolean;
  files: ProjectKnowledgeFile[];
}

export type AppSurfaceMode = 'code' | 'chat' | 'agents' | 'write';

export type CodeSubPage = 'session' | 'customize' | 'projects' | 'permissions';

export type EffortLevel = 'low' | 'medium' | 'high' | 'max';

export type PermissionMode = 'manual' | 'auto-edit' | 'plan';

export type RightPaneMode = 'none' | 'rail' | 'changes' | 'side-chat' | 'terminal' | 'files' | 'preview';

export type SettingsSectionId =
  | 'account'
  | 'usage'
  | 'appearance'
  | 'general'
  | 'models'
  | 'permissions'
  | 'local-pc'
  | 'notifications'
  | 'customize'
  | 'code'
  | 'fcc';

export interface FccConnectionConfig {
  mode: 'gemini' | 'fcc';
  endpointUrl: string;
  workspaceLabel: string;
  sendWithCredentials: boolean;
}

export interface UserPreferences {
  theme: ThemeMode;
  chatFont: ChatFontPreference;
  userName: string;
  userEmail: string;
  userInitials: string;
  planLabel: string;
  sendWithEnter: boolean;
  fcc: FccConnectionConfig;
}

export interface CodeWorkspace {
  id: string;
  name: string;
  pathLabel: string;
  branch: string;
  environmentLabel: string;
  files: Array<{
    path: string;
    language: string;
    content: string;
  }>;
}

export interface ToolCallItem {
  id: string;
  kind: 'read' | 'edit' | 'run' | 'search';
  label: string;
  target: string;
  additions?: number;
  deletions?: number;
  outputPreview?: string;
}

export interface EditedFileItem {
  path: string;
  icon: 'html' | 'code' | 'doc';
  additions: number;
  deletions: number;
}

export interface TaskItem {
  id: string;
  label: string;
  status: 'done' | 'running' | 'pending';
}

export interface ApprovalCardData {
  id: string;
  title: string;
  description: string;
  workingDirectory: string;
  command: string;
  status: 'pending' | 'approved-once' | 'approved-session' | 'denied';
}

export interface NextStepCardData {
  id: string;
  summary: string;
  question: string;
  primaryLabel: string;
  secondaryLabel: string;
  dismissed?: boolean;
  resolvedLabel?: string;
}

export interface CodeTurn {
  id: string;
  role: 'user' | 'assistant';
  intro?: string;
  content: string;
  createdAt: string;
  modelId?: ModelId;
  effort?: EffortLevel;
  isStreaming?: boolean;
  wasStopped?: boolean;
  thinking?: string;
  thinkingDurationSec?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  citations?: Citation[];
  artifact?: Artifact;
  toolGroupSummary?: string;
  toolGroupAdditions?: number;
  toolGroupDeletions?: number;
  toolGroupDefaultExpanded?: boolean;
  toolCalls?: ToolCallItem[];
  editedFiles?: EditedFileItem[];
  tasks?: TaskItem[];
  runningCommandLabel?: string;
  runningDurationLabel?: string;
  approval?: ApprovalCardData;
  nextStep?: NextStepCardData;
}

export interface DiffLine {
  lineNumber: number;
  kind: 'context' | 'added' | 'removed';
  text: string;
}

export interface FileDiff {
  id: string;
  path: string;
  icon: 'html' | 'code' | 'doc';
  additions: number;
  deletions: number;
  lines: DiffLine[];
  collapsedLinesCount?: number;
}

export interface ContextCategory {
  id: string;
  label: string;
  color: string;
  tokens: number;
  dottedUnderline?: boolean;
}

/** Tool call from the model (parsed from structured output). */
export interface ToolCall {
  id: string;
  name: ToolName;
  arguments: Record<string, unknown>;
}

/** Real tool names available for the model & agents to invoke. */
export type ToolName =
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'delete_file'
  | 'move_file'
  | 'list_files'
  | 'run_command'
  | 'glob_files'
  | 'search_files'
  | 'git_status'
  | 'git_diff'
  | 'web_search'
  | 'fetch_url';

/** Tool result returned to the model after execution. */
export interface ToolResult {
  toolCallId: string;
  name: ToolName;
  success: boolean;
  output?: string;
  error?: string;
}

/** Permission state for a pending tool call. */
export interface ToolPermissionRequest {
  id: string;
  toolCall: ToolCall;
  status: 'pending' | 'approved-once' | 'approved-session' | 'denied';
  timestamp: number;
  approvalId?: string;
  permissionKey?: string;
  summary?: string;
  detail?: string;
}

export interface SideChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  thinkingDurationSec?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
}

export interface SideChatSession {
  id: string;
  title: string;
  messages: SideChatMessage[];
}

export interface CodeSession {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  title: string;
  updatedAt: string;
  starred?: boolean;
  needsInput?: boolean;
  originLabel: string;
  savedEnvironment?: boolean;
  contextLimitTokens: number;
  contextCategories: ContextCategory[];
  mcpToolsCount: number;
  memoryFilesCount: number;
  outputs: string[];
  diffs: FileDiff[];
  committed?: boolean;
  terminalLines: string[];
  turns: CodeTurn[];
  sideChats: SideChatSession[];
}

export interface SlashCommandItem {
  id: string;
  name: string;
  description: string;
  alias?: string;
  hint?: string;
}
