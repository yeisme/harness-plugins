// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MissingSessionState } from '../src/empty-state.tsx'
import { SessionLinkMenu } from '../src/session-link-menu.tsx'
import { urlSessionLabels } from '../src/labels.ts'

afterEach(() => cleanup())

const labels = urlSessionLabels('zh')

describe('MissingSessionState (§3.3)', () => {
  it('renders the honest empty state with the session id and the back action', () => {
    const onBackToList = vi.fn()
    render(<MissingSessionState sessionId="sess-gone" labels={labels} onBackToList={onBackToList} />)
    expect(screen.getByRole('region', { name: labels.missingTitle })).toBeDefined()
    expect(screen.getByText('sess-gone')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: labels.backToList }))
    expect(onBackToList).toHaveBeenCalledTimes(1)
  })

  it('moves focus onto the primary action without claiming the composer', () => {
    render(<MissingSessionState sessionId="sess-gone" labels={labels} onBackToList={() => {}} />)
    expect(document.activeElement?.textContent).toBe(labels.backToList)
  })
})

describe('SessionLinkMenu (§3.4)', () => {
  it('disables both actions with reasons when no session is active', () => {
    render(<SessionLinkMenu labels={labels} link={undefined} clipboardAvailable />)
    const trigger = screen.getByRole('button', { name: labels.menuTrigger })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.click(trigger)
    const copy = screen.getByRole('menuitem', { name: labels.copyLink })
    expect((copy as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('menuitem', { name: labels.openInNewTab }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('copies the token-free session link and reports success', async () => {
    const onCopy = vi.fn(async () => {})
    render(<SessionLinkMenu labels={labels} link="http://127.0.0.1:3080/?s=sess-a" clipboardAvailable onCopy={onCopy} />)
    fireEvent.click(screen.getByRole('button', { name: labels.menuTrigger }))
    fireEvent.click(screen.getByRole('menuitem', { name: labels.copyLink }))
    await waitFor(() => expect(screen.getByText(labels.copiedNotice)).toBeDefined())
    expect(onCopy).toHaveBeenCalledWith('http://127.0.0.1:3080/?s=sess-a')
    expect(String(onCopy.mock.calls[0]![0])).not.toMatch(/token|cookie|authorization/i)
  })

  it('disables copy when the clipboard is unavailable and still allows new tab', () => {
    const onOpenTab = vi.fn()
    render(<SessionLinkMenu labels={labels} link="http://127.0.0.1:3080/?s=sess-a" clipboardAvailable={false} onOpenTab={onOpenTab} />)
    fireEvent.click(screen.getByRole('button', { name: labels.menuTrigger }))
    expect((screen.getByRole('menuitem', { name: labels.copyLink }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('menuitem', { name: labels.openInNewTab }))
    expect(onOpenTab).toHaveBeenCalledWith('http://127.0.0.1:3080/?s=sess-a')
  })

  it('keeps a copy failure visible instead of failing silently', async () => {
    const onCopy = vi.fn(async () => { throw new Error('denied') })
    render(<SessionLinkMenu labels={labels} link="http://127.0.0.1:3080/?s=sess-a" clipboardAvailable onCopy={onCopy} />)
    fireEvent.click(screen.getByRole('button', { name: labels.menuTrigger }))
    fireEvent.click(screen.getByRole('menuitem', { name: labels.copyLink }))
    await waitFor(() => expect(screen.getByText(labels.copyFailedReason)).toBeDefined())
  })
})
