import type { Request, Response } from 'express';
import type { BridgeConfig } from '../config';
import { createToolManager } from '../toolManager';
import type { ToolSettings } from '../types';

export function toolsHandler(config: BridgeConfig) {
  return async (_req: Request, res: Response) => {
    const mode = (_req.query.permissionMode as any) || config.defaultPermissionMode;
    const settings: ToolSettings = {
      webSearch: (_req.query.webSearch as any) === 'true',
      extendedThinking: (_req.query.extendedThinking as any) === 'true',
      artifacts: (_req.query.artifacts as any) === 'true',
      responseStyle: 'normal',
    };
    const effort = (_req.query.effort as any) || undefined;
    const tm = createToolManager(mode, settings, effort);
    res.json({
      mode: tm.mode,
      effort: tm.effort,
      tools: tm.availableTools(),
      discovery: tm.discover(),
    });
  };
}
