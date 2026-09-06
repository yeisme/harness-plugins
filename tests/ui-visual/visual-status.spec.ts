import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * /status flow fixture (dsh-session-insights-and-status, tasks 4.2/4.3).
 *
 * The fixture page (/status-flow in server.mjs) runs the REAL plugin code in
 * the browser: the ui-token-usage client bundle (pane, header entry, legacy
 * fallback, directory switcher, trajectory probe), the command-experience-core
 * slash runtime, runStatusCommand from ui-command-experience-web, and the
 * ui-session-status view model. The host roles (remotes, slots, pane
 * workbench, popover chrome, composer) are fixture-owned mocks with
 * wire-valid v1alpha1 shapes; the trajectory locator seam is intentionally
 * absent, so the request-row action must be disabled WITH its reason — that
 * is the current correct behavior while upstream-prs/session-trajectory-locator
 * is pending.
 */

const TRAJECTORY_UNAVAILABLE = 'The trajectory locator seam is not available yet; the statistics view stays put.'

async function openStatusFlow(page: Page, params = ''): Promise<void> {
  await page.goto(`/status-flow${params}`)
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  // The header entry enables once the mock remote attaches and the capability
  // probe settles; wait for it instead of probing fixed delays.
  await expect(page.locator('[data-session="sess_a"] [data-dsh-token-usage-open]')).toBeEnabled()
}

async function submitCommand(page: Page, command: string): Promise<void> {
  await page.locator('[data-fixture="composer-input"]').fill(command)
  await page.locator('[data-fixture="composer-send"]').click()
}

type FlowKey = 'queries' | 'opened' | 'focused' | 'popovers' | 'results' | 'events' | 'switches' | 'locateCalls'

async function flowState(page: Page, key: FlowKey): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(flowKey => (window as unknown as { __flow: Record<string, Array<Record<string, unknown>>> }).__flow[flowKey], key)
}

function insightsPane(page: Page, sessionRef: string): Locator {
  return page.locator(`[data-resource-key="token-usage:session:${sessionRef}"]`)
}

async function expectWithinFrame(page: Page, locator: Locator): Promise<void> {
  const frame = await page.locator('.fixture-frame').boundingBox()
  const box = await locator.boundingBox()
  expect(frame, 'fixture frame has a layout box').not.toBeNull()
  expect(box, 'visible control has a layout box').not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(frame!.x)
  expect(box!.x + box!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1)
}

test('/status opens the summary popover pinned to the originating session, then expands to bound statistics', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1200, height: 900 })
  await openStatusFlow(page, '?width=560')

  await submitCommand(page, '/status')
  const popover = page.locator('[data-fixture="status-popover"]')
  await expect(popover).toBeVisible()
  await expect(popover).toHaveAttribute('data-session-ref', 'sess_a')
  await expect(popover.locator('[data-summary-label]')).toHaveText('Fixture Session A')
  await expect(popover.locator('[data-summary-context]')).toContainText('88%')
  await expect(popover).toContainText('Weekly quota')

  // Focus moving to session B while the popover is open must not retarget it.
  await page.locator('[data-session-tab="sess_b"]').click()
  await expect(popover).toHaveAttribute('data-session-ref', 'sess_a')

  await popover.locator('[data-action="expand-statistics"]').click()
  const pane = insightsPane(page, 'sess_a')
  await expect(pane.locator('[data-dsh-token-usage-insights]')).toBeVisible()
  await expect(pane).toContainText('Session statistics')
  await expect(pane).toContainText('fixture-alpha-chat')
  await expect(pane.locator('.ys-context-bar')).toContainText('sess_a')
  await expect(pane).toContainText('Whole session')
  await expect(pane).toContainText('rev 3')

  // Command contract: lifecycle events carry the frozen sessionRef and the
  // result never enters the model transcript; navigation ≠ data availability.
  const results = await flowState(page, 'results')
  expect(results).toHaveLength(2)
  for (const result of results) {
    expect(result).toMatchObject({ sessionRef: 'sess_a', entersTranscript: false })
  }
  expect(results[1]).toMatchObject({ plan: 'open-pane' })
  expect(String(results[1]!.message)).toContain('data availability')
  const events = await flowState(page, 'events')
  expect(events).toEqual([
    { type: 'command/run', sessionRef: 'sess_a', canonicalName: 'status', correlationId: 'c-flow-1' },
    expect.objectContaining({ type: 'command/done', sessionRef: 'sess_a', status: 'success', correlationId: 'c-flow-1' }),
    { type: 'command/run', sessionRef: 'sess_a', canonicalName: 'status', correlationId: 'c-flow-2' },
    expect.objectContaining({ type: 'command/done', sessionRef: 'sess_a', status: 'success', correlationId: 'c-flow-2' }),
  ])
  const queries = await flowState(page, 'queries')
  expect(queries).toEqual([{ sessionRef: 'sess_a', scope: 'session' }])

  // Trajectory seam pending upstream: the row action is disabled WITH reason.
  const locate = pane.locator('[data-insights-requests] .tui-locate')
  await expect(locate).toHaveCount(1)
  await expect(locate).toBeDisabled()
  await expect(locate).toHaveAttribute('title', TRAJECTORY_UNAVAILABLE)
  await locate.click({ force: true })
  expect(await flowState(page, 'locateCalls')).toEqual([])
  // The statistics view stays put.
  await expect(pane).toContainText('fixture-alpha-chat')
  expect(errors).toEqual([])
})

test('/status tokens focuses the singleton statistics instance instead of duplicating it', async ({ page }) => {
  await openStatusFlow(page, '?width=960')
  await submitCommand(page, '/status tokens')
  await expect(insightsPane(page, 'sess_a')).toBeVisible()
  await submitCommand(page, '/status tokens')
  await expect(insightsPane(page, 'sess_a')).toHaveCount(1)
  const opened = await flowState(page, 'opened')
  expect(opened).toEqual([
    { kind: 'workspace.token-usage', resourceKey: 'token-usage:session:sess_a', metadata: { sessionRef: 'sess_a' } },
    { kind: 'workspace.token-usage', resourceKey: 'token-usage:session:sess_a', metadata: { sessionRef: 'sess_a' } },
  ])
  expect(await flowState(page, 'focused')).toEqual(['token-usage:session:sess_a'])
})

test('two sessions never cross data: panes stay pinned and switching is explicit', async ({ page }) => {
  await openStatusFlow(page, '?width=960')
  await submitCommand(page, '/status tokens')
  await expect(insightsPane(page, 'sess_a')).toContainText('fixture-alpha-chat')

  await page.locator('[data-session-tab="sess_b"]').click()
  await expect(page.locator('[data-session-tab="sess_b"]')).toHaveAttribute('aria-pressed', 'true')
  await submitCommand(page, '/status tokens')
  const paneB = insightsPane(page, 'sess_b')
  await expect(paneB).toContainText('fixture-beta-reasoner')

  // A's surface keeps A's data; B's surface never borrows it.
  const paneA = insightsPane(page, 'sess_a')
  await expect(paneA).toContainText('fixture-alpha-chat')
  await expect(paneA).not.toContainText('fixture-beta-reasoner')
  await expect(paneB).not.toContainText('fixture-alpha-chat')
  const queries = await flowState(page, 'queries')
  expect(queries).toEqual([
    { sessionRef: 'sess_a', scope: 'session' },
    { sessionRef: 'sess_b', scope: 'session' },
  ])

  // Explicit target switch inside pane B rebinds B's pane content to A; the
  // pane identity (resourceKey) stays pinned to the originating session.
  await paneB.locator('[data-dsh-insights-switch-target]').click()
  const directory = paneB.locator('[data-insights-directory]')
  await expect(directory).toBeVisible()
  await expect(directory.locator('[data-insights-directory-row]')).toHaveCount(2)
  await directory.locator('[data-insights-directory-row]', { hasText: 'Fixture Session A' }).locator('.tui-dir-use').click()
  await expect(paneB).toContainText('fixture-alpha-chat')
  await expect(paneB.locator('.ys-context-bar')).toContainText('sess_a')
  await expect(paneB).toHaveAttribute('data-resource-key', 'token-usage:session:sess_b')
  // Pane B now shares A's already-loaded binding (session+scope dedup), so no
  // third query fires — surfaces of one target share one subscription.
  const queriesAfter = await flowState(page, 'queries')
  expect(queriesAfter).toEqual([
    { sessionRef: 'sess_a', scope: 'session' },
    { sessionRef: 'sess_b', scope: 'session' },
  ])
})

test('old host without the query capability shows the explicitly labeled legacy process view', async ({ page }) => {
  await openStatusFlow(page, '?width=560&host=old')
  await submitCommand(page, '/status tokens')
  const pane = insightsPane(page, 'sess_a')
  await expect(pane.locator('[data-dsh-token-usage-panel]')).toBeVisible()
  await expect(pane.locator('[data-legacy-tag]')).toHaveText('Legacy process-observed statistics')
  await expect(pane).toContainText('110.00')
  // The insights query is never invoked on an old host.
  expect(await flowState(page, 'queries')).toEqual([])
})

test('zh locale renders the flow with readable Chinese labels', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await openStatusFlow(page, '?width=560&locale=zh')
  await submitCommand(page, '/status')
  const popover = page.locator('[data-fixture="status-popover"]')
  await expect(popover).toBeVisible()
  await popover.locator('[data-action="expand-statistics"]').click()
  const pane = insightsPane(page, 'sess_a')
  await expect(pane).toContainText('会话统计')
  await expect(pane).toContainText('整个会话')
  await expect(pane.locator('[data-dsh-insights-refresh]')).toContainText('刷新')
  await expect(pane.locator('[data-insights-requests] .tui-locate')).toHaveAttribute('title', '轨迹定位 seam 尚未可用；统计位置保持不变。')
  await expectWithinFrame(page, pane)
})

test('Escape closes the summary popover and returns focus to the composer input', async ({ page }) => {
  await openStatusFlow(page, '?width=560')
  await submitCommand(page, '/status')
  const popover = page.locator('[data-fixture="status-popover"]')
  await expect(popover).toBeVisible()
  await expect(popover.locator('[role="dialog"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)
  await expect(page.locator('[data-fixture="composer-input"]')).toBeFocused()
})

test('keyboard traversal reaches pane controls with accessible names', async ({ page }) => {
  await openStatusFlow(page, '?width=960')
  await submitCommand(page, '/status tokens')
  const pane = insightsPane(page, 'sess_a')
  await expect(pane).toContainText('fixture-alpha-chat')

  // The host focuses the pane on open; Tab walks the context bar actions.
  await pane.locator('[data-dsh-insights-switch-target]').focus()
  await expect(pane.locator('[data-dsh-insights-switch-target]')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(pane.locator('[data-dsh-insights-refresh]')).toBeFocused()
  await page.keyboard.press('Tab')
  // Scope navigation pills follow.
  const scopePill = pane.locator('.tui-scope').first()
  await expect(scopePill).toBeFocused()
  // Every focusable control in the pane exposes an accessible name.
  for (const control of await pane.locator('button, input, select, [tabindex]:not([tabindex="-1"])').all()) {
    if (!await control.isVisible()) continue
    const name = await control.getAttribute('aria-label') ?? await control.innerText().catch(() => '')
    expect(`${name}`.trim().length, 'control has an accessible name').toBeGreaterThan(0)
  }
})

test('coarse pointer keeps 44px touch targets and reduced motion stays off', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1200, height: 900 },
    reducedMotion: 'reduce',
    baseURL: 'http://127.0.0.1:4178',
  })
  try {
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }] })
    await openStatusFlow(page, '?width=560')
    await submitCommand(page, '/status tokens')
    const pane = insightsPane(page, 'sess_a')
    await expect(pane).toContainText('fixture-alpha-chat')
    await expect(pane.locator('[data-dsh-token-usage-insights]')).toHaveCSS('animation-name', 'none')
    for (const button of await pane.locator('button:visible').all()) {
      const box = await button.boundingBox()
      expect(box, `touch target ${await button.innerText()}`).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.width).toBeGreaterThanOrEqual(44)
    }
  } finally {
    await context.close()
  }
})

test('200% zoom keeps the statistics controls visible', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await openStatusFlow(page, '?width=560')
  await submitCommand(page, '/status tokens')
  const pane = insightsPane(page, 'sess_a')
  await expect(pane).toContainText('fixture-alpha-chat')
  await page.evaluate(() => { document.body.style.zoom = '2' })
  await expect(pane.locator('[data-dsh-insights-refresh]')).toBeVisible()
  await expect(pane.locator('[data-dsh-insights-switch-target]')).toBeVisible()
  await expect(pane.locator('[data-insights-requests] .tui-locate')).toBeVisible()
})

test('plugin styles stay scoped: no leakage onto the adjacent fixture element or the page', async ({ page }) => {
  await openStatusFlow(page, '?width=960&locale=zh')
  await submitCommand(page, '/status tokens')
  const pane = insightsPane(page, 'sess_a')
  await expect(pane).toContainText('会话统计')

  const neighbor = page.locator('#fixture-neighbor')
  await expect(neighbor).toHaveCSS('background-color', 'rgb(9, 20, 30)')
  await expect(neighbor).toHaveCSS('color', 'rgb(200, 210, 220)')
  await expect(neighbor).toHaveCSS('font-size', '15px')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 17, 19)')

  // Every stylesheet rule the plugin injected is scoped under its own
  // [data-dsh-*] / [data-yeisme-surface] roots (recursing into media blocks).
  const unscoped = await page.evaluate(() => {
    const roots = document.querySelectorAll('.sf-pane style')
    const bad: string[] = []
    const visit = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          if (!rule.selectorText.includes('[data-dsh-') && !rule.selectorText.includes('[data-yeisme-surface]')) {
            bad.push(rule.selectorText)
          }
        } else if ('cssRules' in rule) {
          visit((rule as CSSGroupingRule).cssRules)
        }
      }
    }
    for (const style of Array.from(roots)) visit((style as HTMLStyleElement).sheet?.cssRules ?? ([] as unknown as CSSRuleList))
    return bad
  })
  expect(unscoped).toEqual([])
})

// --- Responsive baselines (new spec; new snapshots only) ---

for (const width of [360, 560, 960] as const) {
  test(`status statistics pane ${width}px`, async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    await page.setViewportSize({ width: 1200, height: 900 })
    await openStatusFlow(page, `?width=${width}`)
    await submitCommand(page, '/status tokens')
    const pane = insightsPane(page, 'sess_a')
    await expect(pane).toContainText('fixture-alpha-chat')
    await expectWithinFrame(page, pane)
    await expect(page.locator('.fixture-frame')).toHaveScreenshot(`status-flow-pane-${width}.png`)
    expect(consoleErrors).toEqual([])
  })
}

test('status summary popover 560px', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await openStatusFlow(page, '?width=560')
  await submitCommand(page, '/status')
  await expect(page.locator('[data-fixture="status-popover"]')).toContainText('Fixture Session A')
  await expect(page.locator('.fixture-frame')).toHaveScreenshot('status-flow-popover-560.png')
})

test('two session panes side by side 960px', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await openStatusFlow(page, '?width=960')
  await submitCommand(page, '/status tokens')
  await expect(insightsPane(page, 'sess_a')).toContainText('fixture-alpha-chat')
  await page.locator('[data-session-tab="sess_b"]').click()
  await submitCommand(page, '/status tokens')
  await expect(insightsPane(page, 'sess_b')).toContainText('fixture-beta-reasoner')
  await expect(page.locator('.fixture-frame')).toHaveScreenshot('status-flow-dual-960.png')
})

test('zh statistics pane 560px', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await openStatusFlow(page, '?width=560&locale=zh')
  await submitCommand(page, '/status tokens')
  await expect(insightsPane(page, 'sess_a')).toContainText('会话统计')
  await expect(page.locator('.fixture-frame')).toHaveScreenshot('status-flow-zh-560.png')
})

test('legacy process view on an old host 560px', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await openStatusFlow(page, '?width=560&host=old')
  await submitCommand(page, '/status tokens')
  await expect(insightsPane(page, 'sess_a').locator('[data-legacy-tag]')).toHaveText('Legacy process-observed statistics')
  await expect(page.locator('.fixture-frame')).toHaveScreenshot('status-flow-legacy-560.png')
})
