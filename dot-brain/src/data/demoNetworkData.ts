import type {
  Agent,
  AgentStatus,
  Connection,
  Group,
  GroupId,
  MissionPayload,
} from '../types/dotBrain';
import { MISSION_MODES } from '../constants/dotVisuals';

/**
 * DONNÉES DE DÉMONSTRATION (40 Dots répartis en 8 groupes cognitifs)
 * -------------------------------------------------------------------
 * Ces données servent uniquement à illustrer le comportement visuel et
 * ergonomique de Dot Brain. Elles ne représentent aucune exécution réelle
 * d'agents backend et peuvent être remplacées en totalité via les props
 * de <DotBrainWorkspace />.
 */

export const DEMO_GROUPS: Group[] = [
  {
    id: 'core-intelligence',
    name: 'Core Intelligence',
    description: 'Coordination globale, arbitrage des priorités et cohérence cognitive du collectif.',
    agentIds: ['dot-core-01', 'dot-core-02', 'dot-core-03', 'dot-core-04'],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Veille, analyse documentaire, formulation d’hypothèses et cartographie des connaissances.',
    agentIds: [
      'dot-res-01',
      'dot-res-02',
      'dot-res-03',
      'dot-res-04',
      'dot-res-05',
      'dot-res-06',
    ],
  },
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'Conception des systèmes, contrats d’interface, résilience et modélisation des flux.',
    agentIds: [
      'dot-arch-01',
      'dot-arch-02',
      'dot-arch-03',
      'dot-arch-04',
      'dot-arch-05',
    ],
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Implémentation logicielle, composants interactifs, intégrations et optimisation.',
    agentIds: [
      'dot-dev-01',
      'dot-dev-02',
      'dot-dev-03',
      'dot-dev-04',
      'dot-dev-05',
      'dot-dev-06',
      'dot-dev-07',
    ],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Système visuel, ergonomie cognitive, micro-interactions et lisibilité.',
    agentIds: [
      'dot-des-01',
      'dot-des-02',
      'dot-des-03',
      'dot-des-04',
      'dot-des-05',
    ],
  },
  {
    id: 'testing',
    name: 'Testing',
    description: 'Scénarios de validation, non-régression, charge et cas limites.',
    agentIds: [
      'dot-tst-01',
      'dot-tst-02',
      'dot-tst-03',
      'dot-tst-04',
      'dot-tst-05',
    ],
  },
  {
    id: 'review',
    name: 'Review',
    description: 'Audit critique, sécurité, clarté du code et alignement avec la mission.',
    agentIds: ['dot-rev-01', 'dot-rev-02', 'dot-rev-03', 'dot-rev-04'],
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Consolidation sémantique, historique des décisions et rappel contextuel.',
    agentIds: ['dot-mem-01', 'dot-mem-02', 'dot-mem-03', 'dot-mem-04'],
  },
];

export const DEMO_AGENTS: Agent[] = [
  // Core Intelligence (4)
  {
    id: 'dot-core-01',
    name: 'Helios',
    role: 'Coordinateur principal',
    specialty: 'Orchestration cognitive',
    model: 'claude-opus-4-1',
    status: 'Communicating',
    groupId: 'core-intelligence',
    currentTask: 'Ventilation des sous-objectifs entre Architecture et Development',
    metadata: { latencyMs: 410, tokensProcessed: 18420, confidence: 0.96, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-core-02',
    name: 'Ariadne',
    role: 'Planificatrice stratégique',
    specialty: 'Décomposition de mission',
    model: 'claude-opus-4-1',
    status: 'Thinking',
    groupId: 'core-intelligence',
    currentTask: 'Arbitrage des dépendances critiques entre flux parallèles',
    metadata: { latencyMs: 520, tokensProcessed: 14190, confidence: 0.94, lastActiveAt: 'Il y a 4 s', isDemoData: true },
  },
  {
    id: 'dot-core-03',
    name: 'Vesper',
    role: 'Synthétiseur global',
    specialty: 'Convergence multi-agents',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'core-intelligence',
    currentTask: 'Fusion des conclusions de Research et Memory dans le graphe de contexte',
    metadata: { latencyMs: 280, tokensProcessed: 22100, confidence: 0.95, lastActiveAt: 'Il y a 2 s', isDemoData: true },
  },
  {
    id: 'dot-core-04',
    name: 'Solon',
    role: 'Arbitre de cohérence',
    specialty: 'Gouvernance & contraintes',
    model: 'claude-sonnet-4-5',
    status: 'Reviewing',
    groupId: 'core-intelligence',
    currentTask: 'Vérification de l’alignement des livrables avec le périmètre initial',
    metadata: { latencyMs: 310, tokensProcessed: 9850, confidence: 0.97, lastActiveAt: 'Il y a 9 s', isDemoData: true },
  },

  // Research (6)
  {
    id: 'dot-res-01',
    name: 'Clio',
    role: 'Analyste documentaire',
    specialty: 'Synthèse de corpus',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'research',
    currentTask: 'Extraction des motifs de collaboration dans les systèmes distribués',
    metadata: { latencyMs: 340, tokensProcessed: 31200, confidence: 0.93, lastActiveAt: 'Il y a 3 s', isDemoData: true },
  },
  {
    id: 'dot-res-02',
    name: 'Thales',
    role: 'Explorateur d’hypothèses',
    specialty: 'Analyse comparative',
    model: 'claude-sonnet-4-5',
    status: 'Communicating',
    groupId: 'research',
    currentTask: 'Partage des benchmarks d’architecture événementielle vers Architecture',
    metadata: { latencyMs: 295, tokensProcessed: 19400, confidence: 0.91, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-res-03',
    name: 'Hypatia',
    role: 'Spécialiste graphes',
    specialty: 'Topologie & réseaux',
    model: 'claude-opus-4-1',
    status: 'Thinking',
    groupId: 'research',
    currentTask: 'Évaluation des heuristiques de proximité spatiale pour groupes collaboratifs',
    metadata: { latencyMs: 490, tokensProcessed: 16300, confidence: 0.95, lastActiveAt: 'Il y a 6 s', isDemoData: true },
  },
  {
    id: 'dot-res-04',
    name: 'Linnaeus',
    role: 'Taxonomiste',
    specialty: 'Structuration sémantique',
    model: 'claude-haiku-4-5',
    status: 'Completed',
    groupId: 'research',
    currentTask: 'Classification des 8 domaines cognitifs achevée',
    metadata: { latencyMs: 145, tokensProcessed: 11800, confidence: 0.98, lastActiveAt: 'Il y a 22 s', isDemoData: true },
  },
  {
    id: 'dot-res-05',
    name: 'Ptolemy',
    role: 'Cartographe de signaux',
    specialty: 'Détection de tendances',
    model: 'claude-haiku-4-5',
    status: 'Idle',
    groupId: 'research',
    currentTask: 'En attente d’un nouveau corpus de référence',
    metadata: { latencyMs: 130, tokensProcessed: 6420, confidence: 0.9, lastActiveAt: 'Il y a 1 min', isDemoData: true },
  },
  {
    id: 'dot-res-06',
    name: 'Sora',
    role: 'Vérificatrice de sources',
    specialty: 'Traçabilité factuelle',
    model: 'claude-sonnet-4-5',
    status: 'Reviewing',
    groupId: 'research',
    currentTask: 'Recoupement des références techniques avant indexation mémoire',
    metadata: { latencyMs: 270, tokensProcessed: 12940, confidence: 0.94, lastActiveAt: 'Il y a 11 s', isDemoData: true },
  },

  // Architecture (5)
  {
    id: 'dot-arch-01',
    name: 'Vitruvius',
    role: 'Architecte système',
    specialty: 'Contrats & modularité',
    model: 'claude-opus-4-1',
    status: 'Communicating',
    groupId: 'architecture',
    currentTask: 'Transmission des interfaces TypeScript vers le groupe Development',
    metadata: { latencyMs: 430, tokensProcessed: 24500, confidence: 0.97, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-arch-02',
    name: 'Kestrel',
    role: 'Architecte flux temps réel',
    specialty: 'Bus événementiel',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'architecture',
    currentTask: 'Spécification de l’adaptateur WebSocket découplé du rendu',
    metadata: { latencyMs: 315, tokensProcessed: 17650, confidence: 0.94, lastActiveAt: 'Il y a 5 s', isDemoData: true },
  },
  {
    id: 'dot-arch-03',
    name: 'Noether',
    role: 'Modélisatrice d’état',
    specialty: 'Invariants & transitions',
    model: 'claude-opus-4-1',
    status: 'Thinking',
    groupId: 'architecture',
    currentTask: 'Conception de la machine d’états pour les cycles de mission',
    metadata: { latencyMs: 470, tokensProcessed: 13800, confidence: 0.96, lastActiveAt: 'Il y a 7 s', isDemoData: true },
  },
  {
    id: 'dot-arch-04',
    name: 'Bramante',
    role: 'Spécialiste intégration',
    specialty: 'Isolation & SDK hôte',
    model: 'claude-sonnet-4-5',
    status: 'Completed',
    groupId: 'architecture',
    currentTask: 'Définition des callbacks onAgentSelect, onMissionSubmit et onNetworkChange',
    metadata: { latencyMs: 260, tokensProcessed: 15200, confidence: 0.98, lastActiveAt: 'Il y a 18 s', isDemoData: true },
  },
  {
    id: 'dot-arch-05',
    name: 'Turing',
    role: 'Optimiseur de complexité',
    specialty: 'Performance & calcul',
    model: 'claude-sonnet-4-5',
    status: 'Idle',
    groupId: 'architecture',
    currentTask: 'Disponible pour profilage du moteur de disposition',
    metadata: { latencyMs: 225, tokensProcessed: 8900, confidence: 0.93, lastActiveAt: 'Il y a 48 s', isDemoData: true },
  },

  // Development (7)
  {
    id: 'dot-dev-01',
    name: 'Ada',
    role: 'Ingénieure visualisation',
    specialty: 'Moteur SVG & géométrie',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'development',
    currentTask: 'Optimisation du rendu des courbes de Bézier et des particules actives',
    metadata: { latencyMs: 265, tokensProcessed: 29400, confidence: 0.95, lastActiveAt: 'Il y a 1 s', isDemoData: true },
  },
  {
    id: 'dot-dev-02',
    name: 'Linus',
    role: 'Ingénieur noyau UI',
    specialty: 'Gestion d’état React',
    model: 'claude-sonnet-4-5',
    status: 'Communicating',
    groupId: 'development',
    currentTask: 'Synchronisation des filtres actifs avec les contrôles de navigation',
    metadata: { latencyMs: 240, tokensProcessed: 21300, confidence: 0.94, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-dev-03',
    name: 'Grace',
    role: 'Ingénieure interactions',
    specialty: 'Zoom, pan & gestes',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'development',
    currentTask: 'Raffinement du zoom centré curseur et du recentrage fluide',
    metadata: { latencyMs: 255, tokensProcessed: 18700, confidence: 0.93, lastActiveAt: 'Il y a 3 s', isDemoData: true },
  },
  {
    id: 'dot-dev-04',
    name: 'Ken',
    role: 'Ingénieur animations',
    specialty: 'Transitions & physique',
    model: 'claude-haiku-4-5',
    status: 'Working',
    groupId: 'development',
    currentTask: 'Interpolation douce des coordonnées lors de la réorganisation',
    metadata: { latencyMs: 140, tokensProcessed: 16200, confidence: 0.92, lastActiveAt: 'Il y a 5 s', isDemoData: true },
  },
  {
    id: 'dot-dev-05',
    name: 'Barbara',
    role: 'Ingénieure composants',
    specialty: 'Inspecteur & panneaux',
    model: 'claude-sonnet-4-5',
    status: 'Completed',
    groupId: 'development',
    currentTask: 'Assemblage du panneau DotInspector et de la barre de mission',
    metadata: { latencyMs: 230, tokensProcessed: 20100, confidence: 0.97, lastActiveAt: 'Il y a 15 s', isDemoData: true },
  },
  {
    id: 'dot-dev-06',
    name: 'Donald',
    role: 'Spécialiste typage',
    specialty: 'Contrats TypeScript',
    model: 'claude-haiku-4-5',
    status: 'Error',
    groupId: 'development',
    currentTask: 'Conflit de sérialisation sur un événement externe simulé — reprise requise',
    metadata: { latencyMs: 680, tokensProcessed: 9400, confidence: 0.62, lastActiveAt: 'Il y a 8 s', isDemoData: true },
  },
  {
    id: 'dot-dev-07',
    name: 'Margaret',
    role: 'Ingénieure accessibilité',
    specialty: 'Navigation clavier & ARIA',
    model: 'claude-sonnet-4-5',
    status: 'Idle',
    groupId: 'development',
    currentTask: 'En attente de la prochaine revue d’accessibilité des nœuds',
    metadata: { latencyMs: 210, tokensProcessed: 11250, confidence: 0.96, lastActiveAt: 'Il y a 52 s', isDemoData: true },
  },

  // Design (5)
  {
    id: 'dot-des-01',
    name: 'Dieter',
    role: 'Directeur de sobriété',
    specialty: 'Minimalisme & proportions',
    model: 'claude-opus-4-1',
    status: 'Reviewing',
    groupId: 'design',
    currentTask: 'Calibration des contrastes neutres et de la hiérarchie typographique',
    metadata: { latencyMs: 390, tokensProcessed: 14900, confidence: 0.96, lastActiveAt: 'Il y a 4 s', isDemoData: true },
  },
  {
    id: 'dot-des-02',
    name: 'Muriel',
    role: 'Designer systèmes visuels',
    specialty: 'Sémantique des états',
    model: 'claude-sonnet-4-5',
    status: 'Communicating',
    groupId: 'design',
    currentTask: 'Coordination des signatures géométriques des 7 états avec Development',
    metadata: { latencyMs: 275, tokensProcessed: 16800, confidence: 0.95, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-des-03',
    name: 'Josef',
    role: 'Designer grilles & espace',
    specialty: 'Équilibre spatial',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'design',
    currentTask: 'Ajustement des marges de respiration autour des 8 clusters',
    metadata: { latencyMs: 260, tokensProcessed: 13100, confidence: 0.94, lastActiveAt: 'Il y a 6 s', isDemoData: true },
  },
  {
    id: 'dot-des-04',
    name: 'Susan',
    role: 'Designer micro-interactions',
    specialty: 'Infobulles & retours visuels',
    model: 'claude-haiku-4-5',
    status: 'Completed',
    groupId: 'design',
    currentTask: 'Spécification des transitions douces au survol des Dots',
    metadata: { latencyMs: 135, tokensProcessed: 10400, confidence: 0.97, lastActiveAt: 'Il y a 19 s', isDemoData: true },
  },
  {
    id: 'dot-des-05',
    name: 'Massimo',
    role: 'Typographe',
    specialty: 'Lisibilité & échelles',
    model: 'claude-haiku-4-5',
    status: 'Idle',
    groupId: 'design',
    currentTask: 'Veille sur la cohérence des échelles responsives',
    metadata: { latencyMs: 120, tokensProcessed: 7600, confidence: 0.95, lastActiveAt: 'Il y a 1 min', isDemoData: true },
  },

  // Testing (5)
  {
    id: 'dot-tst-01',
    name: 'Popper',
    role: 'Ingénieur validation',
    specialty: 'Tests de géométrie',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'testing',
    currentTask: 'Vérification de l’absence de chevauchement entre les 40 Dots',
    metadata: { latencyMs: 250, tokensProcessed: 17300, confidence: 0.96, lastActiveAt: 'Il y a 2 s', isDemoData: true },
  },
  {
    id: 'dot-tst-02',
    name: 'Curie',
    role: 'Analyste performance',
    specialty: 'Fluidité 60 FPS',
    model: 'claude-sonnet-4-5',
    status: 'Communicating',
    groupId: 'testing',
    currentTask: 'Remontée des mesures de fluidité des particules vers Review',
    metadata: { latencyMs: 280, tokensProcessed: 15900, confidence: 0.93, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-tst-03',
    name: 'Shannon',
    role: 'Testeur résilience',
    specialty: 'Cas limites & charge',
    model: 'claude-haiku-4-5',
    status: 'Thinking',
    groupId: 'testing',
    currentTask: 'Préparation des scénarios multi-résolutions et filtres croisés',
    metadata: { latencyMs: 165, tokensProcessed: 12100, confidence: 0.91, lastActiveAt: 'Il y a 10 s', isDemoData: true },
  },
  {
    id: 'dot-tst-04',
    name: 'Rosalind',
    role: 'Spécialiste non-régression',
    specialty: 'Stabilité des états',
    model: 'claude-haiku-4-5',
    status: 'Completed',
    groupId: 'testing',
    currentTask: 'Suite de tests unitaires du moteur spatial validée',
    metadata: { latencyMs: 150, tokensProcessed: 14200, confidence: 0.99, lastActiveAt: 'Il y a 26 s', isDemoData: true },
  },
  {
    id: 'dot-tst-05',
    name: 'Feynman',
    role: 'Diagnostiqueur d’anomalies',
    specialty: 'Isolation d’incidents',
    model: 'claude-sonnet-4-5',
    status: 'Working',
    groupId: 'testing',
    currentTask: 'Analyse du blocage signalé par Donald sur la sérialisation',
    metadata: { latencyMs: 305, tokensProcessed: 13450, confidence: 0.92, lastActiveAt: 'Il y a 4 s', isDemoData: true },
  },

  // Review (4)
  {
    id: 'dot-rev-01',
    name: 'Hannah',
    role: 'Auditrice qualité',
    specialty: 'Revue architecturale',
    model: 'claude-opus-4-1',
    status: 'Reviewing',
    groupId: 'review',
    currentTask: 'Inspection du découplage entre couche de données et composants UI',
    metadata: { latencyMs: 420, tokensProcessed: 19200, confidence: 0.96, lastActiveAt: 'Il y a 3 s', isDemoData: true },
  },
  {
    id: 'dot-rev-02',
    name: 'Kahneman',
    role: 'Évaluateur ergonomique',
    specialty: 'Charge cognitive',
    model: 'claude-sonnet-4-5',
    status: 'Communicating',
    groupId: 'review',
    currentTask: 'Partage de recommandations de lisibilité vers Core Intelligence',
    metadata: { latencyMs: 290, tokensProcessed: 14700, confidence: 0.94, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-rev-03',
    name: 'Diffie',
    role: 'Auditeur sécurité',
    specialty: 'Isolation & callbacks',
    model: 'claude-sonnet-4-5',
    status: 'Completed',
    groupId: 'review',
    currentTask: 'Validation de l’absence de couplage backend non sollicité',
    metadata: { latencyMs: 245, tokensProcessed: 11500, confidence: 0.98, lastActiveAt: 'Il y a 21 s', isDemoData: true },
  },
  {
    id: 'dot-rev-04',
    name: 'Simone',
    role: 'Critique de précision',
    specialty: 'Clarté & concision',
    model: 'claude-haiku-4-5',
    status: 'Idle',
    groupId: 'review',
    currentTask: 'En attente de la prochaine passe de révision éditoriale',
    metadata: { latencyMs: 135, tokensProcessed: 8100, confidence: 0.95, lastActiveAt: 'Il y a 58 s', isDemoData: true },
  },

  // Memory (4)
  {
    id: 'dot-mem-01',
    name: 'Mnemosyne',
    role: 'Archiviste sémantique',
    specialty: 'Mémoire longue durée',
    model: 'claude-sonnet-4-5',
    status: 'Communicating',
    groupId: 'memory',
    currentTask: 'Synchronisation du contexte consolidé avec Vesper et Clio',
    metadata: { latencyMs: 220, tokensProcessed: 42800, confidence: 0.97, lastActiveAt: 'À l’instant', isDemoData: true },
  },
  {
    id: 'dot-mem-02',
    name: 'Borges',
    role: 'Indexeur de décisions',
    specialty: 'Graphe d’historique',
    model: 'claude-haiku-4-5',
    status: 'Working',
    groupId: 'memory',
    currentTask: 'Indexation des décisions d’architecture et des motifs validés',
    metadata: { latencyMs: 140, tokensProcessed: 35600, confidence: 0.95, lastActiveAt: 'Il y a 5 s', isDemoData: true },
  },
  {
    id: 'dot-mem-03',
    name: 'Ebbinghaus',
    role: 'Gestionnaire de rétention',
    specialty: 'Élagueur de contexte',
    model: 'claude-haiku-4-5',
    status: 'Thinking',
    groupId: 'memory',
    currentTask: 'Priorisation des souvenirs pertinents pour la mission courante',
    metadata: { latencyMs: 155, tokensProcessed: 27100, confidence: 0.92, lastActiveAt: 'Il y a 12 s', isDemoData: true },
  },
  {
    id: 'dot-mem-04',
    name: 'Proust',
    role: 'Rappel associatif',
    specialty: 'Analogies & précédents',
    model: 'claude-sonnet-4-5',
    status: 'Idle',
    groupId: 'memory',
    currentTask: 'Prêt à restituer des précédents similaires sur sollicitation',
    metadata: { latencyMs: 215, tokensProcessed: 18400, confidence: 0.94, lastActiveAt: 'Il y a 44 s', isDemoData: true },
  },
];

export const DEMO_CONNECTIONS: Connection[] = [
  // Core internal coordination
  { id: 'conn-01', sourceId: 'dot-core-01', targetId: 'dot-core-02', type: 'orchestration', status: 'active', direction: 'bidirectional', label: 'Arbitrage des priorités', intensity: 0.9 },
  { id: 'conn-02', sourceId: 'dot-core-03', targetId: 'dot-core-01', type: 'synthesis', status: 'active', direction: 'forward', label: 'Synthèse de contexte', intensity: 0.85 },
  { id: 'conn-03', sourceId: 'dot-core-04', targetId: 'dot-core-02', type: 'critique', status: 'idle', direction: 'forward', label: 'Contrôle périmètre', intensity: 0.4 },

  // Core -> Outer clusters (real functional coordination)
  { id: 'conn-04', sourceId: 'dot-core-01', targetId: 'dot-arch-01', type: 'delegation', status: 'active', direction: 'forward', label: 'Cadrage des interfaces', intensity: 0.95 },
  { id: 'conn-05', sourceId: 'dot-core-01', targetId: 'dot-dev-02', type: 'delegation', status: 'active', direction: 'forward', label: 'Synchronisation UI', intensity: 0.85 },
  { id: 'conn-06', sourceId: 'dot-core-02', targetId: 'dot-res-03', type: 'orchestration', status: 'active', direction: 'forward', label: 'Demande d’analyse topologique', intensity: 0.78 },
  { id: 'conn-07', sourceId: 'dot-core-03', targetId: 'dot-mem-01', type: 'memory-sync', status: 'active', direction: 'bidirectional', label: 'Mise à jour mémoire collective', intensity: 0.9 },
  { id: 'conn-08', sourceId: 'dot-rev-02', targetId: 'dot-core-04', type: 'critique', status: 'active', direction: 'forward', label: 'Retour ergonomique', intensity: 0.82 },
  { id: 'conn-09', sourceId: 'dot-core-02', targetId: 'dot-des-01', type: 'orchestration', status: 'completing', direction: 'forward', label: 'Alignement esthétique', intensity: 0.6 },

  // Research <-> Architecture & Memory & Design
  { id: 'conn-10', sourceId: 'dot-res-02', targetId: 'dot-arch-02', type: 'synthesis', status: 'active', direction: 'forward', label: 'Benchmarks flux temps réel', intensity: 0.88 },
  { id: 'conn-11', sourceId: 'dot-res-01', targetId: 'dot-res-02', type: 'synthesis', status: 'active', direction: 'forward', label: 'Notes comparatives', intensity: 0.72 },
  { id: 'conn-12', sourceId: 'dot-res-06', targetId: 'dot-mem-02', type: 'memory-sync', status: 'completing', direction: 'forward', label: 'Archivage des sources', intensity: 0.55 },
  { id: 'conn-13', sourceId: 'dot-res-03', targetId: 'dot-des-03', type: 'synthesis', status: 'idle', direction: 'forward', label: 'Proportions spatiales', intensity: 0.45 },
  { id: 'conn-14', sourceId: 'dot-mem-01', targetId: 'dot-res-01', type: 'memory-sync', status: 'active', direction: 'forward', label: 'Rappel de corpus antérieur', intensity: 0.8 },

  // Architecture -> Development & Review
  { id: 'conn-15', sourceId: 'dot-arch-01', targetId: 'dot-dev-01', type: 'delegation', status: 'active', direction: 'forward', label: 'Spécification graphe SVG', intensity: 0.92 },
  { id: 'conn-16', sourceId: 'dot-arch-01', targetId: 'dot-dev-05', type: 'delegation', status: 'completing', direction: 'forward', label: 'Contrat inspecteur', intensity: 0.55 },
  { id: 'conn-17', sourceId: 'dot-arch-02', targetId: 'dot-dev-02', type: 'delegation', status: 'active', direction: 'forward', label: 'Flux événements', intensity: 0.84 },
  { id: 'conn-18', sourceId: 'dot-arch-03', targetId: 'dot-arch-01', type: 'synthesis', status: 'idle', direction: 'forward', label: 'Modèle d’états', intensity: 0.45 },
  { id: 'conn-19', sourceId: 'dot-arch-04', targetId: 'dot-rev-01', type: 'critique', status: 'completing', direction: 'forward', label: 'Revue des callbacks', intensity: 0.6 },

  // Design <-> Development
  { id: 'conn-20', sourceId: 'dot-des-02', targetId: 'dot-dev-01', type: 'delegation', status: 'active', direction: 'bidirectional', label: 'Signatures d’états des Dots', intensity: 0.9 },
  { id: 'conn-21', sourceId: 'dot-des-03', targetId: 'dot-dev-03', type: 'synthesis', status: 'active', direction: 'forward', label: 'Marges & viewport', intensity: 0.76 },
  { id: 'conn-22', sourceId: 'dot-des-01', targetId: 'dot-des-02', type: 'critique', status: 'idle', direction: 'forward', label: 'Revue contraste', intensity: 0.4 },
  { id: 'conn-23', sourceId: 'dot-des-04', targetId: 'dot-dev-04', type: 'delegation', status: 'idle', direction: 'forward', label: 'Courbes d’animation', intensity: 0.4 },

  // Development <-> Testing
  { id: 'conn-24', sourceId: 'dot-dev-01', targetId: 'dot-tst-01', type: 'verification', status: 'active', direction: 'forward', label: 'Validation anti-collision', intensity: 0.86 },
  { id: 'conn-25', sourceId: 'dot-dev-04', targetId: 'dot-tst-02', type: 'verification', status: 'active', direction: 'forward', label: 'Mesure cadence 60 FPS', intensity: 0.82 },
  { id: 'conn-26', sourceId: 'dot-tst-05', targetId: 'dot-dev-06', type: 'critique', status: 'active', direction: 'bidirectional', label: 'Diagnostic sérialisation', intensity: 0.94 },
  { id: 'conn-27', sourceId: 'dot-dev-03', targetId: 'dot-dev-02', type: 'synthesis', status: 'idle', direction: 'bidirectional', label: 'Coordination caméra', intensity: 0.4 },

  // Testing -> Review -> Memory
  { id: 'conn-28', sourceId: 'dot-tst-02', targetId: 'dot-rev-01', type: 'verification', status: 'active', direction: 'forward', label: 'Rapport performance', intensity: 0.84 },
  { id: 'conn-29', sourceId: 'dot-tst-01', targetId: 'dot-tst-04', type: 'verification', status: 'completing', direction: 'forward', label: 'Résultats tests spatiaux', intensity: 0.55 },
  { id: 'conn-30', sourceId: 'dot-rev-01', targetId: 'dot-mem-02', type: 'memory-sync', status: 'active', direction: 'forward', label: 'Consignation décisions', intensity: 0.78 },
  { id: 'conn-31', sourceId: 'dot-rev-02', targetId: 'dot-des-01', type: 'critique', status: 'idle', direction: 'forward', label: 'Affinage lisibilité', intensity: 0.45 },
  { id: 'conn-32', sourceId: 'dot-mem-02', targetId: 'dot-mem-01', type: 'memory-sync', status: 'idle', direction: 'forward', label: 'Indexation continue', intensity: 0.4 },
  { id: 'conn-33', sourceId: 'dot-tst-03', targetId: 'dot-rev-03', type: 'verification', status: 'idle', direction: 'forward', label: 'Contrôle cas limites', intensity: 0.4 },
];

const DEMO_WAVE_SCENARIOS: Array<{
  activeConnectionIds: string[];
  completingConnectionIds: string[];
  agentStatuses: Partial<Record<string, AgentStatus>>;
}> = [
  {
    activeConnectionIds: ['conn-01', 'conn-04', 'conn-07', 'conn-10', 'conn-15', 'conn-20', 'conn-24', 'conn-26', 'conn-28'],
    completingConnectionIds: ['conn-02', 'conn-12', 'conn-19'],
    agentStatuses: {
      'dot-core-01': 'Communicating',
      'dot-core-02': 'Thinking',
      'dot-arch-01': 'Communicating',
      'dot-dev-01': 'Working',
      'dot-des-02': 'Communicating',
      'dot-tst-02': 'Communicating',
      'dot-rev-01': 'Reviewing',
      'dot-mem-01': 'Communicating',
      'dot-dev-06': 'Error',
    },
  },
  {
    activeConnectionIds: ['conn-02', 'conn-05', 'conn-06', 'conn-11', 'conn-14', 'conn-17', 'conn-21', 'conn-25', 'conn-30'],
    completingConnectionIds: ['conn-04', 'conn-15', 'conn-24'],
    agentStatuses: {
      'dot-core-01': 'Working',
      'dot-core-02': 'Communicating',
      'dot-core-03': 'Communicating',
      'dot-res-01': 'Working',
      'dot-res-03': 'Thinking',
      'dot-arch-02': 'Communicating',
      'dot-dev-02': 'Communicating',
      'dot-dev-04': 'Working',
      'dot-des-03': 'Communicating',
      'dot-rev-01': 'Communicating',
      'dot-dev-06': 'Working',
    },
  },
  {
    activeConnectionIds: ['conn-03', 'conn-08', 'conn-09', 'conn-13', 'conn-16', 'conn-19', 'conn-23', 'conn-27', 'conn-29', 'conn-31'],
    completingConnectionIds: ['conn-07', 'conn-17', 'conn-25', 'conn-30'],
    agentStatuses: {
      'dot-core-01': 'Thinking',
      'dot-core-04': 'Communicating',
      'dot-res-04': 'Completed',
      'dot-arch-04': 'Communicating',
      'dot-dev-05': 'Completed',
      'dot-dev-06': 'Completed',
      'dot-des-01': 'Reviewing',
      'dot-tst-01': 'Communicating',
      'dot-tst-04': 'Completed',
      'dot-rev-02': 'Communicating',
      'dot-mem-02': 'Working',
    },
  },
  {
    activeConnectionIds: ['conn-01', 'conn-04', 'conn-07', 'conn-12', 'conn-15', 'conn-18', 'conn-20', 'conn-22', 'conn-28', 'conn-32'],
    completingConnectionIds: ['conn-06', 'conn-16', 'conn-29'],
    agentStatuses: {
      'dot-core-01': 'Communicating',
      'dot-core-03': 'Working',
      'dot-res-06': 'Communicating',
      'dot-arch-01': 'Communicating',
      'dot-arch-03': 'Communicating',
      'dot-dev-01': 'Working',
      'dot-des-01': 'Communicating',
      'dot-tst-02': 'Communicating',
      'dot-rev-01': 'Reviewing',
      'dot-mem-01': 'Communicating',
      'dot-mem-03': 'Thinking',
    },
  },
];

/**
 * Fait avancer la simulation de démonstration d'un cycle déterministe.
 * Permet d'observer des vagues réalistes de communication sans backend.
 */
export function advanceDemoSimulation(
  agents: Agent[],
  connections: Connection[],
  stepIndex: number
): { agents: Agent[]; connections: Connection[] } {
  const wave = DEMO_WAVE_SCENARIOS[stepIndex % DEMO_WAVE_SCENARIOS.length];
  const activeSet = new Set(wave.activeConnectionIds);
  const completingSet = new Set(wave.completingConnectionIds);

  const nextConnections: Connection[] = connections.map((conn) => {
    if (activeSet.has(conn.id)) {
      return { ...conn, status: 'active', intensity: Math.max(conn.intensity ?? 0.8, 0.8) };
    }
    if (completingSet.has(conn.id)) {
      return { ...conn, status: 'completing', intensity: 0.55 };
    }
    return { ...conn, status: 'idle', intensity: 0.35 };
  });

  const nextAgents: Agent[] = agents.map((agent) => {
    const override = wave.agentStatuses[agent.id];
    if (!override) {
      return agent;
    }
    return {
      ...agent,
      status: override,
      metadata: {
        ...agent.metadata,
        tokensProcessed: (agent.metadata.tokensProcessed ?? 10000) + 180 + (stepIndex % 5) * 45,
        lastActiveAt: 'À l’instant',
      },
    };
  });

  return { agents: nextAgents, connections: nextConnections };
}

/**
 * Produit une réaction visuelle de démonstration lorsqu'une mission est soumise.
 * Active les groupes pertinents et crée des flux visibles depuis Core Intelligence.
 */
export function applyDemoMissionReaction(
  agents: Agent[],
  connections: Connection[],
  mission: MissionPayload
): { agents: Agent[]; connections: Connection[] } {
  const modeConfig =
    MISSION_MODES.find((m) => m.id === mission.mode) ?? MISSION_MODES[0];
  const targetGroups = new Set<GroupId>(modeConfig.targetGroups);

  const truncatedPrompt =
    mission.prompt.length > 74
      ? `${mission.prompt.slice(0, 71).trim()}…`
      : mission.prompt;

  const agentById = new Map(agents.map((a) => [a.id, a]));

  const nextConnections: Connection[] = connections.map((conn) => {
    const src = agentById.get(conn.sourceId);
    const tgt = agentById.get(conn.targetId);
    if (!src || !tgt) return conn;

    const touchesCore =
      src.groupId === 'core-intelligence' || tgt.groupId === 'core-intelligence';
    const bothTargeted =
      targetGroups.has(src.groupId) && targetGroups.has(tgt.groupId);

    if (bothTargeted && (touchesCore || conn.type === 'delegation' || conn.type === 'verification' || conn.type === 'synthesis')) {
      return { ...conn, status: 'active', intensity: 0.95 };
    }
    if (bothTargeted) {
      return { ...conn, status: 'completing', intensity: 0.6 };
    }
    return { ...conn, status: 'idle', intensity: 0.3 };
  });

  const nextAgents: Agent[] = agents.map((agent) => {
    if (agent.groupId === 'core-intelligence') {
      return {
        ...agent,
        status: agent.id === 'dot-core-01' ? 'Communicating' : 'Thinking',
        currentTask: `Coordination mission (démo) : « ${truncatedPrompt} »`,
        metadata: { ...agent.metadata, lastActiveAt: 'À l’instant' },
      };
    }
    if (targetGroups.has(agent.groupId)) {
      const nextStatus: AgentStatus =
        agent.groupId === 'review'
          ? 'Reviewing'
          : agent.id.endsWith('01') || agent.id.endsWith('02')
            ? 'Communicating'
            : 'Working';
      return {
        ...agent,
        status: nextStatus,
        currentTask: `Traitement (${modeConfig.label.toLowerCase()}) : « ${truncatedPrompt} »`,
        metadata: { ...agent.metadata, lastActiveAt: 'À l’instant' },
      };
    }
    return {
      ...agent,
      status: agent.status === 'Error' ? 'Error' : 'Idle',
    };
  });

  return { agents: nextAgents, connections: nextConnections };
}
