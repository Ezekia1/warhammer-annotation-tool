# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Warhammer 40K Dataset Annotation Tool** - A web application for manually annotating bounding boxes on miniature images to create training datasets for YOLO object detection.

**Purpose**: Create high-quality training data for a custom YOLO model by annotating 18,088 Warhammer 40K miniature images.

## Development Commands

### Running Development Environment

```bash
# Start both frontend and backend concurrently
npm run dev

# Start individually
npm run dev:frontend  # Vite dev server on port 5173
npm run dev:backend   # Express server on port 3001
```

### Building

```bash
# Build everything
npm run build

# Build individually
npm run build:frontend  # TypeScript + Vite build → frontend/dist/
npm run build:backend   # TypeScript compilation → backend/dist/
```

## Architecture Overview

This is a **monorepo** with npm workspaces (`frontend/` and `backend/`).

### Frontend (React 18 + TypeScript)
- **App.tsx** - Main application shell
- **AnnotationInterface.tsx** - Main annotation UI with progress tracking
- **BboxAnnotator.tsx** - Canvas-based bbox drawing with zoom/pan/undo
- **QualityIssuesModal.tsx** - Validation errors/warnings display
- **types.ts** - TypeScript interfaces

### Backend (Node.js + Express + TypeScript)
- **index.ts** - Express server with annotation endpoints
- **annotationService.ts** - Handles loading/saving annotations, validation, and YOLO export
- **middleware/** - Request ID and error handling
- **utils/logger.ts** - Winston logger

### Scripts (Python)
- **validate_yolo_dataset.py** - YOLO dataset validator (directory structure, labels, coordinates)
- **setup_training_env.py** - Automated training environment setup
- **test_yolo_model.py** - Model testing harness with HTML reports

### Tests
- **backend/src/services/__tests__/annotationService.validation.test.ts** - TypeScript validation tests (28 cases)
- **scripts/test_validate_yolo_dataset.py** - Python validator tests (25+ cases)

### Data Structure

**Input**: 18,088 images in `backend/training_data/{faction}/{source}/`
**Output**: Annotations in `backend/training_data_annotations/` as JSON
**Export**: YOLOv8-pose format in `backend/yolo_dataset/`

## Key Features

### Hierarchical Bounding Boxes
Each annotation includes:
- **Model bbox**: Outer box around entire miniature
- **Base bbox** (optional): Inner box around just the base/stand
- **Auto-Constrain**: Base bboxes automatically constrained to stay inside model bounds

Exported as YOLOv8-pose keypoints for training.

### Quality Validation
- **Real-time validation**: Checks annotations before saving (out of bounds, too small, overlaps)
- **Quality issues modal**: Visual feedback with contextual tips
- **Pre-export validation**: Validates entire dataset before YOLO export
- **Error prevention**: Blocks saves when critical errors detected

### Zoom & Pan
- **Mouse wheel zoom**: Zoom in/out for precise annotation
- **Click-and-drag panning**: Pan around zoomed image
- **Centralized coordinate transforms**: Single source of truth for coordinate conversions

### Undo/Redo
- **Command pattern**: Reversible operations for all actions
- **Keyboard shortcuts**: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z
- **Efficient memory**: No full state snapshots

### Annotation Workflow
1. User clicks "Start Annotating"
2. Backend loads next unannotated image
3. User draws model boxes in Model mode (with zoom/pan/undo)
4. User selects model, draws base boxes in Base mode (auto-constrained)
5. User clicks "Save & Next"
6. Backend validates annotation (errors block, warnings inform)
7. Backend saves JSON annotation
8. Repeat for all 18k images

## Architectural Patterns

### Command Pattern (Undo/Redo)
All annotation operations use the Command pattern:
- Each operation implements `Command` interface with `execute()` and `undo()` methods
- Concrete commands: `AddModelBoxCommand`, `DeleteModelBoxCommand`, `AddBaseBoxCommand`, `DeleteBaseBoxCommand`
- Undo/redo stacks maintain history
- Efficient memory usage (operations are reversible, not full state snapshots)

**Example**:
```typescript
interface Command {
  execute(): void
  undo(): void
}

class AddModelBoxCommand implements Command {
  constructor(private bbox: BboxAnnotation, private annotations: BboxAnnotation[]) {}
  execute() { this.annotations.push(this.bbox) }
  undo() { this.annotations.pop() }
}
```

### Centralized Coordinate Transforms (Zoom/Pan)
All coordinate conversions go through centralized transform functions:
- `screenToImage(x, y)`: Canvas pixels → image pixels (accounts for zoom and pan)
- `imageToScreen(x, y)`: Image pixels → canvas pixels
- Single source of truth prevents coordinate bugs
- All mouse handlers use these transforms

**Example**:
```typescript
const screenToImage = (screenX: number, screenY: number) => {
  const effectiveScale = scale * zoom
  return {
    x: (screenX - panX) / effectiveScale,
    y: (screenY - panY) / effectiveScale
  }
}
```

### Validation Strategy
Two-tier validation approach:
- **Errors** (block save): Critical issues that corrupt data (bbox out of bounds, base outside model)
- **Warnings** (inform, don't block): Quality issues that should be reviewed (duplicate boxes, small bboxes)
- Real-time validation during save
- Pre-export validation for entire dataset

**Example**:
```typescript
interface QualityIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  annotationIndex?: number
}
```

### YOLO-Pose Export Format
Hierarchical bboxes exported as pose keypoints:
- **Model bbox**: Standard YOLO format (class, x_center, y_center, width, height)
- **Base bbox**: 4 keypoints at corners (TL, TR, BR, BL) with visibility flags
- **Missing base**: Omit keypoints entirely (5 values instead of 17)
- **Keypoint format**: 12 values (4 keypoints × 3: x, y, visibility)
- **Coordinates**: Normalized to 0-1 range

**Example**:
```
# Model with base (17 values)
0 0.5 0.5 0.3 0.2 0.4 0.4 1 0.6 0.4 1 0.6 0.6 1 0.4 0.6 1

# Model without base (5 values)
0 0.5 0.5 0.3 0.2
```

## Common Development Tasks

### Adding a New Annotation Field

1. Update backend type (`backend/src/types.ts`)
2. Update frontend type (`frontend/src/types.ts`)
3. Update AnnotationInterface to save the field
4. Update annotationService to persist the field

### Adding a New Validation Check

1. Add validation logic to `annotationService.validateAnnotation()`
2. Define error/warning code and message
3. Add test case in `annotationService.validation.test.ts`
4. Add contextual tip in `QualityIssuesModal.tsx`

### Modifying Export Format

Edit `backend/src/services/annotationService.ts` → `exportToYOLO()` method

### Changing Progress Calculation

Edit `backend/src/services/annotationService.ts` → `getProgress()` method

## Testing

### Unit Tests (TypeScript/Jest)

**Location**: `backend/src/services/__tests__/annotationService.validation.test.ts`

```bash
# Run all tests
cd backend && npm test

# Run specific test file
npm test -- annotationService.validation.test.ts

# Run with coverage
npm test -- --coverage
```

**Coverage**: 28 test cases covering:
- Bbox out of bounds (4 tests)
- Bbox too small (2 tests)
- Base outside model (6 tests)
- Duplicate boxes (3 tests)
- Complex scenarios (5 tests)
- IoU calculation (6 tests)

### Unit Tests (Python/pytest)

**Location**: `scripts/test_validate_yolo_dataset.py`

```bash
# Install pytest
pip install pytest pytest-cov

# Run all Python tests
cd scripts && pytest test_validate_yolo_dataset.py -v

# Run with coverage
pytest test_validate_yolo_dataset.py -v --cov=validate_yolo_dataset --cov-report=html
```

**Coverage**: 25+ test cases covering:
- Directory structure validation
- data.yaml validation
- Label format validation (5 vs 17 values)
- Coordinate range validation
- Keypoint validation
- Overlap detection

### Manual Testing

1. Start servers: `npm run dev`
2. Open `http://localhost:5173`
3. Click "Start Annotating"
4. Draw a few bboxes
5. Test zoom/pan (mouse wheel, click-and-drag)
6. Test undo/redo (Ctrl+Z, Ctrl+Y)
7. Click "Save & Next"
8. Verify validation (try invalid bbox out of bounds)
9. Verify next image loads
10. Check annotation saved: `backend/training_data_annotations/`

### Test Export

```bash
# Validate before export (recommended)
curl -X POST http://localhost:3001/api/annotate/validate-export

# Export to YOLO
curl -X POST http://localhost:3001/api/annotate/export \
  -H "Content-Type: application/json" \
  -d '{}'

# Validate exported dataset
python3 scripts/validate_yolo_dataset.py backend/yolo_dataset
```

### Test Coverage Goals
- Validation logic: ~90% (achieved)
- Export logic: ~85% (achieved)
- UI components: Not tested (manual testing only)

## Configuration

All configuration via `.env` file (see `.env.example`).

Currently no special configuration needed - defaults work for annotation.

## Documentation

- `README.md` - Quick start guide and API reference
- `STATUS.md` - Project status and changelog
- `IMPROVEMENTS.md` - Completed enhancements documentation
- `TESTING.md` - Testing guide (unit tests, coverage, CI/CD)
- `TRAIN_CUSTOM_YOLO.md` - Guide for training YOLO after annotation
- `docs/YOLO_TRAINING_GUIDE.md` - Detailed YOLO training reference

## Debugging

**View logs**:
```bash
tail -f backend/logs/all.log
tail -f backend/logs/error.log
```

**Common issues**:
- Images not loading: Check `backend/training_data/` exists and has images
- Save failing: Check write permissions on `backend/training_data_annotations/`
- Progress not updating: Refresh frontend or check backend logs

## Best Practices

### Code Changes

1. **Always read files before editing** - Use Read tool first
2. **Update STATUS.md after changes** - Add entry to Recent Changes section
3. **Write tests** - Add unit tests for new validation logic or export changes
4. **Test manually** - Verify annotation workflow works end-to-end

### Architecture

5. **Use centralized transforms** - All coordinate conversions go through `screenToImage`/`imageToScreen`
6. **Use Command pattern for operations** - Make operations reversible for undo/redo
7. **Validate early** - Add validation checks to `validateAnnotation()` before saving
8. **Keep it simple** - This is a focused annotation tool, not a complex analysis system

### YOLO Export

9. **Normalize coordinates** - Always convert pixels to 0-1 range for YOLO
10. **Include visibility flags** - Keypoints need (x, y, visibility) not just (x, y)
11. **Handle missing bases** - Omit keypoints entirely (5 values, not 17 with zeros)
12. **Validate before export** - Run `validateAllAnnotations()` before YOLO export

## Important Notes

- This tool is for **annotation only** - no AI analysis/detection features
- The 18k images are already collected
- Focus is on speed and accuracy of manual annotation
- YOLO training happens after all annotations are complete

## Key Technical Decisions

### Command Pattern for Undo/Redo
- **Why**: Efficient memory usage, operations are reversible without full state snapshots
- **Alternative considered**: State snapshots (rejected due to memory overhead)

### Centralized Coordinate Transforms
- **Why**: Single source of truth prevents zoom/pan coordinate bugs
- **Alternative considered**: Per-handler transforms (rejected due to inconsistency risk)

### Two-Tier Validation (Errors vs Warnings)
- **Why**: Balance safety (block critical errors) with usability (inform about warnings)
- **Alternative considered**: Block on all issues (rejected as too restrictive)

### YOLO-Pose for Hierarchical Bboxes
- **Why**: Standard format, 4 keypoints at base corners, visibility flags for missing bases
- **Alternative considered**: Custom format (rejected, not compatible with YOLO training)

### Auto-Constrain Base Bboxes
- **Why**: Prevents most common error (base outside model) at draw time
- **Alternative considered**: Post-draw validation (rejected, worse UX)
