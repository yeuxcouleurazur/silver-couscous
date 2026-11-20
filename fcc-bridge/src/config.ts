import dotenv from 'dotenv';

dotenv.config();

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v.trim().length > 0 ? v.trim() : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v.trim().length === 0) return fallback;
  return /^(true|1|yes|on)$/i.test(v.trim());
}

function envCsv(name: string): string[] {
  const v = process.env[name];
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export interface BridgeConfig {
  port: number;
  bindHost: string;
  exposeNetwork: boolean;
  fccBaseUrl: string;
  fccProxyAuthEnabled: boolean;
  fccProxyAuthToken: string;
  defaultPermissionMode: 'plan' | 'manual' | 'auto-edit';
  workspacePath: string | null;
  corsEnabled: boolean;
  corsAllowedOrigins: string[];
  logLevel: string;
  isLocalhostOnly: boolean;
}

export function loadConfig(): BridgeConfig {
  const bindHost = env('BIND_HOST', '127.0.0.1');
  const exposeNetwork = envBool('ENABLE_NETWORK', false);

  // Localhost-only by default. Network exposure is opt-in and must be
  // explicitly requested; binding to 0.0.0.0 without ENABLE_NETWORK=true is
  // still honoured as-is (the operator chose it), but we flag isLocalhostOnly.
  const effectiveHost = exposeNetwork ? '0.0.0.0' : bindHost;

  const rawMode = env('DEFAULT_PERMISSION_MODE', 'manual');
  const permissionMode =
    rawMode === 'plan' || rawMode === 'manual' || rawMode === 'auto-edit'
      ? rawMode
      : 'manual';

  return {
    port: Number(env('PORT', '8787')) || 8787,
    bindHost: effectiveHost,
    exposeNetwork,
    fccBaseUrl: env('FCC_BASE_URL', 'http://127.0.0.1:8082').replace(/\/$/, ''),
    fccProxyAuthEnabled: envBool('FCC_PROXY_AUTH_ENABLED', false),
    fccProxyAuthToken: env('FCC_PROXY_AUTH_TOKEN', 'freecc'),
    defaultPermissionMode: permissionMode,
    workspacePath: env('WORKSPACE_PATH', '') || null,
    corsEnabled: envBool('CORS_ENABLED', false),
    corsAllowedOrigins: envCsv('CORS_ALLOWED_ORIGINS'),
    logLevel: env('LOG_LEVEL', 'info'),
    isLocalhostOnly: !exposeNetwork && /^(127\.0\.0\.1|localhost|::1)$/.test(effectiveHost),
  };
}
