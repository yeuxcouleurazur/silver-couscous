import type { Request, Response } from 'express';
import type { BridgeConfig } from '../config';
import { loadConfig } from '../config';

export function healthHandler(config: BridgeConfig) {
  return (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'fcc-bridge',
      port: config.port,
      localhostOnly: config.isLocalhostOnly,
      fccBaseUrl: config.fccBaseUrl,
      permissionMode: config.defaultPermissionMode,
      networkExposed: config.exposeNetwork,
    });
  };
}
