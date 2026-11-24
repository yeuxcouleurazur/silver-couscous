import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PermissionKey } from './permissions';

export type AuditStatus = 'allowed' | 'denied' | 'pending_approval' | 'completed' | 'error' | 'stopped';

export interface AuditEntry {
  id: string;
  timestamp: string;
  source: 'chat' | 'code' | 'write' | 'agent' | 'terminal' | 'system' | 'user';
  agentName?: string;
  permission?: PermissionKey;
  action: string;
  target: string;
  status: AuditStatus;
  detail?: string;
  durationMs?: number;
}

export interface BackgroundTask {
  id: string;
  title: string;
  kind: 'command' | 'agent_mission' | 'web_research' | 'file_operation';
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: string;
  finishedAt?: string;
  detail?: string;
  outputPreview?: string;
  error?: string;
}

export class AuditAndTaskStore {
  private entries: AuditEntry[] = [];
  private tasks: BackgroundTask[] = [];
  private readonly activeAborts = new Map<string, () => void>();
  private readonly auditFile: string | null;
  private readonly tasksFile: string | null;

  constructor(dataDir: string | null = null) {
    this.auditFile = dataDir ? path.join(dataDir, 'audit.json') : null;
    this.tasksFile = dataDir ? path.join(dataDir, 'tasks.json') : null;
    this.load();
  }

  private load(): void {
    if (this.auditFile && fs.existsSync(this.auditFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.auditFile, 'utf-8'));
        if (Array.isArray(parsed)) this.entries = parsed.slice(0, 300);
      } catch {
        // ignore corrupt audit file
      }
    }
    if (this.tasksFile && fs.existsSync(this.tasksFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.tasksFile, 'utf-8'));
        if (Array.isArray(parsed)) {
          // Any task that was 'running' from a prior server process is marked stopped
          this.tasks = parsed.slice(0, 100).map((t: BackgroundTask) =>
            t.status === 'running'
              ? { ...t, status: 'stopped', finishedAt: new Date().toISOString() }
              : t,
          );
        }
      } catch {
        // ignore
      }
    }
  }

  private persistAudit(): void {
    if (!this.auditFile) return;
    try {
      fs.mkdirSync(path.dirname(this.auditFile), { recursive: true });
      fs.writeFileSync(this.auditFile, JSON.stringify(this.entries.slice(0, 300), null, 2), 'utf-8');
    } catch {
      // non-fatal
    }
  }

  private persistTasks(): void {
    if (!this.tasksFile) return;
    try {
      fs.mkdirSync(path.dirname(this.tasksFile), { recursive: true });
      fs.writeFileSync(this.tasksFile, JSON.stringify(this.tasks.slice(0, 100), null, 2), 'utf-8');
    } catch {
      // non-fatal
    }
  }

  recordAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const full: AuditEntry = {
      id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.entries = [full, ...this.entries].slice(0, 300);
    this.persistAudit();
    return full;
  }

  listAudit(limit = 120): AuditEntry[] {
    return this.entries.slice(0, limit);
  }

  clearAudit(): void {
    this.entries = [];
    this.persistAudit();
  }

  startTask(
    params: {
      title: string;
      kind: BackgroundTask['kind'];
      detail?: string;
    },
    onStop?: () => void,
  ): BackgroundTask {
    const task: BackgroundTask = {
      id: `task-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      title: params.title,
      kind: params.kind,
      status: 'running',
      startedAt: new Date().toISOString(),
      detail: params.detail,
    };
    this.tasks = [task, ...this.tasks].slice(0, 100);
    if (onStop) this.activeAborts.set(task.id, onStop);
    this.persistTasks();
    return task;
  }

  completeTask(
    taskId: string,
    result: { status: 'completed' | 'failed' | 'stopped'; outputPreview?: string; error?: string },
  ): BackgroundTask | null {
    this.activeAborts.delete(taskId);
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    task.status = result.status;
    task.finishedAt = new Date().toISOString();
    if (result.outputPreview !== undefined) task.outputPreview = result.outputPreview.slice(0, 600);
    if (result.error !== undefined) task.error = result.error.slice(0, 400);
    this.persistTasks();
    return task;
  }

  stopTask(taskId: string): boolean {
    const stopFn = this.activeAborts.get(taskId);
    if (stopFn) {
      try {
        stopFn();
      } catch {
        // ignore
      }
      this.activeAborts.delete(taskId);
    }
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    if (task.status === 'running') {
      task.status = 'stopped';
      task.finishedAt = new Date().toISOString();
      this.persistTasks();
      this.recordAudit({
        source: 'user',
        action: 'stop_task',
        target: task.title,
        status: 'stopped',
      });
    }
    return true;
  }

  stopAllTasks(): number {
    let count = 0;
    for (const [id, stopFn] of Array.from(this.activeAborts.entries())) {
      try {
        stopFn();
      } catch {
        // ignore
      }
      this.activeAborts.delete(id);
      const task = this.tasks.find((t) => t.id === id);
      if (task && task.status === 'running') {
        task.status = 'stopped';
        task.finishedAt = new Date().toISOString();
        count += 1;
      }
    }
    if (count > 0) {
      this.persistTasks();
      this.recordAudit({
        source: 'user',
        action: 'emergency_stop_all',
        target: `${count} tâche(s) en cours`,
        status: 'stopped',
      });
    }
    return count;
  }

  listTasks(limit = 50): BackgroundTask[] {
    return this.tasks.slice(0, limit);
  }
}
