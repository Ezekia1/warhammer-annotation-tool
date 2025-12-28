/**
 * QualityIssuesModal Component
 *
 * Displays validation errors and warnings when saving annotations
 * - Errors block save (must fix)
 * - Warnings allow save (informational)
 */

import { useState } from 'react'

interface QualityIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  bboxId?: string
}

interface QualityIssuesModalProps {
  errors: QualityIssue[]
  warnings: QualityIssue[]
  onClose: () => void
}

export default function QualityIssuesModal({ errors, warnings, onClose }: QualityIssuesModalProps) {
  const [showDetails, setShowDetails] = useState(true)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          border: '2px solid #333',
          borderRadius: '12px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>
              {errors.length > 0 ? '❌ Cannot Save - Quality Issues Found' : '⚠️ Quality Warnings'}
            </h2>
            <div style={{ marginTop: '0.5rem', color: '#aaa', fontSize: '0.9rem' }}>
              {errors.length > 0 && (
                <span style={{ color: '#dc2626', fontWeight: 'bold' }}>
                  {errors.length} error{errors.length !== 1 ? 's' : ''}
                </span>
              )}
              {errors.length > 0 && warnings.length > 0 && <span style={{ color: '#666' }}> • </span>}
              {warnings.length > 0 && (
                <span style={{ color: '#f59e0b' }}>
                  {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#374151',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Instructions */}
          {errors.length > 0 && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#7f1d1d',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #991b1b',
              }}
            >
              <div style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
                <strong>⛔ Save blocked:</strong> Fix the errors below before saving. Errors indicate data that would corrupt the YOLO training dataset.
              </div>
            </div>
          )}

          {/* Toggle Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#2a2a2a',
              color: '#aaa',
              border: '1px solid #444',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {showDetails ? '📋 Hide Details' : '📋 Show Details'}
          </button>

          {showDetails && (
            <>
              {/* Errors */}
              {errors.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.1rem', color: '#dc2626' }}>
                    ❌ Errors ({errors.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {errors.map((issue, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '1rem',
                          backgroundColor: '#2a2a2a',
                          borderRadius: '8px',
                          border: '1px solid #dc2626',
                          borderLeft: '4px solid #dc2626',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                              {issue.message}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.8rem' }}>
                              Code: {issue.code}
                              {issue.bboxId && ` • Bbox ID: ${issue.bboxId}`}
                            </div>
                          </div>
                        </div>

                        {/* Helpful context */}
                        {issue.code === 'BBOX_OUT_OF_BOUNDS' && (
                          <div style={{ marginTop: '0.75rem', color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            💡 Tip: Delete this box and redraw it within the image boundaries
                          </div>
                        )}
                        {issue.code === 'BASE_OUTSIDE_MODEL' && (
                          <div style={{ marginTop: '0.75rem', color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            💡 Tip: The base bbox must be completely inside the model bbox. Select the model and redraw the base.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div>
                  <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.1rem', color: '#f59e0b' }}>
                    ⚠️ Warnings ({warnings.length})
                  </h3>
                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#422006',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      border: '1px solid #78350f',
                    }}
                  >
                    <div style={{ color: '#fcd34d', fontSize: '0.85rem' }}>
                      Warnings are informational and don't block save. Review them to ensure quality.
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {warnings.map((issue, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '1rem',
                          backgroundColor: '#2a2a2a',
                          borderRadius: '8px',
                          border: '1px solid #f59e0b',
                          borderLeft: '4px solid #f59e0b',
                        }}
                      >
                        <div style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                          {issue.message}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.8rem' }}>
                          Code: {issue.code}
                          {issue.bboxId && ` • Bbox ID: ${issue.bboxId}`}
                        </div>

                        {/* Helpful context */}
                        {issue.code === 'BBOX_TOO_SMALL' && (
                          <div style={{ marginTop: '0.75rem', color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            💡 Tip: Very small boxes (&lt;10px) might be accidental clicks. Double-check this is intentional.
                          </div>
                        )}
                        {issue.code === 'DUPLICATE_BOX' && (
                          <div style={{ marginTop: '0.75rem', color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            💡 Tip: Two boxes overlap heavily. If they're the same miniature, delete one.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1.5rem',
            borderTop: '1px solid #333',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: errors.length > 0 ? '#dc2626' : '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {errors.length > 0 ? 'Fix Issues' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
