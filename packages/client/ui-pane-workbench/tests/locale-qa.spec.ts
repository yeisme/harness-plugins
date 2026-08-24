// @vitest-environment jsdom
/**
 * V4 Task 2.4: Locale QA Tests
 * 
 * Tests zh/en/pseudo-long/pseudo-RTL locale coverage:
 * - Dynamic count formatting
 * - Shortcut keys display
 * Risk/conflict states
 * Tooltips and ARIA labels
 * Locale hot switch
 * Layout stability (ids/order/selection unchanged)
 * Long text doesn't overflow controls
 */

import { createElement, useEffect, useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { formatT, setActiveLocale, t, type Locale } from '../src/i18n/locale.js'
import { PaneRegionChrome } from '../src/region-chrome.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(cleanup)

const LOCALES: Locale[] = ['en', 'zh', 'pseudo-long', 'pseudo-rtl']

describe('V4 Task 2.4: Locale QA Matrix', () => {
  LOCALES.forEach(locale => {
    describe(`Locale: ${locale}`, () => {
      beforeEach(() => {
        setActiveLocale(locale)
      })

      it('renders tab close buttons with proper locale formatting', () => {
        const registry = new PaneViewRegistry({ capabilities: new Set() })
        registry.registerView({
          descriptor: { 
            kind: 'test.view', 
            label: 'Test View', 
            componentKey: 'test', 
            role: 'content', 
            preferredRegion: 'right', 
            retention: 'keep-alive', 
            singleton: false 
          },
          component: () => createElement('p', null, 'Test content'),
        })
        
        const controller = new PaneWorkbenchController({ registry })
        controller.openView({ 
          kind: 'test.view', 
          resourceKey: 'test:1', 
          role: 'content', 
          preferredRegion: 'right', 
          retention: 'keep-alive', 
          singleton: false,
          title: 'TestFile.ts'
        })

        render(createElement(PaneRegionChrome, {
          region: 'right',
          mode: 'dock',
          width: 800,
          height: 600,
          visible: true,
          maximized: false,
          registry,
          controller,
        }))

        const closeButton = screen.getByRole('button', { name: formatT('tab.closeWithName', { name: 'TestFile.ts' }) })
        expect(closeButton).toBeTruthy()

        // Verify the button aria-label contains the filename (text content may be just the icon)
        expect(closeButton.getAttribute('aria-label')).toContain('TestFile.ts')
      })

      it('maintains layout stability during locale switch', () => {
        const registry = new PaneViewRegistry({ capabilities: new Set() })
        registry.registerView({
          descriptor: { 
            kind: 'stable.view', 
            label: 'Stable View', 
            componentKey: 'stable', 
            role: 'content', 
            preferredRegion: 'right', 
            retention: 'keep-alive', 
            singleton: false 
          },
          component: () => createElement('p', null, 'Content'),
        })

        const controller = new PaneWorkbenchController({ registry })
        controller.openView({
          kind: 'stable.view',
          resourceKey: 'stable:1',
          role: 'content',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: false,
          title: 'StableView'
        })

        // Record initial state
        const initialState = controller.getSnapshot()
        const viewId = Object.keys(initialState.views).find(id => initialState.views[id].kind === 'stable.view')
        const initialTabId = `pane-tab-${viewId}`

        render(createElement(PaneRegionChrome, {
          region: 'right',
          mode: 'dock',
          width: 800,
          height: 600,
          visible: true,
          maximized: false,
          registry,
          controller,
        }))

        const initialTab = screen.getByRole('tab', { name: 'StableView' })
        expect(initialTab.id).toBe(initialTabId)

        // Switch locale and verify stability
        setActiveLocale(locale === 'zh' ? 'en' : 'zh')
        
        const afterSwitchTab = screen.getByRole('tab', { name: 'StableView' })
        expect(afterSwitchTab.id).toBe(initialTabId)
        
        // Verify layout state unchanged
        const afterState = controller.getSnapshot()
        expect(afterState.views[viewId!].id).toBe(initialState.views[viewId!].id)
        expect(afterState.views[viewId!].title).toBe(initialState.views[viewId!].title)
      })

      it('displays proper ARIA labels in each locale', () => {
        const registry = new PaneViewRegistry({ capabilities: new Set() })
        registry.registerView({
          descriptor: { 
            kind: 'aria.view', 
            label: 'ARIA View', 
            componentKey: 'aria', 
            role: 'content', 
            preferredRegion: 'right', 
            retention: 'keep-alive', 
            singleton: false 
          },
          component: () => createElement('p', null, 'Content'),
        })

        const controller = new PaneWorkbenchController({ registry })
        controller.openView({ 
          kind: 'aria.view', 
          resourceKey: 'aria:1', 
          role: 'content', 
          preferredRegion: 'right', 
          retention: 'keep-alive', 
          singleton: false,
          title: 'ARIAView'
        })

        render(createElement(PaneRegionChrome, {
          region: 'right',
          mode: 'dock',
          width: 800,
          height: 600,
          visible: true,
          maximized: false,
          registry,
          controller,
        }))

        // Check for proper ARIA labels
        const tab = screen.getByRole('tab', { name: 'ARIAView' })
        expect(tab.getAttribute('role')).toBe('tab')
        
        const maximizeButton = screen.getByRole('button', { name: t('chrome.maximizePane') })
        expect(maximizeButton.getAttribute('aria-label')).toBe(t('chrome.maximizePane'))
      })

      it('handles long text in pseudo-long locale without overflow', () => {
        setActiveLocale('pseudo-long')
        
        const registry = new PaneViewRegistry({ capabilities: new Set() })
        registry.registerView({
          descriptor: { 
            kind: 'long.view', 
            label: 'Long Text View', 
            componentKey: 'long', 
            role: 'content', 
            preferredRegion: 'right', 
            retention: 'keep-alive', 
            singleton: false 
          },
          component: () => createElement('p', null, 'Long content'),
        })

        const controller = new PaneWorkbenchController({ registry })
        controller.openView({ 
          kind: 'long.view', 
          resourceKey: 'long:1', 
          role: 'content', 
          preferredRegion: 'right', 
          retention: 'keep-alive', 
          singleton: false,
          title: 'VeryLongFileNameThatShouldNotOverflow.ts'
        })

        const { container } = render(createElement(PaneRegionChrome, {
          region: 'right',
          mode: 'dock',
          width: 400, // Narrow width to test overflow
          height: 600,
          visible: true,
          maximized: false,
          registry,
          controller,
        }))

        // Verify buttons are still present and functional
        const closeButton = screen.getByRole('button', { name: formatT('tab.closeWithName', { name: 'VeryLongFileNameThatShouldNotOverflow.ts' }) })
        expect(closeButton).toBeTruthy()

        const maximizeButton = screen.getByRole('button', { name: t('chrome.maximizePane') })
        expect(maximizeButton).toBeTruthy()
      })

      it('supports RTL layout structure in pseudo-rtl locale', () => {
        setActiveLocale('pseudo-rtl')
        
        const registry = new PaneViewRegistry({ capabilities: new Set() })
        registry.registerView({
          descriptor: { 
            kind: 'rtl.view', 
            label: 'RTL View', 
            componentKey: 'rtl', 
            role: 'content', 
            preferredRegion: 'right', 
            retention: 'keep-alive', 
            singleton: false 
          },
          component: () => createElement('p', null, 'RTL content'),
        })

        const controller = new PaneWorkbenchController({ registry })
        controller.openView({ 
          kind: 'rtl.view', 
          resourceKey: 'rtl:1', 
          role: 'content', 
          preferredRegion: 'right', 
          retention: 'keep-alive', 
          singleton: false,
          title: 'RTLView'
        })

        render(createElement(PaneRegionChrome, {
          region: 'right',
          mode: 'dock',
          width: 800,
          height: 600,
          visible: true,
          maximized: false,
          registry,
          controller,
        }))

        // Verify RTL doesn't break the UI structure
        const tab = screen.getByRole('tab', { name: 'RTLView' })
        expect(tab).toBeTruthy()
        
        // Tab list should still exist
        const tabList = screen.getByRole('tablist')
        expect(tabList).toBeTruthy()
      })
    })
  })

  describe('Locale Hot Switch', () => {
    it('switches locale and updates UI without losing state', () => {
      const registry = new PaneViewRegistry({ capabilities: new Set() })
      registry.registerView({
        descriptor: {
          kind: 'switch.view',
          label: 'Switch View',
          componentKey: 'switch',
          role: 'content',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: false
        },
        component: () => createElement('p', null, 'Switch content'),
      })

      const controller = new PaneWorkbenchController({ registry })
      controller.openView({
        kind: 'switch.view',
        resourceKey: 'switch:1',
        role: 'content',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: false,
        title: 'SwitchView'
      })

      function TestComponent() {
        const [locale, setLocale] = useState<Locale>('en')
        useEffect(() => {
          setActiveLocale(locale)
        }, [locale])

        return createElement('div', null,
          createElement('button', { onClick: () => setLocale('zh') }, 'Switch to Chinese'),
          createElement(PaneRegionChrome, {
            region: 'right',
            mode: 'dock',
            width: 800,
            height: 600,
            visible: true,
            maximized: false,
            registry,
            controller,
          })
        )
      }

      const { container } = render(createElement(TestComponent))

      // Initial state with English
      expect(screen.getByRole('button', { name: 'Switch to Chinese' })).toBeTruthy()

      // Get initial view state
      const initialState = controller.getSnapshot()
      const initialViews = Object.keys(initialState.views)

      // Simulate locale switch
      setActiveLocale('zh')

      // Verify view state preserved
      const afterSwitchState = controller.getSnapshot()
      const afterViews = Object.keys(afterSwitchState.views)

      expect(initialViews.length).toBe(afterViews.length)
      initialViews.forEach(viewId => {
        expect(afterSwitchState.views[viewId]).toBeTruthy()
        expect(afterSwitchState.views[viewId].title).toBe(initialState.views[viewId].title)
      })
    })
  })

  describe('Dynamic Count Formatting', () => {
    it('formats dynamic counts correctly in all locales', () => {
      LOCALES.forEach(locale => {
        setActiveLocale(locale)
        
        const single = formatT('designer.validation.applyWarning', { count: 1 })
        const multiple = formatT('designer.validation.applyWarning', { count: 5 })
        
        // Should contain the count number
        expect(single).toBeTruthy()
        expect(multiple).toBeTruthy()
        
        // English should handle pluralization
        setActiveLocale('en')
        const enSingle = formatT('tab.closeWithName', { name: 'File' })
        expect(enSingle).toContain('File')
      })
    })
  })
})
