export type EvaluationMetric = 'success-rate' | 'quality' | 'tokens' | 'cost' | 'errors' | 'skill-progression' | 'latency';

export type ScenarioStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface TestDataset {
  id: string;
  name: string;
  description: string;
  items: DatasetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DatasetItem {
  id: string;
  input: string;
  expectedOutput: string | null;
  metadata: Record<string, string>;
  tags: string[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  modelId: string;
  datasetId: string | null;
  status: ScenarioStatus;
  metrics: EvaluationMetric[];
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
}

export interface EvaluationRun {
  id: string;
  scenarioId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: EvaluationResult[];
  startedAt: string;
  completedAt: string | null;
  summary: EvaluationSummary;
}

export interface EvaluationResult {
  itemId: string;
  output: string;
  score: number;
  passed: boolean;
  metrics: Record<EvaluationMetric, number>;
  notes: string;
  durationMs: number;
}

export interface EvaluationSummary {
  totalItems: number;
  passedItems: number;
  averageScore: number;
  averageTokens: number;
  averageCost: number;
  averageLatencyMs: number;
  errorCount: number;
  byMetric: Record<EvaluationMetric, number>;
}

export interface ABTest {
  id: string;
  name: string;
  scenarioId: string;
  variantA: string; // model id or prompt version
  variantB: string;
  trafficSplit: number; // 0-100 percent to A
  status: 'draft' | 'running' | 'completed';
  results: ABTestResult[];
  createdAt: string;
}

export interface ABTestResult {
  variant: 'a' | 'b';
  wins: number;
  losses: number;
  averageScore: number;
}

export interface TrainingHistoryPoint {
  timestamp: string;
  successRate: number;
  quality: number;
  tokens: number;
  cost: number;
  errors: number;
  skillLevel: number;
}
