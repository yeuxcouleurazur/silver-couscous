export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'communicating'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'error';

export type AgentRole =
  | 'architecte'
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'database'
  | 'api'
  | 'devops'
  | 'security'
  | 'researcher'
  | 'analyst'
  | 'documentation'
  | 'web-research'
  | 'benchmark'
  | 'fact-checker'
  | 'ui-designer'
  | 'ux-designer'
  | 'design-system'
  | 'animation'
  | 'accessibility'
  | 'reasoning'
  | 'planner'
  | 'problem-solver'
  | 'code-reviewer'
  | 'debugger'
  | 'optimizer'
  | 'qa'
  | 'unit-testing'
  | 'integration-testing'
  | 'performance'
  | 'security-testing'
  | 'project-manager'
  | 'coordinator'
  | 'supervisor'
  | 'memory-manager'
  | 'knowledge-manager'
  | 'experimental-01'
  | 'experimental-02'
  | 'experimental-03'
  | 'experimental-04';

export type AgentTeam =
  | 'developpement'
  | 'recherche'
  | 'design'
  | 'intelligence'
  | 'testing'
  | 'management'
  | 'experimental';

export interface AgentMemoryEntry {
  id: string;
  type: 'document' | 'solution' | 'experience' | 'procedure' | 'result' | 'technical';
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sourceAgentId?: string;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  contextWindow: number;
  permissions: string[];
  mcpServers: string[];
  skills: string[];
  concurrency: number;
}

export interface AgentStats {
  tasksCompleted: number;
  tasksFailed: number;
  tokensUsed: number;
  estimatedCost: number;
  avgResponseTimeMs: number;
  lastActiveAt: string | null;
  successRate: number;
}

export interface AgentGoal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  completedAt: string | null;
}

export interface Agent {
  id: string;
  team: AgentTeam;
  role: AgentRole;
  name: string;
  shortName: string;
  description: string;
  status: AgentStatus;
  currentTask: string | null;
  config: AgentConfig;
  memory: AgentMemoryEntry[];
  stats: AgentStats;
  goals: AgentGoal[];
  createdAt: string;
  updatedAt: string;
  isOnline: boolean;
  avatarColor: string;
  provider?: string;
  modelName?: string;
}

/** A message exchanged between two agents (or from the system). */
export interface Message {
  id: string;
  fromAgentId: string | null;
  toAgentId: string | null;
  type: 'task' | 'result' | 'query' | 'reply' | 'error' | 'system';
  content: string;
  stepId?: string;
  missionId?: string;
  createdAt: string;
  read: boolean;
}

/** A single step in a mission decomposition. */
export interface MissionStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  assignedAgentId: string | null;
  result: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
  dependsOn: string[];
}

/** A mission managed by the Dot Brain. */
export interface Mission {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
  steps: MissionStep[];
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  concurrency: number;
  verifyResults: boolean;
  autoCorrect: boolean;
  finalResult: string | null;
}

/** Execution graph node for visualization. */
export interface ExecutionNode {
  id: string;
  label: string;
  agentId: string | null;
  status: AgentStatus;
  type: 'mission' | 'step' | 'agent' | 'decision' | 'merge';
  children: string[];
  parent: string | null;
  result: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ExecutionGraph {
  missionId: string;
  nodes: ExecutionNode[];
  edges: Array<{ from: string; to: string }>;
}

/** Result of executing a single step by an agent. */
export interface StepExecutionResult {
  stepId: string;
  status: 'completed' | 'failed';
  result: string | null;
  error: string | null;
  agentId: string;
  durationMs: number;
  tokensUsed?: number;
}

/** Result of evaluating a step's output quality. */
export interface EvaluationResult {
  stepId: string;
  passed: boolean;
  score: number; // 0-100
  feedback: string;
  needsCorrection: boolean;
  suggestedFix?: string;
}

/** A real LLM call request. */
export interface LLMCallRequest {
  agentId: string;
  prompt: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  stream?: boolean;
}

/** A real LLM call response. */
export interface LLMCallResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  durationMs: number;
  provider: string;
  error?: string;
}

/** Provider connection state. */
export interface ProviderState {
  id: string;
  name: string;
  configured: boolean;
  available: boolean;
  lastCheckedAt: string | null;
  latencyMs: number | null;
  error?: string;
}

/** Event emitted by the Dot system for UI synchronization. */
export interface DotEvent {
  id: string;
  type:
    | 'mission_created'
    | 'mission_started'
    | 'mission_completed'
    | 'mission_failed'
    | 'mission_paused'
    | 'step_assigned'
    | 'step_started'
    | 'step_completed'
    | 'step_failed'
    | 'step_corrected'
    | 'agent_status_changed'
    | 'agent_communicating'
    | 'message_sent'
    | 'message_received'
    | 'evaluation_done'
    | 'error_detected'
    | 'provider_connected'
    | 'provider_disconnected';
  timestamp: string;
  missionId?: string;
  stepId?: string;
  agentId?: string;
  data: Record<string, unknown>;
}

export interface Team {
  id: AgentTeam;
  name: string;
  description: string;
  agentCount: number;
  activeAgents: number;
  color: string;
}
