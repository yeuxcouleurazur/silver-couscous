import type { Request, Response } from 'express';
import { discoverMcpServers } from '../fccDiscovery';

export function mcpHandler() {
  return (_req: Request, res: Response) => {
    const servers = discoverMcpServers();
    res.json({
      object: 'list',
      data: servers,
      count: servers.length,
    });
  };
}
