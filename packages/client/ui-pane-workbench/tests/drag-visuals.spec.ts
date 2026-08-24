// @vitest-environment jsdom
/**
 * V4 Task 3.6: Drag Visuals Tests
 *
 * Tests for shared ghost portal, source placeholder, insertion marker,
 * edge zones, hysteresis and pointermove optimization.
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import {
  DragGhost,
  DragPlaceholder,
  InsertionMarker,
  EdgeZone,
  type DragGhostProps,
  type DragPlaceholderProps,
  type InsertionMarkerProps,
  type EdgeZoneProps,
} from '../src/drag-visuals.js'

// Mock view for testing
const mockView = {
  id: 'view:test',
  kind: 'file.preview',
  resourceKey: 'file:test.ts',
  title: 'Test File',
  groupId: 'group:right:content',
  role: 'content' as const,
  preferredRegion: 'right',
  retention: 'snapshot' as const,
  singleton: false,
  preview: false,
  pinned: false,
  dirty: false,
  status: 'ready' as const,
  attention: false,
  offline: false,
}

describe('V4 Task 3.6: Drag Visuals Components', () => {
  describe('DragGhost', () => {
    it('renders ghost when dragging', () => {
      const props: DragGhostProps = {
        view: mockView,
        x: 100,
        y: 200,
        isDragging: true,
      }

      const { container } = render(createElement(DragGhost, props))
      const ghost = container.querySelector('[data-pane-drag-ghost="true"]')

      expect(ghost).toBeDefined()
      expect(ghost?.style.position).toBe('fixed')
      expect(ghost?.style.left).toBe('100px')
      expect(ghost?.style.top).toBe('200px')
      expect(ghost?.style.opacity).toBe('0.9')
    })

    it('does not render ghost when not dragging', () => {
      const props: DragGhostProps = {
        view: mockView,
        x: 100,
        y: 200,
        isDragging: false,
      }

      const { container } = render(createElement(DragGhost, props))
      const ghost = container.querySelector('[data-pane-drag-ghost="true"]')

      expect(ghost).toBeNull()
    })

    it('ghost contains view title but not view body', () => {
      const props: DragGhostProps = {
        view: mockView,
        x: 100,
        y: 200,
        isDragging: true,
      }

      const { container } = render(createElement(DragGhost, props))
      const ghost = container.querySelector('.pwr-tab-ghost')

      expect(ghost?.textContent).toBe('Test File')
    })
  })

  describe('DragPlaceholder', () => {
    it('renders placeholder when view is being dragged', () => {
      const props: DragPlaceholderProps = {
        viewId: 'view:test',
        isBeingDragged: true,
      }

      const { container } = render(createElement(DragPlaceholder, props))
      const placeholder = container.querySelector('[data-pane-drag-placeholder="view:test"]')

      expect(placeholder).toBeDefined()
      expect(placeholder?.style.opacity).toBe('0.45')
      expect(placeholder?.style.pointerEvents).toBe('none')
    })

    it('does not render placeholder when not dragging', () => {
      const props: DragPlaceholderProps = {
        viewId: 'view:test',
        isBeingDragged: false,
      }

      const { container } = render(createElement(DragPlaceholder, props))
      const placeholder = container.querySelector('[data-pane-drag-placeholder]')

      expect(placeholder).toBeNull()
    })
  })

  describe('InsertionMarker', () => {
    it('renders center insertion marker when enabled', () => {
      const props: InsertionMarkerProps = {
        groupId: 'group:right:content',
        enabled: true,
        edge: 'center',
        index: 1,
      }

      const { container } = render(createElement(InsertionMarker, props))
      const marker = container.querySelector('[data-pane-insertion-marker="center"]')

      expect(marker).toBeDefined()
      expect(marker?.getAttribute('data-pane-insertion-marker-enabled')).toBe('true')
    })

    it('does not render when not center edge', () => {
      const props: InsertionMarkerProps = {
        groupId: 'group:right:content',
        enabled: true,
        edge: 'right',
      }

      const { container } = render(createElement(InsertionMarker, props))
      const marker = container.querySelector('[data-pane-insertion-marker]')

      expect(marker).toBeNull()
    })

    it('does not render when disabled', () => {
      const props: InsertionMarkerProps = {
        groupId: 'group:right:content',
        enabled: false,
        edge: 'center',
        index: 1,
      }

      const { container } = render(createElement(InsertionMarker, props))
      const marker = container.querySelector('[data-pane-insertion-marker="center"]')

      expect(marker).toBeNull()
    })
  })

  describe('EdgeZone', () => {
    it('renders edge zone with enabled state', () => {
      const props: EdgeZoneProps = {
        groupId: 'group:right:content',
        edge: 'right',
        enabled: true,
      }

      const { container } = render(createElement(EdgeZone, props))
      const zone = container.querySelector('[data-pane-edge-zone="right"]')

      expect(zone).toBeDefined()
      expect(zone?.getAttribute('data-pane-edge-enabled')).toBe('true')
    })

    it('renders edge zone with disabled reason', () => {
      const props: EdgeZoneProps = {
        groupId: 'group:right:content',
        edge: 'right',
        enabled: false,
        reason: 'locked',
      }

      const { container } = render(createElement(EdgeZone, props))
      const zone = container.querySelector('[data-pane-edge-zone="right"]')

      expect(zone?.getAttribute('data-pane-edge-enabled')).toBe('false')
      expect(zone?.getAttribute('data-pane-edge-reason')).toBe('locked')
    })

    it('uses minimum 48px width for vertical edges', () => {
      const props: EdgeZoneProps = {
        groupId: 'group:right:content',
        edge: 'right',
        enabled: true,
      }

      const { container } = render(createElement(EdgeZone, props))
      const zone = container.querySelector('[data-pane-edge-zone="right"]') as HTMLElement

      expect(zone?.style.width).toBe('48px')
    })
  })
})

// Note: useDragGhostPortal and useDragHysteresis require a full React component context
// and are tested in integration tests with actual component rendering
// Hysteresis behavior (80ms stability threshold) is verified in browser integration tests
