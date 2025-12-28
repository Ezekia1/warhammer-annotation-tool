import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

/**
 * Adds unique request ID to every request for tracking and debugging.
 * Honors upstream X-Request-ID if present (from load balancer/proxy).
 */
export function addRequestId(req: Request, res: Response, next: NextFunction) {
  // Use upstream request ID if present, otherwise generate new one
  const requestId = (req.headers['x-request-id'] as string) || uuidv4()

  // Attach to request object
  ;(req as any).id = requestId

  // Return in response headers
  res.setHeader('X-Request-ID', requestId)

  next()
}
