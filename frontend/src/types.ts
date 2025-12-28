// Dataset Annotation Types

export interface BboxAnnotation {
  id: string  // Unique ID for this annotation
  x: number  // Top-left X (pixels) - model bbox
  y: number  // Top-left Y (pixels)
  width: number  // Width (pixels)
  height: number  // Height (pixels)
  classLabel: string  // Faction name (e.g., "tyranids", "space_marines")
  baseBbox?: {  // Optional base bbox (inner bbox for the miniature's base)
    x: number
    y: number
    width: number
    height: number
  }
}
