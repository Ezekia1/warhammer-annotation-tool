import winston from 'winston'
import path from 'path'

// Create logs directory path (will be created automatically by winston)
const logsDir = path.join(process.cwd(), 'logs')

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, requestId }) => {
  const prefix = requestId ? `[${requestId}] ` : ''
  return `${timestamp} ${level.toUpperCase()}: ${prefix}${message}`
})

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console output (colorized)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    // File output - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'all.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File output - errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
})

/**
 * Logger wrapper that adds request ID context
 */
export function createRequestLogger(requestId?: string) {
  return {
    info: (message: string) => logger.info(message, { requestId }),
    error: (message: string, error?: any) => {
      if (error) {
        logger.error(`${message}\n${error.stack || error}`, { requestId })
      } else {
        logger.error(message, { requestId })
      }
    },
    warn: (message: string) => logger.warn(message, { requestId }),
    debug: (message: string) => logger.debug(message, { requestId }),
  }
}

export default logger
