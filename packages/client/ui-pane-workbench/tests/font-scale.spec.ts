// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  getWorkbenchFontSize,
  setWorkbenchFontSize,
  stepWorkbenchFontSize,
  WORKBENCH_FONT_SIZE_DEFAULT,
  WORKBENCH_FONT_SIZE_MAX,
  WORKBENCH_FONT_SIZE_MIN,
  WORKBENCH_FONT_SIZE_STORAGE_KEY,
} from '../src/font-scale.ts'

afterEach(() => {
  try { localStorage?.removeItem(WORKBENCH_FONT_SIZE_STORAGE_KEY) } catch { /* node without localStorage */ }
  setWorkbenchFontSize(WORKBENCH_FONT_SIZE_DEFAULT)
})

describe('workbench font scale', () => {
  it('clamps font size to 12-18px', () => {
    expect(setWorkbenchFontSize(8)).toBe(WORKBENCH_FONT_SIZE_MIN)
    expect(setWorkbenchFontSize(42)).toBe(WORKBENCH_FONT_SIZE_MAX)
    expect(getWorkbenchFontSize()).toBe(WORKBENCH_FONT_SIZE_MAX)
  })

  it('steps up and down by one pixel', () => {
    setWorkbenchFontSize(14)
    expect(stepWorkbenchFontSize(1)).toBe(15)
    expect(stepWorkbenchFontSize(-1)).toBe(14)
  })
})
