import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ImageUpload from '../ImageUpload'

const mockOnResults = vi.fn()
const mockOnLoading = vi.fn()

describe('ImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload interface', () => {
    render(<ImageUpload onResults={mockOnResults} onLoading={mockOnLoading} />)

    expect(screen.getByText('🎯 UPLOAD MINIATURE FORMATION')).toBeDefined()
    expect(screen.getByText('DRAG & DROP OR CLICK TO SCAN')).toBeDefined()
  })

  it('shows drag active state', () => {
    render(<ImageUpload onResults={mockOnResults} onLoading={mockOnLoading} />)

    const dropzone = screen.getByText('🎯 UPLOAD MINIATURE FORMATION').closest('div')

    fireEvent.dragOver(dropzone!)
    expect(screen.getByText('⬇️ DROP YOUR BATTLE FORCE ⬇️')).toBeDefined()
  })
})