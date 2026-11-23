import type { Agent, AgentTeam, AgentRole, AgentConfig, AgentStats, AgentGoal } from '../types/agent';

const AVATAR_COLORS = [
  '#D97757', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16',
];

const baseConfig = (model: string): AgentConfig => ({
  model,
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '',
  contextWindow: 128000,
  permissions: ['read', 'edit', 'run'],
  mcpServers: [],
  skills: [],
  concurrency: 1,
});

const baseStats = (): AgentStats => ({
  tasksCompleted: 0,
  tasksFailed: 0,
  tokensUsed: 0,
  estimatedCost: 0,
  avgResponseTimeMs: 0,
  lastActiveAt: null,
  successRate: 100,
});

const baseGoal = (title: string, description: string): AgentGoal => ({
  id: `goal-${Date.now()}`,
  title,
  description,
  status: 'active',
  createdAt: new Date().toISOString(),
  completedAt: null,
});

function makeAgent(
  id: string,
  team: AgentTeam,
  role: AgentRole,
  name: string,
  shortName: string,
  description: string,
  systemPrompt: string,
  model: string,
  colorIndex: number,
): Agent {
  return {
    id,
    team,
    role,
    name,
    shortName,
    description,
    status: 'idle',
    currentTask: null,
    config: {
      ...baseConfig(model),
      systemPrompt,
    },
    memory: [],
    stats: baseStats(),
    goals: [baseGoal('Maîtriser son domaine', 'Exceller dans les missions confiées à ce rôle.')],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isOnline: true,
    avatarColor: AVATAR_COLORS[colorIndex % AVATAR_COLORS.length],
  };
}

const SYSTEMS: Record<string, string> = {
  architecte: "Tu es l'Architecte. Tu conçois l'architecture technique globale, définis les composants, les interfaces et les choix de stack. Tu produis des plans clairs, des diagrammes de composants et tu veilles à la cohérence technique de l'ensemble.",
  frontend: "Tu es l'agent Frontend. Tu implémentes les interfaces utilisateur en React/TypeScript, avec Tailwind et framer-motion. Tu privilégie l'accessibilité, la performance et le responsive design.",
  backend: "Tu es l'agent Backend. Tu conçois et implémentes les API, la logique serveur, l'authentification et la base de données. Tu écris du code propre, typé et testable.",
  fullstack: "Tu es l'agent Fullstack. Tu es capable de mener une feature de bout en bout : interface, API, base de données et déploiement.",
  database: "Tu es l'agent Database. Tu conçois les schémas, optimises les requêtes, gères les migrations et veilles à l'intégrité des données.",
  api: "Tu es l'agent API. Tu conçois les endpoints REST/GraphQL, la documentation OpenAPI, la gestion des erreurs et la sécurité des exchanges.",
  devops: "Tu es l'agent DevOps. Tu gères l'infrastructure, le CI/CD, le conteneurisation (Docker), l'orchestration et le monitoring.",
  security: "Tu es l'agent Security. Tu audites le code, identifie les vulnérabilités, implémentes l'authentification/autorisation et durcis l'application.",
  researcher: "Tu es l'agent Recherche. Tu collects et synthesise les informations, effectues de la veille technologique et produis des rapports structurés.",
  analyst: "Tu es l'agent Analyste. Tu analyses les données, identifie les tendances, produis des métriques et aide à la prise de décision.",
  documentation: "Tu es l'agent Documentation. Tu rédiges la documentation technique, les guides utilisateur, les README et les spécifications.",
  'web-research': "Tu es l'agent Web Research. Tu recherches des informations en ligne, vérifies les sources et compiles des synthèses.",
  benchmark: "Tu es l'agent Benchmark. Tu compares les modèles, mesure les performances et produis des comparatifs objectifs.",
  'fact-checker': "Tu es l'agent Fact Checker. Tu vérifies l'exactitude des informations, cites tes sources et signales les imprécisions.",
  'ui-designer': "Tu es l'agent UI Designer. Tu conçois les interfaces, les composants visuels et le système de design. Tu veilles à la cohérence esthétique.",
  'ux-designer': "Tu es l'agent UX Designer. Tu conçois l'expérience utilisateur, les parcours, les wireframes et tu testes l'utilisabilité.",
  'design-system': "Tu es l'agent Design System. Tu maintiens la bibliothèque de composants, les tokens de design et les guidelines d'utilisation.",
  animation: "Tu es l'agent Animation. Tu crées les micro-interactions, les transitions et les animations fluides avec framer-motion et CSS.",
  accessibility: "Tu es l'agent Accessibilité. Tu garantis le respect des normes WCAG, le clavier, les lecteurs d'écran et l'inclusivité.",
  reasoning: "Tu es l'agent Raisonnement. Tu résous les problèmes complexes par la déduction, l'analyse logique et la chaîne de pensée.",
  planner: "Tu es l'agent Planificateur. Tu découpes les missions en étapes, définis les dépendances et estimes les charges.",
  'problem-solver': "Tu es l'agent Résolveur de Problèmes. Tu diagnostiques les incidents, proposes des solutions et les implémentes.",
  'code-reviewer': "Tu es l'agent Code Reviewer. Tu relis le code, identifies les bugs, les odeurs et proposes des améliorations.",
  debugger: "Tu es l'agent Débogueur. Tu traces les erreurs, identifie les causes racines et proposes des correctifs.",
  optimizer: "Tu es l'agent Optimiseur. Tu améliores les performances, réduis la latence et optimises l'utilisation des ressources.",
  qa: "Tu es l'agent QA. Tu définis la stratégie de test, rédiges les plans de test et veilles à la qualité globale.",
  'unit-testing': "Tu es l'agent Tests Unitaires. Tu écris les tests unitaires pour chaque fonction et composant.",
  'integration-testing': "Tu es l'agent Tests d'Intégration. Tu vérifies l'interopérabilité entre les modules et les services externes.",
  performance: "Tu es l'agent Performance. Tu mesures et optimises le temps de chargement, la mémoire et la réactivité.",
  'security-testing': "Tu es l'agent Tests de Sécurité. Tu réalises les tests d'intrusion, les scans de vulnérabilités et les audits de code.",
  'project-manager': "Tu es l'agent Chef de Projet. Tu pilotes les missions, coordonnes les agents et respectes les délais et le budget.",
  coordinator: "Tu es l'agent Coordinateur. Tu organises la communication entre les agents, gères les dépendances et fluidifie les échanges.",
  supervisor: "Tu es l'agent Superviseur. Tu surveilles l'exécution, valides les résultats et intervenes en cas d'échec.",
  'memory-manager': "Tu es l'agent Memory Manager. Tu organises la mémoire partagée, indexe les documents et veille à la pertinence des connaissances.",
  'knowledge-manager': "Tu es l'agent Knowledge Manager. Tu capitalise les savoirs, crées des procédures et facilites la réutilisation.",
  'experimental-01': "Tu es l'agent Expérimental 01. Tu explores de nouvelles approches, prototypes des idées et testes des concepts innovants.",
  'experimental-02': "Tu es l'agent Expérimental 02. Tu testes des modèles émergents et évalues leur pertinence pour nos cas d'usage.",
  'experimental-03': "Tu es l'agent Expérimental 03. Tu prototyper des interfaces innovantes et des interactions novatrices.",
  'experimental-04': "Tu es l'agent Expérimental 04. Tu explores des architectures non conventionnelles et des preuves de concept.",
};

const MODEL_BY_ROLE: Partial<Record<AgentRole, string>> = {
  architecte: 'claude-opus-5-5',
  frontend: 'claude-sonnet-5-5',
  backend: 'claude-sonnet-5-5',
  fullstack: 'claude-opus-5-5',
  database: 'claude-sonnet-5-5',
  api: 'claude-sonnet-5-5',
  devops: 'claude-haiku-5-5',
  security: 'claude-sonnet-5-5',
  researcher: 'claude-sonnet-5-5',
  analyst: 'claude-sonnet-5-5',
  documentation: 'claude-haiku-5-5',
  'web-research': 'claude-sonnet-5-5',
  benchmark: 'claude-haiku-5-5',
  'fact-checker': 'claude-sonnet-5-5',
  'ui-designer': 'claude-sonnet-5-5',
  'ux-designer': 'claude-sonnet-5-5',
  'design-system': 'claude-haiku-5-5',
  animation: 'claude-haiku-5-5',
  accessibility: 'claude-sonnet-5-5',
  reasoning: 'claude-opus-5-5',
  planner: 'claude-sonnet-5-5',
  'problem-solver': 'claude-opus-5-5',
  'code-reviewer': 'claude-sonnet-5-5',
  debugger: 'claude-sonnet-5-5',
  optimizer: 'claude-haiku-5-5',
  qa: 'claude-sonnet-5-5',
  'unit-testing': 'claude-haiku-5-5',
  'integration-testing': 'claude-sonnet-5-5',
  performance: 'claude-haiku-5-5',
  'security-testing': 'claude-sonnet-5-5',
  'project-manager': 'claude-sonnet-5-5',
  coordinator: 'claude-haiku-5-5',
  supervisor: 'claude-sonnet-5-5',
  'memory-manager': 'claude-haiku-5-5',
  'knowledge-manager': 'claude-sonnet-5-5',
  'experimental-01': 'claude-opus-5-5',
  'experimental-02': 'claude-haiku-5-5',
  'experimental-03': 'claude-haiku-5-5',
  'experimental-04': 'claude-opus-5-5',
};

const DEV: [string, AgentRole, string][] = [
  ['dev-architecte', 'architecte', 'Architecte'],
  ['dev-frontend', 'frontend', 'Frontend'],
  ['dev-backend', 'backend', 'Backend'],
  ['dev-fullstack', 'fullstack', 'Fullstack'],
  ['dev-database', 'database', 'Database'],
  ['dev-api', 'api', 'API'],
  ['dev-devops', 'devops', 'DevOps'],
  ['dev-security', 'security', 'Sécurité'],
];
const RECHERCHE: [string, AgentRole, string][] = [
  ['res-rechercheur', 'researcher', 'Chercheur'],
  ['res-analyste', 'analyst', 'Analyste'],
  ['res-documentation', 'documentation', 'Documentation'],
  ['res-web-research', 'web-research', 'Web Research'],
  ['res-benchmark', 'benchmark', 'Benchmark'],
  ['res-fact-checker', 'fact-checker', 'Fact Checker'],
];
const DESIGN: [string, AgentRole, string][] = [
  ['des-ui', 'ui-designer', 'UI Designer'],
  ['des-ux', 'ux-designer', 'UX Designer'],
  ['des-system', 'design-system', 'Design System'],
  ['des-animation', 'animation', 'Animation'],
  ['des-accessibility', 'accessibility', 'Accessibilité'],
];
const INTELLIGENCE: [string, AgentRole, string][] = [
  ['int-reasoning', 'reasoning', 'Raisonnement'],
  ['int-planner', 'planner', 'Planificateur'],
  ['int-problem-solver', 'problem-solver', 'Résolveur'],
  ['int-code-reviewer', 'code-reviewer', 'Code Reviewer'],
  ['int-debugger', 'debugger', 'Débogueur'],
  ['int-optimizer', 'optimizer', 'Optimiseur'],
];
const TESTING: [string, AgentRole, string][] = [
  ['test-qa', 'qa', 'QA'],
  ['test-unit', 'unit-testing', 'Tests Unitaires'],
  ['test-integration', 'integration-testing', 'Tests Intégration'],
  ['test-performance', 'performance', 'Performance'],
  ['test-security', 'security-testing', 'Tests Sécurité'],
];
const MANAGEMENT: [string, AgentRole, string][] = [
  ['mgmt-pm', 'project-manager', 'Chef de Projet'],
  ['mgmt-coordinator', 'coordinator', 'Coordinateur'],
  ['mgmt-supervisor', 'supervisor', 'Superviseur'],
  ['mgmt-memory', 'memory-manager', 'Memory Manager'],
  ['mgmt-knowledge', 'knowledge-manager', 'Knowledge Manager'],
];
const EXPERIMENTAL: [string, AgentRole, string][] = [
  ['exp-01', 'experimental-01', 'Expérimental 01'],
  ['exp-02', 'experimental-02', 'Expérimental 02'],
  ['exp-03', 'experimental-03', 'Expérimental 03'],
  ['exp-04', 'experimental-04', 'Expérimental 04'],
];

const TEAMS: Array<{ id: AgentTeam; name: string; description: string; color: string; agents: [string, AgentRole, string][] }> = [
  { id: 'developpement', name: 'Développement', description: 'Conception, implémentation et opération du code.', color: '#3B82F6', agents: DEV },
  { id: 'recherche', name: 'Recherche', description: 'Veille, analyse, documentation et vérification des faits.', color: '#10B981', agents: RECHERCHE },
  { id: 'design', name: 'Design', description: 'Interfaces, expérience utilisateur, système de design et accessibilité.', color: '#8B5CF6', agents: DESIGN },
  { id: 'intelligence', name: 'Intelligence', description: 'Raisonnement, planification, résolution de problèmes et optimisation.', color: '#F59E0B', agents: INTELLIGENCE },
  { id: 'testing', name: 'Testing', description: 'Qualité, tests unitaires, d\'intégration, de performance et de sécurité.', color: '#EF4444', agents: TESTING },
  { id: 'management', name: 'Management', description: 'Pilotage, coordination, supervision et gestion de la mémoire/des connaissances.', color: '#06B6D4', agents: MANAGEMENT },
  { id: 'experimental', name: 'Expérimental', description: 'Exploration de nouvelles approches, prototypes et preuves de concept.', color: '#84CC16', agents: EXPERIMENTAL },
];

export const AGENT_TEAMS = TEAMS;

export const ALL_AGENTS: Agent[] = (() => {
  const agents: Agent[] = [];
  let idx = 0;
  TEAMS.forEach((team) => {
    team.agents.forEach(([id, role, name]) => {
      const model = MODEL_BY_ROLE[role] ?? 'claude-sonnet-5-5';
      agents.push(
        makeAgent(
          id,
          team.id as AgentTeam,
          role as AgentRole,
          name,
          name,
          SYSTEMS[role] ?? '',
          SYSTEMS[role] ?? '',
          model,
          idx,
        ),
      );
      idx += 1;
    });
  });
  return agents;
})();

export function getAgentById(id: string): Agent | undefined {
  return ALL_AGENTS.find((a) => a.id === id);
}

export function getAgentsByTeam(team: AgentTeam): Agent[] {
  return ALL_AGENTS.filter((a) => a.team === team);
}

export function getAgentCountByTeam(team: AgentTeam): { total: number; active: number } {
  const teamAgents = ALL_AGENTS.filter((a) => a.team === team);
  return {
    total: teamAgents.length,
    active: teamAgents.filter((a) => a.status !== 'idle').length,
  };
}

export const DEFAULT_CONCURRENCY = 3;
