export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'deepseek'
  | 'mistral'
  | 'qwen'
  | 'glm'
  | 'openrouter'
  | 'local';

export type ModelCapability =
  | 'chat'
  | 'thinking'
  | 'code'
  | 'vision'
  | 'embedding'
  | 'audio'
  | 'functions';

export interface ModelEndpoint {
  provider: ModelProvider;
  baseUrl: string;
  apiKeyEnv: string; // env var name, never the value
  modelsPath: string;
  chatPath: string;
  streamPath: string;
  headers: Record<string, string>;
  timeoutMs: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  capabilities: ModelCapability[];
  contextWindow: number;
  supportsThinking: boolean;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  description: string;
  endpoint: ModelEndpoint;
  isConfigured: boolean; // has real API key / reachable endpoint
  lastCheckedAt: string | null;
  latencyMs: number | null;
}

export interface ModelRegistryConfig {
  providers: Record<ModelProvider, ModelEndpoint>;
  defaultProvider: ModelProvider;
  defaultModel: string;
  enabledProviders: ModelProvider[];
}
