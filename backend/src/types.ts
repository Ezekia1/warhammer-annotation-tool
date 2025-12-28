export interface DetectedModel {
  name: string
  faction: string
  count: number
  confidence: number
}

export interface AnalysisResult {
  models: DetectedModel[]
  totalCount: number
}

// ===== Bbox-Based Detection Types =====

export interface CropClassification {
  id: string  // Links back to DetectionProposal ID
  name: string
  faction: string
  confidence: number
  needsTriangulation: boolean
  triangulationResult?: TriangulationResult
}

export interface TriangulationResult {
  model2Name: string
  model2Confidence: number
  model2Faction: string
  marginExceedsThreshold: boolean
  finalDecision: 'accept_claude' | 'use_triangulation' | 'mark_unknown'
  reasoning: string
}

export interface BboxAnalysisConfig {
  // PASS 1: Detection
  bboxModel: string
  bboxIouThreshold: number

  // PASS 2: Classification
  classifierModel: string
  triangulationModel: string
  triangulationThreshold: number  // Min confidence to skip triangulation
  triangulationMargin: number  // Min difference to accept Claude

  // Clump Separation
  enableClumpSeparation: boolean
  clumpAreaThreshold: number  // Max area ratio before considering a clump
  clumpAspectRatioThreshold: number  // Max aspect ratio
  clumpDistanceThreshold: number  // Min distance between neighbors
}

export interface BboxAnalysisResult extends AnalysisResult {
  detectionCount: number  // Authority count from PASS 1
  clumpSeparationTriggered: boolean
  triangulationCount: number
  processingTimeMs: number
  // Multi-tier cost tracking (optional)
  totalCost?: number
  avgCostPerCrop?: number
  multiTierStats?: {
    tier1Accepted: number
    tier2Accepted: number
    tier3Accepted: number
  }
}

// ===== Hierarchical Bbox Types =====

export interface HierarchicalBbox {
  model: {  // Outer bbox - entire miniature
    x1: number
    y1: number
    x2: number
    y2: number
  }
  base?: {  // Inner bbox - just the base (optional)
    x1: number
    y1: number
    x2: number
    y2: number
  }
}

// ===== Training Mode Types =====

export interface DetectedCrop {
  id: string  // Crop UUID (from detection)
  imageBase64: string  // Base64-encoded crop image (data URL)
  bbox: {
    x1: number  // Normalized coordinates [0.0-1.0]
    y1: number
    x2: number
    y2: number
  }
  baseBbox?: {  // Optional base bbox
    x1: number
    y1: number
    x2: number
    y2: number
  }
  aiSuggestion: {
    unit: string
    confidence: number
  }
}

export interface TrainingModeResult extends BboxAnalysisResult {
  sessionId: string  // For linking labels back to this analysis
  crops: DetectedCrop[]  // Array of cropped images ready for labeling
}