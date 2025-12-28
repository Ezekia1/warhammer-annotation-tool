import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeImage } from '../aiAnalyzer'
import axios from 'axios'

// Mock axios - FIXED: Use vi.mocked instead of jest.Mocked
vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

describe('AI Analyzer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should analyze image and return structured results', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: `{
                "models": [
                  {
                    "name": "Tactical Marine",
                    "faction": "Space Marines",
                    "count": 3,
                    "confidence": 0.95
                  }
                ],
                "totalCount": 3
              }`
            }
          }
        ]
      }
    }

    mockedAxios.post.mockResolvedValue(mockResponse)

    // JPEG signature
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    const result = await analyzeImage(buffer)

    expect(result).toEqual({
      models: [
        {
          name: 'Tactical Marine',
          faction: 'Space Marines',
          count: 3,
          confidence: 0.95
        }
      ],
      totalCount: 3
    })
  })

  it('should handle array content parts in response', async () => {
    // FIXED: Added test for array content format
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: '{"models": [{"name": "Ork Boy", "faction": "Orks", "count": 10, "confidence": 0.9}], "totalCount": 10}' }
              ]
            }
          }
        ]
      }
    }

    mockedAxios.post.mockResolvedValue(mockResponse)

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    const result = await analyzeImage(buffer)

    expect(result.totalCount).toBe(10)
    expect(result.models[0].name).toBe('Ork Boy')
  })

  it('should handle JSON in code blocks', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: '```json\n{"models": [], "totalCount": 0}\n```'
            }
          }
        ]
      }
    }

    mockedAxios.post.mockResolvedValue(mockResponse)

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    const result = await analyzeImage(buffer)

    expect(result.totalCount).toBe(0)
  })

  it('should reject unsupported image format', async () => {
    // Invalid/unknown format
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    await expect(analyzeImage(buffer)).rejects.toThrow('Unsupported or corrupted')
  })

  it('should detect PNG correctly', async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, // PNG signature
      0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x00
    ])

    const mockResponse = {
      data: {
        choices: [{ message: { content: '{"models": [], "totalCount": 0}' } }]
      }
    }

    mockedAxios.post.mockResolvedValue(mockResponse)

    await analyzeImage(pngBuffer)

    // Verify PNG MIME type was sent in request
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                source: expect.objectContaining({
                  media_type: 'image/png'
                })
              })
            ])
          })
        ])
      }),
      expect.any(Object)
    )
  })

  it('should detect WebP with proper RIFF check', async () => {
    // FIXED: Test proper WebP detection
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size
      0x57, 0x45, 0x42, 0x50  // WEBP
    ])

    const mockResponse = {
      data: {
        choices: [{ message: { content: '{"models": [], "totalCount": 0}' } }]
      }
    }

    mockedAxios.post.mockResolvedValue(mockResponse)

    await analyzeImage(webpBuffer)

    // Verify WebP MIME type was sent
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                source: expect.objectContaining({
                  media_type: 'image/webp'
                })
              })
            ])
          })
        ])
      }),
      expect.any(Object)
    )
  })

  it('should handle invalid JSON response', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: 'Invalid response without JSON'
            }
          }
        ]
      }
    }

    mockedAxios.post.mockResolvedValue(mockResponse)

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    await expect(analyzeImage(buffer)).rejects.toThrow('Could not extract valid JSON')
  })

  it('should handle 401 unauthorized error', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
        data: { error: 'Invalid API key' }
      },
      message: 'Unauthorized'
    })

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    await expect(analyzeImage(buffer)).rejects.toThrow('Invalid OpenRouter API key')
  })

  it('should handle 429 rate limit error', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 429,
        data: { error: 'Rate limit exceeded' }
      },
      message: 'Too many requests'
    })

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    await expect(analyzeImage(buffer)).rejects.toThrow('Rate limit exceeded')
  })

  it('should handle 402 insufficient credits error', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 402,
        data: { error: 'Insufficient credits' }
      },
      message: 'Payment required'
    })

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    await expect(analyzeImage(buffer)).rejects.toThrow('Insufficient credits')
  })
})
