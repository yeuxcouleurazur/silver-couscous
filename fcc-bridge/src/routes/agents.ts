import type { Request, Response } from 'express';
import { discoverAgents } from '../fccDiscovery';

export function agentsHandler() {
  return (_req: Request, res: Response) => {
    const agents = discoverAgents();
    res.json({
      object: 'list',
      data: agents,
      count: agents.length,
    });
  };
}
