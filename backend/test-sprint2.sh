#!/bin/bash

echo "🧪 Testing Sprint 2: API Endpoints"
echo "=========================================="
echo ""

cd /home/sinan/photoanalyzer/backend

# Check if server is running
echo "📡 Checking if server is running..."
if curl -s http://localhost:3001/api/health > /dev/null; then
  echo "✅ Server is running"
else
  echo "❌ Server is NOT running"
  echo "   Start server with: npm run dev"
  exit 1
fi

echo ""
echo "=========================================="
echo "Test 1: GET /api/units"
echo "=========================================="
echo ""

UNITS_RESPONSE=$(curl -s http://localhost:3001/api/units)
UNITS_COUNT=$(echo "$UNITS_RESPONSE" | jq -r '.data.units | length')
FACTIONS_COUNT=$(echo "$UNITS_RESPONSE" | jq -r '.data.factions | keys | length')

echo "Response:"
echo "$UNITS_RESPONSE" | jq

if [ "$UNITS_COUNT" = "178" ]; then
  echo "✅ Correct number of units: 178"
else
  echo "❌ Expected 178 units, got: $UNITS_COUNT"
fi

if [ "$FACTIONS_COUNT" = "8" ]; then
  echo "✅ Correct number of factions: 8"
else
  echo "❌ Expected 8 factions, got: $FACTIONS_COUNT"
fi

echo ""
echo "=========================================="
echo "Test 2: POST /api/analyze (training mode)"
echo "=========================================="
echo ""

# Check if test image exists
TEST_IMAGE="../test-images/hormagaunts-2.png"
if [ ! -f "$TEST_IMAGE" ]; then
  echo "⚠️  Test image not found: $TEST_IMAGE"
  echo "   Skipping training mode test"
else
  echo "Uploading image in training mode..."
  ANALYZE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/analyze?bbox=true \
    -F "image=@$TEST_IMAGE" \
    -F "trainingMode=true")

  echo "Response:"
  echo "$ANALYZE_RESPONSE" | jq

  SESSION_ID=$(echo "$ANALYZE_RESPONSE" | jq -r '.data.sessionId')
  CROPS_COUNT=$(echo "$ANALYZE_RESPONSE" | jq -r '.data.crops | length')

  if [ "$SESSION_ID" != "null" ] && [ "$SESSION_ID" != "" ]; then
    echo "✅ Session ID received: $SESSION_ID"
  else
    echo "❌ No session ID in response"
  fi

  if [ "$CROPS_COUNT" -gt "0" ]; then
    echo "✅ Crops array received: $CROPS_COUNT crops"
  else
    echo "❌ No crops in response"
  fi

  # Save session ID and crop ID for next test
  FIRST_CROP_ID=$(echo "$ANALYZE_RESPONSE" | jq -r '.data.crops[0].id')

  echo ""
  echo "=========================================="
  echo "Test 3: POST /api/label"
  echo "=========================================="
  echo ""

  if [ "$SESSION_ID" != "null" ] && [ "$FIRST_CROP_ID" != "null" ]; then
    echo "Labeling crop: $FIRST_CROP_ID"
    LABEL_RESPONSE=$(curl -s -X POST http://localhost:3001/api/label \
      -H "Content-Type: application/json" \
      -d "{
        \"sessionId\": \"$SESSION_ID\",
        \"cropId\": \"$FIRST_CROP_ID\",
        \"unit\": \"Hormagaunts\",
        \"wasCorrect\": true
      }")

    echo "Response:"
    echo "$LABEL_RESPONSE" | jq

    SAVED_PATH=$(echo "$LABEL_RESPONSE" | jq -r '.data.savedPath')

    if [ "$SAVED_PATH" != "null" ]; then
      echo "✅ Crop saved to: $SAVED_PATH"

      # Check if file exists
      if [ -f "$SAVED_PATH" ]; then
        echo "✅ File verified on disk"
      else
        echo "❌ File not found on disk: $SAVED_PATH"
      fi

      # Check metadata
      METADATA_FILE="training_data/hormagaunts/metadata.json"
      if [ -f "$METADATA_FILE" ]; then
        echo "✅ Metadata file exists"
        echo ""
        echo "Metadata contents:"
        cat "$METADATA_FILE" | jq
      else
        echo "❌ Metadata file not found"
      fi
    else
      echo "❌ No saved path in response"
    fi
  else
    echo "⚠️  Skipping label test - no session or crop ID from analyze"
  fi
fi

echo ""
echo "=========================================="
echo "Test 4: Backward Compatibility"
echo "=========================================="
echo ""

if [ -f "$TEST_IMAGE" ]; then
  echo "Testing normal analysis (without training mode)..."
  NORMAL_RESPONSE=$(curl -s -X POST http://localhost:3001/api/analyze?bbox=true \
    -F "image=@$TEST_IMAGE")

  HAS_MODELS=$(echo "$NORMAL_RESPONSE" | jq -r '.data.models | length')
  HAS_SESSION=$(echo "$NORMAL_RESPONSE" | jq -r '.data.sessionId')

  if [ "$HAS_MODELS" -gt "0" ]; then
    echo "✅ Normal analysis still works: $HAS_MODELS model types detected"
  else
    echo "❌ Normal analysis failed"
  fi

  if [ "$HAS_SESSION" = "null" ]; then
    echo "✅ No sessionId in normal mode (correct)"
  else
    echo "❌ sessionId present in normal mode (should be null)"
  fi
fi

echo ""
echo "=========================================="
echo "📂 Checking created directories..."
echo "=========================================="
echo ""

if [ -d ".sessions" ]; then
  SESSION_COUNT=$(ls -1 .sessions/*.json 2>/dev/null | wc -l)
  echo "✅ .sessions/ directory exists"
  echo "   Files: $SESSION_COUNT session file(s)"
else
  echo "❌ .sessions/ directory not found"
fi

if [ -d "training_data" ]; then
  echo "✅ training_data/ directory exists"
  UNIT_DIRS=$(ls -1 training_data 2>/dev/null | wc -l)
  echo "   Subdirectories: $UNIT_DIRS unit(s)"
else
  echo "❌ training_data/ directory not found"
fi

echo ""
echo "✨ Sprint 2 API testing complete!"
