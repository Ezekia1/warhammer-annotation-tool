/**
 * Mock Training Data
 *
 * Sample data for testing training mode components in isolation
 */

import { DetectedCrop } from '../types'

export const mockCrops: DetectedCrop[] = [
  {
    id: 'crop-001',
    imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    bbox: {
      x1: 0.1,
      y1: 0.1,
      x2: 0.3,
      y2: 0.3
    },
    aiSuggestion: {
      unit: 'Hormagaunts',
      confidence: 0.92
    }
  },
  {
    id: 'crop-002',
    imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    bbox: {
      x1: 0.4,
      y1: 0.2,
      x2: 0.6,
      y2: 0.4
    },
    aiSuggestion: {
      unit: 'Termagants',
      confidence: 0.76
    }
  },
  {
    id: 'crop-003',
    imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
    bbox: {
      x1: 0.7,
      y1: 0.5,
      x2: 0.9,
      y2: 0.7
    },
    aiSuggestion: {
      unit: 'Genestealers',
      confidence: 0.64
    }
  }
]

export const mockSessionId = 'test-session-12345678'
