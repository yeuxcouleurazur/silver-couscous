import type { Agent } from '../types/agent';
import type { Team } from '../types/agent';
import type { Mission } from '../types/agent';
import type { MemoryItem } from '../types/memory';
import type { ModelInfo } from '../types/model';
import type { Scenario, EvaluationRun, ABTest } from '../types/training';

type Listener = () => void;

export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (next: Partial<T> | ((prev: T) => Partial<T>)) => {
      const patch = typeof next === 'function' ? next(state) : next;
      state = { ...state, ...patch } as T;
      listeners.forEach((l) => l());
    },
    subscribe: (fn: Listener) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const agentStore = createStore<{
  agents: Agent[];
  teams: Team[];
  selectedAgentId: string | null;
  view: 'dashboard' | 'agent-detail' | 'control-center';
}>({
  agents: [],
  teams: [],
  selectedAgentId: null,
  view: 'dashboard',
});

export const missionStore = createStore<{
  missions: Mission[];
  activeMissionId: string | null;
  graph: Record<string, { nodes: any[]; edges: any[] }> | null;
  isExecuting: boolean;
}>({
  missions: [],
  activeMissionId: null,
  graph: null,
  isExecuting: false,
});

export const memoryStore = createStore<{
  items: MemoryItem[];
  searchQuery: string;
  selectedItemId: string | null;
  view: 'list' | 'detail' | 'editor';
}>({
  items: [],
  searchQuery: '',
  selectedItemId: null,
  view: 'list',
});

export const modelStore = createStore<{
  models: ModelInfo[];
  selectedProvider: string | null;
  isLoading: boolean;
  lastSyncAt: string | null;
}>({
  models: [],
  selectedProvider: null,
  isLoading: false,
  lastSyncAt: null,
});

export const trainingStore = createStore<{
  scenarios: Scenario[];
  datasets: any[];
  runs: EvaluationRun[];
  abTests: ABTest[];
  history: any[];
  selectedScenarioId: string | null;
  isRunning: boolean;
}>({
  scenarios: [],
  datasets: [],
  runs: [],
  abTests: [],
  history: [],
  selectedScenarioId: null,
  isRunning: false,
});
