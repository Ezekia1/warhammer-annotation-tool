/**
 * BboxAnnotator Component
 *
 * Interactive canvas for drawing and editing bounding boxes on images.
 * Used for creating YOLO training datasets.
 *
 * Features:
 * - Click and drag to draw new bboxes
 * - Click existing bbox to select/edit
 * - Delete key to remove selected bbox
 * - Label each bbox with a class name
 * - Export to YOLO format
 */

import { useState, useRef, useEffect } from 'react'
import { BboxAnnotation } from '../types'

interface BboxAnnotatorProps {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  onAnnotationsChange: (annotations: BboxAnnotation[]) => void
  classLabels: string[]  // Available class labels
  defaultClass?: string
  initialAnnotations?: BboxAnnotation[]  // Pre-populated annotations (e.g., from AI)
}

interface DrawingState {
  isDrawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface PanState {
  isPanning: boolean
  startX: number
  startY: number
}

type AnnotationMode = 'model' | 'base'

// ═══════════════════════════════════════════════════════════
// COMMAND PATTERN FOR UNDO/REDO
// ═══════════════════════════════════════════════════════════

interface Command {
  execute(annotations: BboxAnnotation[]): BboxAnnotation[]
  undo(annotations: BboxAnnotation[]): BboxAnnotation[]
  description: string
}

class AddModelBoxCommand implements Command {
  constructor(private bbox: BboxAnnotation) {}

  execute(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return [...annotations, this.bbox]
  }

  undo(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return annotations.filter(a => a.id !== this.bbox.id)
  }

  description = 'Add model box'
}

class DeleteModelBoxCommand implements Command {
  constructor(private bbox: BboxAnnotation) {}

  execute(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return annotations.filter(a => a.id !== this.bbox.id)
  }

  undo(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return [...annotations, this.bbox]
  }

  description = 'Delete model box'
}

class AddBaseBoxCommand implements Command {
  constructor(
    private modelId: string,
    private baseBbox: { x: number; y: number; width: number; height: number }
  ) {}

  execute(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return annotations.map(a =>
      a.id === this.modelId ? { ...a, baseBbox: this.baseBbox } : a
    )
  }

  undo(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return annotations.map(a =>
      a.id === this.modelId ? { ...a, baseBbox: undefined } : a
    )
  }

  description = 'Add base box'
}

class DeleteBaseBoxCommand implements Command {
  constructor(
    private modelId: string,
    private baseBbox: { x: number; y: number; width: number; height: number }
  ) {}

  execute(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return annotations.map(a =>
      a.id === this.modelId ? { ...a, baseBbox: undefined } : a
    )
  }

  undo(annotations: BboxAnnotation[]): BboxAnnotation[] {
    return annotations.map(a =>
      a.id === this.modelId ? { ...a, baseBbox: this.baseBbox } : a
    )
  }

  description = 'Delete base box'
}

export default function BboxAnnotator({
  imageUrl,
  imageWidth,
  imageHeight,
  onAnnotationsChange,
  classLabels,
  defaultClass = 'miniature',
  initialAnnotations = []
}: BboxAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [annotations, setAnnotations] = useState<BboxAnnotation[]>(initialAnnotations)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  })
  const [panning, setPanning] = useState<PanState>({
    isPanning: false,
    startX: 0,
    startY: 0
  })
  const [scale, setScale] = useState(1)  // Fit-to-container scale (initial display scale)
  const [zoom, setZoom] = useState(1)  // User zoom level (1 = 100%, 2 = 200%, etc.)
  const [panX, setPanX] = useState(0)  // Pan offset in canvas pixels
  const [panY, setPanY] = useState(0)
  const [currentClass, setCurrentClass] = useState(defaultClass)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [mode, setMode] = useState<AnnotationMode>('model')  // model or base bbox mode

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<Command[]>([])
  const [redoStack, setRedoStack] = useState<Command[]>([])

  // Execute a command and add to undo stack
  const executeCommand = (command: Command) => {
    const newAnnotations = command.execute(annotations)
    setAnnotations(newAnnotations)
    onAnnotationsChange(newAnnotations)

    // Add to undo stack and clear redo stack
    setUndoStack(prev => [...prev, command])
    setRedoStack([])
  }

  // Undo last command
  const undo = () => {
    if (undoStack.length === 0) return

    const command = undoStack[undoStack.length - 1]
    const newAnnotations = command.undo(annotations)
    setAnnotations(newAnnotations)
    onAnnotationsChange(newAnnotations)

    // Move command from undo to redo stack
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, command])
  }

  // Redo last undone command
  const redo = () => {
    if (redoStack.length === 0) return

    const command = redoStack[redoStack.length - 1]
    const newAnnotations = command.execute(annotations)
    setAnnotations(newAnnotations)
    onAnnotationsChange(newAnnotations)

    // Move command from redo to undo stack
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, command])
  }

  // ═══════════════════════════════════════════════════════════
  // CENTRALIZED COORDINATE TRANSFORMS
  // ═══════════════════════════════════════════════════════════
  // Single source of truth for zoom/pan transforms
  // All coordinate conversions must go through these functions

  /**
   * Convert screen coordinates (canvas pixels) → image coordinates (actual image pixels)
   * Accounts for zoom and pan
   */
  const screenToImage = (screenX: number, screenY: number) => {
    const effectiveScale = scale * zoom
    return {
      x: (screenX - panX) / effectiveScale,
      y: (screenY - panY) / effectiveScale
    }
  }

  /**
   * Convert image coordinates (actual image pixels) → screen coordinates (canvas pixels)
   * Accounts for zoom and pan
   */
  const imageToScreen = (imageX: number, imageY: number) => {
    const effectiveScale = scale * zoom
    return {
      x: imageX * effectiveScale + panX,
      y: imageY * effectiveScale + panY
    }
  }

  /**
   * Constrain a rectangle to stay within model bbox bounds
   * Used for auto-constraining base bbox during drawing
   */
  const constrainToModelBbox = (
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    modelBbox: BboxAnnotation
  ) => {
    // Get the bounding rectangle being drawn (in image coords)
    const minX = Math.min(startX, currentX)
    const minY = Math.min(startY, currentY)
    const maxX = Math.max(startX, currentX)
    const maxY = Math.max(startY, currentY)

    // Model bbox bounds
    const modelMinX = modelBbox.x
    const modelMinY = modelBbox.y
    const modelMaxX = modelBbox.x + modelBbox.width
    const modelMaxY = modelBbox.y + modelBbox.height

    // Constrain to model bounds
    const constrainedMinX = Math.max(minX, modelMinX)
    const constrainedMinY = Math.max(minY, modelMinY)
    const constrainedMaxX = Math.min(maxX, modelMaxX)
    const constrainedMaxY = Math.min(maxY, modelMaxY)

    return {
      x: constrainedMinX,
      y: constrainedMinY,
      width: Math.max(0, constrainedMaxX - constrainedMinX),
      height: Math.max(0, constrainedMaxY - constrainedMinY)
    }
  }

  // Load and scale image
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const img = new Image()
    img.onload = () => {
      // Calculate scale to fit in container (max 800px width)
      const maxWidth = Math.min(container.clientWidth, 800)
      const scale = maxWidth / imageWidth

      canvas.width = imageWidth * scale
      canvas.height = imageHeight * scale

      setScale(scale)
      setImageLoaded(true)

      // Draw image
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        redrawAnnotations(ctx, annotations)  // Draw initial annotations (including AI suggestions)
      }
    }
    img.src = imageUrl
  }, [imageUrl, imageWidth, imageHeight])

  // Redraw canvas
  useEffect(() => {
    if (!imageLoaded) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and redraw image
    const img = new Image()
    img.onload = () => {
      // Clear entire canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Save context state
      ctx.save()

      // Apply zoom and pan transform
      const effectiveScale = scale * zoom
      ctx.translate(panX, panY)
      ctx.scale(effectiveScale / scale, effectiveScale / scale)  // Scale on top of base scale

      // Draw image at base scale
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Draw annotations in image coordinate space
      redrawAnnotations(ctx, annotations)

      // Draw current drawing box
      if (drawing.isDrawing) {
        const drawColor = mode === 'base' ? '#00ffff' : 'yellow'  // Cyan for base, yellow for model
        const isDashed = mode === 'base'

        // Convert screen coords to image coords for drawing
        const start = screenToImage(drawing.startX, drawing.startY)
        const end = screenToImage(drawing.currentX, drawing.currentY)

        let drawRect = {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y)
        }

        // Auto-constrain base bbox to model bbox during drawing
        if (mode === 'base' && selectedId) {
          const selectedBox = annotations.find(a => a.id === selectedId)
          if (selectedBox) {
            drawRect = constrainToModelBbox(start.x, start.y, end.x, end.y, selectedBox)
          }
        }

        drawBox(ctx, {
          x: drawRect.x * scale,
          y: drawRect.y * scale,
          width: drawRect.width * scale,
          height: drawRect.height * scale
        }, drawColor, true, isDashed)
      }

      // Restore context state
      ctx.restore()
    }
    img.src = imageUrl
  }, [annotations, selectedId, drawing, imageLoaded, imageUrl, mode, zoom, panX, panY])

  const redrawAnnotations = (ctx: CanvasRenderingContext2D, boxes: BboxAnnotation[]) => {
    boxes.forEach(box => {
      const scaledBox = {
        x: box.x * scale,
        y: box.y * scale,
        width: box.width * scale,
        height: box.height * scale
      }
      const isSelected = box.id === selectedId
      const modelColor = isSelected ? '#00ff00' : '#ff0000'

      // Draw model bbox (outer)
      drawBox(ctx, scaledBox, modelColor, isSelected)

      // Draw base bbox (inner) if it exists
      if (box.baseBbox) {
        const scaledBaseBbox = {
          x: box.baseBbox.x * scale,
          y: box.baseBbox.y * scale,
          width: box.baseBbox.width * scale,
          height: box.baseBbox.height * scale
        }
        const baseColor = isSelected ? '#00ffff' : '#ffaa00'  // Cyan/Orange for base
        drawBox(ctx, scaledBaseBbox, baseColor, isSelected, true)  // Dashed line
      }

      // Draw label
      ctx.fillStyle = modelColor
      ctx.font = '14px Arial'
      ctx.fillText(box.classLabel, scaledBox.x, scaledBox.y - 5)
    })
  }

  const drawBox = (
    ctx: CanvasRenderingContext2D,
    box: { x: number, y: number, width: number, height: number },
    color: string,
    thick: boolean = false,
    dashed: boolean = false
  ) => {
    ctx.strokeStyle = color
    ctx.lineWidth = thick ? 3 : 2

    // Set line dash for base bboxes
    if (dashed) {
      ctx.setLineDash([8, 4])
    } else {
      ctx.setLineDash([])
    }

    ctx.strokeRect(box.x, box.y, box.width, box.height)

    // Reset line dash
    ctx.setLineDash([])
  }

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    // Get mouse position in canvas coordinates
    const mousePos = getMousePos(e)

    // Calculate zoom delta (0.1 per scroll notch)
    const delta = -e.deltaY / 1000
    const newZoom = Math.max(0.1, Math.min(10, zoom + delta))  // Clamp between 0.1x and 10x

    // Adjust pan to zoom towards mouse cursor
    // This keeps the point under the cursor stationary
    const effectiveScale = scale * zoom
    const newEffectiveScale = scale * newZoom
    const factor = newEffectiveScale / effectiveScale

    setPanX(mousePos.x - (mousePos.x - panX) * factor)
    setPanY(mousePos.y - (mousePos.y - panY) * factor)
    setZoom(newZoom)
  }

  // Reset zoom and pan to fit image
  const resetView = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  // Zoom to 100% (actual size)
  const zoomToActual = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setZoom(1 / scale)  // Cancel out the base scale to show 1:1 pixels
    setPanX(0)
    setPanY(0)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const screenPos = getMousePos(e)

    // Middle mouse button OR spacebar + left mouse = pan mode
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      setPanning({
        isPanning: true,
        startX: screenPos.x - panX,
        startY: screenPos.y - panY
      })
      return
    }

    // Only handle left mouse button for drawing/selecting
    if (e.button !== 0) return

    // Convert screen coords to image coords
    const imagePos = screenToImage(screenPos.x, screenPos.y)

    // Helper: check if point is inside a bbox (in image coordinates)
    const isPointInBox = (box: BboxAnnotation, point: { x: number, y: number }) => {
      return point.x >= box.x && point.x <= box.x + box.width &&
             point.y >= box.y && point.y <= box.y + box.height
    }

    // PRIORITY FIX: In base mode with selected box, check selected box FIRST
    // This fixes overlapping bbox issues - prioritize drawing in the selected box
    if (mode === 'base' && selectedId) {
      const selectedBox = annotations.find(a => a.id === selectedId)
      if (selectedBox && isPointInBox(selectedBox, imagePos)) {
        // Start drawing base bbox inside selected box (store screen coords for drawing)
        setDrawing({
          isDrawing: true,
          startX: screenPos.x,
          startY: screenPos.y,
          currentX: screenPos.x,
          currentY: screenPos.y
        })
        return
      }
    }

    // Check if clicking on any existing box (in image coordinates)
    const clickedBox = annotations.find(box => isPointInBox(box, imagePos))

    // In model mode: clicking a box selects it
    if (clickedBox && mode === 'model') {
      setSelectedId(clickedBox.id)
      return
    }

    // In base mode: if clicking inside a different box, select it
    if (clickedBox && mode === 'base' && clickedBox.id !== selectedId) {
      setSelectedId(clickedBox.id)
      return
    }

    // Start drawing new model box (store screen coords for drawing)
    // In model mode, deselect before drawing new box
    if (mode === 'model') {
      setSelectedId(null)
    }

    setDrawing({
      isDrawing: true,
      startX: screenPos.x,
      startY: screenPos.y,
      currentX: screenPos.x,
      currentY: screenPos.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const screenPos = getMousePos(e)

    // Handle panning
    if (panning.isPanning) {
      setPanX(screenPos.x - panning.startX)
      setPanY(screenPos.y - panning.startY)
      return
    }

    // Handle drawing
    if (drawing.isDrawing) {
      setDrawing(prev => ({
        ...prev,
        currentX: screenPos.x,
        currentY: screenPos.y
      }))
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // End panning
    if (panning.isPanning) {
      setPanning({ isPanning: false, startX: 0, startY: 0 })
      return
    }

    // End drawing
    if (!drawing.isDrawing) return

    const screenPos = getMousePos(e)
    const width = Math.abs(screenPos.x - drawing.startX)
    const height = Math.abs(screenPos.y - drawing.startY)

    // Minimum size check (10px in screen space)
    if (width < 10 || height < 10) {
      setDrawing({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
      return
    }

    // Convert screen coordinates to image coordinates
    const startImage = screenToImage(drawing.startX, drawing.startY)
    const endImage = screenToImage(screenPos.x, screenPos.y)

    if (mode === 'model') {
      // Create new model annotation (in image coordinates)
      const newAnnotation: BboxAnnotation = {
        id: crypto.randomUUID(),
        x: Math.min(startImage.x, endImage.x),
        y: Math.min(startImage.y, endImage.y),
        width: Math.abs(endImage.x - startImage.x),
        height: Math.abs(endImage.y - startImage.y),
        classLabel: currentClass
      }

      // Use command pattern for undo/redo
      const command = new AddModelBoxCommand(newAnnotation)
      executeCommand(command)
    } else if (mode === 'base' && selectedId) {
      // Add base bbox to selected annotation
      const selectedAnnotation = annotations.find(a => a.id === selectedId)
      if (!selectedAnnotation) return

      // Auto-constrain base bbox to stay inside model bbox
      const baseBbox = constrainToModelBbox(
        startImage.x,
        startImage.y,
        endImage.x,
        endImage.y,
        selectedAnnotation
      )

      // Only add if bbox has non-zero size after constraining
      if (baseBbox.width > 0 && baseBbox.height > 0) {
        // Use command pattern for undo/redo
        const command = new AddBaseBoxCommand(selectedId, baseBbox)
        executeCommand(command)
      }
    }

    setDrawing({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
  }

  const handleDeleteSelected = () => {
    if (!selectedId) return

    const bbox = annotations.find(a => a.id === selectedId)
    if (!bbox) return

    // Use command pattern for undo/redo
    const command = new DeleteModelBoxCommand(bbox)
    executeCommand(command)
    setSelectedId(null)
  }

  const handleDeleteBaseBbox = () => {
    if (!selectedId) return

    const bbox = annotations.find(a => a.id === selectedId)
    if (!bbox || !bbox.baseBbox) return

    // Use command pattern for undo/redo
    const command = new DeleteBaseBoxCommand(selectedId, bbox.baseBbox)
    executeCommand(command)
  }

  const handleClassChange = (newClass: string) => {
    setCurrentClass(newClass)

    // Also update selected box if any
    if (selectedId) {
      const updatedAnnotations = annotations.map(a =>
        a.id === selectedId ? { ...a, classLabel: newClass } : a
      )
      setAnnotations(updatedAnnotations)
      onAnnotationsChange(updatedAnnotations)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      // Redo alternative (Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      // Delete model box
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDeleteSelected()
      }
      // Delete base bbox
      else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        handleDeleteBaseBbox()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, annotations, undoStack, redoStack])

  return (
    <div className="bbox-annotator">
      {/* Controls */}
      <div className="annotation-controls" style={{
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setMode('model')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: mode === 'model' ? '#2563eb' : '#2a2a2a',
                color: '#fff',
                border: mode === 'model' ? '2px solid #3b82f6' : '1px solid #444',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: mode === 'model' ? 'bold' : 'normal'
              }}
            >
              📦 Model
            </button>
            <button
              onClick={() => setMode('base')}
              disabled={!selectedId}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: mode === 'base' ? '#059669' : '#2a2a2a',
                color: mode === 'base' || !selectedId ? '#fff' : '#aaa',
                border: mode === 'base' ? '2px solid #10b981' : '1px solid #444',
                borderRadius: '4px',
                cursor: selectedId ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem',
                fontWeight: mode === 'base' ? 'bold' : 'normal',
                opacity: selectedId ? 1 : 0.5
              }}
            >
              ⭕ Base
            </button>
          </div>

          {/* Class selector */}
          <div>
            <label style={{ marginRight: '0.5rem', color: '#aaa' }}>Class:</label>
            <select
              value={currentClass}
              onChange={(e) => handleClassChange(e.target.value)}
              style={{
                padding: '0.5rem',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px'
              }}
            >
              {classLabels.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>

          {/* Undo/Redo controls */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: undoStack.length > 0 ? '#2a2a2a' : '#1a1a1a',
                color: undoStack.length > 0 ? '#fff' : '#666',
                border: '1px solid #444',
                borderRadius: '4px',
                cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem',
                opacity: undoStack.length > 0 ? 1 : 0.5
              }}
              title="Undo (Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: redoStack.length > 0 ? '#2a2a2a' : '#1a1a1a',
                color: redoStack.length > 0 ? '#fff' : '#666',
                border: '1px solid #444',
                borderRadius: '4px',
                cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem',
                opacity: redoStack.length > 0 ? 1 : 0.5
              }}
              title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
            >
              ↷ Redo
            </button>
          </div>

          {/* Zoom controls */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={resetView}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              title="Reset zoom and pan (fit to screen)"
            >
              🔍 Fit
            </button>
            <button
              onClick={zoomToActual}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              title="Zoom to 100% (actual pixels)"
            >
              1:1
            </button>
            <div style={{ color: '#aaa', fontSize: '0.85rem', minWidth: '60px' }}>
              {(zoom * 100).toFixed(0)}%
            </div>
          </div>

          {/* Stats */}
          <div style={{ color: '#aaa', fontSize: '0.9rem' }}>
            Annotations: <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{annotations.length}</span>
          </div>

          {selectedId && (
            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>
              Selected: <span style={{ color: '#00ff00' }}>1 box</span>
              {annotations.find(a => a.id === selectedId)?.baseBbox && (
                <span style={{ color: '#00ffff', marginLeft: '0.5rem' }}>• has base</span>
              )}
            </div>
          )}

          {/* Delete buttons */}
          {selectedId && (
            <>
              <button
                onClick={handleDeleteSelected}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Delete Model (Del)
              </button>
              {annotations.find(a => a.id === selectedId)?.baseBbox && (
                <button
                  onClick={handleDeleteBaseBbox}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ea580c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Delete Base (B)
                </button>
              )}
            </>
          )}
        </div>

        {/* Instructions */}
        <div style={{ marginTop: '0.75rem', color: '#666', fontSize: '0.85rem' }}>
          {mode === 'model' ? (
            <>💡 <strong>Model Mode:</strong> Click and drag to draw model boxes (red) • Click box to select • Del to remove • Mouse wheel to zoom • Shift+drag to pan</>
          ) : (
            <>💡 <strong>Base Mode:</strong> Select a model box first, then draw base bbox (dashed cyan) inside it • Press B to delete base • Mouse wheel to zoom • Shift+drag to pan</>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          style={{
            border: '2px solid #444',
            borderRadius: '8px',
            cursor: panning.isPanning ? 'grabbing' : drawing.isDrawing ? 'crosshair' : 'default',
            maxWidth: '100%'
          }}
        />
      </div>
    </div>
  )
}
