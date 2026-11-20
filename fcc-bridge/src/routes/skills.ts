import type { Request, Response } from 'express';
import { discoverSkills } from '../fccDiscovery';

export function skillsHandler() {
  return (_req: Request, res: Response) => {
    const skills = discoverSkills();
    res.json({
      object: 'list',
      data: skills,
      count: skills.length,
    });
  };
}
