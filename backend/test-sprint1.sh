#!/bin/bash

echo "🧪 Testing Sprint 1: Backend Foundation"
echo "========================================"
echo ""

cd /home/sinan/photoanalyzer/backend

echo "📋 Running comprehensive Sprint 1 tests..."
echo ""

npx tsx src/test-sprint1.ts

echo ""
echo "📂 Checking created directories and files..."
echo ""

if [ -d ".sessions" ]; then
  echo "✅ .sessions/ directory created"
  SESSION_COUNT=$(ls -1 .sessions/*.json 2>/dev/null | wc -l)
  echo "   Files: $SESSION_COUNT session file(s)"
else
  echo "❌ .sessions/ directory not found"
fi

if [ -d "training_data" ]; then
  echo "✅ training_data/ directory created"
else
  echo "❌ training_data/ directory not found"
fi

echo ""
echo "🔍 TypeScript Compilation Check..."
npx tsc --noEmit 2>&1 | head -5 || echo "✅ TypeScript compilation successful"

echo ""
echo "✨ Sprint 1 testing complete!"
