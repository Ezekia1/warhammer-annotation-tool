/**
 * Integration Test for Full Bbox-Based Analysis Pipeline
 *
 * Tests the complete orchestration including:
 * - PASS 1: Detection with optional clump separation
 * - PASS 2: Classification
 * - PASS 3: Triangulation (if needed)
 * - Final aggregation and count integrity
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { analyzeBboxBased } from './services/bboxAnalyzer'
import logger from './utils/logger'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function testFullPipeline() {
  console.log('🧪 Testing FULL bbox-based analysis pipeline\n')
  console.log('=' .repeat(70))

  try {
    // Load test image
    const imagePath = path.join(__dirname, '../../test-images/hormagaunts-2.png')
    console.log(`📷 Loading test image: ${imagePath}`)

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Test image not found at: ${imagePath}`)
    }

    const imageBuffer = fs.readFileSync(imagePath)
    console.log(`   Image loaded: ${imageBuffer.length} bytes\n`)

    // Run full pipeline
    console.log('🚀 Running full analysis pipeline...\n')
    const result = await analyzeBboxBased(imageBuffer)

    // Display results
    console.log('\n' + '='.repeat(70))
    console.log('📊 ANALYSIS RESULTS')
    console.log('='.repeat(70))

    console.log(`\n📈 Detection Phase:`)
    console.log(`   Authority Count: ${result.detectionCount}`)
    console.log(`   Clump Separation: ${result.clumpSeparationTriggered ? '✅ YES' : '⏭️ NO'}`)

    console.log(`\n🤖 Classification Phase:`)
    console.log(`   Triangulation: ${result.triangulationCount > 0 ? `✅ ${result.triangulationCount} crops` : '⏭️ Not needed'}`)

    console.log(`\n🎯 Final Results:`)
    console.log(`   Total Miniatures: ${result.totalCount}`)
    console.log(`   Unique Units: ${result.models.length}`)
    console.log(`   Processing Time: ${result.processingTimeMs}ms`)

    console.log(`\n📋 Unit Breakdown:`)
    for (const model of result.models) {
      console.log(`   - ${model.name} (${model.faction}): ${model.count}`)
      console.log(`     Confidence: ${(model.confidence * 100).toFixed(1)}%`)
    }

    // Verification
    console.log('\n' + '='.repeat(70))
    console.log('📋 VERIFICATION CHECKLIST')
    console.log('='.repeat(70))

    const expectedCount = 2  // hormagaunts-2.png has 2 miniatures
    const countCorrect = result.detectionCount === expectedCount
    const countIntact = result.totalCount === result.detectionCount
    const hasResults = result.models.length > 0

    console.log(`✓ Expected detection count (2): ${countCorrect ? '✅ PASS' : `❌ FAIL (got ${result.detectionCount})`}`)
    console.log(`✓ Count integrity maintained: ${countIntact ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`✓ Models identified: ${hasResults ? '✅ PASS' : '❌ FAIL'}`)

    const hasTyranids = result.models.some(m => m.faction.toLowerCase().includes('tyranid'))
    console.log(`✓ Identified as Tyranids: ${hasTyranids ? '✅ PASS' : '⚠️ CHECK RESULTS'}`)

    // Count integrity check
    const aggregatedCount = result.models.reduce((sum, m) => sum + m.count, 0)
    const aggregationCorrect = aggregatedCount === result.totalCount
    console.log(`✓ Aggregation count matches: ${aggregationCorrect ? '✅ PASS' : '❌ FAIL'}`)

    console.log('\n' + '='.repeat(70))
    if (countCorrect && countIntact && hasResults && aggregationCorrect) {
      console.log('🎉 ALL TESTS PASSED - Full pipeline working correctly!')
    } else {
      console.log('⚠️ SOME TESTS FAILED - Review results above')
    }
    console.log('='.repeat(70))

    // Additional diagnostics
    console.log('\n📊 PIPELINE DIAGNOSTICS:')
    console.log(`   Raw Detections → Deduplication: (tracked internally)`)
    console.log(`   Authority Count: ${result.detectionCount}`)
    console.log(`   Classifications: ${result.totalCount}`)
    console.log(`   Aggregated Count: ${aggregatedCount}`)
    console.log(`   Count Integrity: ${result.detectionCount === result.totalCount && result.totalCount === aggregatedCount ? '✅ PERFECT' : '❌ BROKEN'}`)

    if (result.clumpSeparationTriggered) {
      console.log(`\n🔬 Clump Separation Details:`)
      console.log(`   Triggered: YES`)
      console.log(`   This means dense regions were re-tiled for finer detection`)
    }

    if (result.triangulationCount > 0) {
      console.log(`\n🔬 Triangulation Details:`)
      console.log(`   Ambiguous crops: ${result.triangulationCount}`)
      console.log(`   These had low confidence and got a second opinion`)
    }

    console.log('\n✅ Integration test completed\n')

  } catch (error) {
    console.error('\n❌ Test failed with error:')
    console.error(error)
    process.exit(1)
  }
}

// Run test
testFullPipeline()
  .then(() => {
    console.log('✅ Full pipeline test completed successfully')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Full pipeline test failed:', error)
    process.exit(1)
  })
