// CRITICAL: Load .env FIRST, before any other imports!
import dotenv from 'dotenv'
import path from 'path'

const envPath = path.join(process.cwd(), '../.env')
console.log(`[DOTENV] Loading from: ${envPath}`)
const result = dotenv.config({ path: envPath })
if (result.error) {
  console.error(`[DOTENV] ERROR:`, result.error)
} else {
  console.log(`[DOTENV] Loaded successfully`)
}

// Now import everything else
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { promises as fs } from 'fs'
import { addRequestId } from './middleware/requestId'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import logger, { createRequestLogger } from './utils/logger'
import { annotationService } from './services/annotationService'

const app = express()
const port = process.env.PORT || 3001

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════

app.set('trust proxy', 1)
app.use(cors())
app.use(addRequestId)

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)
  log.info(`📥 ${req.method} ${req.path}`)
  next()
})

// Body parsers
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ limit: '100kb', extended: true }))

// ═══════════════════════════════════════════════════════════
// ANNOTATION ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/annotate/images
 *
 * Get list of all images with annotation status
 */
app.get('/api/annotate/images', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)

  try {
    log.info(`📋 Get image list`)

    const includeDetails = req.query.details === 'true'
    const images = await annotationService.getImageList(includeDetails)

    log.info(`✅ Retrieved ${images.length} images`)

    res.json({
      success: true,
      data: {
        images,
        totalCount: images.length
      },
      requestId
    })
  } catch (error: any) {
    log.error(`🔴 Failed to get image list: ${error.message}`)
    next(error)
  }
})

/**
 * GET /api/annotate/next
 *
 * Get next unannotated image
 */
app.get('/api/annotate/next', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)

  try {
    log.info(`📷 Get next unannotated image`)

    const image = await annotationService.getNextImage()

    if (!image) {
      log.info(`✅ No more images to annotate`)
      return res.json({
        success: true,
        data: {
          image: null,
          message: 'All images have been annotated!'
        },
        requestId
      })
    }

    log.info(`✅ Next image: ${image.imageId}`)

    res.json({
      success: true,
      data: {
        image
      },
      requestId
    })
  } catch (error: any) {
    log.error(`🔴 Failed to get next image: ${error.message}`)
    next(error)
  }
})

/**
 * GET /api/annotate/image/:imageId
 *
 * Get image data (as base64) and existing annotation
 */
app.get('/api/annotate/image/:imageId', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)

  try {
    const { imageId } = req.params
    log.info(`📷 Get image data: ${imageId}`)

    // Get image from list
    const images = await annotationService.getImageList(true)
    const image = images.find(img => img.imageId === imageId)

    if (!image) {
      log.error(`🔴 Image not found: ${imageId}`)
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Image not found'
        },
        requestId
      })
    }

    // Read image as base64
    const imageBuffer = await fs.readFile(image.imagePath)
    const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`

    // Get dimensions
    const sharp = await import('sharp')
    const metadata = await sharp.default(image.imagePath).metadata()

    // Get existing annotation if any
    const annotation = await annotationService.getAnnotation(imageId)

    log.info(`✅ Image data loaded: ${imageId}`)

    res.json({
      success: true,
      data: {
        image: {
          ...image,
          imageBase64,
          width: metadata.width || 0,
          height: metadata.height || 0
        },
        annotation
      },
      requestId
    })
  } catch (error: any) {
    log.error(`🔴 Failed to get image data: ${error.message}`)
    next(error)
  }
})

/**
 * POST /api/annotate/save
 *
 * Save annotation for an image
 */
app.post('/api/annotate/save', express.json(), async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)

  try {
    log.info(`💾 Save annotation`)

    const annotation = req.body

    // Validate required fields
    if (!annotation.imageId || !annotation.imagePath) {
      log.error(`🔴 Missing required fields`)
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: imageId, imagePath'
        },
        requestId
      })
    }

    // Run quality checks
    const issues = await annotationService.validateAnnotation(annotation)
    const errors = issues.filter(i => i.type === 'error')
    const warnings = issues.filter(i => i.type === 'warning')

    // Block on errors
    if (errors.length > 0) {
      log.error(`🔴 Annotation has ${errors.length} quality errors`)
      return res.status(400).json({
        success: false,
        errors,
        warnings,
        message: 'Cannot save: annotation has quality errors',
        requestId
      })
    }

    // Save annotation
    await annotationService.saveAnnotation(annotation)

    log.info(`✅ Annotation saved: ${annotation.imageId}${warnings.length > 0 ? ` (${warnings.length} warnings)` : ''}`)

    res.json({
      success: true,
      warnings,  // Return warnings but allow save
      data: {
        imageId: annotation.imageId,
        annotationCount: annotation.annotations?.length || 0
      },
      requestId
    })
  } catch (error: any) {
    log.error(`🔴 Failed to save annotation: ${error.message}`)
    next(error)
  }
})

/**
 * GET /api/annotate/progress
 *
 * Get annotation progress statistics
 */
app.get('/api/annotate/progress', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)

  try {
    log.info(`📊 Get annotation progress`)

    const progress = await annotationService.getProgress()

    log.info(`✅ Progress: ${progress.annotatedImages}/${progress.totalImages} (${progress.percentComplete.toFixed(2)}%)`)

    res.json({
      success: true,
      data: {
        progress
      },
      requestId
    })
  } catch (error: any) {
    log.error(`🔴 Failed to get progress: ${error.message}`)
    next(error)
  }
})

/**
 * POST /api/annotate/validate-export
 *
 * Validate all annotations before export
 * Returns summary of errors/warnings across dataset
 */
app.post('/api/annotate/validate-export', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)

  try {
    log.info(`🔍 Validate dataset for export`)

    const validationResult = await annotationService.validateAllAnnotations()

    const hasErrors = validationResult.invalidAnnotations > 0

    if (hasErrors) {
      log.warn(`⚠️  Dataset validation found ${validationResult.totalErrors} errors in ${validationResult.invalidAnnotations} annotations`)
    } else {
      log.info(`✅ Dataset validation passed (${validationResult.totalWarnings} warnings)`)
    }

    res.json({
      success: true,
      data: {
        validation: validationResult,
        readyForExport: !hasErrors
      },
      requestId
    })
  } catch (error: any) {
    log.error(`🔴 Validation failed: ${error.message}`)
    next(error)
  }
})

/**
 * POST /api/annotate/export
 *
 * Export annotations to YOLOv8-pose format
 * Runs validation first and blocks if errors found
 */
app.post('/api/annotate/export', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id
  const log = createRequestLogger(requestId)

  try {
    log.info(`📦 Export to YOLO format`)

    // Run validation first
    log.info(`🔍 Running pre-export validation...`)
    const validationResult = await annotationService.validateAllAnnotations()

    // Block if errors found
    if (validationResult.invalidAnnotations > 0) {
      log.error(`🔴 Export blocked: ${validationResult.totalErrors} errors in ${validationResult.invalidAnnotations} annotations`)
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: `Cannot export: ${validationResult.totalErrors} validation errors found in ${validationResult.invalidAnnotations} annotations`
        },
        validation: validationResult,
        requestId
      })
    }

    // Validation passed, proceed with export
    if (validationResult.totalWarnings > 0) {
      log.warn(`⚠️  Export proceeding with ${validationResult.totalWarnings} warnings`)
    }

    const { outputDir = 'backend/yolo_dataset', trainSplit = 0.8 } = req.body

    const result = await annotationService.exportToYOLO(outputDir, trainSplit)

    log.info(`✅ Exported ${result.trainImages + result.valImages} annotations`)

    res.json({
      success: true,
      data: {
        export: result,
        validation: {
          totalAnnotations: validationResult.totalAnnotations,
          validAnnotations: validationResult.validAnnotations,
          totalWarnings: validationResult.totalWarnings
        }
      },
      requestId
    })
  } catch (error: any) {
    log.error(`🔴 Export failed: ${error.message}`)
    next(error)
  }
})

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════

app.use(notFoundHandler)
app.use(errorHandler)

// ═══════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════

;(async () => {
  try {
    // Initialize annotation service
    logger.info(`📝 Initializing annotation service...`)
    await annotationService.initialize()
    logger.info(`✅ Annotation service initialized`)

    // Start server
    app.listen(port, () => {
      logger.info(`═══════════════════════════════════════`)
      logger.info(`🚀 Server Started Successfully`)
      logger.info(`═══════════════════════════════════════`)
      logger.info(`Port: ${port}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
      logger.info(`Frontend: http://localhost:5173`)
      logger.info(`Backend: http://localhost:${port}`)
      logger.info(`Logs directory: ${path.join(process.cwd(), 'logs')}`)
      logger.info(`═══════════════════════════════════════`)
    })
  } catch (error) {
    logger.error(`🔴 Failed to start server: ${error}`)
    process.exit(1)
  }
})()
