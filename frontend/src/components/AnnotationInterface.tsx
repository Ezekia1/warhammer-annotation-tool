/**
 * AnnotationInterface Component
 *
 * Full-featured annotation interface for labeling training data:
 * - Loads images from training_data
 * - Uses BboxAnnotator for drawing model + base bboxes
 * - Saves annotations to backend
 * - Tracks progress
 * - Navigation (next/previous/skip)
 */

import { useState, useEffect } from 'react'
import BboxAnnotator from './BboxAnnotator'
import QualityIssuesModal from './QualityIssuesModal'
import { BboxAnnotation } from '../types'

interface ImageData {
  imageId: string
  imagePath: string
  faction: string
  source: 'reddit' | 'dakkadakka'
  imageBase64?: string
  width?: number
  height?: number
}

interface AnnotationProgress {
  totalImages: number
  annotatedImages: number
  percentComplete: number
  byFaction: Record<string, { total: number; annotated: number }>
}

interface QualityIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  bboxId?: string
}

export default function AnnotationInterface() {
  const [currentImage, setCurrentImage] = useState<ImageData | null>(null)
  const [annotations, setAnnotations] = useState<BboxAnnotation[]>([])
  const [progress, setProgress] = useState<AnnotationProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fetchingProgress, setFetchingProgress] = useState(false)

  // Quality issues state
  const [qualityErrors, setQualityErrors] = useState<QualityIssue[]>([])
  const [qualityWarnings, setQualityWarnings] = useState<QualityIssue[]>([])
  const [showQualityModal, setShowQualityModal] = useState(false)

  // Fetch progress on mount
  useEffect(() => {
    fetchProgress()
  }, [])

  // Fetch annotation progress
  const fetchProgress = async () => {
    try {
      setFetchingProgress(true)
      const response = await fetch('http://localhost:3001/api/annotate/progress')
      const data = await response.json()

      if (data.success) {
        setProgress(data.data.progress)
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err)
    } finally {
      setFetchingProgress(false)
    }
  }

  // Load next image
  const loadNextImage = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Get next image metadata
      const response = await fetch('http://localhost:3001/api/annotate/next')
      const data = await response.json()

      if (!data.success || !data.data.image) {
        setError('No more images to annotate!')
        setLoading(false)
        return
      }

      const imageInfo = data.data.image

      // Load full image data
      const imageResponse = await fetch(`http://localhost:3001/api/annotate/image/${imageInfo.imageId}`)
      const imageData = await imageResponse.json()

      if (imageData.success) {
        // Load existing annotations if any, otherwise start with empty array
        let newAnnotations: BboxAnnotation[] = []

        if (imageData.data.annotation && imageData.data.annotation.annotations) {
          // Convert backend format to BboxAnnotator format
          newAnnotations = imageData.data.annotation.annotations.map((ann: any) => ({
            id: ann.id,
            x: ann.modelBbox.x,
            y: ann.modelBbox.y,
            width: ann.modelBbox.width,
            height: ann.modelBbox.height,
            classLabel: ann.classLabel,
            baseBbox: ann.baseBbox
          }))
        }

        // Update both image and annotations together
        setCurrentImage(imageData.data.image)
        setAnnotations(newAnnotations)
      }
    } catch (err: any) {
      setError(`Failed to load image: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Save current annotations
  const saveAnnotations = async () => {
    if (!currentImage) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Convert BboxAnnotator format to backend format
      const annotationData = {
        imageId: currentImage.imageId,
        imagePath: currentImage.imagePath,
        faction: currentImage.faction,
        source: currentImage.source,
        width: currentImage.width || 0,
        height: currentImage.height || 0,
        annotations: annotations.map(ann => ({
          id: ann.id,
          modelBbox: {
            x: ann.x,
            y: ann.y,
            width: ann.width,
            height: ann.height
          },
          baseBbox: ann.baseBbox,
          classLabel: ann.classLabel
        })),
        annotatedAt: new Date().toISOString(),
        annotatedBy: 'user'
      }

      const response = await fetch('http://localhost:3001/api/annotate/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(annotationData)
      })

      const data = await response.json()

      if (data.success) {
        // Check for warnings (save succeeded but with warnings)
        if (data.warnings && data.warnings.length > 0) {
          setQualityWarnings(data.warnings)
          setQualityErrors([])
          setShowQualityModal(true)
        }

        setSuccess(`✅ Saved ${annotations.length} annotations!`)

        // Auto-load next image after save (skip slow progress refresh)
        setTimeout(() => {
          loadNextImage()
        }, 500)
      } else {
        // Check for validation errors
        if (data.errors && data.warnings) {
          // Validation failed - show modal
          setQualityErrors(data.errors)
          setQualityWarnings(data.warnings)
          setShowQualityModal(true)
          setError(null) // Clear generic error since we're showing detailed modal
        } else {
          // Other error
          setError(`Failed to save: ${data.error?.message || 'Unknown error'}`)
        }
      }
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Skip current image (save empty annotation to mark as processed)
  const skipImage = async () => {
    if (!currentImage) return

    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      // Save empty annotation to mark image as skipped/processed
      const annotationData = {
        imageId: currentImage.imageId,
        imagePath: currentImage.imagePath,
        faction: currentImage.faction,
        source: currentImage.source,
        width: currentImage.width || 0,
        height: currentImage.height || 0,
        annotations: [],  // Empty - no miniatures in this image
        annotatedAt: new Date().toISOString(),
        annotatedBy: 'user'
      }

      await fetch('http://localhost:3001/api/annotate/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(annotationData)
      })

      // Clear and load next (skip slow progress refresh)
      setAnnotations([])
      await loadNextImage()
    } catch (err: any) {
      setError(`Failed to skip: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="annotation-interface" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>
            🎨 Training Data Annotation
          </h1>
          {progress && (
            <>
              <div style={{ marginTop: '1rem', fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>
                <span style={{ color: '#10b981', fontSize: '2rem' }}>{progress.annotatedImages.toLocaleString()}</span>
                <span style={{ color: '#666', margin: '0 0.5rem' }}>/</span>
                <span style={{ color: '#aaa' }}>{progress.totalImages.toLocaleString()}</span>
                <span style={{ color: '#666', marginLeft: '1rem', fontSize: '1rem' }}>
                  ({progress.percentComplete.toFixed(3)}% complete)
                </span>
              </div>
              <div style={{ marginTop: '0.75rem', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progress.percentComplete}%`,
                  backgroundColor: '#10b981',
                  transition: 'width 0.5s ease',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                }} />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={fetchProgress}
            disabled={fetchingProgress}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#374151',
              color: '#fff',
              border: '1px solid #4b5563',
              borderRadius: '8px',
              fontSize: '0.9rem',
              cursor: fetchingProgress ? 'not-allowed' : 'pointer',
              opacity: fetchingProgress ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!fetchingProgress) {
                e.currentTarget.style.backgroundColor = '#4b5563'
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
          >
            {fetchingProgress ? '⏳ Updating...' : '🔄 Refresh Progress'}
          </button>
          {!currentImage && (
            <button
              onClick={loadNextImage}
              disabled={loading}
              style={{
                padding: '1rem 2rem',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? 'Loading...' : 'Start Annotating'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Stats */}
      {progress && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {Object.entries(progress.byFaction)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([faction, stats]) => (
              <div key={faction} style={{
                padding: '1rem',
                backgroundColor: '#1a1a1a',
                borderRadius: '8px',
                border: '1px solid #333'
              }}>
                <div style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                  {faction.replace(/_/g, ' ')}
                </div>
                <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {stats.annotated} / {stats.total}
                </div>
                <div style={{ marginTop: '0.5rem', height: '4px', backgroundColor: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(stats.annotated / stats.total) * 100}%`,
                    backgroundColor: '#10b981',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#dc2626',
          color: '#fff',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#059669',
          color: '#fff',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {success}
        </div>
      )}

      {/* Current Image Info */}
      {currentImage && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#aaa', fontSize: '0.8rem' }}>Current Image:</div>
              <div style={{ color: '#fff', fontSize: '1rem', marginTop: '0.25rem' }}>
                <span style={{ color: '#10b981', textTransform: 'capitalize' }}>
                  {currentImage.faction.replace(/_/g, ' ')}
                </span>
                {' '} / {currentImage.source}
                {' '} / {currentImage.width}x{currentImage.height}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ padding: '0.5rem 1rem', backgroundColor: '#2a2a2a', borderRadius: '4px', fontSize: '0.9rem', color: '#aaa' }}>
                {annotations.length} annotations
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Annotator */}
      {currentImage && currentImage.imageBase64 && currentImage.width && currentImage.height && (
        <div style={{ marginBottom: '2rem' }}>
          <BboxAnnotator
            key={currentImage.imageId}  // Force re-mount when image changes
            imageUrl={currentImage.imageBase64}
            imageWidth={currentImage.width}
            imageHeight={currentImage.height}
            onAnnotationsChange={setAnnotations}
            classLabels={[currentImage.faction]}  // Use faction as default class
            defaultClass={currentImage.faction}
            initialAnnotations={annotations}  // Pre-populate with AI suggestions or existing annotations
          />
        </div>
      )}

      {/* Action Buttons */}
      {currentImage && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          padding: '1.5rem',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <button
            onClick={skipImage}
            disabled={loading || saving}
            style={{
              padding: '1rem 2rem',
              backgroundColor: '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: loading || saving ? 'not-allowed' : 'pointer',
              opacity: loading || saving ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loading && !saving) {
                e.currentTarget.style.backgroundColor = '#9ca3af'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#6b7280'
            }}
          >
            ⏭️ Skip (no annotation)
          </button>

          <button
            onClick={saveAnnotations}
            disabled={loading || saving || annotations.length === 0}
            style={{
              padding: '1rem 3rem',
              backgroundColor: annotations.length > 0 ? '#059669' : '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: loading || saving || annotations.length === 0 ? 'not-allowed' : 'pointer',
              opacity: loading || saving || annotations.length === 0 ? 0.5 : 1
            }}
          >
            {saving ? 'Saving...' : `💾 Save & Next (${annotations.length} annotations)`}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        color: '#aaa',
        fontSize: '0.9rem'
      }}>
        <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Instructions:</div>
        <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>Click "Start Annotating" to load the first image</li>
          <li style={{ marginBottom: '0.5rem' }}>Use <strong>Model Mode</strong> to draw boxes around miniatures</li>
          <li style={{ marginBottom: '0.5rem' }}>Select a model box, then use <strong>Base Mode</strong> to draw the base bbox inside it</li>
          <li style={{ marginBottom: '0.5rem' }}>Click "Save & Next" to save annotations and load the next image</li>
          <li>Click "Skip" to skip images without miniatures or that are unusable</li>
        </ol>
      </div>

      {/* Quality Issues Modal */}
      {showQualityModal && (
        <QualityIssuesModal
          errors={qualityErrors}
          warnings={qualityWarnings}
          onClose={() => setShowQualityModal(false)}
        />
      )}
    </div>
  )
}
