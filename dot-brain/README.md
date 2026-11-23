# Dot Brain — Visualisation Interactive Multi-Agents

Interface frontend modulaire dédiée à la visualisation d’un écosystème cognitif de **40 agents IA (Dots)** répartis en **8 groupes spécialisés**, avec communications dynamiques orientées, gravité de collaboration et panneau d’inspection.

Conçue pour être **entièrement indépendante du backend**, elle s’intègre directement dans une application React + TypeScript existante.

---

## Architecture des modules

```text
src/
├── types/dotBrain.ts            # Contrats TypeScript publics (Agent, Connection, Group, Callbacks)
├── constants/dotVisuals.ts      # Palette neutre, signatures géométriques des 7 états, modes
├── data/demoNetworkData.ts      # Données de démonstration clairement identifiées (40 Dots)
├── engine/
│   ├── layoutEngine.ts          # Moteur spatial pur (constellation, collaboration, collisions, Bézier)
│   └── layoutEngine.test.ts     # Tests unitaires déterministes (node:test)
├── components/
│   ├── DotBrainWorkspace.tsx    # Composant racine intégrable (contrôlé ou démo autonome)
│   ├── DotNetwork.tsx           # Scène SVG interactive (zoom, pan, recentrage, particules RAF)
│   ├── DotNode.tsx              # Représentation précise d'un Dot (10–15 px) + états + clavier
│   ├── DotConnection.tsx        # Courbes de Bézier dynamiques avec sens de transmission
│   ├── DotGroup.tsx             # Enveloppes organiques des 8 groupes cognitifs
│   ├── DotInspector.tsx         # Panneau latéral de détail & actions sur l'agent
│   ├── MissionComposer.tsx      # Barre de mission en bas d'écran (prompt, mode, fichiers)
│   ├── NetworkControls.tsx      # Filtres (spécialité/état), visibilité groupes, zoom, réorganisation
│   └── NetworkLegend.tsx        # Légende dépliable des 7 états et flux de communication
└── index.ts                     # Exports publics pour intégration hôte
```

---

## Intégration dans une application existante

### 1. Mode autonome (démonstration locale)

Sans props `agents` / `connections`, `DotBrainWorkspace` utilise automatiquement les données de démonstration de `src/data/demoNetworkData.ts` et l’indique explicitement à l’utilisateur.

```tsx
import { DotBrainWorkspace } from './src';

export function DemoPage() {
  return (
    <div className="h-screen w-screen">
      <DotBrainWorkspace
        isDemoMode
        enableDemoSimulation
        onMissionSubmit={(mission) => console.log('Mission soumise :', mission)}
      />
    </div>
  );
}
```

### 2. Mode connecté à votre backend (WebSocket / SSE / REST)

Pour remplacer les données de démonstration par vos événements temps réel, passez vos propres tableaux `agents`, `connections` et `groups` ainsi que les callbacks métier :

```tsx
import { useEffect, useState } from 'react';
import {
  DotBrainWorkspace,
  type Agent,
  type AgentAction,
  type Connection,
  type Group,
  type MissionPayload,
  type NetworkChangeEvent,
} from './src';

export function ConnectedDotBrain() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    const ws = new WebSocket('wss://votre-backend.example/dot-brain/stream');
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.agents) setAgents(payload.agents);
      if (payload.connections) setConnections(payload.connections);
      if (payload.groups) setGroups(payload.groups);
    };
    return () => ws.close();
  }, []);

  const handleMissionSubmit = async (mission: MissionPayload) => {
    const formData = new FormData();
    formData.append('prompt', mission.prompt);
    formData.append('mode', mission.mode);
    mission.attachments.forEach((a) => {
      if (a.file) formData.append('files', a.file);
    });

    await fetch('/api/missions', { method: 'POST', body: formData });
  };

  const handleAgentAction = (action: AgentAction) => {
    fetch(`/api/agents/${action.agentId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: action.type }),
    });
  };

  const handleNetworkChange = (event: NetworkChangeEvent) => {
    // Synchronisation optionnelle de la télémétrie ou persistance des filtres
    console.debug('Network change:', event.reason, event.layoutMode);
  };

  return (
    <div className="h-screen w-full">
      <DotBrainWorkspace
        agents={agents}
        connections={connections}
        groups={groups}
        isDemoMode={false}
        enableDemoSimulation={false}
        onAgentSelect={(agent) => console.debug('Agent sélectionné :', agent?.id)}
        onMissionSubmit={handleMissionSubmit}
        onAgentAction={handleAgentAction}
        onNetworkChange={handleNetworkChange}
      />
    </div>
  );
}
```

---

## Contrats TypeScript principaux

- **`Agent`** : `id`, `name`, `role`, `specialty`, `model`, `status`, `groupId`, `currentTask`, `metadata`
- **`Connection`** : `id`, `sourceId`, `targetId`, `type`, `status` (`'active' | 'completing' | 'idle'`), `direction` (`'forward' | 'reverse' | 'bidirectional'`)
- **`Group`** : `id`, `name`, `description`, `agentIds`
- **Callbacks** :
  - `onAgentSelect(agent: Agent | null)`
  - `onMissionSubmit(mission: MissionPayload)`
  - `onAgentAction(action: AgentAction)`
  - `onNetworkChange(event: NetworkChangeEvent)`

---

## Vérification & Scripts

```bash
# Tests unitaires du moteur spatial et des invariants (40 Dots, anti-collision, filtres)
npx --yes tsx --test src/engine/layoutEngine.test.ts

# Vérification TypeScript
npm run lint

# Build de production
npm run build
```
