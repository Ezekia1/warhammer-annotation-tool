/**
 * Test script for bbox detection and classification pipeline
 * Tests Phases 1-3 with the hormagaunts-2.png image
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { detectAndLockCount } from './services/bboxDetector'
import { classifyBatch, groupByUnitName } from './services/cropClassifier'
import logger from './utils/logger'

// Load environment variables from parent .env file
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function testBboxPipeline() {
  console.log('🧪 Testing bbox detection and classification pipeline\n')
  console.log('=' .repeat(60))

  try {
    // Load test image
    const imagePath = path.join(__dirname, '../../test-images/hormagaunts-2.png')
    console.log(`📷 Loading test image: ${imagePath}`)

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Test image not found at: ${imagePath}`)
    }

    const imageBuffer = fs.readFileSync(imagePath)
    console.log(`   Image loaded: ${imageBuffer.length} bytes\n`)

    // PHASE 1 + 2: Detection with count-lock
    console.log('🔍 PHASE 1-2: Bbox Detection (Count Authority)')
    console.log('-'.repeat(60))
    const detections = await detectAndLockCount(imageBuffer)

    console.log(`\n✅ AUTHORITY COUNT LOCKED: ${detections.length} detections\n`)
    console.log('Detected bounding boxes:')
    detections.forEach((det, idx) => {
      console.log(`  ${idx + 1}. ID: ${det.id.substring(0, 8)}...`)
      console.log(`     Type: ${det.roughType}`)
      console.log(`     Confidence: ${(det.confidence * 100).toFixed(1)}%`)
      console.log(`     Bbox: [${det.box.x1.toFixed(0)}, ${det.box.y1.toFixed(0)}, ${det.box.x2.toFixed(0)}, ${det.box.y2.toFixed(0)}]`)
    })

    if (detections.length === 0) {
      console.log('\n⚠️ No detections found - cannot test classification')
      return
    }

    // PHASE 3: Classification
    console.log('\n🤖 PHASE 3: Per-Crop Classification')
    console.log('-'.repeat(60))
    const classifications = await classifyBatch(imageBuffer, detections)

    console.log(`\n✅ Classified ${classifications.size} crops\n`)
    console.log('Classification results:')
    classifications.forEach((cls, id) => {
      console.log(`  ${id.substring(0, 8)}... → ${cls.name} (${cls.faction})`)
      console.log(`     Confidence: ${(cls.confidence * 100).toFixed(1)}%`)
      console.log(`     Needs triangulation: ${cls.needsTriangulation}`)
    })

    // AGGREGATION: Group by unit name
    console.log('\n📊 FINAL AGGREGATION')
    console.log('-'.repeat(60))
    const grouped = groupByUnitName(Array.from(classifications.values()))

    console.log('\nUnit counts:')
    let totalCount = 0
    grouped.forEach((group, unitName) => {
      const count = group.ids.length
      const avgConfidence = group.confidences.reduce((a, b) => a + b, 0) / group.confidences.length
      totalCount += count

      console.log(`  ${unitName} (${group.faction}): ${count}`)
      console.log(`     Avg confidence: ${(avgConfidence * 100).toFixed(1)}%`)
      console.log(`     IDs: ${group.ids.map(id => id.substring(0, 8)).join(', ')}`)
    })

    console.log(`\n📈 Total count: ${totalCount}`)
    console.log(`   Authority count: ${detections.length}`)
    console.log(`   Count integrity: ${totalCount === detections.length ? '✅ MAINTAINED' : '❌ VIOLATED'}`)

    // VERIFICATION
    console.log('\n' + '='.repeat(60))
    console.log('📋 VERIFICATION CHECKLIST')
    console.log('='.repeat(60))

    const expectedCount = 2  // hormagaunts-2.png has 2 miniatures
    const countCorrect = detections.length === expectedCount
    const countIntact = totalCount === detections.length
    const allClassified = classifications.size === detections.length

    console.log(`✓ Expected count (2): ${countCorrect ? '✅ PASS' : `❌ FAIL (got ${detections.length})`}`)
    console.log(`✓ Count authority maintained: ${countIntact ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`✓ All detections classified: ${allClassified ? '✅ PASS' : '❌ FAIL'}`)

    const hasTyranids = Array.from(grouped.keys()).some(name => {
      const group = grouped.get(name)!
      return group.faction.toLowerCase().includes('tyranid')
    })
    console.log(`✓ Identified as Tyranids: ${hasTyranids ? '✅ PASS' : '⚠️ CHECK RESULTS'}`)

    console.log('\n' + '='.repeat(60))
    if (countCorrect && countIntact && allClassified) {
      console.log('🎉 ALL TESTS PASSED - Bbox pipeline working correctly!')
    } else {
      console.log('⚠️ SOME TESTS FAILED - Review results above')
    }
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Test failed with error:')
    console.error(error)
    process.exit(1)
  }
}

// Run test
testBboxPipeline()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
