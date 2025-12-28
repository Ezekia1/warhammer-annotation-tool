# Sprint 1 Testing Guide

## Quick Test

Run the automated test script:

```bash
cd /home/sinan/photoanalyzer/backend
./test-sprint1.sh
```

## What Gets Tested

### ✅ Session Management
- Creates a new session with mock data
- Saves session to `.sessions/` directory as JSON
- Retrieves session from memory
- Restores session from disk after "restart"
- Cleans up old sessions (>100ms old in test)

### ✅ Units Configuration
- Loads 178 total units (177 + Unknown/Other)
- Tests 8 factions: Tyranids, Space Marines, Necrons, Tau, Orks, Aeldari, Chaos, Imperial Guard
- Tests search functionality ("warrior" finds 5 units)

### ✅ Quality Filters
- Validates Laplacian blur detection kernel
- Tests with clear image (should pass)
- Tests with blurred image (should fail blur check)
- Tests with tiny image (should fail size check)

**Note**: Quality filter tests require test image at `test-images/hormagaunts-2.png`

## Manual Testing

### Test 1: Session Persistence Across "Restarts"

```bash
cd /home/sinan/photoanalyzer/backend

# Run test once
npx tsx src/test-sprint1.ts

# Check that session file was created
ls -la .sessions/

# Run test again - it should restore the session
npx tsx src/test-sprint1.ts
```

**Expected**: You should see a message like "Restored 1 sessions from disk"

### Test 2: Quality Filters with Real Image

```bash
cd /home/sinan/photoanalyzer/backend

# Test with a real Warhammer image
npx tsx -e "
import { passesQualityChecks } from './src/utils/qualityFilters'
import { readFileSync } from 'fs'

const image = readFileSync('../test-images/hormagaunts-2.png')
const result = await passesQualityChecks(image)
console.log('Quality check result:', result)
"
```

**Expected**:
```
Quality check result: {
  passes: true,
  score: 150-300 (blur score),
  details: { width: 500+, height: 300+, blurScore: 150-300 }
}
```

### Test 3: Unit Search

```bash
cd /home/sinan/photoanalyzer/backend

npx tsx -e "
import { searchUnits, getAllUnits } from './src/config/units'

console.log('Total units:', getAllUnits().length)
console.log('Search \"marine\":', searchUnits('marine'))
console.log('Search \"tyranid\":', searchUnits('tyranid'))
"
```

**Expected**:
```
Total units: 178
Search "marine": [ 'Space Marines', 'Chaos Space Marines', ... ]
Search "tyranid": [ 'Tyranid Warriors (Melee)', 'Tyranid Warriors (Ranged)', ... ]
```

### Test 4: Save a Labeled Crop

```bash
cd /home/sinan/photoanalyzer/backend

npx tsx -e "
import { createSession, saveLabeledCrop, initializeSessionStorage } from './src/services/labelingService'
import { readFileSync } from 'fs'
import sharp from 'sharp'

await initializeSessionStorage()

// Create mock image
const mockImage = await sharp({
  create: { width: 500, height: 500, channels: 3, background: 'blue' }
}).png().toBuffer()

// Create session with one detection
const sessionId = createSession(mockImage, [{
  id: 'test-crop-1',
  box: { x1: 100, y1: 100, x2: 300, y2: 300 },
  roughType: 'Hormagaunt',
  confidence: 0.9,
  sourcePass: 'initial'
}])

console.log('Created session:', sessionId)

// Save the crop
const filepath = await saveLabeledCrop(sessionId, 'test-crop-1', 'Hormagaunts', true)
console.log('Saved crop to:', filepath)

// Check metadata
const fs = await import('fs')
const metadata = JSON.parse(fs.readFileSync('training_data/hormagaunts/metadata.json', 'utf-8'))
console.log('Metadata:', metadata)
"
```

**Expected**:
- Crop saved to: `training_data/hormagaunts/crop_<timestamp>_<uuid>.png`
- Metadata file created: `training_data/hormagaunts/metadata.json`
- Metadata contains: `totalCrops: 1`, `aiAccuracy.correctSuggestions: 1`

## Verify Directory Structure

```bash
cd /home/sinan/photoanalyzer/backend

# Should see:
tree -L 2 .sessions training_data
```

**Expected**:
```
.sessions
└── <uuid>.json

training_data
└── hormagaunts
    ├── crop_<timestamp>_<uuid>.png
    └── metadata.json
```

## Cleanup After Testing

```bash
cd /home/sinan/photoanalyzer/backend

# Remove test data
rm -rf .sessions/* training_data/*

echo "Test data cleaned"
```

## Troubleshooting

### "Module not found" errors
```bash
# Make sure you're in the backend directory
cd /home/sinan/photoanalyzer/backend

# Check TypeScript compiles
npx tsc --noEmit
```

### "No such file or directory: test-images/hormagaunts-2.png"
The quality filter tests need a test image. This is optional - other tests will still pass.

To fix:
```bash
# The image exists at the root level
cd /home/sinan/photoanalyzer/backend
# The test looks for ../test-images/ which resolves to /home/sinan/photoanalyzer/test-images/
# This should work automatically
```

### Sessions not persisting
Check that `.sessions/` directory exists and is writable:
```bash
ls -la .sessions/
# Should show .json files after running tests
```

## Success Criteria

All these should pass:
- ✅ TypeScript compiles without errors
- ✅ Session creation and retrieval works
- ✅ Sessions persist to disk (check `.sessions/*.json` files exist)
- ✅ Sessions restore after cleanup/restart
- ✅ Units configuration loads 178 units
- ✅ Search returns relevant units
- ✅ Quality filters validate images
- ✅ Laplacian blur detection works (with fallback)
- ✅ Can save crops to `training_data/`
- ✅ Metadata.json created with correct structure

## Next Steps After Sprint 1

Once all tests pass, you're ready for:

**Sprint 2: API Endpoints** - Expose these services via REST API
- Modify `/api/analyze` to support training mode
- Add `POST /api/label` endpoint
- Add `GET /api/units` endpoint
- Test with curl commands
