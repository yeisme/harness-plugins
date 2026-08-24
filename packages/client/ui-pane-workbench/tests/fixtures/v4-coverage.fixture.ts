/**
 * V4 Fixture Matrix Coverage
 *
 * Dimension coverage for DSH Pane Workspace Interaction V4 testing.
 * This module exports fixture generators and constants for comprehensive testing.
 *
 * Dimensions:
 * - Viewport: 1440px (desktop), 1024px (laptop), 768px (tablet), 390px (mobile)
 * - Locale: zh (Chinese), en (English), pseudo-long (text expansion), pseudo-RTL (RTL simulation)
 * - Motion: full, reduced
 * - Data scale: 10k tree nodes, 2k changed files, 50+ tabs
 * - States: dirty, deny close, offline, gap, revision drift
 */

// Viewport dimensions (width × height)
export const VIEWPORT_DESKTOP = { width: 1440, height: 900 }
export const VIEWPORT_LAPTOP = { width: 1024, height: 768 }
export const VIEWPORT_TABLET = { width: 768, height: 1024 }
export const VIEWPORT_MOBILE = { width: 390, height: 844 }

// Locale variants
export const LOCALE_ZH = 'zh'
export const LOCALE_EN = 'en'
export const LOCALE_PSEUDO_LONG = 'pseudo-long'  // Text expansion simulation (~200%)
export const LOCALE_PSEUDO_RTL = 'pseudo-rtl'    // RTL simulation for layout testing

// Motion preferences
export const MOTION_FULL = 'full'
export const MOTION_REDUCED = 'reduced'

// Data scale fixtures
export const TREE_NODE_COUNT_SMALL = 100
export const TREE_NODE_COUNT_MEDIUM = 1000
export const TREE_NODE_COUNT_LARGE = 10000  // Target for virtualization testing

export const CHANGED_FILE_COUNT_SMALL = 50
export const CHANGED_FILE_COUNT_MEDIUM = 500
export const CHANGED_FILE_COUNT_LARGE = 2000  // Target for virtualization testing

export const TAB_COUNT_SMALL = 10
export const TAB_COUNT_MEDIUM = 30
export const TAB_COUNT_LARGE = 50  // Target for overflow testing

// State fixtures for Tab lifecycle testing
export const TAB_STATE_CLEAN = 'clean'
export const TAB_STATE_DIRTY = 'dirty'
export const TAB_STATE_PREVIEW = 'preview'
export const TAB_STATE_PINNED = 'pinned'
export const TAB_STATE_OFFLINE = 'offline'
export const TAB_STATE_ORPHANED = 'orphaned'
export const TAB_STATE_DENY_CLOSE = 'deny-close'
export const TAB_STATE_CONFLICT = 'conflict'

// Git decoration fixtures
export const GIT_DECORATION_NONE = null
export const GIT_DECORATION_MODIFIED = 'modified'
export const GIT_DECORATION_ADDED = 'added'
export const GIT_DECORATION_DELETED = 'deleted'
export const GIT_DECORATION_CONFLICT = 'conflict'
export const GIT_DECORATION_STAGED = 'staged'
export const GIT_DECORATION_IGNORED = 'ignored'

// Drag and drop states
export const DRAG_STATE_IDLE = 'idle'
export const DRAG_STATE_PENDING = 'pending'
export const DRAG_STATE_DRAGGING = 'dragging'
export const DRAG_STATE_COMMITTING = 'committing'
export const DRAG_STATE_CANCELLING = 'cancelling'

/**
 * Generates tree nodes for testing explorer performance.
 * Creates hierarchical file structure with configurable depth and breadth.
 */
export function generateTreeNodes(
  count: number,
  options: {
    maxDepth?: number
    childrenPerNode?: number
    namePrefix?: string
  } = {}
): string[] {
  const {
    maxDepth = 4,
    childrenPerNode = 5,
    namePrefix = 'file'
  } = options

  const nodes: string[] = []
  let generated = 0

  function generateLevel(depth: number, parentPath: string) {
    if (depth >= maxDepth || generated >= count) return

    const childrenAtLevel = Math.min(childrenPerNode, count - generated)
    for (let i = 0; i < childrenAtLevel && generated < count; i++) {
      const name = `${namePrefix}-${depth}-${i}`
      const path = parentPath ? `${parentPath}/${name}` : name
      nodes.push(path)
      generated++

      if (depth < maxDepth - 1 && generated < count) {
        generateLevel(depth + 1, path)
      }
    }
  }

  generateLevel(0, '')
  return nodes
}

/**
 * Generates changed file entries for Source Control testing.
 * Supports staged/unstaged/untracked categorization.
 */
export function generateChangedFiles(
  count: number,
  distribution: {
    staged?: number
    unstaged?: number
    untracked?: number
  } = {}
): Array<{ path: string; status: string }> {
  const {
    staged = Math.floor(count * 0.2),
    unstaged = Math.floor(count * 0.6),
    untracked = Math.floor(count * 0.2)
  } = distribution

  const files: Array<{ path: string; status: string }> = []
  let index = 0

  for (let i = 0; i < staged && index < count; i++, index++) {
    files.push({ path: `src/modified-${index}.ts`, status: 'staged' })
  }

  for (let i = 0; i < unstaged && index < count; i++, index++) {
    files.push({ path: `src/changed-${index}.ts`, status: 'unstaged' })
  }

  for (let i = 0; i < untracked && index < count; i++, index++) {
    files.push({ path: `src/new-${index}.ts`, status: 'untracked' })
  }

  return files
}

/**
 * Generates Tab fixtures for overflow and lifecycle testing.
 * Supports pinned/dirty/preview states with proper distribution.
 */
export function generateTabs(
  count: number,
  options: {
    pinnedCount?: number
    dirtyCount?: number
    previewCount?: number
  } = {}
): Array<{ id: string; title: string; state: string }> {
  const {
    pinnedCount = Math.min(5, Math.floor(count * 0.1)),
    dirtyCount = Math.floor(count * 0.3),
    previewCount = 1  // Only one preview tab at a time
  } = options

  const tabs: Array<{ id: string; title: string; state: string }> = []

  // Add pinned tabs first
  for (let i = 0; i < pinnedCount; i++) {
    tabs.push({
      id: `tab-pinned-${i}`,
      title: `Pinned Tab ${i}`,
      state: TAB_STATE_PINNED
    })
  }

  // Add preview tab
  tabs.push({
    id: 'tab-preview',
    title: 'Preview Tab',
    state: TAB_STATE_PREVIEW
  })

  // Add dirty tabs
  for (let i = 0; i < dirtyCount; i++) {
    tabs.push({
      id: `tab-dirty-${i}`,
      title: `Dirty Tab ${i}`,
      state: TAB_STATE_DIRTY
    })
  }

  // Fill remaining with clean tabs
  let filled = tabs.length
  for (let i = filled; i < count; i++) {
    tabs.push({
      id: `tab-clean-${i}`,
      title: `Clean Tab ${i}`,
      state: TAB_STATE_CLEAN
    })
  }

  return tabs
}

/**
 * Viewport test matrix for responsive design validation.
 * Each entry defines dimensions and expected layout behavior.
 */
export const VIEWPORT_TEST_MATRIX = [
  {
    name: 'desktop',
    dimensions: VIEWPORT_DESKTOP,
    expectations: {
      rightVisible: true,
      bottomVisible: true,
      designerColumns: 3,
      tabMinWidth: 136,
      touchTargets: 28
    }
  },
  {
    name: 'laptop',
    dimensions: VIEWPORT_LAPTOP,
    expectations: {
      rightVisible: true,
      bottomVisible: true,
      designerColumns: 3,
      tabMinWidth: 136,
      touchTargets: 28
    }
  },
  {
    name: 'tablet',
    dimensions: VIEWPORT_TABLET,
    expectations: {
      rightVisible: true,
      bottomVisible: false,  // Only one auxiliary region
      designerColumns: 2,   // Palette/Inspector collapsible
      tabMinWidth: 136,
      touchTargets: 44
    }
  },
  {
    name: 'mobile',
    dimensions: VIEWPORT_MOBILE,
    expectations: {
      rightVisible: false,
      bottomVisible: false,
      designerColumns: 1,    // Single-step wizard
      tabMinWidth: 88,
      touchTargets: 44
    }
  }
]

/**
 * Locale test matrix for i18n validation.
 * Tests text expansion, RTL, and character sets.
 */
export const LOCALE_TEST_MATRIX = [
  {
    locale: LOCALE_EN,
    description: 'English baseline',
    textExpansionFactor: 1.0
  },
  {
    locale: LOCALE_ZH,
    description: 'Chinese character set',
    textExpansionFactor: 0.6  // Chinese is typically more compact
  },
  {
    locale: LOCALE_PSEUDO_LONG,
    description: 'Text expansion simulation (~200%)',
    textExpansionFactor: 2.0
  },
  {
    locale: LOCALE_PSEUDO_RTL,
    description: 'RTL layout simulation',
    textExpansionFactor: 1.0,
    isRTL: true
  }
]

/**
 * Motion test matrix for animation and reduced-motion validation.
 */
export const MOTION_TEST_MATRIX = [
  {
    preference: MOTION_FULL,
    description: 'Full motion - all animations enabled',
    expectedAnimations: ['ghost-flight', 'flip', 'tab-reorder', 'region-open-close']
  },
  {
    preference: MOTION_REDUCED,
    description: 'Reduced motion - instant transitions only',
    expectedAnimations: [],
    skipAnimations: true
  }
]

/**
 * Combines multiple test matrices for comprehensive fixture generation.
 */
export function generateTestFixtureMatrix(): Array<{
  viewport: typeof VIEWPORT_TEST_MATRIX[number]
  locale: typeof LOCALE_TEST_MATRIX[number]
  motion: typeof MOTION_TEST_MATRIX[number]
  dataScale: {
    treeNodes: number
    changedFiles: number
    tabs: number
  }
}> {
  const fixtures: Array<{
    viewport: typeof VIEWPORT_TEST_MATRIX[number]
    locale: typeof LOCALE_TEST_MATRIX[number]
    motion: typeof MOTION_TEST_MATRIX[number]
    dataScale: { treeNodes: number; changedFiles: number; tabs: number }
  }> = []

  // Critical combinations for focused testing
  const criticalCombos = [
    {
      viewport: VIEWPORT_TEST_MATRIX[0],  // desktop
      locale: LOCALE_TEST_MATRIX[0],      // en
      motion: MOTION_TEST_MATRIX[0],      // full
      dataScale: { treeNodes: TREE_NODE_COUNT_MEDIUM, changedFiles: CHANGED_FILE_COUNT_MEDIUM, tabs: TAB_COUNT_MEDIUM }
    },
    {
      viewport: VIEWPORT_TEST_MATRIX[3],  // mobile
      locale: LOCALE_TEST_MATRIX[1],      // zh
      motion: MOTION_TEST_MATRIX[1],      // reduced
      dataScale: { treeNodes: TREE_NODE_COUNT_SMALL, changedFiles: CHANGED_FILE_COUNT_SMALL, tabs: TAB_COUNT_SMALL }
    },
    {
      viewport: VIEWPORT_TEST_MATRIX[0],  // desktop
      locale: LOCALE_TEST_MATRIX[2],      // pseudo-long
      motion: MOTION_TEST_MATRIX[0],      // full
      dataScale: { treeNodes: TREE_NODE_COUNT_LARGE, changedFiles: CHANGED_FILE_COUNT_LARGE, tabs: TAB_COUNT_LARGE }
    },
    {
      viewport: VIEWPORT_TEST_MATRIX[3],  // mobile
      locale: LOCALE_TEST_MATRIX[3],      // pseudo-RTL
      motion: MOTION_TEST_MATRIX[1],      // reduced
      dataScale: { treeNodes: TREE_NODE_COUNT_SMALL, changedFiles: CHANGED_FILE_COUNT_SMALL, tabs: TAB_COUNT_SMALL }
    }
  ]

  fixtures.push(...criticalCombos)
  return fixtures
}
