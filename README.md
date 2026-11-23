<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# OpenClaudeDesktop — AI Multi-Agent Desktop

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/51e31112-7636-4ea2-86c0-f76dace367ff

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
4. Open http://localhost:3000

## Desktop Shell — AI Multi-Agent Interface

The app includes a dark premium minimalist desktop shell (Antigravity/Codex style) with 8 views:

| View | Description |
|------|-------------|
| **Accueil** | Centre de contrôle avec stats des 6 équipes d'agents |
| **Centre de contrôle** | 40 agents par équipe, filtres par statut, détails |
| **Missions** | Création, exécution, suivi et graphe d'exécution multi-agent |
| **Mémoire partagée** | CRUD, recherche, historique des changements, stats |
| **Laboratoire** | Scénarios d'entraînement, historique des performances |
| **Modèles** | 9 fournisseurs, 18 modèles, statut de configuration |
| **Workspace** | Explorateur de fichiers (File System Access API), terminal, recherche, Git |
| **Conversation** | Interface Claude Code existante (chat, sidebar, sessions) |

### Orchestrateur multi-agent

- Décomposition de mission en étapes assignées aux agents les plus qualifiés
- Exécution parallèle avec limite de concurrence
- Auto-correction / retry en cas d'échech
- Vérification des résultats
- Graphe d'exécution interactif (mission → étapes → agents)

### Clavier (raccourcis globaux)

- `⌘K` — Recherche
- `⌘,` — Paramètres
- `⌘/` — Raccourcis
- `⌘.` — Barre latérale
- `⇧⌘O` — Nouvelle session
- `Esc` — Arrêter la génération

### Accès aux fichiers locaux

L'onglet **Fichiers** du workspace utilise l'API File System Access (`showDirectoryPicker`). L'utilisateur doit choisir explicitement un dossier. Supporté par Chrome/Edge.

### Pont FCC

Le pont FCC (Claude Code bridge) est configuré dans Settings > Secrets. Le streaming passe par `/api/gemini/stream` sur le serveur Express.

## Développement

```bash
npm run dev      # Serveur de développement (Express + Vite)
npm run build    # Build de production (Vite)
npm run preview  # Aperçu de la build
npm run lint     # Vérification TypeScript (tsc --noEmit)
```

## Tests

Les tests utilisent `node:test` (built-in) avec `tsx`:

```bash
npx tsx src/services/agentOrchestrator.test.ts
npx tsx src/services/memoryService.test.ts
npx tsx src/utils/chatStore.test.ts
```

## Architecture

- `src/types/` — Types TypeScript (agent, memory, model, training, claude)
- `src/stores/` — Magasins réactifs (createStore) avec abonnement
- `src/services/` — agentOrchestrator, modelRegistry, memoryService, trainingService, fileSystem, fccAdapter
- `src/components/desktop/` — DesktopShell + 8 vues + sous-composants
- `src/components/` — CodeSidebar, CodeSessionView, CodeRightPane, LocalFileExplorer, modaux
