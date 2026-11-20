import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { loadConfig } from './config';
import { registerRoutes } from './routes';

dotenv.config();

const config = loadConfig();

const app = express();

// ---- CORS: disabled by default (localhost-only). Opt-in via ENABLE_NETWORK. ----
if (config.corsEnabled && config.corsAllowedOrigins.length > 0) {
  app.use(
    cors({
      origin: config.corsAllowedOrigins,
      credentials: false,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept'],
    }),
  );
}

// ---- Localhost-only enforcement ----
if (!config.exposeNetwork && !config.isLocalhostOnly) {
  // BIND_HOST was set to something non-localhost without ENABLE_NETWORK: still
  // bind, but flag it clearly in logs (operator explicitly chose it).
  console.warn(
    `[fcc-bridge] WARNING: bound to non-localhost host ${config.bindHost} without ENABLE_NETWORK=true.`,
  );
}

app.use(express.json({ limit: '4mb' }));

// Health with no auth, everything else is the bridge API.
registerRoutes(app, config);

const server = app.listen(config.port, config.bindHost, () => {
  console.log(
    `[fcc-bridge] Listening on http://${config.bindHost}:${config.port} | ` +
      `FCC=${config.fccBaseUrl} | mode=${config.defaultPermissionMode} | ` +
      `localhostOnly=${config.isLocalhostOnly} | networkExposed=${config.exposeNetwork}`,
  );
});

server.on('error', (err: NodeJS.ErrnoException) => {
  console.error('[fcc-bridge] Server error:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err: unknown) => {
  console.error('[fcc-bridge] Unhandled rejection:', err instanceof Error ? err.message : String(err));
});

export { app, config };
