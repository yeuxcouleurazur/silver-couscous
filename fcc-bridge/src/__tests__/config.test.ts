import { describe, it, expect } from '@jest/globals';
import { loadConfig } from '../config';

describe('loadConfig', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.PORT;
    delete process.env.BIND_HOST;
    delete process.env.ENABLE_NETWORK;
    delete process.env.FCC_BASE_URL;
    delete process.env.DEFAULT_PERMISSION_MODE;
    delete process.env.WORKSPACE_PATH;
    delete process.env.CORS_ENABLED;
  });

  afterAll(() => {
    process.env = origEnv;
  });

  it('returns defaults when no env vars set', () => {
    const c = loadConfig();
    expect(c.port).toBe(8787);
    expect(c.bindHost).toBe('127.0.0.1');
    expect(c.exposeNetwork).toBe(false);
    expect(c.fccBaseUrl).toBe('http://127.0.0.1:8082');
    expect(c.defaultPermissionMode).toBe('manual');
    expect(c.workspacePath).toBe(null);
    expect(c.corsEnabled).toBe(false);
    expect(c.isLocalhostOnly).toBe(true);
  });

  it('honors PORT and BIND_HOST', () => {
    process.env.PORT = '9999';
    process.env.BIND_HOST = '0.0.0.0';
    const c = loadConfig();
    expect(c.port).toBe(9999);
    expect(c.bindHost).toBe('0.0.0.0');
  });

  it('requires ENABLE_NETWORK=true to expose network', () => {
    process.env.BIND_HOST = '0.0.0.0';
    let c = loadConfig();
    expect(c.exposeNetwork).toBe(false);
    // BIND_HOST is honoured as-is even without ENABLE_NETWORK (operator chose it);
    // only isLocalhostOnly flips to false and a warning is logged.
    expect(c.bindHost).toBe('0.0.0.0');
    expect(c.isLocalhostOnly).toBe(false);

    process.env.ENABLE_NETWORK = 'true';
    c = loadConfig();
    expect(c.exposeNetwork).toBe(true);
    expect(c.bindHost).toBe('0.0.0.0');
    expect(c.isLocalhostOnly).toBe(false);
  });

  it('validates permission mode', () => {
    process.env.DEFAULT_PERMISSION_MODE = 'plan';
    expect(loadConfig().defaultPermissionMode).toBe('plan');

    process.env.DEFAULT_PERMISSION_MODE = 'auto-edit';
    expect(loadConfig().defaultPermissionMode).toBe('auto-edit');

    process.env.DEFAULT_PERMISSION_MODE = 'invalid';
    expect(loadConfig().defaultPermissionMode).toBe('manual');
  });

  it('strips trailing slash from FCC_BASE_URL', () => {
    process.env.FCC_BASE_URL = 'http://127.0.0.1:8082/';
    expect(loadConfig().fccBaseUrl).toBe('http://127.0.0.1:8082');
  });

  it('sets workspacePath from env', () => {
    process.env.WORKSPACE_PATH = '/my/workspace';
    expect(loadConfig().workspacePath).toBe('/my/workspace');
  });
});
