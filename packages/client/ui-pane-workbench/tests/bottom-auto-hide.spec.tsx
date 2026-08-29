// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { PaneRegionChrome, REGION_STYLES } from '../src/region-chrome.js'
import { setActiveLocale } from '../src/i18n/locale.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(() => { setActiveLocale('en'); cleanup() })

function bottomFixture() {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: {
      kind: 'test.bottom',
      label: 'Bottom tool',
      componentKey: 'bottom-tool',
      role: 'utility',
      preferredRegion: 'bottom',
      retention: 'recreate',
      singleton: false,
    },
    component: () => createElement('p', null, 'Bottom tool content'),
  })
  const controller = new PaneWorkbenchController({ registry })
  controller.openView({
    kind: 'test.bottom',
    resourceKey: 'test:bottom',
    role: 'utility',
    preferredRegion: 'bottom',
    retention: 'recreate',
    singleton: false,
    title: 'Bottom tool',
  })
  return { registry, controller }
}

describe('Bottom workspace chrome', () => {
  it('hides the Bottom workspace after its final view closes', async () => {
    const { registry, controller } = bottomFixture()
    render(createElement(PaneRegionChrome, {
      region: 'bottom',
      mode: 'dock',
      width: 900,
      height: 280,
      visible: true,
      maximized: false,
      registry,
      controller,
    }))
    expect(controller.getSnapshot().regions.bottom.visible).toBe(true)
    const view = Object.values(controller.getSnapshot().views).find(item => item.kind === 'test.bottom')
    expect(view).toBeTruthy()

    act(() => { controller.dispatch({ type: 'close_view', viewId: view!.id }) })

    await waitFor(() => expect(controller.getSnapshot().regions.bottom.visible).toBe(false))
  })

  it('uses the same 136px width and 34px height for regular and pinned tabs', () => {
    expect(REGION_STYLES).toContain('--pwr-tab-width:136px')
    expect(REGION_STYLES).toContain('--pwr-tab-height:34px')
    expect(REGION_STYLES).toContain('flex:0 0 var(--pwr-tab-width)')
    expect(REGION_STYLES).toContain('.pwr-tab-pinned{width:100%;min-width:0;max-width:none}')
  })
})
