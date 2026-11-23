import type {
  Scenario,
  TestDataset,
  DatasetItem,
  EvaluationRun,
  EvaluationResult,
  EvaluationSummary,
  EvaluationMetric,
  ABTest,
  ABTestResult,
  TrainingHistoryPoint,
} from '../types/training';

const DATASET_KEY = 'training_datasets_v1';
const SCENARIO_KEY = 'training_scenarios_v1';
const RUN_KEY = 'training_runs_v1';
const ABTEST_KEY = 'training_abtests_v1';
const HISTORY_KEY = 'training_history_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadDatasets(): TestDataset[] {
  return loadJson(DATASET_KEY, []);
}
export function saveDatasets(datasets: TestDataset[]): void {
  saveJson(DATASET_KEY, datasets);
}
export function createDataset(name: string, description: string): TestDataset {
  const now = nowIso();
  const ds: TestDataset = {
    id: `ds-${Date.now()}`,
    name,
    description,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  saveDatasets([...loadDatasets(), ds]);
  return ds;
}
export function addDatasetItem(datasetId: string, input: string, expectedOutput: string | null, tags: string[]): void {
  const datasets = loadDatasets();
  const ds = datasets.find((d) => d.id === datasetId);
  if (!ds) return;
  ds.items.push({
    id: `di-${Date.now()}`,
    input,
    expectedOutput,
    metadata: {},
    tags,
  });
  ds.updatedAt = nowIso();
  saveDatasets(datasets);
}
export function deleteDataset(id: string): void {
  saveDatasets(loadDatasets().filter((d) => d.id !== id));
}

export function loadScenarios(): Scenario[] {
  return loadJson(SCENARIO_KEY, []);
}
export function saveScenarios(scenarios: Scenario[]): void {
  saveJson(SCENARIO_KEY, scenarios);
}
export function createScenario(fields: {
  name: string;
  description: string;
  promptTemplate: string;
  modelId: string;
  datasetId: string | null;
  metrics: EvaluationMetric[];
}): Scenario {
  const now = nowIso();
  const s: Scenario = {
    id: `sc-${Date.now()}`,
    status: 'draft',
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
  saveScenarios([...loadScenarios(), s]);
  return s;
}
export function updateScenario(id: string, updates: Partial<Scenario>): void {
  saveScenarios(loadScenarios().map((s) => (s.id === id ? { ...s, ...updates, updatedAt: nowIso() } : s)));
}
export function deleteScenario(id: string): void {
  saveScenarios(loadScenarios().filter((s) => s.id !== id));
}

export function loadRuns(): EvaluationRun[] {
  return loadJson(RUN_KEY, []);
}
export function saveRuns(runs: EvaluationRun[]): void {
  saveJson(RUN_KEY, runs);
}
export function createRun(scenarioId: string, name: string): EvaluationRun {
  const now = nowIso();
  const run: EvaluationRun = {
    id: `run-${Date.now()}`,
    scenarioId,
    name,
    status: 'pending',
    results: [],
    startedAt: now,
    completedAt: null,
    summary: {
      totalItems: 0,
      passedItems: 0,
      averageScore: 0,
      averageTokens: 0,
      averageCost: 0,
      averageLatencyMs: 0,
      errorCount: 0,
      byMetric: {} as Record<EvaluationMetric, number>,
    },
  };
  saveRuns([...loadRuns(), run]);
  return run;
}
export function completeRun(runId: string, results: EvaluationResult[]): void {
  const runs = loadRuns();
  const run = runs.find((r) => r.id === runId);
  if (!run) return;
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const avgScore = total ? results.reduce((a, b) => a + b.score, 0) / total : 0;
  const avgTokens = total ? results.reduce((a, b) => a + (b.metrics.tokens || 0), 0) / total : 0;
  const avgCost = total ? results.reduce((a, b) => a + (b.metrics.cost || 0), 0) / total : 0;
  const avgLatency = total ? results.reduce((a, b) => a + b.durationMs, 0) / total : 0;
  const errors = results.filter((r) => !r.passed).length;
  const byMetric: Record<EvaluationMetric, number> = {} as Record<EvaluationMetric, number>;
  (['success-rate', 'quality', 'tokens', 'cost', 'errors', 'skill-progression', 'latency'] as EvaluationMetric[]).forEach(
    (m) => {
      byMetric[m] = total ? results.reduce((a, b) => a + (b.metrics[m] || 0), 0) / total : 0;
    },
  );
  run.status = 'completed';
  run.completedAt = nowIso();
  run.results = results;
  run.summary = {
    totalItems: total,
    passedItems: passed,
    averageScore: avgScore,
    averageTokens: avgTokens,
    averageCost: avgCost,
    averageLatencyMs: avgLatency,
    errorCount: errors,
    byMetric,
  };
  saveRuns(runs);
  // Append history point
  const history = loadHistory();
  history.push({
    timestamp: nowIso(),
    successRate: total ? (passed / total) * 100 : 0,
    quality: avgScore,
    tokens: avgTokens,
    cost: avgCost,
    errors: errors,
    skillLevel: avgScore,
  });
  saveJson(HISTORY_KEY, history);
}
export function failRun(runId: string): void {
  saveRuns(
    loadRuns().map((r) => (r.id === runId ? { ...r, status: 'failed', completedAt: nowIso() } : r)),
  );
}

export function loadABTests(): ABTest[] {
  return loadJson(ABTEST_KEY, []);
}
export function saveABTests(tests: ABTest[]): void {
  saveJson(ABTEST_KEY, tests);
}
export function createABTest(fields: {
  name: string;
  scenarioId: string;
  variantA: string;
  variantB: string;
  trafficSplit: number;
}): ABTest {
  const t: ABTest = {
    id: `ab-${Date.now()}`,
    status: 'draft',
    results: [],
    createdAt: nowIso(),
    ...fields,
  };
  saveABTests([...loadABTests(), t]);
  return t;
}
export function updateABTest(id: string, updates: Partial<ABTest>): void {
  saveABTests(loadABTests().map((t) => (t.id === id ? { ...t, ...updates } : t)));
}

export function loadHistory(): TrainingHistoryPoint[] {
  return loadJson(HISTORY_KEY, []);
}

export const trainingService = {
  loadDatasets,
  saveDatasets,
  createDataset,
  addDatasetItem,
  deleteDataset,
  loadScenarios,
  saveScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  loadRuns,
  saveRuns,
  createRun,
  completeRun,
  failRun,
  loadABTests,
  saveABTests,
  createABTest,
  updateABTest,
  loadHistory,
};
