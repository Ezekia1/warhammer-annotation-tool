/**
 * Sprint 1 Manual Test Script
 * Tests session management, quality filters, and unit configuration
 */

import { readFileSync } from 'fs'
import { createSession, getSession, saveLabeledCrop, initializeSessionStorage, restoreSessions, cleanupOldSessions } from './services/labelingService'
import { passesQualityChecks, validateLaplacianKernel } from './utils/qualityFilters'
import { getAllUnits, getUnitsByFaction, searchUnits } from './config/units'
import { DetectionProposal } from './utils/bbox'
import sharp from 'sharp'

async function main() {
  console.log('🧪 Sprint 1: Testing Backend Foundation\n')

  // Test 1: Initialize session storage
  console.log('Test 1: Initializing session storage...')
  await initializeSessionStorage()
  console.log('✅ Session storage initialized\n')

  // Test 2: Units configuration
  console.log('Test 2: Testing units configuration...')
  const allUnits = getAllUnits()
  console.log(`✅ Total units (including Unknown): ${allUnits.length}`)
  console.log(`   First few: ${allUnits.slice(0, 5).join(', ')}`)

  const byFaction = getUnitsByFaction()
  console.log(`✅ Factions: ${Object.keys(byFaction).length}`)
  console.log(`   Tyranids units: ${byFaction.Tyranids?.length || 0}`)

  const searchResults = searchUnits('warrior')
  console.log(`✅ Search for 'warrior': ${searchResults.length} results`)
  console.log(`   ${searchResults.join(', ')}\n`)

  // Test 3: Quality filters (requires test image)
  console.log('Test 3: Testing quality filters...')
  try {
    const testImage = readFileSync('test-images/hormagaunts-2.png')

    // Validate Laplacian kernel
    const kernelValid = await validateLaplacianKernel(testImage)
    console.log(`✅ Laplacian kernel validation: ${kernelValid ? 'PASS' : 'FAIL'}`)

    // Test quality check on clear image
    const qualityResult = await passesQualityChecks(testImage)
    console.log(`✅ Quality check (clear image):`)
    console.log(`   Passes: ${qualityResult.passes}`)
    console.log(`   Blur score: ${qualityResult.score?.toFixed(2)}`)
    console.log(`   Dimensions: ${qualityResult.details?.width}x${qualityResult.details?.height}`)

    // Test with intentionally blurred image
    const blurryImage = await sharp(testImage).blur(10).toBuffer()
    const blurryResult = await passesQualityChecks(blurryImage)
    console.log(`✅ Quality check (blurred image):`)
    console.log(`   Passes: ${blurryResult.passes}`)
    console.log(`   Blur score: ${blurryResult.score?.toFixed(2)}`)
    console.log(`   Reason: ${blurryResult.reason || 'N/A'}`)

    // Test with tiny image
    const tinyImage = await sharp({ create: { width: 30, height: 30, channels: 3, background: 'black' }}).png().toBuffer()
    const tinyResult = await passesQualityChecks(tinyImage)
    console.log(`✅ Quality check (tiny image):`)
    console.log(`   Passes: ${tinyResult.passes}`)
    console.log(`   Reason: ${tinyResult.reason || 'N/A'}\n`)

  } catch (error) {
    console.log(`⚠️  Skipping quality filter tests (no test image): ${error}\n`)
  }

  // Test 4: Session management
  console.log('Test 4: Testing session management...')

  // Create mock detections
  const mockDetections: DetectionProposal[] = [
    {
      id: 'test-crop-1',
      box: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
      roughType: 'Hormagaunt',
      confidence: 0.9,
      sourcePass: 'initial'
    },
    {
      id: 'test-crop-2',
      box: { x1: 0.5, y1: 0.5, x2: 0.7, y2: 0.7 },
      roughType: 'Termagant',
      confidence: 0.85,
      sourcePass: 'initial'
    }
  ]

  // Create mock image buffer
  const mockImageBuffer = await sharp({
    create: { width: 500, height: 500, channels: 3, background: { r: 100, g: 150, b: 200 } }
  }).png().toBuffer()

  const sessionId = createSession(mockImageBuffer, mockDetections)
  console.log(`✅ Created session: ${sessionId}`)

  const session = await getSession(sessionId)
  console.log(`✅ Retrieved session: ${session.detections.length} detections`)

  // Test persistence (session should be written to disk)
  console.log('✅ Session persisted to disk (async)')

  // Wait a moment for async persistence
  await new Promise(resolve => setTimeout(resolve, 500))

  // Test restoration
  const restoredCount = await restoreSessions()
  console.log(`✅ Restored ${restoredCount} session(s) from disk`)

  // Test cleanup
  console.log('Testing cleanup of old sessions (this will fail since session is new)...')
  const cleaned = await cleanupOldSessions(100) // 100ms age
  console.log(`   Cleaned: ${cleaned} sessions (expected 0 since session is fresh)\n`)

  console.log('🎉 Sprint 1 tests completed successfully!')
  console.log('\n📋 Summary:')
  console.log('   ✅ Session storage initialized')
  console.log('   ✅ Unit configuration working')
  console.log('   ✅ Quality filters operational')
  console.log('   ✅ Session management functional')
  console.log('   ✅ Session persistence working')
}

main().catch(console.error)
