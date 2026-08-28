import { describe, expect, it } from 'vitest'
import {
  clampRegion,
  fromNormalized,
  pixelOffsetToNormalized,
  pointInRegion,
  roundTripRegion,
  toNormalized,
} from '../../src/client/image-region.ts'

const NATURAL = { width: 2000, height: 1000 }

describe('normalized image coordinates', () => {
  it('round-trips pixel rects through normalization', () => {
    const region = toNormalized({ x: 400, y: 250, width: 600, height: 300 }, NATURAL)
    expect(region).toEqual({ x: 0.2, y: 0.25, width: 0.3, height: 0.3 })
    const pixels = fromNormalized(region, { width: 800, height: 400 })
    expect(pixels).toEqual({ x: 160, y: 100, width: 240, height: 120 })
  })

  it('keeps markers aligned across zoom factors and high DPI', () => {
    const region = toNormalized({ x: 1000, y: 500, width: 200, height: 100 }, NATURAL)
    // 100% / 250% / 400% 显示尺寸下，投影到像素再回来都回到同一区域。
    expect(roundTripRegion(region, { width: 2000, height: 1000 })).toEqual(region)
    expect(roundTripRegion(region, { width: 5000, height: 2500 })).toEqual(region)
    expect(roundTripRegion(region, { width: 8000, height: 4000 })).toEqual(region)
    // 高 DPI：CSS 800px 显示的是 1600 物理像素，归一化值不变。
    expect(roundTripRegion(region, { width: 800, height: 400 })).toEqual(region)
    expect(roundTripRegion(region, { width: 1600, height: 800 })).toEqual(region)
  })

  it('clamps out-of-bounds regions without distorting the origin', () => {
    expect(clampRegion({ x: -0.2, y: 0.5, width: 0.9, height: 2 })).toEqual({ x: 0, y: 0.5, width: 0.9, height: 0.5 })
    expect(clampRegion({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 })).toEqual({ x: 0.9, y: 0.9, width: 0.1, height: 0.1 })
  })

  it('hit-tests points inside and outside a region', () => {
    const region = { x: 0.2, y: 0.2, width: 0.3, height: 0.3 }
    expect(pointInRegion(region, { x: 0.35, y: 0.35 })).toBe(true)
    expect(pointInRegion(region, { x: 0.1, y: 0.35 })).toBe(false)
  })

  it('converts pointer offsets into clamped normalized coordinates', () => {
    const point = pixelOffsetToNormalized(-50, 1200, { width: 1000, height: 600 })
    expect(point).toEqual({ x: 0, y: 1 })
  })

  it('rejects degenerate sizes', () => {
    expect(() => toNormalized({ x: 0, y: 0, width: 1, height: 1 }, { width: 0, height: 10 })).toThrow()
    expect(() => fromNormalized({ x: 0, y: 0, width: 0.5, height: 0.5 }, { width: Number.NaN, height: 1 })).toThrow()
  })
})
