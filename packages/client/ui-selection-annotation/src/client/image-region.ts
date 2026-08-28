/**
 * 图像归一化坐标运算。截图锚点只保存 0..1 的归一化值；CSS 像素只存在于
 * 瞬时交互层，缩放、窗口变化或高 DPI 显示时标记仍然对齐原区域。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import type { ImageRegionV1 } from '@yeisme/dsh-selection-host'

export interface PixelSize {
  readonly width: number
  readonly height: number
}

export interface PixelRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

function finitePositive(size: PixelSize): boolean {
  return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0
}

/** Convert a pixel rect on the natural image into a normalized 0..1 region. */
export function toNormalized(rect: PixelRect, natural: PixelSize): ImageRegionV1 {
  if (!finitePositive(natural)) throw new Error('natural size must be finite and positive')
  const width = rect.width < 0 ? 0 : rect.width
  const height = rect.height < 0 ? 0 : rect.height
  return clampRegion({
    x: rect.x / natural.width,
    y: rect.y / natural.height,
    width: width / natural.width,
    height: height / natural.height,
  })
}

/** Convert a normalized region into a pixel rect on the current display size. */
export function fromNormalized(region: ImageRegionV1, display: PixelSize): PixelRect {
  if (!finitePositive(display)) throw new Error('display size must be finite and positive')
  return {
    x: region.x * display.width,
    y: region.y * display.height,
    width: region.width * display.width,
    height: region.height * display.height,
  }
}

/** Clamp every component into 0..1 without distorting the region origin. */
export function clampRegion(region: ImageRegionV1): ImageRegionV1 {
  // 12 位小数舍入吸收 1 - 0.9 类浮点噪声，保持坐标可比较。
  const round = (value: number): number => Math.round(value * 1e12) / 1e12
  const clampUnit = (value: number): number => {
    if (!Number.isFinite(value)) return 0
    if (value < 0) return 0
    if (value > 1) return 1
    return round(value)
  }
  const x = clampUnit(region.x)
  const y = clampUnit(region.y)
  return {
    x,
    y,
    width: round(Math.min(clampUnit(region.width), round(1 - x))),
    height: round(Math.min(clampUnit(region.height), round(1 - y))),
  }
}

export interface NormalizedPoint {
  readonly x: number
  readonly y: number
}

export function pointInRegion(region: ImageRegionV1, point: NormalizedPoint): boolean {
  return point.x >= region.x && point.x <= region.x + region.width
    && point.y >= region.y && point.y <= region.y + region.height
}

export function regionCenter(region: ImageRegionV1): NormalizedPoint {
  return { x: region.x + region.width / 2, y: region.y + region.height / 2 }
}

/**
 * The zoom/DPI alignment invariant: normalized coordinates never depend on the
 * display size, so projecting to pixels and back at any display size returns
 * the same region.
 */
export function roundTripRegion(region: ImageRegionV1, display: PixelSize): ImageRegionV1 {
  return toNormalized(fromNormalized(region, display), display)
}

/** Convert a pointer event offset on a displayed image into normalized coords. */
export function pixelOffsetToNormalized(offsetX: number, offsetY: number, display: PixelSize): NormalizedPoint {
  if (!finitePositive(display)) throw new Error('display size must be finite and positive')
  return {
    x: Math.min(Math.max(offsetX / display.width, 0), 1),
    y: Math.min(Math.max(offsetY / display.height, 0), 1),
  }
}
