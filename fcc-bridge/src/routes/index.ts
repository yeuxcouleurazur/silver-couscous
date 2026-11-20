import type { Application } from 'express';
import type { BridgeConfig } from '../config';
import { healthHandler } from './health';
import { modelsHandler } from './models';
import { toolsHandler } from './tools';
import { skillsHandler } from './skills';
import { mcpHandler } from './mcp';
import { agentsHandler } from './agents';
import { streamHandler, abortHandler } from './stream';

export function registerRoutes(app: Application, config: BridgeConfig): void {
  app.get('/v1/health', healthHandler(config));
  app.get('/v1/models', modelsHandler(config));
  app.get('/v1/tools', toolsHandler(config));
  app.get('/v1/skills', skillsHandler());
  app.get('/v1/mcp', mcpHandler());
  app.get('/v1/agents', agentsHandler());
  app.post('/v1/claude/stream', streamHandler(config));
  app.post('/v1/abort/:conversationId', abortHandler());
}
