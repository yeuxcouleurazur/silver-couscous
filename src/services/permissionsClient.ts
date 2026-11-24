export type PermissionModeValue = 'allow' | 'ask' | 'deny';

export type PermissionKey =
  | 'files_read'
  | 'files_write'
  | 'files_delete_move'
  | 'terminal_exec'
  | 'install_dependencies'
  | 'internet_access'
  | 'web_browsing'
  | 'app_launch'
  | 'git_access'
  | 'require_approval_sensitive';

export interface PermissionsPolicy {
  permissions: Record<PermissionKey, PermissionModeValue>;
  allowedDirectories: string[];
  updatedAt: string;
}

export interface PermissionCatalogItem {
  key: PermissionKey;
  label: string;
  description: string;
  sensitive: boolean;
}

export interface PendingApprovalRecord {
  id: string;
  permission: PermissionKey;
  action: string;
  target: string;
  summary: string;
  detail?: string;
  createdAt: string;
  status: 'pending' | 'approved-once' | 'approved-session' | 'denied';
  token?: string;
  resolvedAt?: string;
}

export interface AuditEntryRecord {
  id: string;
  timestamp: string;
  source: 'chat' | 'code' | 'write' | 'agent' | 'terminal' | 'system' | 'user';
  agentName?: string;
  permission?: PermissionKey;
  action: string;
  target: string;
  status: 'allowed' | 'denied' | 'pending_approval' | 'completed' | 'error' | 'stopped';
  detail?: string;
  durationMs?: number;
}

export interface BackgroundTaskRecord {
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

export interface SystemInfoResponse {
  workspaceRoot: string;
  allowedDirectories: string[];
  geminiConfigured: boolean;
  models: string[];
  bridge: {
    mode: 'local-host' | 'remote-windows-agent' | 'disconnected-cloud';
    connected: boolean;
    hostPlatform: string;
    hostHostname: string;
    hostArch: string;
    isWindowsHost: boolean;
    remoteAgentUrl: string;
    remoteAgentReachable: boolean;
    remotePlatform?: string;
    remoteHostname?: string;
    remoteWorkspaceRoot?: string;
    lastCheckedAt: string;
    error?: string;
    detectedTools: Array<{ name: string; available: boolean; version?: string }>;
  };
  bridgeConfig: {
    enabled: boolean;
    url: string;
    hasToken: boolean;
    label: string;
  };
}

export interface ServerProjectRecord {
  id: string;
  name: string;
  description: string;
  instructions: string;
  workspacePath?: string;
  files: Array<{
    id: string;
    name: string;
    path?: string;
    content: string;
    size: number;
    addedAt: string;
  }>;
  memories: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ServerMemoryRecord {
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

export interface GlobalInstructionsRecord {
  instructions: string;
  responseLanguage: string;
  codingStyle: string;
  updatedAt: string;
}

export async function fetchPermissionsState(): Promise<{
  policy: PermissionsPolicy;
  catalog: PermissionCatalogItem[];
  approvals: PendingApprovalRecord[];
}> {
  const res = await fetch('/api/permissions');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updatePermissionsPolicy(updates: {
  permissions?: Partial<Record<PermissionKey, PermissionModeValue>>;
  allowedDirectories?: string[];
}): Promise<PermissionsPolicy> {
  const res = await fetch('/api/permissions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { policy: PermissionsPolicy };
  return data.policy;
}

export async function resolveServerApproval(
  approvalId: string,
  decision: 'approved-once' | 'approved-session' | 'denied',
): Promise<PendingApprovalRecord> {
  const res = await fetch(`/api/permissions/approvals/${encodeURIComponent(approvalId)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { approval: PendingApprovalRecord };
  return data.approval;
}

export async function revokeSessionApprovals(): Promise<void> {
  await fetch('/api/permissions/revoke-session', { method: 'POST' });
}

export async function fetchAuditLog(limit = 120): Promise<AuditEntryRecord[]> {
  const res = await fetch(`/api/audit?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { entries: AuditEntryRecord[] };
  return data.entries;
}

export async function clearAuditLog(): Promise<void> {
  await fetch('/api/audit', { method: 'DELETE' });
}

export async function fetchBackgroundTasks(): Promise<BackgroundTaskRecord[]> {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { tasks: BackgroundTaskRecord[] };
  return data.tasks;
}

export async function stopBackgroundTask(taskId: string): Promise<void> {
  await fetch(`/api/tasks/${encodeURIComponent(taskId)}/stop`, { method: 'POST' });
}

export async function stopAllBackgroundTasks(): Promise<number> {
  const res = await fetch('/api/tasks/stop-all', { method: 'POST' });
  if (!res.ok) return 0;
  const data = (await res.json()) as { stoppedCount?: number };
  return data.stoppedCount ?? 0;
}

export async function fetchSystemInfo(): Promise<SystemInfoResponse> {
  const res = await fetch('/api/system/info');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveLocalAgentConfig(payload: {
  enabled: boolean;
  url: string;
  token?: string;
  label?: string;
}): Promise<{
  config: { enabled: boolean; url: string; hasToken: boolean; label: string };
  test: { reachable: boolean; platform?: string; hostname?: string; error?: string };
}> {
  const res = await fetch('/api/local-agent/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function testLocalAgentConnection(): Promise<{
  reachable: boolean;
  platform?: string;
  hostname?: string;
  workspaceRoot?: string;
  error?: string;
}> {
  const res = await fetch('/api/local-agent/test', { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- Projects ----
export async function fetchProjects(): Promise<ServerProjectRecord[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { projects: ServerProjectRecord[] };
  return data.projects;
}

export async function createProjectApi(input: {
  name: string;
  description?: string;
  instructions?: string;
  workspacePath?: string;
}): Promise<ServerProjectRecord> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { project: ServerProjectRecord };
  return data.project;
}

export async function updateProjectApi(
  id: string,
  updates: Partial<ServerProjectRecord>,
): Promise<ServerProjectRecord> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { project: ServerProjectRecord };
  return data.project;
}

export async function deleteProjectApi(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ---- Memory & Instructions ----
export async function fetchMemories(projectId?: string): Promise<ServerMemoryRecord[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`/api/memory${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { memories: ServerMemoryRecord[] };
  return data.memories;
}

export async function createMemoryApi(input: {
  title: string;
  content: string;
  category?: ServerMemoryRecord['category'];
  tags?: string[];
  pinned?: boolean;
  projectId?: string | null;
}): Promise<ServerMemoryRecord> {
  const res = await fetch('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { memory: ServerMemoryRecord };
  return data.memory;
}

export async function updateMemoryApi(
  id: string,
  updates: Partial<ServerMemoryRecord>,
): Promise<ServerMemoryRecord> {
  const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { memory: ServerMemoryRecord };
  return data.memory;
}

export async function deleteMemoryApi(id: string): Promise<void> {
  const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function fetchGlobalInstructions(): Promise<GlobalInstructionsRecord> {
  const res = await fetch('/api/instructions');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { instructions: GlobalInstructionsRecord };
  return data.instructions;
}

export async function saveGlobalInstructions(
  updates: Partial<GlobalInstructionsRecord>,
): Promise<GlobalInstructionsRecord> {
  const res = await fetch('/api/instructions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { instructions: GlobalInstructionsRecord };
  return data.instructions;
}
