/**
 * YOLO Inference Service
 * Runs the trained YOLO model to predict bounding boxes on images
 */

import { spawn } from 'child_process'
import path from 'path'
import logger from '../utils/logger'

export interface PredictedBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  classLabel: string
  confidence: number
}

export interface PredictionResult {
  imageId: string
  predictions: PredictedBox[]
  inferenceTime: number
}

// Path to the trained model
const MODEL_PATH = path.join(__dirname, '../../../runs/yolo11_colab_best.pt')
const PYTHON_ENV = path.join(__dirname, '../../../yolo_env/bin/python3')

/**
 * Run YOLO inference on an image
 */
export async function predictBoxes(imagePath: string, imageId: string): Promise<PredictionResult> {
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import json
from ultralytics import YOLO

model = YOLO('${MODEL_PATH}')
results = model.predict('${imagePath}', conf=0.25, verbose=False)

predictions = []
for r in results:
    for i, box in enumerate(r.boxes):
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        name = model.names[cls]

        predictions.append({
            'id': f'pred_{i}',
            'x': x1,
            'y': y1,
            'width': x2 - x1,
            'height': y2 - y1,
            'classLabel': name,
            'confidence': conf
        })

print(json.dumps(predictions))
`

    const python = spawn(PYTHON_ENV, ['-c', pythonScript])

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    python.on('close', (code) => {
      const inferenceTime = Date.now() - startTime

      if (code !== 0) {
        logger.error(`YOLO inference failed: ${stderr}`)
        reject(new Error(`YOLO inference failed: ${stderr}`))
        return
      }

      try {
        const predictions = JSON.parse(stdout.trim())
        logger.info(`🤖 YOLO predicted ${predictions.length} boxes in ${inferenceTime}ms`)

        resolve({
          imageId,
          predictions,
          inferenceTime
        })
      } catch (e) {
        logger.error(`Failed to parse YOLO output: ${stdout}`)
        reject(new Error(`Failed to parse YOLO output: ${e}`))
      }
    })
  })
}

/**
 * Check if the YOLO model is available
 */
export async function isModelAvailable(): Promise<boolean> {
  const fs = await import('fs/promises')
  try {
    await fs.access(MODEL_PATH)
    return true
  } catch {
    return false
  }
}
