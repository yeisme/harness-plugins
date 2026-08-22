// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RetryButton } from '../../src/client/retry.tsx'

afterEach(cleanup)

const base = {
  label: '重试',
  loadingLabel: '重试中…',
  onRetry: () => {},
}

describe('RetryButton', () => {
  it('renders an enabled retry button and fires the action', () => {
    const onRetry = vi.fn()
    render(<RetryButton {...base} onRetry={onRetry} />)
    const button = screen.getByRole('button', { name: '重试' })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders loading and disables clicks', () => {
    const onRetry = vi.fn()
    render(<RetryButton {...base} loading onRetry={onRetry} />)
    const button = screen.getByRole('button', { name: '重试' })
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('renders disabled with a reason and does not fire', () => {
    const onRetry = vi.fn()
    render(<RetryButton {...base} disabled disabledReason="首轮消息重试尚未启用" onRetry={onRetry} />)
    const button = screen.getByRole('button', { name: '重试' })
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('title')).toBe('首轮消息重试尚未启用')
    fireEvent.click(button)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('renders a visible error', () => {
    render(<RetryButton {...base} error="重试失败" />)
    expect(screen.getByRole('alert').textContent).toBe('重试失败')
  })
})
