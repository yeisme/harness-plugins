// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CreatorActionToolView } from '../src/toolview.tsx'
import { action } from './fixtures.ts'

afterEach(cleanup)

describe('CreatorActionToolView', () => {
  it('renders only owner-authored preview and receipt facts', () => {
    render(<CreatorActionToolView action={action('eikona', 'image')} receipt={{ status: 'completed', receiptRef: 'receipt:eikona:1', owner: 'eikona', summary: 'Preview ready.' }} />)
    expect(screen.getByText('Create image')).toBeTruthy()
    expect(screen.getByText(/Preview ready/)).toBeTruthy()
  })
})
