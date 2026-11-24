import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface LocalAgentBridgeConfig {
  enabled: boolean;
  url: string;
  token: string;
  label: string;
}

export interface LocalAgentStatus {
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
}

async function probeBinary(
  cmd: string,
  args: string[],
): Promise<{ name: string; available: boolean; version?: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: 2500 });
    const firstLine = (stdout || stderr || '').split(/\r?\n/).find((l) => l.trim())?.trim();
    return { name: cmd, available: true, version: firstLine?.slice(0, 80) };
  } catch {
    return { name: cmd, available: false };
  }
}

export class LocalBridgeManager {
  private config: LocalAgentBridgeConfig;
  private readonly persistPath: string | null;
  private lastRemoteInfo: {
    reachable: boolean;
    platform?: string;
    hostname?: string;
    workspaceRoot?: string;
    error?: string;
    checkedAt: string;
  } | null = null;

  constructor(dataDir: string | null = null) {
    this.persistPath = dataDir ? path.join(dataDir, 'local-agent.json') : null;
    this.config = this.loadConfig();
  }

  private loadConfig(): LocalAgentBridgeConfig {
    const fallback: LocalAgentBridgeConfig = {
      enabled: Boolean(process.env.LOCAL_AGENT_URL?.trim()),
      url: process.env.LOCAL_AGENT_URL?.trim() || 'http://127.0.0.1:4789',
      token: process.env.LOCAL_AGENT_TOKEN?.trim() || '',
      label: 'Agent PC Windows',
    };
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return fallback;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8')) as Partial<LocalAgentBridgeConfig>;
      return {
        enabled: Boolean(parsed.enabled),
        url: typeof parsed.url === 'string' && parsed.url.trim() ? parsed.url.trim() : fallback.url,
        token: typeof parsed.token === 'string' ? parsed.token.trim() : fallback.token,
        label: typeof parsed.label === 'string' && parsed.label.trim() ? parsed.label.trim() : fallback.label,
      };
    } catch {
      return fallback;
    }
  }

  private saveConfig(): void {
    if (!this.persistPath) return;
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      // Store only non-secret fields or keep token in memory/env when possible;
      // for local desktop pairing config on the user's own host, keep file 0600.
      fs.writeFileSync(this.persistPath, JSON.stringify(this.config, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
    } catch {
      // non-fatal
    }
  }

  getSafeConfig(): { enabled: boolean; url: string; hasToken: boolean; label: string } {
    return {
      enabled: this.config.enabled,
      url: this.config.url,
      hasToken: this.config.token.length > 0,
      label: this.config.label,
    };
  }

  updateConfig(next: Partial<LocalAgentBridgeConfig>): {
    enabled: boolean;
    url: string;
    hasToken: boolean;
    label: string;
  } {
    if (typeof next.enabled === 'boolean') this.config.enabled = next.enabled;
    if (typeof next.url === 'string' && next.url.trim()) {
      this.config.url = next.url.trim().replace(/\/+$/, '');
    }
    if (typeof next.token === 'string') this.config.token = next.token.trim();
    if (typeof next.label === 'string' && next.label.trim()) this.config.label = next.label.trim();
    this.saveConfig();
    return this.getSafeConfig();
  }

  isRemoteBridgeActive(): boolean {
    return Boolean(this.config.enabled && this.config.url && this.lastRemoteInfo?.reachable);
  }

  async testRemoteConnection(): Promise<{
    reachable: boolean;
    platform?: string;
    hostname?: string;
    workspaceRoot?: string;
    error?: string;
  }> {
    if (!this.config.url) {
      return { reachable: false, error: 'URL de l’agent local non renseignée.' };
    }
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.config.token) {
        headers.Authorization = `Bearer ${this.config.token}`;
      }
      const res = await fetch(`${this.config.url}/health`, {
        headers,
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) {
        const msg = `L’agent local a répondu HTTP ${res.status}.`;
        this.lastRemoteInfo = { reachable: false, error: msg, checkedAt: new Date().toISOString() };
        return { reachable: false, error: msg };
      }
      const data = (await res.json()) as {
        ok?: boolean;
        platform?: string;
        hostname?: string;
        workspaceRoot?: string;
      };
      this.lastRemoteInfo = {
        reachable: Boolean(data.ok !== false),
        platform: data.platform,
        hostname: data.hostname,
        workspaceRoot: data.workspaceRoot,
        checkedAt: new Date().toISOString(),
      };
      return {
        reachable: this.lastRemoteInfo.reachable,
        platform: data.platform,
        hostname: data.hostname,
        workspaceRoot: data.workspaceRoot,
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Agent PC Windows non joignable (${err.message}).`
          : 'Agent PC Windows non joignable.';
      this.lastRemoteInfo = { reachable: false, error: msg, checkedAt: new Date().toISOString() };
      return { reachable: false, error: msg };
    }
  }

  async proxyRequest(
    endpointPath: string,
    init: { method?: 'GET' | 'POST'; body?: unknown } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    const res = await fetch(`${this.config.url}${endpointPath}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = (payload as { error?: string }).error || `Agent local HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return payload;
  }

  async getFullStatus(): Promise<LocalAgentStatus> {
    const hostPlatform = process.platform;
    const isWindowsHost = hostPlatform === 'win32';
    const hostHostname = os.hostname();
    const hostArch = process.arch;

    const toolProbes = await Promise.all([
      probeBinary('node', ['--version']),
      probeBinary('npm', ['--version']),
      probeBinary('git', ['--version']),
      probeBinary('python3', ['--version']).then((r) =>
        r.available ? r : probeBinary('python', ['--version']),
      ),
      isWindowsHost
        ? probeBinary('powershell', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'])
        : probeBinary('bash', ['--version']),
    ]);

    if (this.config.enabled && this.config.url) {
      await this.testRemoteConnection();
    }

    const remoteReachable = Boolean(this.config.enabled && this.lastRemoteInfo?.reachable);

    let mode: LocalAgentStatus['mode'] = 'local-host';
    if (remoteReachable) {
      mode = 'remote-windows-agent';
    } else if (this.config.enabled && !remoteReachable) {
      mode = 'disconnected-cloud';
    }

    return {
      mode,
      connected: mode !== 'disconnected-cloud',
      hostPlatform,
      hostHostname,
      hostArch,
      isWindowsHost,
      remoteAgentUrl: this.config.url,
      remoteAgentReachable: remoteReachable,
      remotePlatform: this.lastRemoteInfo?.platform,
      remoteHostname: this.lastRemoteInfo?.hostname,
      remoteWorkspaceRoot: this.lastRemoteInfo?.workspaceRoot,
      lastCheckedAt: new Date().toISOString(),
      error: this.config.enabled && !remoteReachable ? this.lastRemoteInfo?.error : undefined,
      detectedTools: toolProbes,
    };
  }
}
