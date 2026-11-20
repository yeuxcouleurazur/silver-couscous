import type { Request, Response } from 'express';
import type { BridgeConfig } from '../config';
import { discoverModels } from '../fccDiscovery';
import { getCachedModelIds, invalidateModelCache } from './modelsCache';

export function modelsHandler(config: BridgeConfig) {
  return async (_req: Request, res: Response) => {
    try {
      const models = await discoverModels(config.fccBaseUrl);
      invalidateModelCache();
      res.json({
        object: 'list',
        data: models,
        first_id: models[0]?.id ?? null,
        has_more: false,
        last_id: models[models.length - 1]?.id ?? null,
      });
    } catch (err) {
      res.status(502).json({
        error: `Unable to reach FCC models endpoint: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };
}

export { getCachedModelIds };
