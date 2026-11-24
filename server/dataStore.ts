import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ServerProjectFile {
  id: string;
  name: string;
  path?: string;
  content: string;
  size: number;
  addedAt: string;
}

export interface ServerProjectMemory {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface ServerProject {
  id: string;
  name: string;
  description: string;
  instructions: string;
  workspacePath?: string;
  files: ServerProjectFile[];
  memories: ServerProjectMemory[];
  createdAt: string;
  updatedAt: string;
}

export interface ServerMemoryItem {
  id: string;
  category: 'preference' | 'fact' | 'project' | 'procedure' | 'technical';
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalInstructionsConfig {
  instructions: string;
  responseLanguage: string;
  codingStyle: string;
  updatedAt: string;
}

export class AssistantDataStore {
  private readonly dataDir: string;
  private projects: ServerProject[] = [];
  private memories: ServerMemoryItem[] = [];
  private instructions: GlobalInstructionsConfig = {
    instructions: '',
    responseLanguage: 'fr',
    codingStyle: '',
    updatedAt: new Date().toISOString(),
  };

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.loadAll();
  }

  private filePath(name: string): string {
    return path.join(this.dataDir, name);
  }

  private readJson<T>(name: string, fallback: T): T {
    try {
      const fp = this.filePath(name);
      if (fs.existsSync(fp)) {
        return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T;
      }
    } catch {
      // ignore malformed
    }
    return fallback;
  }

  private writeJson(name: string, data: unknown): void {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(this.filePath(name), JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // non-fatal
    }
  }

  private loadAll(): void {
    this.projects = this.readJson<ServerProject[]>('projects.json', []);
    this.memories = this.readJson<ServerMemoryItem[]>('memory.json', []);
    this.instructions = this.readJson<GlobalInstructionsConfig>('instructions.json', {
      instructions: '',
      responseLanguage: 'fr',
      codingStyle: '',
      updatedAt: new Date().toISOString(),
    });
  }

  // ---- Projects ----
  listProjects(): ServerProject[] {
    return this.projects;
  }

  getProject(id: string): ServerProject | undefined {
    return this.projects.find((p) => p.id === id);
  }

  createProject(input: {
    name: string;
    description?: string;
    instructions?: string;
    workspacePath?: string;
  }): ServerProject {
    const now = new Date().toISOString();
    const project: ServerProject = {
      id: `proj-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name: input.name.trim(),
      description: (input.description ?? '').trim(),
      instructions: (input.instructions ?? '').trim(),
      workspacePath: input.workspacePath?.trim() || undefined,
      files: [],
      memories: [],
      createdAt: now,
      updatedAt: now,
    };
    this.projects = [project, ...this.projects];
    this.writeJson('projects.json', this.projects);
    return project;
  }

  updateProject(
    id: string,
    updates: Partial<
      Pick<ServerProject, 'name' | 'description' | 'instructions' | 'workspacePath' | 'files' | 'memories'>
    >,
  ): ServerProject | null {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const current = this.projects[idx];
    const updated: ServerProject = {
      ...current,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() || current.name : current.name,
      updatedAt: new Date().toISOString(),
    };
    this.projects[idx] = updated;
    this.writeJson('projects.json', this.projects);
    return updated;
  }

  deleteProject(id: string): boolean {
    const before = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id);
    if (this.projects.length !== before) {
      this.writeJson('projects.json', this.projects);
      return true;
    }
    return false;
  }

  // ---- Memory ----
  listMemories(projectId?: string | null): ServerMemoryItem[] {
    if (projectId) {
      return this.memories.filter((m) => m.projectId === projectId || !m.projectId);
    }
    return this.memories;
  }

  createMemory(input: {
    title: string;
    content: string;
    category?: ServerMemoryItem['category'];
    tags?: string[];
    pinned?: boolean;
    projectId?: string | null;
  }): ServerMemoryItem {
    const now = new Date().toISOString();
    const item: ServerMemoryItem = {
      id: `mem-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      category: input.category ?? 'fact',
      title: input.title.trim(),
      content: input.content.trim(),
      tags: Array.isArray(input.tags)
        ? input.tags.map((t) => t.trim()).filter(Boolean)
        : [],
      pinned: Boolean(input.pinned),
      projectId: input.projectId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.memories = [item, ...this.memories];
    this.writeJson('memory.json', this.memories);
    return item;
  }

  updateMemory(
    id: string,
    updates: Partial<Pick<ServerMemoryItem, 'title' | 'content' | 'category' | 'tags' | 'pinned'>>,
  ): ServerMemoryItem | null {
    const idx = this.memories.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const updated: ServerMemoryItem = {
      ...this.memories[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.memories[idx] = updated;
    this.writeJson('memory.json', this.memories);
    return updated;
  }

  deleteMemory(id: string): boolean {
    const before = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    if (this.memories.length !== before) {
      this.writeJson('memory.json', this.memories);
      return true;
    }
    return false;
  }

  // ---- Global Instructions ----
  getInstructions(): GlobalInstructionsConfig {
    return { ...this.instructions };
  }

  updateInstructions(updates: Partial<GlobalInstructionsConfig>): GlobalInstructionsConfig {
    this.instructions = {
      ...this.instructions,
      ...(updates.instructions !== undefined ? { instructions: updates.instructions } : {}),
      ...(updates.responseLanguage !== undefined
        ? { responseLanguage: updates.responseLanguage }
        : {}),
      ...(updates.codingStyle !== undefined ? { codingStyle: updates.codingStyle } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.writeJson('instructions.json', this.instructions);
    return this.getInstructions();
  }
}
