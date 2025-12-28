import { Request, Response, NextFunction } from 'express'
import { MulterError } from 'multer'
import { createRequestLogger } from '../utils/logger'

/**
 * Comprehensive error handler that:
 * 1. Logs full error details to console
 * 2. Returns clean JSON response with request ID
 * 3. Includes stack trace in development
 * 4. Handles Multer-specific errors with proper status codes
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req as any).id || 'unknown'
  const isDev = process.env.NODE_ENV !== 'production'
  const log = createRequestLogger(requestId)

  // Log full error details
  log.error('═══════════════════════════════════════')
  log.error('❌ ERROR CAUGHT BY ERROR HANDLER')
  log.error('═══════════════════════════════════════')
  log.error(`Path: ${req.method} ${req.path}`)
  log.error(`Error Name: ${err.name}`)
  log.error(`Error Message: ${err.message}`)
  log.error(`Error Type: ${err.constructor.name}`)

  if (isDev && err.stack) {
    log.error('Stack Trace:', err)
  }

  log.error('═══════════════════════════════════════')

  // Handle Multer-specific errors
  if (err instanceof MulterError) {
    log.error(`🔴 MULTER ERROR DETECTED: ${err.code}`)

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE',
        requestId,
      })
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field. Expected field name: "image"',
        code: 'UNEXPECTED_FIELD',
        requestId,
      })
    }

    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      code: err.code,
      requestId,
    })
  }

  // Handle CORS errors
  if (err.message === 'CORS_BLOCKED') {
    log.error('🔴 CORS ERROR DETECTED')
    return res.status(403).json({
      success: false,
      error: `Origin '${req.headers.origin}' not allowed by CORS policy`,
      code: 'CORS_BLOCKED',
      requestId,
    })
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500

  return res.status(statusCode).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    requestId,
    ...(isDev && err.stack ? { stack: err.stack.split('\n').slice(0, 5) } : {}),
  })
}

/**
 * Handle 404 - Route not found
 */
export function notFoundHandler(req: Request, res: Response) {
  const requestId = (req as any).id || 'unknown'
  const log = createRequestLogger(requestId)

  log.error('═══════════════════════════════════════')
  log.error('❌ 404 NOT FOUND')
  log.error('═══════════════════════════════════════')
  log.error(`Path: ${req.method} ${req.path}`)
  log.error('═══════════════════════════════════════')

  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
    requestId,
  })
}
