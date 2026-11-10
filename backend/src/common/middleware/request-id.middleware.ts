import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { requestId: string };

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Always generate: a client-supplied id must not flow into audit logs.
  const id = randomUUID();
  (req as RequestWithId).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
